const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs-extra');
const path = require('path');
const { config } = require('../config');
const FacebookPagesManager = require('../config/facebookPages');
const { logger } = require('../utils/logger');

class FacebookReelsService {
  constructor() {
    this.pagesManager = new FacebookPagesManager();
    this.baseURL = 'https://graph.facebook.com/v18.0';
    
    // ตัวแปรสำหรับเก็บสถานะการโพสต์
    this.currentJob = null;
    this.postingQueue = [];
  }

  // เพิ่มงานโพสต์เข้าคิว
  async queueReelsPosting(jobData) {
    try {
      const job = {
        id: Date.now().toString(),
        ...jobData,
        status: 'queued',
        createdAt: new Date(),
        pages: this.pagesManager.getEnabledPages(),
        currentPageIndex: 0,
        results: []
      };

      this.postingQueue.push(job);
      logger.info('Job added to posting queue:', { 
        jobId: job.id, 
        pagesCount: job.pages.length 
      });

      // เริ่มประมวลผลคิวหากไม่มีงานที่กำลังทำงานอยู่
      if (!this.currentJob) {
        await this.processQueue();
      }

      return job.id;
    } catch (error) {
      logger.error('Error queueing reels posting:', error);
      throw error;
    }
  }

  // ประมวลผลคิวการโพสต์
  async processQueue() {
    if (this.currentJob || this.postingQueue.length === 0) {
      return;
    }

    this.currentJob = this.postingQueue.shift();
    logger.info('Starting to process job:', { jobId: this.currentJob.id });

    try {
      await this.postToAllPages(this.currentJob);
    } catch (error) {
      logger.error('Error processing job:', error);
      this.currentJob.status = 'failed';
      this.currentJob.error = error.message;
    } finally {
      this.currentJob = null;
      
      // ประมวลผลงานถัดไปในคิว
      if (this.postingQueue.length > 0) {
        setTimeout(() => this.processQueue(), 1000);
      }
    }
  }

  // โพสต์ไปยังเพจทั้งหมดตามลำดับ - โพสต์แค่หนึ่งคลิปต่อหนึ่งเพจ
  async postToAllPages(job) {
    const { videoPath } = job;
    const enabledPages = this.pagesManager.getEnabledPages();
    job.status = 'processing';

    logger.info('Starting posting - ONE video per page only:', { 
      jobId: job.id, 
      totalEnabledPages: enabledPages.length 
    });

    // โพสต์แค่หนึ่งคลิปต่อหนึ่งเพจ หากไม่มีเพจที่สองให้หยุดการทำงาน
    for (let i = 0; i < enabledPages.length; i++) {
      const page = enabledPages[i];
      job.currentPageIndex = i;

      try {
        logger.info(`Posting to page ${i + 1}/${enabledPages.length}:`, { 
          pageId: page.pageId, 
          pageName: page.name 
        });

        const result = await this.postReelsToPage(videoPath, page);
        
        job.results.push({
          pageId: page.pageId,
          pageName: page.name,
          status: 'success',
          postId: result.id,
          timestamp: new Date()
        });

        logger.info(`Successfully posted to page:`, { 
          pageId: page.pageId, 
          postId: result.id 
        });

        // โพสต์แค่หนึ่งคลิปต่อหนึ่งเพจ - หยุดทันทีหลังจากโพสต์สำเร็จ
        logger.info(`Posted to one page successfully. Stopping as per requirement (one video per page).`);
        break; // หยุดการโพสต์ต่อ - ตามคำสั่งที่ระบุ

      } catch (error) {
        logger.error(`Error posting to page:`, { 
          pageId: page.pageId, 
          error: error.message 
        });

        job.results.push({
          pageId: page.pageId,
          pageName: page.name,
          status: 'failed',
          error: error.message,
          timestamp: new Date()
        });

        // ลองใหม่หากการโพสต์ล้มเหลว
        const retryResult = await this.retryPostWithDelay(videoPath, page, config.reels.maxRetries);
        if (retryResult.success) {
          job.results[job.results.length - 1] = {
            pageId: page.pageId,
            pageName: page.name,
            status: 'success',
            postId: retryResult.postId,
            timestamp: new Date(),
            retriedTimes: retryResult.retriedTimes
          };
          
          // หยุดหลังจากโพสต์สำเร็จ (แม้จะลองใหม่)
          logger.info(`Posted to one page successfully after retry. Stopping as per requirement.`);
          break;
        }
        
        // หากโพสต์เพจแรกล้มเหลว ลองเพจถัดไป (หากมี)
        logger.info(`Failed to post to page ${i + 1}. Trying next page...`);
      }
    }

    job.status = 'completed';
    job.completedAt = new Date();

    const summary = this.generatePostingSummary(job);
    logger.info('Job completed:', summary);

    // ส่งการแจ้งเตือนกลับไปยัง Telegram Bot
    await this.notifyJobCompletion(job);
  }

