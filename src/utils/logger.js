const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');
const { config } = require('../config');

// สร้างโฟลเดอร์ logs หากยังไม่มี
fs.ensureDirSync(config.logging.path);

// Custom format สำหรับ log
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // เพิ่ม metadata หากมี
    if (Object.keys(meta).length > 0) {
      logMessage += ` | ${JSON.stringify(meta)}`;
    }
    
    // เพิ่ม stack trace หากเป็น error
    if (stack) {
      logMessage += `\n${stack}`;
    }
    
    return logMessage;
  })
);

// สร้าง logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  format: customFormat,
  defaultMeta: { service: 'linebot-facebook-reels' },
  transports: [
    // เขียน log ลงไฟล์สำหรับ error
    new winston.transports.File({
      filename: path.join(config.logging.path, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // เขียน log ลงไฟล์สำหรับทุกระดับ
    new winston.transports.File({
      filename: path.join(config.logging.path, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),

    // Log สำหรับ LINE Bot activities
    new winston.transports.File({
      filename: path.join(config.logging.path, 'linebot.log'),
      level: 'info',
      maxsize: 5242880, // 5MB
      maxFiles: 3,
      tailable: true,
      format: winston.format.combine(
        winston.format.label({ label: 'LINEBOT' }),
        customFormat
      )
    }),

    // Log สำหรับ Facebook API activities
    new winston.transports.File({
      filename: path.join(config.logging.path, 'facebook.log'),
      level: 'info',
      maxsize: 5242880, // 5MB
      maxFiles: 3,
      tailable: true,
      format: winston.format.combine(
        winston.format.label({ label: 'FACEBOOK' }),
        customFormat
      )
    }),

    // Log สำหรับ Video Processing
    new winston.transports.File({
      filename: path.join(config.logging.path, 'video.log'),
      level: 'info',
      maxsize: 5242880, // 5MB
      maxFiles: 3,
      tailable: true,
      format: winston.format.combine(
        winston.format.label({ label: 'VIDEO' }),
        customFormat
      )
    })
  ]
});

// เพิ่ม console transport สำหรับ development
if (config.server.env !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ level, message, timestamp, ...meta }) => {
        let logMessage = `${timestamp} [${level}]: ${message}`;
        
        if (Object.keys(meta).length > 0) {
          logMessage += ` ${JSON.stringify(meta, null, 2)}`;
        }
        
        return logMessage;
      })
    )
  }));
}

// สร้าง specialized loggers
const createSpecializedLogger = (label, filename) => {
  return winston.createLogger({
    level: config.logging.level,
    format: winston.format.combine(
      winston.format.label({ label }),
      customFormat
    ),
    defaultMeta: { service: 'linebot-facebook-reels' },
    transports: [
      new winston.transports.File({
        filename: path.join(config.logging.path, filename),
        maxsize: 5242880, // 5MB
        maxFiles: 3,
        tailable: true
      })
    ]
  });
};

// Specialized loggers
const lineBotLogger = createSpecializedLogger('LINEBOT', 'linebot.log');
const facebookLogger = createSpecializedLogger('FACEBOOK', 'facebook.log');
const videoLogger = createSpecializedLogger('VIDEO', 'video.log');

// Helper functions สำหรับ logging แต่ละประเภท
const logLineBot = {
  info: (message, meta = {}) => {
    logger.info(message, { ...meta, category: 'linebot' });
    lineBotLogger.info(message, meta);
  },
  error: (message, error = null, meta = {}) => {
    const errorMeta = error ? { 
      error: error.message, 
      stack: error.stack,
      ...meta 
    } : meta;
    logger.error(message, { ...errorMeta, category: 'linebot' });
    lineBotLogger.error(message, errorMeta);
  },
  warn: (message, meta = {}) => {
    logger.warn(message, { ...meta, category: 'linebot' });
    lineBotLogger.warn(message, meta);
  },
  debug: (message, meta = {}) => {
    logger.debug(message, { ...meta, category: 'linebot' });
    lineBotLogger.debug(message, meta);
  }
};

