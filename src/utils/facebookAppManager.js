// Facebook App Manager - จัดการหลาย Facebook Apps
const { config } = require('../config');

class FacebookAppManager {
  constructor() {
    this.apps = config.facebook.apps;
  }

  // ดึงข้อมูล Facebook App ตาม key หรือ App ID
  getApp(appKey) {
    // หากเป็น key ใน config (เช่น primary, secondary, tertiary)
    if (this.apps[appKey]) {
      return {
        appId: this.apps[appKey].appId,
        appSecret: this.apps[appKey].appSecret,
        key: appKey
      };
    }

    // หากเป็น App ID โดยตรง
    for (const [key, app] of Object.entries(this.apps)) {
      if (app.appId === appKey) {
        return {
          appId: app.appId,
          appSecret: app.appSecret,
          key: key
        };
      }
    }

    return null;
  }

  // ดึงรายการ Apps ทั้งหมดที่พร้อมใช้งาน
  getAvailableApps() {
    const availableApps = [];
    
    for (const [key, app] of Object.entries(this.apps)) {
      // เปลี่ยนเงื่อนไข: ต้องมี appId แต่ appSecret ไม่บังคับ
      if (app.appId && 
          app.appId !== 'YOUR_SECOND_APP_ID' && 
          app.appId !== 'YOUR_THIRD_APP_ID') {
        availableApps.push({
          key,
          appId: app.appId,
          appSecret: app.appSecret || null // อนุญาตให้เป็น null
        });
      }
    }
    
    return availableApps;
  }

  // ตรวจสอบว่า App ID นี้มีอยู่หรือไม่
  hasApp(appId) {
    return this.getApp(appId) !== null;
  }

  // สร้าง Access Token URL สำหรับ App นี้
  getAccessTokenUrl(appKey, redirectUri) {
    const app = this.getApp(appKey);
    if (!app) {
      throw new Error(`Facebook App not found: ${appKey}`);
    }

    const baseUrl = 'https://www.facebook.com/v18.0/dialog/oauth';
    const params = new URLSearchParams({
      client_id: app.appId,
      redirect_uri: redirectUri,
      scope: 'pages_manage_posts,pages_read_engagement,pages_show_list,publish_video',
      response_type: 'code'
    });

    return `${baseUrl}?${params.toString()}`;
  }

  // ดึงสถิติการใช้งาน Apps
  async getUsageStats() {
    const FacebookPagesManager = require('../config/facebookPages');
    const pagesManager = new FacebookPagesManager();
    await pagesManager.initialize();
    
    const availableApps = this.getAvailableApps();
    const stats = {};

    for (const app of availableApps) {
      try {
        const pages = await pagesManager.getPagesByAppId(app.key);
        stats[app.key] = {
          appId: app.appId,
          totalPages: pages.length,
          enabledPages: pages.filter(page => page.enabled).length,
          pageNames: pages.map(page => page.name)
        };
      } catch (error) {
        stats[app.key] = {
          appId: app.appId,
          totalPages: 0,
          enabledPages: 0,
          pageNames: []
        };
      }
    }

    return stats;
  }

  // แสดงรายงานการใช้งาน
  async generateReport() {
    try {
      const stats = await this.getUsageStats();
      const availableApps = this.getAvailableApps();

      console.log('\n=== Facebook Apps Usage Report ===');
      console.log(`Total Apps Configured: ${availableApps.length}`);
      
      Object.entries(stats).forEach(([key, stat]) => {
        console.log(`\n📱 App: ${key} (${stat.appId})`);
        console.log(`   📄 Pages: ${stat.enabledPages}/${stat.totalPages} enabled`);
        if (stat.pageNames.length > 0) {
          console.log(`   📝 Page Names: ${stat.pageNames.join(', ')}`);
        }
      });

      console.log('\n=================================\n');
    } catch (error) {
      console.log('\n❌ Error generating report, but continuing startup...\n');
    }
  }
}

module.exports = FacebookAppManager;