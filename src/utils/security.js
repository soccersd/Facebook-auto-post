const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');
const { logger } = require('./logger');

// Rate limiting middleware
const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 100) => {
  return rateLimit({
    windowMs,
    max,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    onLimitReached: (req) => {
      logger.warn('Rate limit reached:', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
    }
  });
};

// Security headers middleware
const securityHeaders = () => {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  });
};

// File validation middleware
const validateVideoFile = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const file = req.file;
  const allowedMimeTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv'];
  const maxSize = 100 * 1024 * 1024; // 100MB

  // ตรวจสอบ MIME type
  if (!allowedMimeTypes.includes(file.mimetype)) {
    logger.warn('Invalid file type uploaded:', {
      mimetype: file.mimetype,
      filename: file.originalname,
      ip: req.ip
    });
    return res.status(400).json({ 
      error: 'Invalid file type. Only video files are allowed.' 
    });
  }

  // ตรวจสอบขนาดไฟล์
  if (file.size > maxSize) {
    logger.warn('File too large uploaded:', {
      size: file.size,
      filename: file.originalname,
      ip: req.ip
    });
    return res.status(400).json({ 
      error: 'File too large. Maximum size is 100MB.' 
    });
  }

  next();
};

// Sanitize user input
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .trim()
    .substring(0, 1000); // Limit length
};

// Request validation middleware
const validateRequest = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Request validation failed:', {
        errors: errors.array(),
        ip: req.ip,
        path: req.path
      });
      return res.status(400).json({
        error: 'Invalid request data',
        details: errors.array()
      });
    }

    next();
  };
};

// Common validation rules
const validationRules = {
  telegramMessage: [
    body('chatId').isNumeric().withMessage('Chat ID must be numeric'),
    body('message').isLength({ min: 1, max: 4096 }).withMessage('Message length invalid'),
  ],
  facebookPage: [
    body('pageId').isLength({ min: 1, max: 50 }).withMessage('Page ID invalid'),
    body('accessToken').isLength({ min: 10 }).withMessage('Access token invalid'),
  ]
};

// IP whitelist middleware (สำหรับ admin endpoints)
const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
      logger.warn('Unauthorized IP access attempt:', {
        ip: clientIP,
        path: req.path,
        userAgent: req.get('User-Agent')
      });
      return res.status(403).json({ error: 'Access denied' });
    }
    
    next();
  };
};

// Error sanitization - ป้องกันไม่ให้ sensitive data leak
const sanitizeError = (error) => {
  const safeError = {
    message: 'An error occurred',
    timestamp: new Date().toISOString()
  };

  // ใน development mode แสดง error details
  if (process.env.NODE_ENV === 'development') {
    safeError.details = error.message;
    safeError.stack = error.stack;
  }

  return safeError;
};

// Security audit logging
const auditLog = (action, details = {}) => {
  logger.info('Security audit:', {
    action,
    timestamp: new Date().toISOString(),
    ...details,
    category: 'security_audit'
  });
};

module.exports = {
  createRateLimiter,
  securityHeaders,
  validateVideoFile,
  sanitizeInput,
  validateRequest,
  validationRules,
  ipWhitelist,
  sanitizeError,
  auditLog
};