// Facebook Pages Management - Fully Automated
// This file automatically manages all Facebook Pages from environment variables
// 
// วิธีการตั้งค่า:
// 1. เพิ่ม Page Access Token ใน .env file เท่านั้น:
//    FACEBOOK_PAGE_TOKEN_1=YOUR_PAGE_ACCESS_TOKEN
//    FACEBOOK_PAGE_TOKEN_2=YOUR_PAGE_ACCESS_TOKEN
// 2. ระบบจะดึง Page ID และ Page Name อัตโนมัติจาก Facebook API
//
// ข้อดี:
// - ไม่ต้องกรอกข้อมูลใน code เลย - ทุกอย่างอัตโนมัติ
// - ดึง Page ID และ Page Name จาก Facebook API โดยตรง
// - จัดการ Token ที่เดียวใน .env 
// - ปลอดภัยและง่ายต่อการจัดการ

const axios = require('axios');

class FacebookPagesManager {
  constructor() {
    // สร้าง pages array โดยอัตโนมัติจาก environment variables
    this.pages = [];
    this.initialized = false;
  }

  // Initialize pages asynchronously
  async initialize() {
    if (this.initialized) return;
    this.pages = await this.generatePagesFromEnv();
    this.initialized = true;
  }

  // สร้าง pages array จาก environment variables และดึงข้อมูลจาก Facebook API
  async generatePagesFromEnv() {
    const pages = [];
    let pageIndex = 1;
    
    console.log('🔄 Auto-generating Facebook pages from environment variables...');
    
    // วนลูปหา FACEBOOK_PAGE_TOKEN_X ใน environment variables
    while (true) {
      const pageToken = process.env[`FACEBOOK_PAGE_TOKEN_${pageIndex}`];
      
      // ถ้าไม่มี token แล้ว ให้หยุด
      if (!pageToken) {
        break;
      }
      
      console.log(`📡 Fetching page info for token ${pageIndex}...`);
      
      try {
        // ดึงข้อมูล Page จาก Facebook API อัตโนมัติ
        const pageInfo = await this.fetchPageInfoFromFacebook(pageToken);
        
        // สร้าง page object ด้วยข้อมูลจริงจาก Facebook
        const page = {
          id: pageIndex,
          pageId: pageInfo.id,
          accessToken: pageToken,
          appId: process.env[`FACEBOOK_APP_ID_${pageIndex}`] || `app${pageIndex}`,
          name: pageInfo.name,
          category: pageInfo.category || 'Unknown',
          enabled: true,
          // เพิ่มข้อมูลเสริมจาก Facebook API
          followers: pageInfo.followers_count || 0,
          verification: pageInfo.verification_status || 'not_verified',
          fetchedAt: new Date().toISOString()
        };
        
        pages.push(page);
        console.log(`✅ Page ${pageIndex}: ${pageInfo.name} (ID: ${pageInfo.id})`);
        
      } catch (error) {
        console.error(`❌ Failed to fetch page info for token ${pageIndex}:`, error.message);
        
        // สร้าง fallback page object
        const fallbackPage = {
          id: pageIndex,
          pageId: process.env[`FACEBOOK_PAGE_ID_${pageIndex}`] || `UNKNOWN_PAGE_${pageIndex}`,
          accessToken: pageToken,
          appId: process.env[`FACEBOOK_APP_ID_${pageIndex}`] || `app${pageIndex}`,
          name: process.env[`FACEBOOK_PAGE_NAME_${pageIndex}`] || `Page ${pageIndex} (API Error)`,
          enabled: false, // ปิดใช้งานถ้าดึงข้อมูลไม่ได้
          error: error.message,
          fetchedAt: new Date().toISOString()
        };
        
        pages.push(fallbackPage);
      }
      
      pageIndex++;
      
      // เพิ่ม delay เล็กน้อยเพื่อป้องกัน rate limiting
      if (pageIndex > 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    const enabledCount = pages.filter(p => p.enabled).length;
    console.log(`📄 Auto-generated ${pages.length} page(s), ${enabledCount} enabled`);
    return pages;
  }

  // ดึงข้อมูล Page จาก Facebook Graph API
  async fetchPageInfoFromFacebook(pageToken) {
    try {
      const response = await axios.get('https://graph.facebook.com/v18.0/me', {
        params: {
          access_token: pageToken,
          fields: 'id,name,category,followers_count,verification_status'
        },
        timeout: 10000 // 10 seconds timeout
      });
      
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`Facebook API Error: ${error.response.status} - ${error.response.data?.error?.message || 'Unknown error'}`);
      } else if (error.request) {
        throw new Error('Facebook API Request Failed: No response received');
      } else {
        throw new Error(`Request Setup Error: ${error.message}`);
      }
    }
  }

  // ดึงข้อมูลเพจทั้งหมดที่เปิดใช้งาน
  async getEnabledPages() {
    await this.initialize();
    return this.pages.filter(page => {
      // ตรวจสอบว่าเพจมีข้อมูลจริงและเปิดใช้งาน
      return page.enabled && 
             page.pageId && 
             page.accessToken && 
             !page.pageId.startsWith('UNKNOWN_PAGE_') &&
             !page.accessToken.startsWith('YOUR_PAGE_ACCESS_TOKEN_');
    });
  }

  // ดึงข้อมูลเพจตาม ID
  async getPageById(id) {
    await this.initialize();
    return this.pages.find(page => page.id === id);
  }

  // ดึงข้อมูลเพจตาม Facebook Page ID
  async getPageByFacebookId(pageId) {
    await this.initialize();
    return this.pages.find(page => page.pageId === pageId);
  }

