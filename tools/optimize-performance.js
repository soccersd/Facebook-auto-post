#!/usr/bin/env node

// Performance Optimization Tool - เครื่องมือปรับปรุงประสิทธิภาพการอัปโหลด
const performanceMonitor = require('../src/utils/performanceMonitor');
const smartUploadOptimizer = require('../src/utils/smartUploadOptimizer');
const FacebookReelsService = require('../src/services/facebookReelsService');
const { logger } = require('../src/utils/logger');

class PerformanceOptimizer {
  constructor() {
    this.reelsService = new FacebookReelsService();
  }

  // ทดสอบประสิทธิภาพการอัปโหลด
  async runPerformanceTest() {
    console.log('🚀 เริ่มการทดสอบประสิทธิภาพการอัปโหลด...\n');

    try {
      // ดึงรายการเพจที่เปิดใช้งาน
      const enabledPages = this.reelsService.pagesManager.getEnabledPages();
      
      if (enabledPages.length === 0) {
        console.log('❌ ไม่พบเพจที่เปิดใช้งาน กรุณาตรวจสอบการตั้งค่า Facebook Pages');
        return;
      }

      console.log(`📊 พบเพจที่เปิดใช้งาน: ${enabledPages.length} เพจ`);
      console.log('📋 รายการเพจ:');
      enabledPages.forEach((page, index) => {
        console.log(`   ${index + 1}. ${page.name} (${page.pageId})`);
      });
      console.log('');

      // ทดสอบการเชื่อมต่อ Facebook API
      console.log('🔗 ทดสอบการเชื่อมต่อ Facebook API...');
      const connectionResults = await this.reelsService.checkFacebookConnection();
      
      let connectedPages = 0;
      connectionResults.forEach(result => {
        if (result.status === 'connected') {
          console.log(`   ✅ ${result.pageName}: เชื่อมต่อสำเร็จ`);
          connectedPages++;
        } else {
          console.log(`   ❌ ${result.pageName}: ${result.error}`);
        }
      });

      console.log(`\n📈 ผลการทดสอบการเชื่อมต่อ: ${connectedPages}/${connectionResults.length} เพจ\n`);

      // แสดงการตั้งค่าปัจจุบัน
      console.log('⚙️  การตั้งค่าปัจจุบัน:');
      const optimalSettings = smartUploadOptimizer.getOptimalSettings();
      console.log(`   • Chunk size: ${Math.round(optimalSettings.chunkSize / (1024 * 1024))}MB (ปรับตามสภาพเครือข่าย)`);
      console.log(`   • Upload timeout: ${Math.round(optimalSettings.chunkTimeout / 1000)}วินาที`);
      console.log(`   • Wait between pages: ${optimalSettings.pageDelay}ms`);
      console.log(`   • Wait between chunks: ${optimalSettings.chunkDelay}ms`);
      console.log(`   • Max retries: ${optimalSettings.retryAttempts} ครั้ง`);
      console.log(`   • Network quality: ${smartUploadOptimizer.getNetworkQuality()}`);
      console.log('');
      
      // แสดงรายงานสภาพเครือข่าย
      const networkReport = smartUploadOptimizer.generateNetworkReport();
      console.log('🌐 สภาพเครือข่าย:');
      console.log(`   • ความเร็วเฉลี่ย: ${networkReport.networkStatus.speed}`);
      console.log(`   • ความเสถียร: ${networkReport.networkStatus.stability}`);
      console.log(`   • คุณภาพ: ${networkReport.networkStatus.quality}`);
      console.log(`   • วิเคราะห์ล่าสุด: ${networkReport.networkStatus.lastAnalyzed}`);
      console.log('');
      
      // แสดงคำแนะนำ
      if (networkReport.recommendations.length > 0) {
        console.log('💡 คำแนะนำเฉพาะ:');
        networkReport.recommendations.forEach((rec, index) => {
          const priority = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
          console.log(`   ${priority} ${rec.issue}`);
          console.log(`      → ${rec.suggestion}`);
        });
        console.log('');
      }

      // แสดงรายงานประสิทธิภาพ
      const report = performanceMonitor.generateReport();

      // ให้คำแนะนำเพิ่มเติม
      this.provideOptimizationTips();

    } catch (error) {
      console.error('❌ เกิดข้อผิดพลาดในการทดสอบ:', error.message);
    }
  }