  // โพสต์ Reels ไปยังเพจเดียว - ใช้วิธีง่ายที่ทำงานได้แน่นอน
  async postReelsToPage(videoPath, page) {
    try {
      // ขั้นตอนที่ 1: บีบอัดไฟล์วิดีโอก่อนอัพโหลด
      const compressedVideoPath = await this.compressVideoForUpload(videoPath);
      logger.info('Video compressed for upload:', { 
        originalPath: videoPath,
        compressedPath: compressedVideoPath
      });
      
      // ขั้นตอนที่ 2: อัพโหลดวิดีโอด้วย Resumable Upload
      const uploadResult = await this.uploadVideoToFacebook(compressedVideoPath, page.accessToken);
      
      // ขั้นตอนที่ 3: สร้าง post โดยใช้ video ID ที่ได้
      const postData = {
        message: `🎥 วิดีโอใหม่ถูกโพสต์โดยอัตโนมัติจาก Bot`,
        link: `https://www.facebook.com/watch/?v=${uploadResult.id}`,
        access_token: page.accessToken
      };

      const postResponse = await axios.post(
        `${this.baseURL}/${page.pageId}/feed`,
        postData,
        {
          timeout: 30000 // 30 วินาที
        }
      );
      
      logger.info('Video post created successfully:', { 
        pageId: page.pageId, 
        videoId: uploadResult.id,
        postId: postResponse.data.id 
      });
      
      // ลบไฟล์ที่บีบอัดแล้ว
      try {
        await fs.remove(compressedVideoPath);
        logger.info('Compressed video file cleaned up:', { compressedVideoPath });
      } catch (cleanupError) {
        logger.warn('Failed to cleanup compressed video file:', cleanupError.message);
      }
      
      return postResponse.data;
    } catch (error) {
      logger.error('Error posting reels to page:', { 
        pageId: page.pageId, 
        error: error.message 
      });
      throw error;
    }
  }

  // อัพโหลดวิดีโอไปยัง Facebook (ปรับปรุงใหม่ให้ง่ายและมั่นคง)
  async uploadVideoToFacebook(videoPath, accessToken) {
    try {
      logger.info('Starting optimized Facebook video upload:', { videoPath });
      
      // ตรวจสอบขนาดไฟล์
      const stats = await fs.stat(videoPath);
      const fileSizeMB = Math.round(stats.size / 1024 / 1024);
      logger.info('Video file size:', { fileSize: fileSizeMB + ' MB' });
      
      // ใช้วิธีอัพโหลดที่ปรับปรุงแล้ว
      return await this.uploadVideoWithStream(videoPath, accessToken);
    } catch (error) {
      logger.error('Error in video upload process:', {
        errorType: error.name,
        message: error.message,
        statusCode: error.response?.status
      });
      
      throw error;
    }
  }
  
