const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { config } = require('../config');
const { logger } = require('../utils/logger');
const VideoProcessor = require('../services/videoProcessor');
const FacebookReelsService = require('../services/facebookReelsService');

class TelegramBotController {
  constructor() {
    // Singleton pattern - return existing instance if already created
    if (TelegramBotController.instance) {
      return TelegramBotController.instance;
    }
    
    this.bot = null;
    this.isInitialized = false;
    this.videoProcessor = new VideoProcessor();
    this.facebookReelsService = new FacebookReelsService();
    
    // เก็บสถานะการรอ description
    this.pendingVideos = new Map(); // videoFileId -> { videoPath, userId, chatId, timestamp }
    
    // ทำความสะอาด pending videos ทุก 5 นาที
    setInterval(() => {
      this.cleanupPendingVideos();
    }, 5 * 60 * 1000);
    
    // Store the instance
    TelegramBotController.instance = this;
    
    // Initialize asynchronously
    this.initializeBot();
  }

  // Static method to get instance
  static getInstance() {
    if (!TelegramBotController.instance) {
      TelegramBotController.instance = new TelegramBotController();
    }
    return TelegramBotController.instance;
  }

  // ฟังก์ชันสำหรับ initialize bot
  async initializeBot() {
    try {
      // Clear webhook ก่อนเริ่ม polling
      await this.clearWebhook();
      
      // สร้าง Telegram Bot client ด้วยการตั้งค่า polling ที่ปรับปรุงแล้ว
      this.bot = new TelegramBot(config.telegram.botToken, { 
        polling: {
          interval: 2000,        // เพิ่มจาก 1000ms เป็น 2000ms เพื่อลดความถี่ polling
          autoStart: true,
          params: {
            timeout: 20,         // เพิ่มจาก 10s เป็น 20s เพื่อใข้เวลาการรอ response นานขึ้น
            limit: 100,         // จำกัดจำนวน messages ต่อ request
            allowed_updates: ['message', 'callback_query'] // จำกัดประเภท updates ที่จะรับ
          }
        },
        // เพิ่มการตั้งค่า request timeout
        request: {
          timeout: 30000,      // 30 วินาทีสำหรับ HTTP request timeout
          agent: false,        // ใช้ global agent
          forever: true        // เปิดใช้ keep-alive connections
        }
      });
      
      this.setupHandlers();
      this.isInitialized = true;
      logger.info('Telegram Bot initialized successfully');
    } catch (error) {
      logger.error('Error initializing Telegram Bot:', error);
      this.isInitialized = false;
    }
  }

