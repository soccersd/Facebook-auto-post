// Performance Monitor - ติดตามและวิเคราะห์ประสิทธิภาพการอัปโหลด
const { logger } = require('./logger');

class PerformanceMonitor {
  constructor() {
    this.uploadMetrics = new Map(); // เก็บข้อมูลการอัปโหลดของแต่ละ job
    this.pagePerformance = new Map(); // เก็บข้อมูลประสิทธิภาพของแต่ละเพจ
  }

  // เริ่มต้นการติดตามการอัปโหลด
  startUploadTracking(jobId, pageId, fileSizeMB) {
    const trackingData = {
      jobId,
      pageId,
      fileSizeMB,
      startTime: Date.now(),
      phases: {},
      totalDuration: 0,
      uploadSpeed: 0 // MB/s
    };

    this.uploadMetrics.set(`${jobId}_${pageId}`, trackingData);
    
    logger.info('Performance tracking started:', {
      jobId,
      pageId,
      fileSizeMB
    });

    return trackingData;
  }

  // ติดตามเฟสการอัปโหลด (compression, upload_session, chunk_transfer, finish)
  trackPhase(jobId, pageId, phaseName, startTime = Date.now()) {
    const key = `${jobId}_${pageId}`;
    const tracking = this.uploadMetrics.get(key);
    
    if (!tracking) {
      logger.warn('No tracking data found for:', { jobId, pageId });
      return;
    }

    tracking.phases[phaseName] = {
      startTime,
      endTime: null,
      duration: 0
    };
  }

  // สิ้นสุดการติดตามเฟส
  endPhase(jobId, pageId, phaseName) {
    const key = `${jobId}_${pageId}`;
    const tracking = this.uploadMetrics.get(key);
    
    if (!tracking || !tracking.phases[phaseName]) {
      return;
    }

    const phase = tracking.phases[phaseName];
    phase.endTime = Date.now();
    phase.duration = phase.endTime - phase.startTime;

    logger.info(`Phase ${phaseName} completed:`, {
      jobId,
      pageId,
      duration: `${Math.round(phase.duration / 1000)}s`
    });
  }

  // สิ้นสุดการติดตามการอัปโหลด
  endUploadTracking(jobId, pageId, success = true) {
    const key = `${jobId}_${pageId}`;
    const tracking = this.uploadMetrics.get(key);
    
    if (!tracking) {
      return null;
    }

    tracking.endTime = Date.now();
    tracking.totalDuration = tracking.endTime - tracking.startTime;
    tracking.uploadSpeed = tracking.fileSizeMB / (tracking.totalDuration / 1000); // MB/s
    tracking.success = success;

    // เก็บสถิติของเพจ
    this.updatePagePerformance(pageId, tracking);

    const summary = {
      jobId,
      pageId,
      fileSizeMB: tracking.fileSizeMB,
      totalDuration: Math.round(tracking.totalDuration / 1000), // seconds
      uploadSpeed: tracking.uploadSpeed.toFixed(2), // MB/s
      success,
      phases: Object.keys(tracking.phases).map(name => ({
        name,
        duration: Math.round(tracking.phases[name].duration / 1000)
      }))
    };

    logger.info('Upload performance summary:', summary);

    // ลบข้อมูลการติดตามเพื่อประหยัดหน่วยความจำ
    this.uploadMetrics.delete(key);

    return summary;
  }

  // อัปเดตสถิติประสิทธิภาพของเพจ
  updatePagePerformance(pageId, tracking) {
    if (!this.pagePerformance.has(pageId)) {
      this.pagePerformance.set(pageId, {
        totalUploads: 0,
        successfulUploads: 0,
        totalSize: 0,
        totalTime: 0,
        averageSpeed: 0,
        fastestUpload: Infinity,
        slowestUpload: 0
      });
    }

    const stats = this.pagePerformance.get(pageId);
    stats.totalUploads++;
    
    if (tracking.success) {
      stats.successfulUploads++;
      stats.totalSize += tracking.fileSizeMB;
      stats.totalTime += tracking.totalDuration;
      stats.averageSpeed = stats.totalSize / (stats.totalTime / 1000);
      
      if (tracking.uploadSpeed > 0) {
        stats.fastestUpload = Math.min(stats.fastestUpload, tracking.totalDuration);
        stats.slowestUpload = Math.max(stats.slowestUpload, tracking.totalDuration);
      }
    }
  }

