const Bull = require('bull');
const { config } = require('../config');
const { logger, performanceLogger } = require('../utils/logger');
const FacebookReelsService = require('./facebookReelsService');
const VideoProcessor = require('./videoProcessor');

class QueueManager {
  constructor() {
    // Create Bull queue for video processing
    this.videoQueue = new Bull('video processing', {
      redis: {
        port: 6379,
        host: '127.0.0.1',
        // Use in-memory fallback if Redis is not available
        lazyConnect: true
      },
      defaultJobOptions: {
        removeOnComplete: 10, // Keep last 10 completed jobs
        removeOnFail: 20,     // Keep last 20 failed jobs
        attempts: 3,          // Retry failed jobs 3 times
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      }
    });

    // Create Bull queue for Facebook posting
    this.facebookQueue = new Bull('facebook posting', {
      redis: {
        port: 6379,
        host: '127.0.0.1',
        lazyConnect: true
      },
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 20,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000
        }
      }
    });

    this.facebookReelsService = new FacebookReelsService();
    this.videoProcessor = new VideoProcessor();
    
    this.setupProcessors();
    this.setupEventHandlers();
  }

  // Setup job processors
  setupProcessors() {
    // Video processing processor
    this.videoQueue.process('process-video', 1, async (job) => {
      const startTime = performanceLogger.start('video-processing', { jobId: job.id });
      
      try {
        const { videoPath, messageId, userId } = job.data;
        
        logger.info('Starting video processing job:', { 
          jobId: job.id, 
          videoPath, 
          messageId,
          userId 
        });

        // Update job progress
        await job.progress(10);

        // Validate video
        const validation = await this.videoProcessor.validateVideo(videoPath);
        if (!validation.isValid) {
          throw new Error(`Invalid video: ${JSON.stringify(validation.validations)}`);
        }

        await job.progress(30);

        // Process video for Reels
        const processedVideoPath = await this.videoProcessor.processVideoForReels(videoPath);
        
        await job.progress(80);

        // Generate thumbnail (optional)
        const thumbnailPath = await this.videoProcessor.generateThumbnail(processedVideoPath);
        
        await job.progress(100);

        performanceLogger.end('video-processing', startTime, { jobId: job.id });

        return {
          originalVideoPath: videoPath,
          processedVideoPath,
          thumbnailPath,
          messageId,
          userId
        };
      } catch (error) {
        performanceLogger.error('video-processing', startTime, error, { jobId: job.id });
        throw error;
      }
    });

    // Facebook posting processor - Sequential processing (concurrency = 1)
    this.facebookQueue.process('post-reels', 1, async (job) => {
      const startTime = performanceLogger.start('facebook-posting', { jobId: job.id });
      
      try {
        const { processedVideoPath, messageId, userId, pages } = job.data;
        
        logger.info('Starting Facebook posting job:', { 
          jobId: job.id, 
          pagesCount: pages.length,
          messageId,
          userId 
        });

        const results = [];
        let successCount = 0;
        let failCount = 0;

        // Sequential posting to each page
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          const progress = Math.round(((i + 1) / pages.length) * 100);
          
          try {
            logger.info(`Posting to page ${i + 1}/${pages.length}:`, { 
              pageId: page.pageId, 
              pageName: page.name 
            });

            const postResult = await this.facebookReelsService.postReelsToPage(
              processedVideoPath, 
              page
            );
            
            results.push({
              pageId: page.pageId,
              pageName: page.name,
              status: 'success',
              postId: postResult.id,
              timestamp: new Date()
            });

            successCount++;
            
            logger.info(`Successfully posted to page:`, { 
              pageId: page.pageId, 
              postId: postResult.id 
            });

            // Wait between posts (as configured)
            if (i < pages.length - 1) {
              await this.delay(config.reels.delayBetweenPosts * 1000);
            }

          } catch (error) {
            logger.error(`Failed to post to page:`, { 
              pageId: page.pageId, 
              error: error.message 
            });

            results.push({
              pageId: page.pageId,
              pageName: page.name,
              status: 'failed',
              error: error.message,
              timestamp: new Date()
            });

            failCount++;
          }

          await job.progress(progress);
        }

        performanceLogger.end('facebook-posting', startTime, { 
          jobId: job.id,
          successCount,
          failCount 
        });

        return {
          results,
          summary: {
            total: pages.length,
            successful: successCount,
            failed: failCount,
            successRate: Math.round((successCount / pages.length) * 100)
          },
          messageId,
          userId
        };
      } catch (error) {
        performanceLogger.error('facebook-posting', startTime, error, { jobId: job.id });
        throw error;
      }
    });
  }

  // Setup event handlers
  setupEventHandlers() {
    // Video processing events
    this.videoQueue.on('completed', async (job, result) => {
      logger.info('Video processing completed:', { 
        jobId: job.id, 
        processedVideoPath: result.processedVideoPath 
      });

      // Automatically queue Facebook posting job
      await this.queueFacebookPosting({
        processedVideoPath: result.processedVideoPath,
        messageId: result.messageId,
        userId: result.userId
      });

      // Cleanup original video file
      await this.videoProcessor.cleanupTempFile(result.originalVideoPath);
    });

    this.videoQueue.on('failed', (job, err) => {
      logger.error('Video processing failed:', { 
        jobId: job.id, 
        error: err.message,
        attempts: job.attemptsMade,
        maxAttempts: job.opts.attempts 
      });
    });

    // Facebook posting events
    this.facebookQueue.on('completed', async (job, result) => {
      logger.info('Facebook posting completed:', { 
        jobId: job.id, 
        summary: result.summary 
      });

      // Send notification back to LINE Bot
      await this.notifyCompletion(result);

      // Cleanup processed video file after posting
      await this.videoProcessor.cleanupProcessedFile(result.processedVideoPath);
    });

    this.facebookQueue.on('failed', (job, err) => {
      logger.error('Facebook posting failed:', { 
        jobId: job.id, 
        error: err.message,
        attempts: job.attemptsMade,
        maxAttempts: job.opts.attempts 
      });

      // Send error notification
      this.notifyError(job.data.userId, err);
    });

    // General queue events
    ['videoQueue', 'facebookQueue'].forEach(queueName => {
      const queue = this[queueName];
      
      queue.on('stalled', (job) => {
        logger.warn(`Job stalled in ${queueName}:`, { jobId: job.id });
      });

      queue.on('progress', (job, progress) => {
        logger.debug(`Job progress in ${queueName}:`, { 
          jobId: job.id, 
          progress: `${progress}%` 
        });
      });
    });
  }

  // Queue video processing
  async queueVideoProcessing(jobData) {
    try {
      const job = await this.videoQueue.add('process-video', jobData, {
        priority: 1, // High priority for video processing
        delay: 0
      });

      logger.info('Video processing job queued:', { 
        jobId: job.id, 
        videoPath: jobData.videoPath 
      });

      return job.id;
    } catch (error) {
      logger.error('Error queueing video processing:', error);
      throw error;
    }
  }

  // Queue Facebook posting
  async queueFacebookPosting(jobData) {
    try {
      // Get enabled Facebook pages
      const FacebookPagesManager = require('../config/facebookPages');
      const pagesManager = new FacebookPagesManager();
      const pages = pagesManager.getEnabledPages();

      const job = await this.facebookQueue.add('post-reels', {
        ...jobData,
        pages
      }, {
        priority: 2, // Lower priority than video processing
        delay: 2000  // Small delay to ensure video processing is complete
      });

      logger.info('Facebook posting job queued:', { 
        jobId: job.id, 
        pagesCount: pages.length 
      });

      return job.id;
    } catch (error) {
      logger.error('Error queueing Facebook posting:', error);
      throw error;
    }
  }

  // Get queue statistics
  async getQueueStats() {
    try {
      const videoStats = await this.getQueueInfo(this.videoQueue);
      const facebookStats = await this.getQueueInfo(this.facebookQueue);

      return {
        video: videoStats,
        facebook: facebookStats,
        total: {
          waiting: videoStats.waiting + facebookStats.waiting,
          active: videoStats.active + facebookStats.active,
          completed: videoStats.completed + facebookStats.completed,
          failed: videoStats.failed + facebookStats.failed
        }
      };
    } catch (error) {
      logger.error('Error getting queue stats:', error);
      return {
        video: { waiting: 0, active: 0, completed: 0, failed: 0 },
        facebook: { waiting: 0, active: 0, completed: 0, failed: 0 },
        total: { waiting: 0, active: 0, completed: 0, failed: 0 }
      };
    }
  }

  // Get individual queue info
  async getQueueInfo(queue) {
    const waiting = await queue.getWaiting();
    const active = await queue.getActive();
    const completed = await queue.getCompleted();
    const failed = await queue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length
    };
  }

  // Send completion notification
  async notifyCompletion(result) {
    try {
      const LineBotController = require('../controllers/lineBotController');
      const lineBot = new LineBotController();
      
      await lineBot.notifyPostingComplete(result.userId, result.summary);
    } catch (error) {
      logger.error('Error sending completion notification:', error);
    }
  }

  // Send error notification
  async notifyError(userId, error) {
    try {
      const LineBotController = require('../controllers/lineBotController');
      const lineBot = new LineBotController();
      
      await lineBot.notifyPostingError(userId, error);
    } catch (error) {
      logger.error('Error sending error notification:', error);
    }
  }

  // Cleanup old jobs
  async cleanupOldJobs() {
    try {
      await this.videoQueue.clean(24 * 60 * 60 * 1000, 'completed'); // 24 hours
      await this.videoQueue.clean(24 * 60 * 60 * 1000, 'failed');
      
      await this.facebookQueue.clean(24 * 60 * 60 * 1000, 'completed');
      await this.facebookQueue.clean(24 * 60 * 60 * 1000, 'failed');
      
      logger.info('Old jobs cleaned up');
    } catch (error) {
      logger.error('Error cleaning up old jobs:', error);
    }
  }

  // Pause queues
  async pauseQueues() {
    await this.videoQueue.pause();
    await this.facebookQueue.pause();
    logger.info('Queues paused');
  }

  // Resume queues
  async resumeQueues() {
    await this.videoQueue.resume();
    await this.facebookQueue.resume();
    logger.info('Queues resumed');
  }

  // Graceful shutdown
  async shutdown() {
    logger.info('Shutting down queue manager...');
    
    await this.videoQueue.close();
    await this.facebookQueue.close();
    
    logger.info('Queue manager shut down');
  }

  // Utility delay function
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = QueueManager;