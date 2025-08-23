const fs = require('fs-extra');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('@ffprobe-installer/ffprobe');
const { config } = require('../config');
const { logger } = require('../utils/logger');

// ตั้งค่า ffmpeg และ ffprobe paths
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

class VideoProcessor {
  constructor() {
    this.uploadPath = config.upload.path;
    this.ensureUploadDirectory();
  }

  // สร้างโฟลเดอร์สำหรับอัพโหลดหากยังไม่มี
  async ensureUploadDirectory() {
    try {
      await fs.ensureDir(this.uploadPath);
      await fs.ensureDir(path.join(this.uploadPath, 'processed'));
      await fs.ensureDir(path.join(this.uploadPath, 'temp'));
    } catch (error) {
      logger.error('Error creating upload directories:', error);
      throw error;
    }
  }

  // บันทึกวิดีโอจาก stream ที่ได้จาก LINE
  async saveVideoFromStream(videoStream, messageId) {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      // สร้างชื่อไฟล์แบบ safe และป้องกัน path traversal
      const sanitizedMessageId = messageId.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${sanitizedMessageId}_${timestamp}.mp4`;
      const filePath = path.resolve(path.join(this.uploadPath, 'temp', fileName));
      
      // ตรวจสอบว่า path อยู่ใน upload directory
      if (!filePath.startsWith(path.resolve(this.uploadPath))) {
        reject(new Error('Invalid file path'));
        return;
      }

      const writeStream = fs.createWriteStream(filePath);
      
      videoStream.pipe(writeStream);

      writeStream.on('finish', () => {
        logger.info('Video saved successfully:', { filePath, messageId });
        resolve(filePath);
      });

      writeStream.on('error', (error) => {
        logger.error('Error saving video:', error);
        reject(error);
      });
    });
  }

  // ตรวจสอบคุณภาพวิดีโอด้วย ffprobe
  async analyzeVideoWithFfprobe(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, ['-v', 'error', '-show_format', '-show_streams'], (error, metadata) => {
        if (error) {
          logger.error('Error analyzing video with ffprobe:', error);
          reject(error);
        } else {
          const videoStream = metadata.streams.find(s => s.codec_type === 'video');
          const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
          
          const analysis = {
            format: metadata.format,
            video: videoStream ? {
              codec: videoStream.codec_name,
              width: videoStream.width,
              height: videoStream.height,
              aspectRatio: videoStream.width / videoStream.height,
              duration: parseFloat(videoStream.duration),
              frameRate: eval(videoStream.r_frame_rate || '0'),
              bitRate: parseInt(videoStream.bit_rate) || 0
            } : null,
            audio: audioStream ? {
              codec: audioStream.codec_name,
              sampleRate: parseInt(audioStream.sample_rate),
              bitRate: parseInt(audioStream.bit_rate) || 0,
              channels: audioStream.channels
            } : null
          };
          
          logger.info('Video analysis completed:', analysis);
          resolve(analysis);
        }
      });
    });
  }

  // ประมวลผลวิดีโอให้เหมาะสมกับ Facebook Reels (ตามมาตรฐานที่แนะนำ)
  async processVideoForReels(inputPath) {
    try {
      logger.info('Starting Facebook Reels video processing:', { inputPath });
      
      // วิเคราะห์วิดีโอต้นฉบับก่อน
      const analysis = await this.analyzeVideoWithFfprobe(inputPath);
      logger.info('Original video analysis:', analysis);
      
      const fileName = path.basename(inputPath, path.extname(inputPath));
      const outputPath = path.join(this.uploadPath, 'processed', `${fileName}_reels.mp4`);
      
      return new Promise((resolve, reject) => {
        // ใช้คำสั่ง FFmpeg ตามที่แนะนำ
        ffmpeg(inputPath)
          // กรองวิดีโอให้เป็น 9:16 aspect ratio สำหรับ Reels
          .videoFilters([
            'scale=1080:1920:force_original_aspect_ratio=decrease',
            'pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black'
          ])
          // ตั้งค่า video codec (H.264)
          .videoCodec('libx264')
          .outputOptions([
            '-profile:v high',
            '-level 4.1',
            '-pix_fmt yuv420p'
          ])
          // ตั้งค่า audio codec (AAC)
          .audioCodec('aac')
          .audioBitrate('128k')
          .audioFrequency(44100)
          // จำกัดความยาวไม่เกิน 90 วินาที
          .duration(90)
          // ตั้งค่าสำหรับ streaming
          .outputOptions([
            '-movflags +faststart'
          ])
          .on('start', (commandLine) => {
            logger.info('FFmpeg Reels processing started:', { commandLine });
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              logger.info(`Reels processing progress: ${Math.round(progress.percent)}%`);
            }
          })
          .on('end', () => {
            logger.info('Facebook Reels video processing completed:', { outputPath });
            // ลบไฟล์ต้นฉบับใน temp
            this.cleanupTempFile(inputPath);
            resolve(outputPath);
          })
          .on('error', (error) => {
            logger.error('Error processing video for Reels:', error);
            this.cleanupTempFile(inputPath);
            reject(error);
          })
          .save(outputPath);
      });
    } catch (error) {
      logger.error('Error in Reels video processing:', error);
      throw error;
    }
  }

  // ตรวจสอบขนาดไฟล์วิดีโอ
  async getVideoInfo(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (error, metadata) => {
        if (error) {
          logger.error('Error getting video info:', error);
          reject(error);
        } else {
          const info = {
            duration: metadata.format.duration,
            size: metadata.format.size,
            bitRate: metadata.format.bit_rate,
            format: metadata.format.format_name,
            streams: metadata.streams.map(stream => ({
              type: stream.codec_type,
              codec: stream.codec_name,
              width: stream.width,
              height: stream.height,
              duration: stream.duration
            }))
          };
          logger.info('Video info retrieved:', info);
          resolve(info);
        }
      });
    });
  }

  // ตรวจสอบว่าไฟล์วิดีโอถูกต้องหรือไม่
  async validateVideo(filePath) {
    try {
      // ตรวจสอบว่าไฟล์อยู่ในโฟลเดอร์ที่อนุญาต
      const resolvedPath = path.resolve(filePath);
      if (!resolvedPath.startsWith(path.resolve(this.uploadPath))) {
        throw new Error('File path not allowed');
      }
      
      // ตรวจสอบว่าไฟล์มีอยู่จริง
      const exists = await fs.pathExists(filePath);
      if (!exists) {
        throw new Error('File does not exist');
      }
      
      const info = await this.getVideoInfo(filePath);
      
      // ตรวจสอบเงื่อนไขต่างๆ
      const validations = {
        hasVideo: info.streams.some(s => s.type === 'video'),
        duration: info.duration <= 90, // Facebook Reels สูงสุด 90 วินาที
        size: info.size <= 100 * 1024 * 1024, // สูงสุด 100MB
        format: ['mp4', 'mov', 'avi'].some(f => info.format.includes(f)),
        validPath: resolvedPath.startsWith(path.resolve(this.uploadPath))
      };

      const isValid = Object.values(validations).every(v => v);
      
      logger.info('Video validation result:', { 
        filePath, 
        validations, 
        isValid 
      });

      return {
        isValid,
        validations,
        info
      };
    } catch (error) {
      logger.error('Error validating video:', error);
      return {
        isValid: false,
        error: error.message
      };
    }
  }

  // สร้าง thumbnail จากวิดีโอ
  async generateThumbnail(videoPath) {
    return new Promise((resolve, reject) => {
      const fileName = path.basename(videoPath, path.extname(videoPath));
      const thumbnailPath = path.join(this.uploadPath, 'processed', `${fileName}_thumb.jpg`);

      ffmpeg(videoPath)
        .screenshots({
          timestamps: ['00:00:02'], // สร้าง thumbnail ที่วินาทีที่ 2
          filename: path.basename(thumbnailPath),
          folder: path.dirname(thumbnailPath),
          size: '720x1280' // ขนาดที่เหมาะกับ Reels
        })
        .on('end', () => {
          logger.info('Thumbnail generated:', { thumbnailPath });
          resolve(thumbnailPath);
        })
        .on('error', (error) => {
          logger.error('Error generating thumbnail:', error);
          reject(error);
        });
    });
  }

  // ลบไฟล์ชั่วคราว
  async cleanupTempFile(filePath) {
    try {
      if (filePath && filePath.includes('/temp/')) {
        await fs.remove(filePath);
        logger.info('Temp file cleaned up:', { filePath });
      }
    } catch (error) {
      logger.error('Error cleaning up temp file:', error);
    }
  }

  // ลบไฟล์ที่ประมวลผลแล้ว
  async cleanupProcessedFile(filePath) {
    try {
      await fs.remove(filePath);
      logger.info('Processed file cleaned up:', { filePath });
    } catch (error) {
      logger.error('Error cleaning up processed file:', error);
    }
  }

  // ทำความสะอาดไฟล์เก่าที่มีอายุมากกว่า 24 ชั่วโมง
  async cleanupOldFiles() {
    try {
      const tempDir = path.join(this.uploadPath, 'temp');
      const processedDir = path.join(this.uploadPath, 'processed');
      
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 ชั่วโมง

      // ทำความสะอาดไฟล์ temp
      const tempFiles = await fs.readdir(tempDir);
      for (const file of tempFiles) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.remove(filePath);
          logger.info('Old temp file removed:', { filePath });
        }
      }

      // ทำความสะอาดไฟล์ processed
      const processedFiles = await fs.readdir(processedDir);
      for (const file of processedFiles) {
        const filePath = path.join(processedDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.remove(filePath);
          logger.info('Old processed file removed:', { filePath });
        }
      }

      logger.info('Old files cleanup completed');
    } catch (error) {
      logger.error('Error during old files cleanup:', error);
    }
  }

  // ดึงข้อมูลการใช้พื้นที่
  async getStorageInfo() {
    try {
      const tempDir = path.join(this.uploadPath, 'temp');
      const processedDir = path.join(this.uploadPath, 'processed');

      const tempFiles = await fs.readdir(tempDir);
      const processedFiles = await fs.readdir(processedDir);

      let tempSize = 0;
      let processedSize = 0;

      for (const file of tempFiles) {
        const stats = await fs.stat(path.join(tempDir, file));
        tempSize += stats.size;
      }

      for (const file of processedFiles) {
        const stats = await fs.stat(path.join(processedDir, file));
        processedSize += stats.size;
      }

      return {
        tempFiles: tempFiles.length,
        processedFiles: processedFiles.length,
        tempSize: Math.round(tempSize / 1024 / 1024), // MB
        processedSize: Math.round(processedSize / 1024 / 1024), // MB
        totalSize: Math.round((tempSize + processedSize) / 1024 / 1024) // MB
      };
    } catch (error) {
      logger.error('Error getting storage info:', error);
      return {
        tempFiles: 0,
        processedFiles: 0,
        tempSize: 0,
        processedSize: 0,
        totalSize: 0
      };
    }
  }
}

module.exports = VideoProcessor;