// Smart Upload Optimizer - ปรับปรุงการอัปโหลดแบบอัจฉริยะ
const { logger } = require('./logger');

class SmartUploadOptimizer {
  constructor() {
    this.networkConditions = {
      avgSpeed: 1.0, // MB/s เฉลี่ย
      latency: 100,  // ms
      stability: 0.8, // ความเสถียรของเครือข่าย (0-1)
      lastMeasured: Date.now()
    };
    
    this.uploadMetrics = [];
    this.maxMetrics = 10; // เก็บข้อมูล 10 ครั้งล่าสุด
  }

  // วิเคราะห์เครือข่ายจากประสิทธิภาพการอัปโหลดล่าสุด
  analyzeNetworkConditions(uploadStats) {
    const { uploadSpeed, duration, fileSize, success } = uploadStats;
    
    // อัปเดตข้อมูลเครือข่าย
    this.uploadMetrics.push({
      speed: parseFloat(uploadSpeed) || 0,
      duration: duration || 0,
      fileSize: fileSize || 0,
      success: success || false,
      timestamp: Date.now()
    });

    // เก็บเฉพาะข้อมูลล่าสุด
    if (this.uploadMetrics.length > this.maxMetrics) {
      this.uploadMetrics.shift();
    }

    // คำนวณค่าเฉลี่ย
    const successfulUploads = this.uploadMetrics.filter(m => m.success);
    if (successfulUploads.length > 0) {
      this.networkConditions.avgSpeed = successfulUploads.reduce((sum, m) => sum + m.speed, 0) / successfulUploads.length;
      this.networkConditions.stability = successfulUploads.length / this.uploadMetrics.length;
      this.networkConditions.lastMeasured = Date.now();
    }

    logger.info('Network conditions updated:', this.networkConditions);
  }

  // แนะนำขนาด chunk ที่เหมาะสม
  getOptimalChunkSize() {
    const { avgSpeed, stability } = this.networkConditions;
    
    // เครือข่ายเร็วและเสถียร
    if (avgSpeed > 2.0 && stability > 0.8) {
      return 64 * 1024 * 1024; // 64MB
    }
    
    // เครือข่ายเร็วปานกลาง
    if (avgSpeed > 1.0 && stability > 0.6) {
      return 32 * 1024 * 1024; // 32MB
    }
    
    // เครือข่ายช้าหรือไม่เสถียร
    if (avgSpeed < 0.5 || stability < 0.5) {
      return 8 * 1024 * 1024; // 8MB
    }
    
    // ปกติ
    return 16 * 1024 * 1024; // 16MB
  }

  // แนะนำ timeout ที่เหมาะสม
  getOptimalTimeout() {
    const { avgSpeed, stability } = this.networkConditions;
    const chunkSize = this.getOptimalChunkSize();
    const chunkSizeMB = chunkSize / (1024 * 1024);
    
    // คำนวณเวลาที่คาดหวังสำหรับ chunk size นี้
    const expectedTime = chunkSizeMB / Math.max(avgSpeed, 0.1); // วินาที
    
    // เพิ่ม buffer สำหรับเครือข่ายไม่เสถียร
    const stabilityFactor = stability < 0.6 ? 3 : 2;
    const timeout = Math.max(expectedTime * stabilityFactor * 1000, 60000); // อย่างน้อย 1 นาที
    
    return Math.min(timeout, 5 * 60 * 1000); // ไม่เกิน 5 นาที
  }

  // แนะนำเวลารอระหว่าง chunks
  getOptimalChunkDelay() {
    const { avgSpeed, stability } = this.networkConditions;
    
    // เครือข่ายเร็วและเสถียร - ไม่ต้องรอ
    if (avgSpeed > 2.0 && stability > 0.8) {
      return 0;
    }
    
    // เครือข่ายปานกลาง
    if (avgSpeed > 1.0 && stability > 0.6) {
      return 25; // 0.025 วินาที
    }
    
    // เครือข่ายช้าหรือไม่เสถียร
    return 100; // 0.1 วินาที
  }

