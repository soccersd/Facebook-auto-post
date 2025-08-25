require('dotenv').config();
const FacebookPagesManager = require('./facebookPages');

// สร้าง instance ของ FacebookPagesManager
const pagesManager = new FacebookPagesManager();

const config = {
  // Telegram Bot Configuration
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
  },
  
  // Facebook Configuration - รองรับแบบจับคู่ App ID + Page Token
  facebook: {
    // Primary App (App 1)
    appId: process.env.FACEBOOK_APP_ID_1 || process.env.FACEBOOK_APP_ID,
    appSecret: process.env.FACEBOOK_APP_SECRET_1 || process.env.FACEBOOK_APP_SECRET || null,
    
    // Multiple Apps Support - รองรับหลาย App
    apps: {
      app1: {
        appId: process.env.FACEBOOK_APP_ID_1,
        appSecret: process.env.FACEBOOK_APP_SECRET_1 || null
      },
      app2: {
        appId: process.env.FACEBOOK_APP_ID_2,
        appSecret: process.env.FACEBOOK_APP_SECRET_2 || null
      },
      app3: {
        appId: process.env.FACEBOOK_APP_ID_3,
        appSecret: process.env.FACEBOOK_APP_SECRET_3 || null
      },
      app4: {
        appId: process.env.FACEBOOK_APP_ID_4,
        appSecret: process.env.FACEBOOK_APP_SECRET_4 || null
      },
      app5: {
        appId: process.env.FACEBOOK_APP_ID_5,
        appSecret: process.env.FACEBOOK_APP_SECRET_5 || null
      }
      // เพิ่มได้ตามต้องการ
    },
    
    // โหลด Facebook Pages จาก FacebookPagesManager
    pages: pagesManager.getEnabledPages()
  },
  
  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
  },
  
  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  // Upload Configuration
  upload: {
    maxFileSize: process.env.MAX_FILE_SIZE || '50MB',
    path: process.env.UPLOAD_PATH || './uploads',
    allowedTypes: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv'],
  },
  
  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    path: process.env.LOG_PATH || './logs',
  },
  
  // Facebook Reels Configuration
  reels: {
    // จำนวนเวลารอระหว่างการโพสต์แต่ละเพจ (วินาที)
    delayBetweenPosts: 1, // ลดลงเพื่อความเร็ว
    // จำนวนครั้งที่จะลองใหม่หากโพสต์ไม่สำเร็จ
    maxRetries: 2, // ลดลงเพื่อความเร็ว
    // เวลารอก่อนลองใหม่ (วินาที)
    retryDelay: 5, // ลดลงเพื่อความเร็ว
  }
};

// Validate required configuration
const validateConfig = () => {
  const required = [
    'telegram.botToken',
    'facebook.appId'
    // ลบ 'facebook.appSecret' ออกเพราะไม่จำเป็น
  ];
  
  for (const key of required) {
    const value = key.split('.').reduce((obj, k) => obj?.[k], config);
    if (!value) {
      throw new Error(`Missing required configuration: ${key}`);
    }
  }
  
  // แจ้งเตือนถ้าไม่มี APP_SECRET
  if (!config.facebook.appSecret) {
    console.warn('⚠️  FACEBOOK_APP_SECRET ไม่ได้ตั้งค่า - จะใช้แค่ Page Access Token');
  }
  
  if (config.facebook.pages.length === 0) {
    console.warn('Warning: No Facebook pages configured. Please add pages to facebookPages.js');
  } else {
    console.log(`✅ Loaded ${config.facebook.pages.length} Facebook page(s)`);
  }
};

// Export configuration and validation function
module.exports = {
  config,
  validateConfig
};