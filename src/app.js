const express = require('express');
const { config, validateConfig } = require('./config');
const { logger, performanceLogger } = require('./utils/logger');
const TelegramBotController = require('./controllers/lineBotController');
const FacebookAppManager = require('./utils/facebookAppManager');

// สร้าง Express app
const app = express();

// ตรวจสอบ configuration
try {
  validateConfig();
  logger.info('Configuration validated successfully');
  
  // แสดงรายงานการใช้งาน Facebook Apps
  const appManager = new FacebookAppManager();
  appManager.generateReport();
} catch (error) {
  logger.error('Configuration validation failed:', error);
  process.exit(1);
}

// สร้าง controllers
const telegramBotController = TelegramBotController.getInstance();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const startTime = performanceLogger.start(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  res.on('finish', () => {
    performanceLogger.end(`${req.method} ${req.path}`, startTime, {
      statusCode: res.statusCode,
      contentLength: res.get('Content-Length')
    });
  });
  
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: require('../package.json').version,
      environment: config.server.env,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      },
      telegram: {
        connected: telegramBotController.bot ? true : false
      }
    };
    
    res.status(200).json(healthCheck);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Telegram Bot webhook endpoint (if needed for webhook mode)
app.post('/webhook/telegram', async (req, res) => {
  try {
    logger.info('Received Telegram webhook (webhook mode):', req.body);
    // Note: In polling mode, this endpoint is not used
    // Telegram bot is already handling messages via polling
    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error handling Telegram webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Facebook webhook verification (ถ้าต้องการใช้ Facebook webhooks ในอนาคต)
app.get('/webhook/facebook', (req, res) => {
  const VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN || 'your-verify-token';
  
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      logger.info('Facebook webhook verified');
      res.status(200).send(challenge);
    } else {
      logger.warn('Facebook webhook verification failed');
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// API endpoints สำหรับการจัดการระบบ
app.get('/api/status', async (req, res) => {
  try {
    const facebookReelsService = telegramBotController.facebookReelsService;
    const queueStatus = await facebookReelsService.getQueueStatus();
    const enabledPagesCount = await facebookReelsService.getEnabledPagesCount();
    
    res.json({
      status: 'running',
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: config.server.env
      },
      telegramBot: {
        status: 'connected'
      },
      facebook: {
        enabledPages: enabledPagesCount,
        queue: queueStatus
      }
    });
  } catch (error) {
    logger.error('Error getting system status:', error);
    res.status(500).json({ error: 'Failed to get system status' });
  }
});

app.get('/api/facebook/pages', async (req, res) => {
  try {
    const facebookReelsService = telegramBotController.facebookReelsService;
    const connectionStatus = await facebookReelsService.checkFacebookConnection();
    const enabledPagesCount = await facebookReelsService.getEnabledPagesCount();
    
    res.json({
      totalPages: enabledPagesCount,
      connections: connectionStatus
    });
  } catch (error) {
    logger.error('Error getting Facebook pages status:', error);
    res.status(500).json({ error: 'Failed to get Facebook pages status' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).send('Internal Server Error');
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown
const gracefulShutdown = () => {
  logger.info('Received shutdown signal, shutting down gracefully...');
  
  server.close(() => {
    logger.info('HTTP server closed');
    
    // ทำความสะอาดทรัพยากร
    setTimeout(() => {
      logger.info('Process terminated');
      process.exit(0);
    }, 1000);
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// Handle process signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
const port = config.server.port;
const server = app.listen(port, () => {
  logger.info(`🚀 Telegram Bot Facebook Reels Poster started successfully!`, {
    port,
    environment: config.server.env,
    nodeVersion: process.version
  });
  
  logger.info('📋 Available endpoints:');
  logger.info('  POST /webhook/telegram - Telegram Bot webhook (if using webhook mode)');
  logger.info('  GET  /health - Health check');
  logger.info('  GET  /api/status - System status');
  logger.info('  GET  /api/facebook/pages - Facebook pages status');
  
  logger.info('🔧 Next steps:');
  logger.info('  1. Bot is running in polling mode - no webhook URL needed');
  logger.info('  2. Add your Telegram Bot to chat and start sending videos');
  logger.info('  3. Add your Facebook Page access tokens in src/config/facebookPages.js');
  logger.info('  4. Create .env file based on .env.example');
});

module.exports = app;