  // ให้คำแนะนำการปรับปรุงประสิทธิภาพ
  provideOptimizationTips() {
    console.log('💡 คำแนะนำการปรับปรุงประสิทธิภาพ:\n');
    
    console.log('🔧 การปรับปรุงที่ได้ทำไปแล้ว:');
    console.log('   ✅ เพิ่มขนาด chunk จาก 8MB เป็น 16MB');
    console.log('   ✅ ลด timeout จาก 20 นาที เป็น 5 นาที');
    console.log('   ✅ ลดเวลารอระหว่างเพจจาก 3 วินาที เป็น 1 วินาที');
    console.log('   ✅ ลดเวลารอก่อน retry จาก 10 วินาที เป็น 5 วินาที');
    console.log('   ✅ ลดจำนวน retry จาก 3 ครั้ง เป็น 2 ครั้ง');
    console.log('   ✅ ปรับปรุงการบีบอัดวิดีโอให้เร็วขึ้น\n');

    console.log('📋 คำแนะนำเพิ่มเติม:');
    console.log('   1. 📹 วิดีโอ:');
    console.log('      • ใช้วิดีโอที่มีขนาดไม่เกิน 50MB');
    console.log('      • ความละเอียด 720p หรือ 1080p');
    console.log('      • ความยาวไม่เกิน 90 วินาที');
    console.log('      • รูปแบบ MP4 เพื่อความเร็วในการประมวลผล\n');

    console.log('   2. 🌐 เครือข่าย:');
    console.log('      • ใช้เครือข่ายที่เสถียรและเร็ว');
    console.log('      • หลีกเลี่ยงการอัปโหลดในช่วงเวลาเครือข่ายช้า');
    console.log('      • ตรวจสอบ bandwidth ว่าเพียงพอสำหรับการอัปโหลดหลายเพจ\n');

    console.log('   3. ⚙️  เซิร์ฟเวอร์:');
    console.log('      • ติดตั้ง ffmpeg เวอร์ชันล่าสุดเพื่อการบีบอัดที่เร็วขึ้น');
    console.log('      • เพิ่ม RAM หากประมวลผลวิดีโอขนาดใหญ่บ่อยๆ');
    console.log('      • ใช้ SSD สำหรับ temporary files เพื่อความเร็วในการเข้าถึงไฟล์\n');

    console.log('   4. 🔑 Facebook API:');
    console.log('      • ตรวจสอบให้แน่ใจว่า access token ยังไม่หมดอายุ');
    console.log('      • ใช้ long-lived token เพื่อลดการต่ออายุบ่อยๆ');
    console.log('      • ตรวจสอบสิทธิ์การโพสต์ของแต่ละเพจ\n');

    console.log('📊 การติดตามประสิทธิภาพ:');
    console.log('   • ระบบจะติดตามความเร็วการอัปโหลดอัตโนมัติ');
    console.log('   • ดูรายงานประสิทธิภาพใน log files');
    console.log('   • หากพบปัญหา ระบบจะแสดงคำแนะนำเพิ่มเติม\n');
  }

  // แสดงสถิติการใช้งาน
  async showUsageStats() {
    console.log('📈 สถิติการใช้งาน:\n');

    try {
      const queueStatus = await this.reelsService.getQueueStatus();
      console.log('📋 สถานะคิว:');
      console.log(`   • งานที่รอ: ${queueStatus.waiting}`);
      console.log(`   • งานที่กำลังทำ: ${queueStatus.active}`);
      console.log(`   • งานที่เสร็จแล้ว: ${queueStatus.completed}`);
      console.log(`   • งานที่ล้มเหลว: ${queueStatus.failed}\n`);

      const enabledPagesCount = this.reelsService.getEnabledPagesCount();
      console.log(`📄 จำนวนเพจที่เปิดใช้งาน: ${enabledPagesCount}\n`);

      const allPerformance = performanceMonitor.getAllPagePerformance();
      if (allPerformance.length > 0) {
        console.log('🏆 ประสิทธิภาพของแต่ละเพจ:');
        allPerformance.forEach(stat => {
          console.log(`   📱 ${stat.pageId}:`);
          console.log(`      • การอัปโหลด: ${stat.totalUploads} ครั้ง`);
          console.log(`      • อัตราสำเร็จ: ${stat.successRate}%`);
          console.log(`      • ความเร็วเฉลี่ย: ${stat.averageSpeed}`);
          console.log(`      • ข้อมูลรวม: ${stat.totalDataUploaded}`);
        });
      } else {
        console.log('📊 ยังไม่มีข้อมูลการใช้งาน');
      }

    } catch (error) {
      console.error('❌ ไม่สามารถดึงสถิติได้:', error.message);
    }
  }

