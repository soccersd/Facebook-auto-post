// ตัวอย่างการใช้งานหลาย Facebook Apps
// วิธีการตั้งค่าและใช้งาน

const FacebookAppManager = require('../src/utils/facebookAppManager');
const FacebookPagesManager = require('../src/config/facebookPages');

async function exampleUsage() {
  console.log('=== ตัวอย่างการใช้งานหลาย Facebook Apps ===\n');

  // 1. สร้าง instance ของ managers
  const appManager = new FacebookAppManager();
  const pagesManager = new FacebookPagesManager();

  // 2. แสดงรายการ Apps ที่พร้อมใช้งาน
  console.log('📱 Facebook Apps ที่พร้อมใช้งาน:');
  const availableApps = appManager.getAvailableApps();
  availableApps.forEach(app => {
    console.log(`   - ${app.key}: ${app.appId}`);
  });

  // 3. ตรวจสอบการใช้งาน Apps
  console.log('\n📊 สถิติการใช้งาน Apps:');
  const usageStats = appManager.getUsageStats();
  Object.entries(usageStats).forEach(([key, stats]) => {
    console.log(`   - ${key}: ${stats.enabledPages} หน้าเพจใช้งาน`);
  });

  // 4. ตัวอย่างการค้นหาเพจตาม App ID
  console.log('\n🔍 ตัวอย่างการค้นหาเพจ:');
  const primaryPages = pagesManager.getPagesByAppId('primary');
  console.log(`   เพจที่ใช้ primary app: ${primaryPages.length} เพจ`);

  // 5. ดึงข้อมูล App ตาม key
  console.log('\n🔑 ข้อมูล Primary App:');
  const primaryApp = appManager.getApp('primary');
  if (primaryApp) {
    console.log(`   App ID: ${primaryApp.appId}`);
    console.log(`   Key: ${primaryApp.key}`);
  }

  console.log('\n=== จบตัวอย่าง ===');
}

// วิธีการเพิ่ม Facebook App ใหม่:
function howToAddNewApp() {
  console.log('\n=== วิธีการเพิ่ม Facebook App ใหม่ ===');
  console.log('1. แก้ไขไฟล์ .env:');
  console.log('   FACEBOOK_APP_ID_4=YOUR_NEW_APP_ID');
  console.log('   FACEBOOK_APP_SECRET_4=YOUR_NEW_APP_SECRET');
  console.log('');
  console.log('2. แก้ไขไฟล์ src/config/index.js:');
  console.log('   เพิ่ม fourth: { appId: ..., appSecret: ... } ใน facebook.apps');
  console.log('');
  console.log('3. แก้ไขไฟล์ src/config/facebookPages.js:');
  console.log('   เพิ่ม appId: "fourth" ให้กับเพจที่ต้องการใช้ App ใหม่');
  console.log('');
  console.log('4. รีสตาร์ทแอป');
  console.log('=== จบคำแนะนำ ===\n');
}

// เรียกใช้งานตัวอย่าง
if (require.main === module) {
  exampleUsage().catch(console.error);
  howToAddNewApp();
}

module.exports = {
  exampleUsage,
  howToAddNewApp
};