const logFacebook = {
  info: (message, meta = {}) => {
    logger.info(message, { ...meta, category: 'facebook' });
    facebookLogger.info(message, meta);
  },
  error: (message, error = null, meta = {}) => {
    const errorMeta = error ? { 
      error: error.message, 
      stack: error.stack,
      ...meta 
    } : meta;
    logger.error(message, { ...errorMeta, category: 'facebook' });
    facebookLogger.error(message, errorMeta);
  },
  warn: (message, meta = {}) => {
    logger.warn(message, { ...meta, category: 'facebook' });
    facebookLogger.warn(message, meta);
  },
  debug: (message, meta = {}) => {
    logger.debug(message, { ...meta, category: 'facebook' });
    facebookLogger.debug(message, meta);
  }
};

const logVideo = {
  info: (message, meta = {}) => {
    logger.info(message, { ...meta, category: 'video' });
    videoLogger.info(message, meta);
  },
  error: (message, error = null, meta = {}) => {
    const errorMeta = error ? { 
      error: error.message, 
      stack: error.stack,
      ...meta 
    } : meta;
    logger.error(message, { ...errorMeta, category: 'video' });
    videoLogger.error(message, errorMeta);
  },
  warn: (message, meta = {}) => {
    logger.warn(message, { ...meta, category: 'video' });
    videoLogger.warn(message, meta);
  },
  debug: (message, meta = {}) => {
    logger.debug(message, { ...meta, category: 'video' });
    videoLogger.debug(message, meta);
  }
};

// Performance logging helpers
const performanceLogger = {
  start: (operation, meta = {}) => {
    const startTime = Date.now();
    logger.info(`Starting operation: ${operation}`, { 
      ...meta, 
      operation, 
      startTime,
      category: 'performance' 
    });
    return startTime;
  },
  
  end: (operation, startTime, meta = {}) => {
    const endTime = Date.now();
    const duration = endTime - startTime;
    logger.info(`Operation completed: ${operation}`, { 
      ...meta, 
      operation, 
      startTime, 
      endTime, 
      duration: `${duration}ms`,
      category: 'performance' 
    });
    return duration;
  },
  
  error: (operation, startTime, error, meta = {}) => {
    const endTime = Date.now();
    const duration = endTime - startTime;
    logger.error(`Operation failed: ${operation}`, { 
      ...meta, 
      operation, 
      startTime, 
      endTime, 
      duration: `${duration}ms`,
      error: error.message,
      stack: error.stack,
      category: 'performance' 
    });
    return duration;
  }
};

// Function สำหรับดูสถิติ log files
const getLogStats = async () => {
  try {
    const logDir = config.logging.path;
    const files = await fs.readdir(logDir);
    const stats = {};

    for (const file of files) {
      if (file.endsWith('.log')) {
        const filePath = path.join(logDir, file);
        const fileStat = await fs.stat(filePath);
        stats[file] = {
          size: Math.round(fileStat.size / 1024), // KB
          lastModified: fileStat.mtime,
          created: fileStat.birthtime
        };
      }
    }

    return stats;
  } catch (error) {
    logger.error('Error getting log stats:', error);
    return {};
  }
};

// Clean up old log files
const cleanupOldLogs = async (daysOld = 30) => {
  try {
    const logDir = config.logging.path;
    const files = await fs.readdir(logDir);
    const now = Date.now();
    const maxAge = daysOld * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (file.endsWith('.log')) {
        const filePath = path.join(logDir, file);
        const fileStat = await fs.stat(filePath);
        
        if (now - fileStat.mtime.getTime() > maxAge) {
          await fs.remove(filePath);
          logger.info(`Old log file removed: ${file}`, { 
            file, 
            age: Math.round((now - fileStat.mtime.getTime()) / (24 * 60 * 60 * 1000)) 
          });
        }
      }
    }
  } catch (error) {
    logger.error('Error cleaning up old logs:', error);
  }
};

module.exports = {
  logger,
  logLineBot,
  logFacebook,
  logVideo,
  performanceLogger,
  getLogStats,
  cleanupOldLogs
};