  // ทำความสะอาดข้อมูลเก่า
  async cleanup() {
    console.log('🧹 ทำความสะอาดข้อมูลเก่า...');
    
    try {
      performanceMonitor.cleanup();
      this.reelsService.cleanup();
      console.log('✅ ทำความสะอาดเสร็จสิ้น');
    } catch (error) {
      console.error('❌ เกิดข้อผิดพลาดในการทำความสะอาด:', error.message);
    }
  }

  // วิเคราะห์สภาพเครือข่าย
  async analyzeNetwork() {
    console.log('🌐 การวิเคราะห์สภาพเครือข่าย...');
    
    try {
      const networkReport = smartUploadOptimizer.generateNetworkReport();
      const optimalSettings = smartUploadOptimizer.getOptimalSettings();
      
      console.log('\n📈 รายงานสภาพเครือข่าย:');
      console.log(`   🚀 ความเร็วเฉลี่ย: ${networkReport.networkStatus.speed}`);
      console.log(`   🔄 ความเสถียร: ${networkReport.networkStatus.stability}`);
      console.log(`   ⭐ คุณภาพโดยรวม: ${networkReport.networkStatus.quality}`);
      console.log(`   🕰️ วิเคราะห์ล่าสุด: ${networkReport.networkStatus.lastAnalyzed}`);
      console.log(`   📁 ประวัติการอัปโหลด: ${networkReport.uploadHistory} ครั้ง`);
      
      console.log('\n⚙️ การตั้งค่าที่แนะนำ:');
      console.log(`   📦 ขนาด Chunk: ${Math.round(optimalSettings.chunkSize / (1024 * 1024))}MB`);
      console.log(`   ⏱️ Timeout: ${Math.round(optimalSettings.chunkTimeout / 1000)}วินาที`);
      console.log(`   ⏸️ ระหว่างเพจ: ${optimalSettings.pageDelay}ms`);
      console.log(`   ⏸️ ระหว่าง Chunk: ${optimalSettings.chunkDelay}ms`);
      console.log(`   🔁 ลองใหม่: ${optimalSettings.retryAttempts} ครั้ง`);
      
      if (networkReport.recommendations.length > 0) {
        console.log('\n💡 คำแนะนำ:');
        networkReport.recommendations.forEach((rec, index) => {
          const priority = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
          console.log(`   ${priority} ${rec.issue}`);
          console.log(`      → ${rec.suggestion}`);
        });
      } else {
        console.log('\n✅ ไม่พบปัญหาเครือข่าย - การตั้งค่าเหมาะสมแล้ว!');
      }
      
    } catch (error) {
      console.error('❌ ไม่สามารถวิเคราะห์เครือข่ายได้:', error.message);
    }
  }
}

// ฟังก์ชันหลักสำหรับรันเครื่องมือ
async function main() {
  const optimizer = new PerformanceOptimizer();
  
  const args = process.argv.slice(2);
  const command = args[0] || 'test';

  console.log('🔧 เครื่องมือปรับปรุงประสิทธิภาพการอัปโหลด Facebook Reels\n');

  switch (command) {
    case 'test':
      await optimizer.runPerformanceTest();
      break;
    
    case 'stats':
      await optimizer.showUsageStats();
      break;
    
    case 'cleanup':
      await optimizer.cleanup();
      break;
    
    case 'network':
      await optimizer.analyzeNetwork();
      break;
    
    case 'tips':
      optimizer.provideOptimizationTips();
      break;
    
    default:
      console.log('📚 การใช้งาน:');
      console.log('   node optimize-performance.js [command]');
      console.log('');
      console.log('📋 คำสั่งที่ใช้ได้:');
      console.log('   test    - ทดสอบประสิทธิภาพและแสดงรายงาน (default)');
      console.log('   stats   - แสดงสถิติการใช้งาน');
      console.log('   network - วิเคราะห์สภาพเครือข่ายและแนะนำการตั้งค่า');
      console.log('   cleanup - ทำความสะอาดข้อมูลเก่า');
      console.log('   tips    - แสดงคำแนะนำการปรับปรุงประสิทธิภาพ');
      console.log('');
      break;
  }
}

// รันเครื่องมือหากถูกเรียกใช้โดยตรง
if (require.main === module) {
  main().catch(console.error);
}

module.exports = PerformanceOptimizer;