  // วิธีอัพโหลดด้วย stream ที่มีประสิทธิภาพดี
  async uploadVideoWithStream(videoPath, accessToken) {
    try {
      logger.info('Using optimized stream upload method...');
      
      const formData = new FormData();
      const videoStream = fs.createReadStream(videoPath);
      
      formData.append('source', videoStream);
      formData.append('access_token', accessToken);
      formData.append('published', 'true'); // เผยแพร่ทันที
      
      const response = await axios.post(
        `${this.baseURL}/me/videos`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: 20 * 60 * 1000, // 20 นาที สำหรับไฟล์ใหญ่
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          // เพิ่ม progress tracking
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              if (percent % 5 === 0) { // log ทุก 5%
                logger.info(`Facebook upload progress: ${percent}% (${Math.round(progressEvent.loaded/1024/1024)}MB/${Math.round(progressEvent.total/1024/1024)}MB)`);
              }
            }
          }
        }
      );

      logger.info('Video uploaded to Facebook successfully:', { 
        videoId: response.data.id 
      });

      return response.data;
    } catch (error) {
      logger.error('Error in stream upload:', {
        errorType: error.name,
        statusCode: error.response?.status,
        message: error.message
      });
      
      const safeErrorMessage = error.response?.status === 401 
        ? 'Facebook authentication failed. Please check access token.'
        : error.response?.status === 413
        ? 'Video file too large for Facebook upload.'
        : error.code === 'ECONNRESET' || error.code === 'ECONNABORTED'
        ? 'Connection timeout. Please try with a smaller video file.'
        : error.response?.status === 400
        ? `Facebook API error: ${error.response?.data?.error?.message || 'Invalid video format'}`
        : 'Failed to upload video to Facebook. Please try again.';
        
      throw new Error(safeErrorMessage);
    }
  }
  
  // Phase 1: เริ่มต้น upload session
  async startUploadSession(fileSize, accessToken) {
    try {
      const response = await axios.post(
        `${this.baseURL}/me/video_reels`,
        {
          upload_phase: 'start',
          file_size: fileSize,
          access_token: accessToken
        },
        {
          timeout: 30000, // 30 วินาที
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      logger.error('Error starting upload session:', {
        statusCode: error.response?.status,
        message: error.message
      });
      throw error;
    }
  }
  
  // Phase 2: อัพโหลด video chunks
  async transferVideoChunks(videoPath, uploadSession, accessToken) {
    const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks
    const fileSize = (await fs.stat(videoPath)).size;
    let uploadedBytes = 0;
    
    const fileBuffer = await fs.readFile(videoPath);
    
    while (uploadedBytes < fileSize) {
      const end = Math.min(uploadedBytes + CHUNK_SIZE, fileSize);
      const chunk = fileBuffer.slice(uploadedBytes, end);
      
      logger.info(`Uploading chunk: ${uploadedBytes}-${end}/${fileSize} bytes`);
      
      try {
        const formData = new FormData();
        formData.append('upload_phase', 'transfer');
        formData.append('start_offset', uploadedBytes.toString());
        formData.append('upload_session_id', uploadSession.upload_session_id);
        formData.append('video_file_chunk', chunk, {
          filename: `chunk_${uploadedBytes}`,
          contentType: 'application/octet-stream'
        });
        formData.append('access_token', accessToken);
        
        await axios.post(
          `${this.baseURL}/me/video_reels`,
          formData,
          {
            headers: {
              ...formData.getHeaders()
            },
            timeout: 5 * 60 * 1000, // 5 นาที per chunk
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          }
        );
        
        uploadedBytes = end;
        
        // รอสักหน่อยระหว่าง chunks
        if (uploadedBytes < fileSize) {
          await this.delay(500); // รอ 0.5 วินาที
        }
        
      } catch (error) {
        logger.error(`Error uploading chunk ${uploadedBytes}-${end}:`, {
          statusCode: error.response?.status,
          message: error.message
        });
        throw error;
      }
    }
  }
  
  // Phase 3: สิ้นสุด upload session
  async finishUploadSession(uploadSession, accessToken) {
    try {
      const response = await axios.post(
        `${this.baseURL}/me/video_reels`,
        {
          upload_phase: 'finish',
          upload_session_id: uploadSession.upload_session_id,
          access_token: accessToken
        },
        {
          timeout: 2 * 60 * 1000, // 2 นาที
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      logger.error('Error finishing upload session:', {
        statusCode: error.response?.status,
        message: error.message
      });
      throw error;
    }
  }
  
  // Fallback: วิธีอัพโหลดแบบเดิม (ถ้า resumable upload ไม่ได้)
  async fallbackUploadVideo(videoPath, accessToken) {
    try {
      const formData = new FormData();
      const videoStream = fs.createReadStream(videoPath);
      
      formData.append('source', videoStream);
      formData.append('access_token', accessToken);

      const response = await axios.post(
        `${this.baseURL}/me/videos`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: 10 * 60 * 1000, // 10 นาที timeout (ตามที่คุณแนะนำ)
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      logger.info('Video uploaded to Facebook (fallback method):', { 
        videoId: response.data.id 
      });

      return response.data;
    } catch (error) {
      logger.error('Error in fallback video upload:', {
        errorType: error.name,
        statusCode: error.response?.status,
        hasErrorData: !!error.response?.data
      });
      
      const safeErrorMessage = error.response?.status === 401 
        ? 'Facebook authentication failed. Please check access token.'
        : error.response?.status === 413
        ? 'Video file too large for Facebook upload.'
        : error.code === 'ECONNRESET' || error.code === 'ECONNABORTED'
        ? 'Connection timeout. Please try with a smaller video file.'
        : 'Failed to upload video to Facebook. Please try again.';
        
      throw new Error(safeErrorMessage);
    }
  }

  // สร้าง Video post - แก้ไขให้ใช้ API ที่ถูกต้อง
  async createReelsPost(videoId, pageId, accessToken, description = '') {
    try {
      // ใช้วิธี POST แบบ Form Data ที่ Facebook ต้องการ
      const FormData = require('form-data');
      const formData = new FormData();
      
      formData.append('file_url', `https://graph.facebook.com/v18.0/${videoId}`);
      formData.append('access_token', accessToken);
      
      // เพิ่มคำอธิบายหากมี
      if (description) {
        formData.append('message', description);
      }

      const response = await axios.post(
        `${this.baseURL}/${pageId}/photos`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          }
        }
      );

      logger.info('Video post created:', { 
        pageId: pageId, 
        postId: response.data.id 
      });

      return response.data;
    } catch (postError) {
      // หากไม่สำเร็จ ลองใช้วิธีอื่น
      try {
        logger.info('Trying alternative video posting method...');
        
        const postData = {
          link: `https://www.facebook.com/watch/?v=${videoId}`,
          access_token: accessToken
        };

        if (description) {
          postData.message = description;
        }

        const response = await axios.post(
          `${this.baseURL}/${pageId}/feed`,
          postData
        );

        logger.info('Video post created via feed:', { 
          pageId: pageId, 
          postId: response.data.id 
        });

        return response.data;
      } catch (error) {
        logger.error('Error creating video post:', {
          errorType: error.name,
          statusCode: error.response?.status,
          pageId: pageId,
          hasErrorData: !!error.response?.data
        });
        
        // ส่ง error message ที่ปลอดภัย
        const safeErrorMessage = error.response?.status === 401 
          ? 'Facebook page authentication failed.'
          : error.response?.status === 400
          ? 'Invalid video format for Facebook post.'
          : 'Failed to create Facebook video post.';
          
        throw new Error(safeErrorMessage);
      }
    }
  }

  // ลองโพสต์ใหม่หากล้มเหลว
  async retryPostWithDelay(videoPath, page, maxRetries) {
    let retriedTimes = 0;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.delay(config.reels.retryDelay * 1000);
        retriedTimes++;
        
        logger.info(`Retrying post to page (attempt ${i + 1}/${maxRetries}):`, { 
          pageId: page.pageId 
        });

        const result = await this.postReelsToPage(videoPath, page);
        
        return {
          success: true,
          postId: result.id,
          retriedTimes
        };
      } catch (error) {
        logger.error(`Retry ${i + 1} failed:`, { 
          pageId: page.pageId, 
          error: error.message 
        });
      }
    }

    return {
      success: false,
      retriedTimes
    };
  }

  // สร้างสรุปผลการโพสต์
  generatePostingSummary(job) {
    const successful = job.results.filter(r => r.status === 'success').length;
    const failed = job.results.filter(r => r.status === 'failed').length;
    const total = job.results.length;

    return {
      jobId: job.id,
      successful,
      failed,
      total,
      successRate: Math.round((successful / total) * 100),
      duration: job.completedAt - job.createdAt
    };
  }

  // ส่งการแจ้งเตือนเมื่องานเสร็จสิ้น
  async notifyJobCompletion(job) {
    try {
      const summary = this.generatePostingSummary(job);
      
      // ใช้ singleton instance ของ TelegramBotController
      const TelegramBotController = require('../controllers/lineBotController');
      const lineBot = TelegramBotController.getInstance();
      
      if (summary.failed === 0) {
        await lineBot.notifyPostingComplete(job.chatId, summary);
      } else {
        await lineBot.notifyPostingError(job.chatId, new Error(`${summary.failed} pages failed to post`));
      }
    } catch (error) {
      logger.error('Error sending job completion notification:', error);
    }
  }

  // ดึงสถานะคิว
  async getQueueStatus() {
    return {
      waiting: this.postingQueue.length,
      active: this.currentJob ? 1 : 0,
      completed: 0, // จะต้องเก็บใน database หรือ memory สำหรับข้อมูลนี้
      failed: 0     // จะต้องเก็บใน database หรือ memory สำหรับข้อมูลนี้
    };
  }

  // ดึงจำนวนเพจที่เปิดใช้งาน
  getEnabledPagesCount() {
    return this.pagesManager.getEnabledPagesCount();
  }

  // ตรวจสอบสถานะการเชื่อมต่อ Facebook API
  async checkFacebookConnection() {
    try {
      const pages = this.pagesManager.getEnabledPages();
      const results = [];

      for (const page of pages.slice(0, 3)) { // ทดสอบเพื่อ 3 เพจแรก
        try {
          const response = await axios.get(
            `${this.baseURL}/${page.pageId}?fields=id,name&access_token=${page.accessToken}`
          );
          
          results.push({
            pageId: page.pageId,
            pageName: page.name,
            status: 'connected',
            facebookName: response.data.name
          });
        } catch (error) {
          results.push({
            pageId: page.pageId,
            pageName: page.name,
            status: 'error',
            error: error.response?.data?.error?.message || error.message
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Error checking Facebook connection:', error);
      throw error;
    }
  }

  // บีบอัดวิดีโอเพื่อลดขนาดก่อนอัพโหลด
  async compressVideoForUpload(videoPath) {
    try {
      const ffmpeg = require('fluent-ffmpeg');
      const ffmpegPath = require('ffmpeg-static');
      ffmpeg.setFfmpegPath(ffmpegPath);
      
      const outputPath = videoPath.replace(/\.(\w+)$/, '_compressed.$1');
      
      // ตรวจสอบขนาดไฟล์ต้นฉบับ
      const stats = await fs.stat(videoPath);
      const fileSizeMB = Math.round(stats.size / 1024 / 1024);
      
      // ถ้าไฟล์เล็กกว่า 30MB หรือมีความละเอียดสูง ใช้ต้นฉบับ
      if (fileSizeMB <= 30) {
        logger.info(`Video file is small enough (${fileSizeMB}MB), skipping compression`);
        return videoPath;
      }
      
      logger.info(`Compressing video file (${fileSizeMB}MB) to reduce upload time...`);
      
      return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .videoBitrate('1500k') // ลด bitrate เพื่อลดขนาด
          .audioBitrate('128k')
          .size('1280x720') // ลดความละเอียดเป็น 720p
          .fps(30) // จำกัด frame rate
          .outputOptions([
            '-preset fast', // เร็วขึ้นแต่คุณภาพดี
            '-crf 23', // คุณภวามดีของวิดีโอ
            '-movflags +faststart' // เพิ่ม streaming performance
          ])
          .on('start', (commandLine) => {
            logger.info('FFmpeg compression started:', { commandLine });
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              logger.info(`Compression progress: ${Math.round(progress.percent)}%`);
            }
          })
          .on('end', async () => {
            try {
              const compressedStats = await fs.stat(outputPath);
              const compressedSizeMB = Math.round(compressedStats.size / 1024 / 1024);
              logger.info('Video compression completed:', { 
                outputPath,
                originalSize: `${fileSizeMB}MB`,
                compressedSize: `${compressedSizeMB}MB`,
                reduction: `${Math.round(((stats.size - compressedStats.size) / stats.size) * 100)}%`
              });
              resolve(outputPath);
            } catch (error) {
              logger.error('Error checking compressed file:', error);
              resolve(outputPath);
            }
          })
          .on('error', (error) => {
            logger.error('Video compression failed:', error.message);
            reject(error);
          })
          .save(outputPath);
      });
    } catch (error) {
      logger.error('Error setting up video compression:', error.message);
      // ถ้าบีบอัดไม่ได้ ใช้ไฟล์ต้นฉบับ
      return videoPath;
    }
  }

  // Utility function สำหรับการรอ
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ทำความสะอาดงานที่เสร็จสิ้นแล้ว
  cleanup() {
    // ล้างคิวที่เก่าเกินไป
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 ชั่วโมง

    this.postingQueue = this.postingQueue.filter(job => {
      return (now - new Date(job.createdAt).getTime()) < maxAge;
    });

    logger.info('Queue cleanup completed');
  }
}

module.exports = FacebookReelsService;