  // แนะนำเวลารอระหว่างเพจ
  getOptimalPageDelay() {
    const { stability } = this.networkConditions;
    
    // เครือข่ายเสถียร
    if (stability > 0.8) {
      return 250; // 0.25 วินาที
    }
    
    // เครือข่ายไม่เสถียร
    return 500; // 0.5 วินาที
  }

  // แนะนำการตั้งค่าที่เหมาะสม
  getOptimalSettings() {
    const settings = {
      chunkSize: this.getOptimalChunkSize(),
      chunkTimeout: this.getOptimalTimeout(),
      chunkDelay: this.getOptimalChunkDelay(),
      pageDelay: this.getOptimalPageDelay(),
      maxConcurrentUploads: this.networkConditions.stability > 0.7 ? 2 : 1,
      retryAttempts: this.networkConditions.stability > 0.6 ? 1 : 2
    };

    logger.info('Optimal upload settings calculated:', settings);
    return settings;
  }

  // ให้คำแนะนำการปรับปรุง
  getOptimizationRecommendations() {
    const { avgSpeed, stability } = this.networkConditions;
    const recommendations = [];

    if (avgSpeed < 0.5) {
      recommendations.push({
        type: 'network',
        priority: 'high',
        issue: 'ความเร็วเครือข่ายช้ามาก',
        suggestion: 'ลองเปลี่ยนเครือข่าย WiFi หรือใช้ 4G/5G'
      });
    }

    if (stability < 0.5) {
      recommendations.push({
        type: 'stability',
        priority: 'high',
        issue: 'เครือข่ายไม่เสถียร',
        suggestion: 'ตรวจสอบสัญญาณ WiFi หรือความแรงของ 4G'
      });
    }

    if (avgSpeed > 0.5 && avgSpeed < 1.0) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        issue: 'ความเร็วปานกลาง',
        suggestion: 'ลองอัปโหลดในช่วงเวลาที่เครือข่ายไม่ยุ่ง'
      });
    }

    if (this.uploadMetrics.length < 3) {
      recommendations.push({
        type: 'analysis',
        priority: 'low',
        issue: 'ข้อมูลไม่เพียงพอ',
        suggestion: 'ระบบกำลังเรียนรู้เครือข่ายของคุณ'
      });
    }

    return recommendations;
  }

  // รีเซ็ตข้อมูลเครือข่าย
  resetNetworkAnalysis() {
    this.uploadMetrics = [];
    this.networkConditions = {
      avgSpeed: 1.0,
      latency: 100,
      stability: 0.8,
      lastMeasured: Date.now()
    };
    
    logger.info('Network analysis reset');
  }

  // สร้างรายงานสถานะเครือข่าย
  generateNetworkReport() {
    const { avgSpeed, stability, lastMeasured } = this.networkConditions;
    const recommendations = this.getOptimizationRecommendations();
    const settings = this.getOptimalSettings();

    const report = {
      networkStatus: {
        speed: `${avgSpeed.toFixed(1)} MB/s`,
        stability: `${(stability * 100).toFixed(0)}%`,
        quality: this.getNetworkQuality(),
        lastAnalyzed: new Date(lastMeasured).toLocaleString()
      },
      recommendations,
      optimalSettings: {
        chunkSize: `${(settings.chunkSize / (1024 * 1024)).toFixed(0)}MB`,
        timeout: `${(settings.chunkTimeout / 1000).toFixed(0)}s`,
        delays: `chunk: ${settings.chunkDelay}ms, page: ${settings.pageDelay}ms`
      },
      uploadHistory: this.uploadMetrics.length
    };

    return report;
  }

  // ประเมินคุณภาพเครือข่าย
  getNetworkQuality() {
    const { avgSpeed, stability } = this.networkConditions;
    
    if (avgSpeed > 2.0 && stability > 0.8) return 'ممتاز'; // ممتาز
    if (avgSpeed > 1.0 && stability > 0.6) return 'ดี';
    if (avgSpeed > 0.5 && stability > 0.4) return 'ปานกลาง';
    return 'ต้องปรับปรุง';
  }
}

// Singleton instance
const smartUploadOptimizer = new SmartUploadOptimizer();

module.exports = smartUploadOptimizer;