  // Clear webhook เพื่อป้องกัน conflict
  async clearWebhook() {
    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${config.telegram.botToken}/deleteWebhook`
      );
      logger.info('Webhook cleared successfully');
    } catch (error) {
      logger.warn('Failed to clear webhook:', error.message);
    }
  }

  // ตั้งค่า handlers
  setupHandlers() {
    // Handle text messages
    this.bot.on('message', (msg) => {
      this.handleMessage(msg);
    });

    // Handle video messages
    this.bot.on('video', (msg) => {
      this.handleVideoMessage(msg);
    });

    // Handle errors
    this.bot.on('error', (error) => {
      logger.error('Telegram Bot error:', error);
    });

    // Handle polling errors แบบ graceful พร้อมจัดการ ETIMEDOUT และ network errors
    this.bot.on('polling_error', (error) => {
      if (error.code === 'ETELEGRAM' && error.response?.statusCode === 409) {
        logger.warn('Telegram Bot conflict detected - another instance might be running');
        logger.info('Attempting to restart polling in 5 seconds...');
        setTimeout(() => {
          this.restartPolling();
        }, 5000);
      } else if (error.code === 'EFATAL' || error.message?.includes('ETIMEDOUT') || error.message?.includes('read ETIMEDOUT')) {
        logger.warn('Telegram API timeout detected (ETIMEDOUT) - network connection issue');
        logger.info('Attempting to restart polling in 10 seconds...');
        setTimeout(() => {
          this.restartPolling();
        }, 10000);
      } else if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
        logger.warn('Network connection error detected - will retry connection');
        logger.info('Attempting to restart polling in 15 seconds...');
        setTimeout(() => {
          this.restartPolling();
        }, 15000);
      } else {
        logger.error('Telegram Bot polling error (unknown):', error);
        logger.info('Attempting to restart polling in 30 seconds...');
        setTimeout(() => {
          this.restartPolling();
        }, 30000);
      }
    });

    logger.info('Telegram Bot handlers setup completed');
  }

  // ฟังก์ชันสำหรับ restart polling
  async restartPolling() {
    try {
      await this.bot.stopPolling();
      await new Promise(resolve => setTimeout(resolve, 2000));
      await this.bot.startPolling();
      logger.info('Telegram Bot polling restarted successfully');
    } catch (error) {
      logger.error('Failed to restart polling:', error);
    }
  }

  // จัดการข้อความ
  async handleMessage(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
      logger.info('Received Telegram message:', { 
        chatId, 
        userId,
        messageType: msg.video ? 'video' : 'text',
        text: msg.text 
      });

      if (msg.video) {
        return await this.handleVideoMessage(msg);
      } else if (msg.text) {
        return await this.handleTextMessage(msg);
      }
    } catch (error) {
      logger.error('Error handling Telegram message:', error);
      await this.sendMessage(chatId, '❌ เกิดข้อผิดพลาดในการประมวลผลข้อความ กรุณาลองใหม่อีกครั้งครับ');
    }
  }

  // จัดการวิดีโอที่ส่งมา
  async handleVideoMessage(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const videoFileId = msg.video.file_id;

    try {
      // ส่งข้อความแจ้งว่าได้รับวิดีโอแล้ว
      await this.sendMessage(chatId, '📹 ได้รับวิดีโอของคุณแล้ว! กำลังดาวน์โหลด...');

      // ดาวน์โหลดวิดีโอจาก Telegram
      logger.info('Starting video download from Telegram:', { videoFileId, userId });
      
      const videoPath = await this.downloadVideo(videoFileId);
      
      logger.info('Video downloaded successfully:', { videoPath, videoFileId });

      // ประมวลผลวิดีโอ
      const processedVideoPath = await this.videoProcessor.processVideoForReels(videoPath);
      
      logger.info('Video processed for Reels:', { processedVideoPath });

      // เก็บข้อมูลวิดีโอไว้เพื่อรอ description
      this.pendingVideos.set(videoFileId, {
        videoPath: processedVideoPath,
        userId: userId,
        chatId: chatId,
        timestamp: new Date(),
        originalMessageId: videoFileId
      });

      // ถาม description จากผู้ใช้
      await this.sendMessage(chatId, 
        '✨ กรุณาใส่คำอธิบาย (description) สำหรับคลิปนี้\n\n📝 ส่งข้อความมาในข้อความถัดไป หรือ\n🚀 พิมพ์ "skip" เพื่อข้ามการใส่คำอธิบาย'
      );

    } catch (error) {
      logger.error('Error processing video message:', error);
      
      await this.sendMessage(chatId, '❌ เกิดข้อผิดพลาดในการประมวลผลวิดีโอ กรุณาลองใหม่อีกครั้งครับ');
    }
  }

  // จัดการข้อความธรรมดา
  async handleTextMessage(msg) {
    const chatId = msg.chat.id;
    const text = msg.text.toLowerCase();
    const userId = msg.from.id;

    // ตรวจสอบว่ามีวิดีโอที่รอ description อยู่หรือไม่
    if (this.pendingVideos.size > 0) {
      // หาวิดีโอที่ตรงกับ userId นี้
      let pendingVideo = null;
      let videoFileId = null;
      
      for (const [fileId, videoData] of this.pendingVideos.entries()) {
        if (videoData.userId === userId && videoData.chatId === chatId) {
          pendingVideo = videoData;
          videoFileId = fileId;
          break;
        }
      }
      
      if (pendingVideo) {
        let description = msg.text;
        
        // ถ้าผู้ใช้พิมพ์ "skip" ให้ใช้ description เริ่มต้น
        if (text === 'skip') {
          description = 'คลิปใหม่มาแล้วครับ';
          await this.sendMessage(chatId, 'ข้ามการใส่คำอธิบาย จะใช้คำอธิบายเริ่มต้น');
        } else {
          await this.sendMessage(chatId, `✨ ได้รับคำอธิบายแล้ว: "${description}"`);
        }
        
        // ลบออกจากคิว
        this.pendingVideos.delete(videoFileId);
        
        // เริ่มโพสต์วิดีโอพร้อม description
        await this.sendMessage(chatId, '🚀 เริ่มโพสต์วิดีโอไปยัง Facebook Reels กรุณารอสักครู่นะครับ...');
        
        // ส่งไปยังคิวสำหรับโพสต์ Facebook Reels
        await this.facebookReelsService.queueReelsPosting({
          videoPath: pendingVideo.videoPath,
          originalMessageId: pendingVideo.originalMessageId,
          userId: pendingVideo.userId,
          chatId: pendingVideo.chatId,
          timestamp: pendingVideo.timestamp,
          description: description // เพิ่ม description
        });
        
        return; // ออกจากฟังก์ชัน
      }
    }

    // คำสั่งต่างๆ
    if (text === '/help' || text === 'help' || text === 'ช่วยเหลือ') {
      return await this.sendMessage(chatId, 
        `🤖 Telegram Bot สำหรับโพสต์ Facebook Reels\n\n📹 วิธีใช้งาน:\n1. ส่งไฟล์วิดีโอมาที่นี่\n2. บอทจะถามคำอธิบาย\n3. ใส่คำอธิบายที่ต้องการ หรือ พิมพ์ "skip"\n4. บอทจะโพสต์ไปยัง Facebook Page อัตโนมัติ\n\n💫 คำสั่ง:\n- "/help" หรือ "ช่วยเหลือ" - แสดงวิธีใช้งาน\n- "/status" หรือ "สถานะ" - ตรวจสอบสถานะระบบ`
      );
    }

    if (text === '/status' || text === 'status' || text === 'สถานะ') {
      const systemStatus = await this.getSystemStatus();
      return await this.sendMessage(chatId, systemStatus);
    }

    if (text === '/start') {
      return await this.sendMessage(chatId, 
        `🎉 ยินดีต้อนรับสู่ Telegram Bot สำหรับโพสต์ Facebook Reels!\n\n📹 ส่งวิดีโอมาที่นี่ แล้วผมจะโพสต์ไปยัง Facebook Reels ให้คุณอัตโนมัติ\n\n💬 พิมพ์ "/help" เพื่อดูวิธีใช้งานครับ`
      );
    }

    // ข้อความเริ่มต้น
    return await this.sendMessage(chatId, 
      `🤖 สวัสดีครับ! ผมเป็น Bot สำหรับโพสต์วิดีโอไปยัง Facebook Reels อัตโนมัติ\n\n📹 กรุณาส่งไฟล์วิดีโอมาที่นี่ แล้วผมจะโพสต์ไปยัง Facebook Page ให้คุณเลย!\n\n💬 พิมพ์ "/help" หากต้องการดูวิธีใช้งาน`
    );
  }

  // ดาวน์โหลดวิดีโอจาก Telegram (ปรับปรุงตามคำแนะนำ)
  async downloadVideo(fileId) {
    try {
      // ขั้นตอนที่ 1: ดึงข้อมูลไฟล์จาก Telegram API
      const fileInfo = await this.bot.getFile(fileId);
      logger.info('Retrieved Telegram file info:', { 
        fileId, 
        filePath: fileInfo.file_path,
        fileSize: fileInfo.file_size 
      });
      
      // ขั้นตอนที่ 2: สร้าง URL สำหรับดาวน์โหลด
      const fileUrl = `https://api.telegram.org/file/bot${config.telegram.botToken}/${fileInfo.file_path}`;
      
      // ขั้นตอนที่ 3: ตั้งชื่อไฟล์ปลายทาง
      const timestamp = Date.now();
      const fileExtension = path.extname(fileInfo.file_path) || '.mp4';
      const fileName = `telegram_${fileId}_${timestamp}${fileExtension}`;
      const localFilePath = path.join(config.upload.path, 'temp', fileName);
      
      // สร้างโฟลเดอร์ temp หากยังไม่มี
      await fs.ensureDir(path.dirname(localFilePath));
      
      logger.info('Starting video download from Telegram:', { 
        fileUrl: fileUrl.replace(config.telegram.botToken, '[HIDDEN]'),
        localFilePath,
        expectedSize: fileInfo.file_size
      });
      
      // ขั้นตอนที่ 4: ดาวน์โหลดด้วย axios stream (ปรับปรุงความเร็ว)
      const response = await axios({
        method: 'GET',
        url: fileUrl,
        responseType: 'stream',
        timeout: 3 * 60 * 1000, // ลดเหลือ 3 นาที timeout
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        maxRedirects: 5
      });
      
      const writeStream = fs.createWriteStream(localFilePath);
      
      // เพิ่ว progress tracking
      let downloadedBytes = 0;
      const totalBytes = fileInfo.file_size || 0;
      
      response.data.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0) {
          const progress = Math.round((downloadedBytes / totalBytes) * 100);
          if (progress % 10 === 0) { // log ทุก 10%
            logger.info(`Download progress: ${progress}% (${Math.round(downloadedBytes/1024/1024)}MB/${Math.round(totalBytes/1024/1024)}MB)`);
          }
        }
      });
      
      response.data.pipe(writeStream);
      
      return new Promise((resolve, reject) => {
        writeStream.on('finish', () => {
          logger.info('Video downloaded successfully from Telegram:', { 
            localFilePath, 
            downloadedSize: downloadedBytes,
            fileId
          });
          resolve(localFilePath);
        });
        
        writeStream.on('error', (error) => {
          logger.error('Error writing downloaded video file:', error);
          // ลบไฟล์ที่ดาวน์โหลดไม่สำเร็จ
          fs.remove(localFilePath).catch(() => {});
          reject(error);
        });
        
        response.data.on('error', (error) => {
          logger.error('Error downloading video from Telegram:', error);
          fs.remove(localFilePath).catch(() => {});
          reject(error);
        });
      });
      
    } catch (error) {
      logger.error('Error getting video file info from Telegram:', error);
      throw error;
    }
  }

  // ส่งข้อความ Telegram
  async sendMessage(chatId, text) {
    try {
      // Check if bot is initialized
      if (!this.bot || !this.isInitialized) {
        logger.warn('Bot not initialized yet, waiting...');
        // Wait for bot to be initialized (max 10 seconds)
        let attempts = 0;
        while ((!this.bot || !this.isInitialized) && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 200));
          attempts++;
        }
        
        if (!this.bot || !this.isInitialized) {
          throw new Error('Telegram bot not initialized after waiting');
        }
      }
      
      return await this.bot.sendMessage(chatId, text);
    } catch (error) {
      logger.error('Error sending Telegram message:', error);
      throw error;
    }
  }

  // ดึงสถานะระบบ
  async getSystemStatus() {
    try {
      const enabledPagesCount = await this.facebookReelsService.getEnabledPagesCount();
      const queueStatus = await this.facebookReelsService.getQueueStatus();
      
      return `📊 สถานะระบบ:\n\n🔸 Facebook Pages: ${enabledPagesCount} เพจ (ที่มีข้อมูลจริง)\n🔸 งานในคิว: ${queueStatus.waiting} รายการ\n🔸 กำลังประมวลผล: ${queueStatus.active} รายการ\n🔸 เสร็จสิ้นแล้ว: ${queueStatus.completed} รายการ\n🔸 ล้มเหลว: ${queueStatus.failed} รายการ\n\n✅ ระบบพร้อมใช้งาน`;
    } catch (error) {
      logger.error('Error getting system status:', error);
      return '❌ ไม่สามารถดึงสถานะระบบได้ในขณะนี้';
    }
  }

  // ทำความสะอาด pending videos ที่เก่าเกินไป
  cleanupPendingVideos() {
    const now = new Date();
    const maxAge = 10 * 60 * 1000; // 10 นาที
    
    for (const [fileId, videoData] of this.pendingVideos.entries()) {
      if (now - videoData.timestamp > maxAge) {
        logger.info('Cleaning up expired pending video:', { fileId, userId: videoData.userId });
        this.pendingVideos.delete(fileId);
        
        // ลบไฟล์วิดีโอที่ไม่ได้โพสต์
        try {
          fs.remove(videoData.videoPath).catch(() => {});
        } catch (error) {
          logger.warn('Failed to cleanup pending video file:', error.message);
        }
      }
    }
  }

  // ส่งการแจ้งเตือนเมื่อโพสต์เสร็จสิ้น
  async notifyPostingComplete(chatId, result) {
    try {
      const { successful, failed, total } = result;
      
      let message = `🎉 โพสต์วิดีโอเสร็จสิ้นแล้ว!\n\n`;
      message += `✅ โพสต์สำเร็จ: ${successful}/${total} เพจ\n`;
      
      if (failed > 0) {
        message += `❌ โพสต์ไม่สำเร็จ: ${failed} เพจ\n`;
      }
      
      message += `\n📱 วิดีโอได้ถูกโพสต์ไปยัง Facebook Page ทั้ง ${successful} เพจแล้ว!\n`;
      message += `🔄 การโพสต์จะดำเนินการทีละเพจตามลำดับ`;

      await this.sendMessage(chatId, message);
    } catch (error) {
      logger.error('Error sending posting complete notification:', error);
    }
  }

  // ส่งการแจ้งเตือนเมื่อเกิดข้อผิดพลาด
  async notifyPostingError(chatId, error) {
    try {
      await this.sendMessage(chatId, 
        `❌ เกิดข้อผิดพลาดในการโพสต์ Facebook Reels\n\nรายละเอียด: ${error.message}\n\nกรุณาลองใหม่อีกครั้งครับ`
      );
    } catch (error) {
      logger.error('Error sending posting error notification:', error);
    }
  }
}

// Static instance for singleton pattern
TelegramBotController.instance = null;

module.exports = TelegramBotController;