  // เพิ่มเพจใหม่
  async addPage(pageData) {
    await this.initialize();
    const newId = Math.max(...this.pages.map(p => p.id)) + 1;
    const newPage = {
      id: newId,
      ...pageData,
      enabled: pageData.enabled !== undefined ? pageData.enabled : true
    };
    this.pages.push(newPage);
    return newPage;
  }

  // เปิด/ปิดการใช้งานเพจ
  async togglePage(id, enabled) {
    await this.initialize();
    const page = await this.getPageById(id);
    if (page) {
      page.enabled = enabled;
      return true;
    }
    return false;
  }

  // อัพเดตข้อมูลเพจ
  async updatePage(id, updates) {
    await this.initialize();
    const page = await this.getPageById(id);
    if (page) {
      Object.assign(page, updates);
      return page;
    }
    return null;
  }

  // ลบเพจ
  async removePage(id) {
    await this.initialize();
    const index = this.pages.findIndex(page => page.id === id);
    if (index !== -1) {
      return this.pages.splice(index, 1)[0];
    }
    return null;
  }

  // ดึงจำนวนเพจทั้งหมด
  async getTotalPages() {
    await this.initialize();
    return this.pages.length;
  }

  // ดึงจำนวนเพจที่เปิดใช้งาน
  async getEnabledPagesCount() {
    const enabledPages = await this.getEnabledPages();
    return enabledPages.length;
  }

  // ดึงเพจตาม Facebook App ID
  async getPagesByAppId(appId) {
    const enabledPages = await this.getEnabledPages();
    return enabledPages.filter(page => page.appId === appId);
  }

  // ดึงรายการ Facebook App IDs ทั้งหมดที่ใช้งานอยู่
  async getUsedAppIds() {
    const enabledPages = await this.getEnabledPages();
    const appIds = enabledPages.map(page => page.appId).filter(Boolean);
    return [...new Set(appIds)]; // ลบค่าซ้ำ
  }

  // ดึงสถิติการใช้งาน Facebook Apps
  async getAppUsageStats() {
    const appIds = await this.getUsedAppIds();
    const stats = {};
    
    for (const appId of appIds) {
      const pages = await this.getPagesByAppId(appId);
      stats[appId] = {
        totalPages: pages.length,
        pageNames: pages.map(page => page.name),
        pageDetails: pages.map(page => ({
          id: page.pageId,
          name: page.name,
          followers: page.followers || 0,
          verification: page.verification || 'not_verified'
        }))
      };
    }
    
    return stats;
  }

  // ตรวจสอบความถูกต้องของข้อมูลเพจ
  async validatePagesConfiguration() {
    await this.initialize();
    const errors = [];
    const warnings = [];
    const enabledPages = await this.getEnabledPages();
    
    enabledPages.forEach((page, index) => {
      if (!page.pageId || page.pageId.startsWith('UNKNOWN_PAGE_')) {
        errors.push(`Page ${index + 1}: Missing or invalid Facebook Page ID`);
      }
      
      if (!page.accessToken || page.accessToken.startsWith('YOUR_PAGE_ACCESS_TOKEN_')) {
        errors.push(`Page ${index + 1}: Missing or invalid Page Access Token`);
      }
      
      if (!page.name || page.name.includes('API Error')) {
        errors.push(`Page ${index + 1}: Missing page name or API fetch failed`);
      }
      
      // Additional validations for auto-fetched data
      if (page.error) {
        warnings.push(`Page ${index + 1}: ${page.error}`);
      }
      
      if (page.verification === 'not_verified') {
        warnings.push(`Page ${index + 1}: Page is not verified on Facebook`);
      }
    });
    
    const disabledPages = this.pages.filter(page => !page.enabled);
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      enabledPagesCount: enabledPages.length,
      disabledPagesCount: disabledPages.length,
      totalPagesCount: this.pages.length,
      lastFetched: new Date().toISOString()
    };
  }

  // ฟังก์ชันสำหรับ refresh ข้อมูลเพจ
  async refreshPageData() {
    console.log('🔄 Refreshing Facebook page data...');
    this.pages = [];
    this.initialized = false;
    await this.initialize();
    console.log('✅ Page data refreshed successfully');
    return this.pages;
  }

  // แสดงรายงานเพจทั้งหมด
  async generateReport() {
    await this.initialize();
    const stats = await this.getAppUsageStats();
    const validation = await this.validatePagesConfiguration();
    
    console.log('\n=== Facebook Pages Auto-Configuration Report ===');
    console.log(`📊 Total Pages: ${validation.totalPagesCount}`);
    console.log(`✅ Enabled Pages: ${validation.enabledPagesCount}`);
    console.log(`❌ Disabled Pages: ${validation.disabledPagesCount}`);
    
    if (validation.errors.length > 0) {
      console.log('\n❌ Errors:');
      validation.errors.forEach(error => console.log(`   ${error}`));
    }
    
    if (validation.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      validation.warnings.forEach(warning => console.log(`   ${warning}`));
    }
    
    console.log('\n📱 Apps Usage:');
    Object.entries(stats).forEach(([appId, stat]) => {
      console.log(`   ${appId}: ${stat.totalPages} page(s)`);
      stat.pageDetails.forEach(page => {
        console.log(`     📄 ${page.name} (${page.id}) - ${page.followers} followers`);
      });
    });
    
    console.log(`\n🕒 Last Updated: ${validation.lastFetched}`);
    console.log('================================================\n');
    
    return {
      stats,
      validation,
      pages: this.pages
    };
  }
}

module.exports = FacebookPagesManager;