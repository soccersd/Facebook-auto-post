require('dotenv').config();
const FacebookPagesManager = require('./facebookPages');

// สร้าง instance ของ FacebookPagesManager
const pagesManager = new FacebookPagesManager();

const config = {
  // Telegram Bot Configuration
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
  },
  
  // Facebook Configuration
  facebook: {
    appId: process.env.FACEBOOK_APP_ID,
    appSecret: process.env.FACEBOOK_APP_SECRET,
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
    delayBetweenPosts: 5,
    // จำนวนครั้งที่จะลองใหม่หากโพสต์ไม่สำเร็จ
    maxRetries: 3,
    // เวลารอก่อนลองใหม่ (วินาที)
    retryDelay: 10,
  }
};

// Validate required configuration
const validateConfig = () => {
  const required = [
    'telegram.botToken',
    'facebook.appId',
    'facebook.appSecret'
  ];
  
  for (const key of required) {
    const value = key.split('.').reduce((obj, k) => obj?.[k], config);
    if (!value) {
      throw new Error(`Missing required configuration: ${key}`);
    }
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