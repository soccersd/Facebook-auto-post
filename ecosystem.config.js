module.exports = {
  apps: [
    {
      name: 'telegram-facebook-bot',
      script: 'src/app.js',
      instances: 1, // ใช้ instance เดียวเพื่อป้องกัน conflict ใน Telegram polling
      exec_mode: 'fork', // ใช้ fork mode แทน cluster เพื่อ Telegram Bot
      watch: false, // ปิด watch ใน production
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001, // VPS production ใช้ 3001
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000, // Local development ใช้ 3000
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 8000,
      // Health monitoring
      health_check_grace_period: 10000,
      // Log rotation
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      merge_logs: true,
      // Environment variables
      env_file: '.env',
      // Startup script
      post_update: ['npm install'],
      // Monitoring
      pmx: true,
      // Advanced settings
      ignore_watch: [
        'node_modules',
        'uploads',
        'logs',
        '.git'
      ],
      // Instance configuration
      increment_var: 'PORT',
      // Process management
      vizion: false,
      // Advanced PM2 features
      automation: false,
      // Custom settings for Telegram Bot
      node_args: '--max-old-space-size=512',
      // Restart conditions
      exp_backoff_restart_delay: 100,
      // Custom environment for production
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        LOG_LEVEL: 'info',
        // Performance optimizations
        UV_THREADPOOL_SIZE: 4,
        // Memory management
        NODE_OPTIONS: '--max-old-space-size=512'
      }
    }
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: 'ubuntu', // เปลี่ยนตาม username ของ VPS
      host: ['YOUR_VPS_IP'], // ใส่ IP ของ VPS
      ref: 'origin/main',
      repo: 'YOUR_GIT_REPOSITORY', // ใส่ Git repository URL
      path: '/home/ubuntu/telegram-facebook-bot',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  },

  // PM2+ monitoring (optional)
  monitoring: {
    http: true,
    https: false,
    port: 9615
  }
};