  // ดึงสถิติประสิทธิภาพของเพจ
  getPagePerformance(pageId) {
    const stats = this.pagePerformance.get(pageId);
    if (!stats) {
      return null;
    }

    return {
      pageId,
      totalUploads: stats.totalUploads,
      successRate: Math.round((stats.successfulUploads / stats.totalUploads) * 100),
      averageSpeed: stats.averageSpeed.toFixed(2) + ' MB/s',
      fastestUpload: stats.fastestUpload === Infinity ? 'N/A' : Math.round(stats.fastestUpload / 1000) + 's',
      slowestUpload: stats.slowestUpload === 0 ? 'N/A' : Math.round(stats.slowestUpload / 1000) + 's',
      totalDataUploaded: stats.totalSize.toFixed(1) + ' MB'
    };
  }

  // ดึงสถิติประสิทธิภาพของทุกเพจ
  getAllPagePerformance() {
    const results = [];
    
    for (const pageId of this.pagePerformance.keys()) {
      results.push(this.getPagePerformance(pageId));
    }

    return results.sort((a, b) => b.totalUploads - a.totalUploads);
  }

  // วิเคราะห์และให้คำแนะนำการปรับปรุงประสิทธิภาพ
  analyzePerformance() {
    const allStats = this.getAllPagePerformance();
    
    if (allStats.length === 0) {
      return {
        message: 'ยังไม่มีข้อมูลการอัปโหลดเพียงพอสำหรับการวิเคราะห์',
        recommendations: []
      };
    }

    const recommendations = [];
    const avgSpeed = allStats.reduce((sum, stat) => sum + parseFloat(stat.averageSpeed), 0) / allStats.length;

    // วิเคราะห์ความเร็วเฉลี่ย
    if (avgSpeed < 0.5) {
      recommendations.push({
        type: 'speed',
        issue: 'ความเร็วการอัปโหลดช้า',
        suggestion: 'ลองเพิ่มขนาด chunk หรือปรับปรุงการบีบอัดวิดีโอ'
      });
    }

    // วิเคราะห์อัตราความสำเร็จ
    const avgSuccessRate = allStats.reduce((sum, stat) => sum + stat.successRate, 0) / allStats.length;
    if (avgSuccessRate < 90) {
      recommendations.push({
        type: 'reliability',
        issue: 'อัตราความสำเร็จต่ำ',
        suggestion: 'ตรวจสอบการเชื่อมต่อเครือข่ายและ access token'
      });
    }

    // หาเพจที่ประสิทธิภาพต่ำ
    const slowPages = allStats.filter(stat => parseFloat(stat.averageSpeed) < avgSpeed * 0.7);
    if (slowPages.length > 0) {
      recommendations.push({
        type: 'pages',
        issue: `เพจ ${slowPages.map(p => p.pageId).join(', ')} มีประสิทธิภาพต่ำ`,
        suggestion: 'ตรวจสอบ access token และสิทธิ์ของเพจเหล่านี้'
      });
    }

    return {
      summary: {
        totalPages: allStats.length,
        averageSpeed: avgSpeed.toFixed(2) + ' MB/s',
        averageSuccessRate: avgSuccessRate.toFixed(1) + '%'
      },
      recommendations
    };
  }

  // ล้างข้อมูลเก่า
  cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 ชั่วโมง

    // ล้างการติดตามที่ค้างอยู่นานเกินไป
    for (const [key, tracking] of this.uploadMetrics.entries()) {
      if (now - tracking.startTime > maxAge) {
        this.uploadMetrics.delete(key);
      }
    }

    logger.info('Performance monitor cleanup completed');
  }

  // ส่งออกรายงานประสิทธิภาพ
  generateReport() {
    const analysis = this.analyzePerformance();
    const allStats = this.getAllPagePerformance();

    console.log('\n=== Performance Report ===');
    console.log(`📊 Summary:`);
    if (analysis.summary) {
      console.log(`   - Pages tracked: ${analysis.summary.totalPages}`);
      console.log(`   - Average speed: ${analysis.summary.averageSpeed}`);
      console.log(`   - Average success rate: ${analysis.summary.averageSuccessRate}`);
    }

    console.log('\n📈 Page Performance:');
    allStats.forEach(stat => {
      console.log(`   🔸 Page ${stat.pageId}:`);
      console.log(`     • Uploads: ${stat.totalUploads} (${stat.successRate}% success)`);
      console.log(`     • Speed: ${stat.averageSpeed}`);
      console.log(`     • Range: ${stat.fastestUpload} - ${stat.slowestUpload}`);
    });

    if (analysis.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      analysis.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec.issue}`);
        console.log(`      → ${rec.suggestion}`);
      });
    }

    console.log('\n=========================\n');

    return {
      analysis,
      pageStats: allStats
    };
  }
}

// Singleton instance
const performanceMonitor = new PerformanceMonitor();

module.exports = performanceMonitor;