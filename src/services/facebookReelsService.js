const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs-extra');
const path = require('path');
const { config } = require('../config');
const FacebookPagesManager = require('../config/facebookPages');
const { logger } = require('../utils/logger');
const performanceMonitor = require('../utils/performanceMonitor');
const smartUploadOptimizer = require('../utils/smartUploadOptimizer');
const http = require('http');
const https = require('https');

// สร้าง HTTP Agent ด้วย Keep-Alive เพื่อประสิทธิภาพ
 const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 60000,
  keepAliveMsecs: 30000
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 60000,
  keepAliveMsecs: 30000
});

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
      // ตรวจสอบว่ามีงานที่กำลังประมวลผลอยู่หรือไม่
      if (this.currentJob) {
        logger.warn('Job already in progress, skipping duplicate request:', {
          currentJobId: this.currentJob.id,
          newJobData: jobData.originalMessageId
        });
        return this.currentJob.id;
      }

      // ดึงข้อมูลเพจที่เปิดใช้งานแบบ async
      const enabledPages = await this.pagesManager.getEnabledPages();
      
      const job = {
        id: Date.now().toString(),
        ...jobData,
        status: 'queued',
        createdAt: new Date(),
        pages: enabledPages,
        currentPageIndex: 0,
        results: [],
        isProcessing: false // เพิ่ม flag เพื่อป้องกันการประมวลผลซ้ำ
      };

      // ตรวจสอบว่ามีงานที่มี originalMessageId เดียวกันในคิวหรือไม่
      const duplicateJob = this.postingQueue.find(queuedJob => 
        queuedJob.originalMessageId === jobData.originalMessageId
      );
      
      if (duplicateJob) {
        logger.warn('Duplicate job found in queue, using existing job:', {
          existingJobId: duplicateJob.id,
          messageId: jobData.originalMessageId
        });
        return duplicateJob.id;
      }

      this.postingQueue.push(job);
      logger.info('Job added to posting queue:', { 
        jobId: job.id, 
        pagesCount: job.pages.length,
        messageId: jobData.originalMessageId
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
    
    // ตรวจสอบว่างานนี้กำลังถูกประมวลผลอยู่หรือไม่
    if (this.currentJob.isProcessing) {
      logger.warn('Job is already being processed, skipping:', { jobId: this.currentJob.id });
      this.currentJob = null;
      return;
    }
    
    this.currentJob.isProcessing = true;
    logger.info('Starting to process job:', { jobId: this.currentJob.id });

    try {
      await this.postToAllPages(this.currentJob);
    } catch (error) {
      logger.error('Error processing job:', error);
      this.currentJob.status = 'failed';
      this.currentJob.error = error.message;
    } finally {
      if (this.currentJob) {
        this.currentJob.isProcessing = false;
      }
      this.currentJob = null;
      
      // ประมวลผลงานถัดไปในคิว
      if (this.postingQueue.length > 0) {
        setTimeout(() => this.processQueue(), 2000); // เพิ่มเวลารอเป็น 2 วินาที
      }
    }
  }

  // โพสต์ไปยังเพจทั้งหมดตามลำดับ - โพสต์หนึ่งคลิปไปทุกเพจที่เปิดใช้งาน
  async postToAllPages(job) {
    const { videoPath } = job;
    const enabledPages = await this.pagesManager.getEnabledPages();
    job.status = 'processing';

    logger.info('Starting posting to all enabled pages:', { 
      jobId: job.id, 
      totalEnabledPages: enabledPages.length 
    });

    // โพสต์ไปทุกเพจที่เปิดใช้งาน
    for (let i = 0; i < enabledPages.length; i++) {
      const page = enabledPages[i];
      job.currentPageIndex = i;

      try {
        logger.info(`Posting to page ${i + 1}/${enabledPages.length}:`, { 
          pageId: page.pageId, 
          pageName: page.name 
        });

        // แจ้งเตือนผ่าน Telegram ก่อนเริ่มอัปโหลด
        await this.notifyPageUploadStart(job.chatId, page.name, i + 1, enabledPages.length);

        const result = await this.postReelsToPage(videoPath, page, job);
        
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

        // แจ้งเตือนผ่าน Telegram เมื่ออัปโหลดเสร็จ
        await this.notifyPageUploadComplete(job.chatId, page.name, i + 1, enabledPages.length);

        // เพิ่มหน่วงเวลาระหว่างการโพสต์แต่ละเพจ (ปรับตามสภาพเครือข่าย)
        if (i < enabledPages.length - 1) {
          logger.info('Waiting before posting to next page...');
          await this.notifyPageUploadNext(job.chatId, i + 2, enabledPages.length);
          
          const optimalSettings = smartUploadOptimizer.getOptimalSettings();
          await this.delay(optimalSettings.pageDelay);
        }

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

        // ลองใหม่หากการโพสต์ล้มเหลว (ลดจำนวนครั้ง retry)
        const retryResult = await this.retryPostWithDelay(videoPath, page, job, 1); // ลดเหลือแค่ 1 ครั้ง
        if (retryResult.success) {
          job.results[job.results.length - 1] = {
            pageId: page.pageId,
            pageName: page.name,
            status: 'success',
            postId: retryResult.postId,
            timestamp: new Date(),
            retriedTimes: retryResult.retriedTimes
          };
          
          // โพสต์สำเร็จหลังจากลองใหม่
          logger.info(`Posted to page successfully after retry. Continuing to next page.`);
          
          // แจ้งเตือนผ่าน Telegram เมื่ออัปโหลดสำเร็จหลังจาก retry
          await this.notifyPageUploadComplete(job.chatId, page.name, i + 1, enabledPages.length, true);
          
          // เพิ่มหน่วงเวลาระหว่างการโพสต์แต่ละเพจ
          if (i < enabledPages.length - 1) {
            logger.info('Waiting before posting to next page after retry...');
            await this.notifyPageUploadNext(job.chatId, i + 2, enabledPages.length);
            await this.delay(500); // ลดเวลารอเหลือ 0.5 วินาที
          }
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

  // โพสต์ Reels ไปยังเพจเดียว - ใช้ Facebook Reels API ที่ถูกต้อง
  async postReelsToPage(videoPath, page, job = {}) {
    // เริ่มการติดตามประสิทธิภาพ
    const stats = await fs.stat(videoPath);
    const fileSizeMB = Math.round(stats.size / 1024 / 1024);
    const tracking = performanceMonitor.startUploadTracking(job.id || 'unknown', page.pageId, fileSizeMB);
    
    try {
      logger.info(`Starting Reels post to page: ${page.pageId} (${page.name})`);
      
      // ขั้นตอนที่ 1: บีบอัดไฟล์วิดีโอก่อนอัพโหลด
      performanceMonitor.trackPhase(job.id || 'unknown', page.pageId, 'compression');
      const compressedVideoPath = await this.compressVideoForUpload(videoPath);
      performanceMonitor.endPhase(job.id || 'unknown', page.pageId, 'compression');
      
      logger.info('Video compressed for upload:', { 
        originalPath: videoPath,
        compressedPath: compressedVideoPath
      });
      
      // ขั้นตอนที่ 2: อัพโหลด Reels ด้วย 3-phase resumable upload
      performanceMonitor.trackPhase(job.id || 'unknown', page.pageId, 'upload');
      const description = job.description || 'วีดีโอใหม่ถูกโพสต์โดยอัติโนมัติจากบอท';
      const reelsResult = await this.uploadReelsToFacebook(compressedVideoPath, page.accessToken, page.pageId, description);
      performanceMonitor.endPhase(job.id || 'unknown', page.pageId, 'upload');
      
      logger.info('Reels uploaded successfully:', { 
        pageId: page.pageId,
        reelsId: reelsResult.id 
      });
      
      // สิ้นสุดการติดตามประสิทธิภาพ (สำเร็จ)
      const performanceSummary = performanceMonitor.endUploadTracking(job.id || 'unknown', page.pageId, true);
      if (performanceSummary) {
        logger.info('Upload performance:', {
          speed: performanceSummary.uploadSpeed + ' MB/s',
          duration: performanceSummary.totalDuration + 's'
        });
        
        // อัปเดต Smart Optimizer ด้วยผลการอัปโหลด
        smartUploadOptimizer.analyzeNetworkConditions({
          uploadSpeed: performanceSummary.uploadSpeed,
          duration: performanceSummary.totalDuration,
          fileSize: performanceSummary.fileSizeMB,
          success: true
        });
      }
      
      // ลบไฟล์ที่บีบอัดแล้ว
      try {
        if (compressedVideoPath !== videoPath) {
          await fs.remove(compressedVideoPath);
          logger.info('Compressed video file cleaned up:', { compressedVideoPath });
        }
      } catch (cleanupError) {
        logger.warn('Failed to cleanup compressed video file:', cleanupError.message);
      }
      
      return reelsResult;
    } catch (error) {
      logger.error('Error posting reels to page:', { 
        pageId: page.pageId, 
        error: error.message 
      });
      
      // สิ้นสุดการติดตามประสิทธิภาพ (ล้มเหลว)
      performanceMonitor.endUploadTracking(job.id || 'unknown', page.pageId, false);
      
      // แจ้ง Smart Optimizer เกี่ยวกับความล้มเหลว
      smartUploadOptimizer.analyzeNetworkConditions({
        uploadSpeed: 0,
        duration: 0,
        fileSize: 0,
        success: false
      });
      
      throw error;
    }
  }

  // อัพโหลด Reels ไปยัง Facebook (ใช้ 3-phase resumable upload ที่ถูกต้อง)
  async uploadReelsToFacebook(videoPath, accessToken, pageId, description = '') {
    try {
      logger.info('Starting proper Facebook Reels upload (3-phase):', { videoPath, pageId });
      
      // ตรวจสอบขนาดไฟล์
      const stats = await fs.stat(videoPath);
      const fileSize = stats.size;
      const fileSizeMB = Math.round(fileSize / 1024 / 1024);
      logger.info('Video file size:', { fileSize: fileSizeMB + ' MB' });
      
      // Phase 1: เริ่มต้น upload session สำหรับ Reels
      const uploadSession = await this.startReelsUploadSession(fileSize, accessToken, pageId);
      logger.info('Reels upload session started:', { uploadSessionId: uploadSession.upload_session_id });
      
      // Phase 2: อัพโหลด video chunks
      await this.transferReelsVideoChunks(videoPath, uploadSession, accessToken, pageId);
      logger.info('Reels video chunks uploaded successfully');
      
      // Phase 3: สิ้นสุด upload session พร้อม description
      const finishResult = await this.finishReelsUploadSession(uploadSession, accessToken, pageId, description);
      logger.info('Reels upload completed:', { reelsId: finishResult.id });
      
      return finishResult;
    } catch (error) {
      logger.error('Error in Reels upload process:', {
        errorType: error.name,
        message: error.message,
        statusCode: error.response?.status,
        pageId,
        errorData: error.response?.data
      });
      
      // Fallback: ใช้วิธีการอัพโหลดแบบง่าย
      logger.info('Falling back to simplified upload method...');
      return await this.fallbackDirectReelsUpload(videoPath, accessToken, pageId, description);
    }
  }
  
  // Fallback: วิธีอัพโหลดแบบง่าย (ถ้า 3-phase Reels upload ไม่ได้)
  async fallbackDirectReelsUpload(videoPath, accessToken, pageId, description = '') {
    try {
      logger.info('Using fallback direct upload method for Reels');
      
      // อัพโหลดวิดีโอแบบธรรมดา
      const videoResult = await this.uploadVideoWithStream(videoPath, accessToken);
      logger.info('Video uploaded via fallback method:', { videoId: videoResult.id });
      
      // สร้าง post บน feed พร้อม description
      const postData = {
        message: description || 'วีดีโอใหม่ถูกโพสต์โดยอัติโนมัติจากบอท',
        link: `https://www.facebook.com/watch/?v=${videoResult.id}`,
        access_token: accessToken
      };

      const postResponse = await axios.post(
        `${this.baseURL}/${pageId}/feed`,
        postData,
        {
          timeout: 30000 // 30 วินาที
        }
      );
      
      logger.info('Fallback post created successfully:', { 
        pageId: pageId, 
        videoId: videoResult.id,
        postId: postResponse.data.id 
      });
      
      return postResponse.data;
    } catch (error) {
      logger.error('Error in fallback direct upload:', {
        errorType: error.name,
        statusCode: error.response?.status,
        message: error.message,
        pageId,
        errorData: error.response?.data
      });
      
      throw error;
    }
  }
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
          timeout: 3 * 60 * 1000, // ลด timeout เหลือ 3 นาที
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          httpAgent: httpAgent,
          httpsAgent: httpsAgent,
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
  
  // Phase 1: เริ่มต้น upload session สำหรับ Reels
  async startReelsUploadSession(fileSize, accessToken, pageId) {
    try {
      logger.info('Starting Reels upload session with params:', {
        fileSize,
        pageId,
        endpoint: `${this.baseURL}/me/video_reels`
      });
      
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
      logger.error('Error starting Reels upload session:', {
        statusCode: error.response?.status,
        message: error.message,
        pageId,
        errorData: error.response?.data,
        errorCode: error.code
      });
      throw error;
    }
  }
  
  // Phase 2: อัพโหลด video chunks สำหรับ Reels ด้วยการปรับปรุงอัจฉริยะ
  async transferReelsVideoChunks(videoPath, uploadSession, accessToken, pageId) {
    // ใช้ Smart Optimizer เพื่อหาขนาด chunk ที่เหมาะสม
    const optimalSettings = smartUploadOptimizer.getOptimalSettings();
    const CHUNK_SIZE = optimalSettings.chunkSize;
    
    logger.info('Using dynamic chunk size based on network conditions:', { 
      chunkSizeMB: Math.round(CHUNK_SIZE / (1024 * 1024)),
      networkQuality: smartUploadOptimizer.getNetworkQuality()
    });
    
    const fileSize = (await fs.stat(videoPath)).size;
    let uploadedBytes = 0;
    
    const fileBuffer = await fs.readFile(videoPath);
    
    while (uploadedBytes < fileSize) {
      const end = Math.min(uploadedBytes + CHUNK_SIZE, fileSize);
      const chunk = fileBuffer.slice(uploadedBytes, end);
      
      logger.info(`Uploading Reels chunk: ${uploadedBytes}-${end}/${fileSize} bytes`);
      
      try {
        const formData = new FormData();
        formData.append('upload_phase', 'transfer');
        formData.append('start_offset', uploadedBytes.toString());
        formData.append('upload_session_id', uploadSession.upload_session_id);
        formData.append('video_file_chunk', chunk, {
          filename: `chunk_${uploadedBytes}.mp4`,
          contentType: 'video/mp4'
        });
        formData.append('access_token', accessToken);
        
        logger.info(`Uploading chunk with details:`, {
          uploadPhase: 'transfer',
          startOffset: uploadedBytes,
          uploadSessionId: uploadSession.upload_session_id,
          chunkSize: chunk.length,
          pageId
        });
        
        await axios.post(
          `${this.baseURL}/me/video_reels`,
          formData,
          {
            headers: {
              ...formData.getHeaders()
            },
            timeout: optimalSettings.chunkTimeout, // ใช้ timeout ที่เหมาะสม
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            httpAgent: httpAgent,
            httpsAgent: httpsAgent
          }
        );
        
        uploadedBytes = end;
        
        // รอน้อยลงระหว่าง chunks ตามสภาพเครือข่าย
        if (uploadedBytes < fileSize && optimalSettings.chunkDelay > 0) {
          await this.delay(optimalSettings.chunkDelay);
        }
        
      } catch (error) {
        logger.error(`Error uploading Reels chunk ${uploadedBytes}-${end}:`, {
          statusCode: error.response?.status,
          message: error.message,
          pageId,
          errorData: error.response?.data,
          errorCode: error.code
        });
        throw error;
      }
    }
  }
  
  // Phase 3: สิ้นสุด upload session สำหรับ Reels พร้อม description
  async finishReelsUploadSession(uploadSession, accessToken, pageId, description = '') {
    try {
      const finishData = {
        upload_phase: 'finish',
        upload_session_id: uploadSession.upload_session_id,
        access_token: accessToken
      };
      
      // เพิ่ม description หากมี
      if (description && description.trim()) {
        finishData.description = description.trim();
        logger.info('Adding description to Reels:', { description: description.trim() });
      }
      
      const response = await axios.post(
        `${this.baseURL}/me/video_reels`,
        finishData,
        {
          timeout: 2 * 60 * 1000, // 2 นาที
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      logger.error('Error finishing Reels upload session:', {
        statusCode: error.response?.status,
        message: error.message,
        pageId
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
          timeout: 5 * 60 * 1000, // 5 นาที timeout (ลดลงเพื่อความเร็ว)
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

  // ฟังก์ชันสำหรับรอ (delay)
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ลองโพสต์ใหม่หากล้มเหลว
  async retryPostWithDelay(videoPath, page, job, maxRetries) {
    let retriedTimes = 0;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.delay(config.reels.retryDelay * 1000);
        retriedTimes++;
        
        logger.info(`Retrying post to page (attempt ${i + 1}/${maxRetries}):`, { 
          pageId: page.pageId 
        });

        const result = await this.postReelsToPage(videoPath, page, job);
        
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

  // แจ้งเตือนก่อนเริ่มอัปโหลดเพจ
  async notifyPageUploadStart(chatId, pageName, currentPage, totalPages) {
    try {
      const TelegramBotController = require('../controllers/lineBotController');
      const lineBot = TelegramBotController.getInstance();
      
      const message = `🚀 กำลังอัปโหลดไปเพจที่ ${currentPage}/${totalPages}\n📱 เพจ: ${pageName}`;
      await lineBot.sendMessage(chatId, message);
    } catch (error) {
      logger.error('Error sending page upload start notification:', error);
    }
  }

  // แจ้งเตือนเมื่ออัปโหลดเพจเสร็จ
  async notifyPageUploadComplete(chatId, pageName, currentPage, totalPages, isRetry = false) {
    try {
      const TelegramBotController = require('../controllers/lineBotController');
      const lineBot = TelegramBotController.getInstance();
      
      const retryText = isRetry ? ' (หลังจากลองใหม่)' : '';
      const message = `✅ อัปโหลดเพจที่ ${currentPage}/${totalPages} เสร็จแล้ว${retryText}\n📱 เพจ: ${pageName}`;
      await lineBot.sendMessage(chatId, message);
    } catch (error) {
      logger.error('Error sending page upload complete notification:', error);
    }
  }

  // แจ้งเตือนก่อนอัปโหลดเพจถัดไป
  async notifyPageUploadNext(chatId, nextPage, totalPages) {
    try {
      const TelegramBotController = require('../controllers/lineBotController');
      const lineBot = TelegramBotController.getInstance();
      
      const message = `🔄 เริ่มอัปโหลดเพจถัดไป (${nextPage}/${totalPages})...`;
      await lineBot.sendMessage(chatId, message);
    } catch (error) {
      logger.error('Error sending next page notification:', error);
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
  async getEnabledPagesCount() {
    return await this.pagesManager.getEnabledPagesCount();
  }

  // ตรวจสอบสถานะการเชื่อมต่อ Facebook API
  async checkFacebookConnection() {
    try {
      const pages = await this.pagesManager.getEnabledPages();
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
      
      // ถ้าไฟล์เล็กกว่า 50MB ใช้ต้นฉบับ (เพิ่มขึ้นเพื่อคุณภาพที่ดีขึ้น)
      if (fileSizeMB <= 50) {
        logger.info(`Video file is acceptable size (${fileSizeMB}MB), skipping compression for better quality`);
        return videoPath;
      }
      
      logger.info(`Compressing video file (${fileSizeMB}MB) with balanced quality settings...`);
      
      return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .videoBitrate('2000k') // เพิ่มขึ้นเพื่อคุณภาพที่ดีขึ้น
          .audioBitrate('128k') // คืนค่าเดิมสำหรับเสียงที่ชัด
          .size('1280x720') // รักษาความละเอียด 720p
          .fps(30) // คืนค่า 30fps เพื่อความลื่น
          .outputOptions([
            '-preset medium', // สมดุลระหว่างความเร็วและคุณภาพ
            '-crf 21', // คุณภาพที่ดีขึ้น (ลดจาก 23)
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