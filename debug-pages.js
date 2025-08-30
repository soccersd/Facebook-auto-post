require('dotenv').config();
const FacebookPagesManager = require('./src/config/facebookPages');
const axios = require('axios');

async function debugFacebookPages() {
  console.log('🔍 กำลังตรวจสอบการตั้งค่า Facebook Pages...\n');
  
  // ตรวจสอบ token ทั้งหมดที่ตั้งค่าใน .env
  const configuredTokens = [];
  let pageIndex = 1;
  
  while (true) {
    const token = process.env[`FACEBOOK_PAGE_TOKEN_${pageIndex}`];
    if (!token) break;
    
    configuredTokens.push({
      index: pageIndex,
      token: token.substring(0, 30) + '...', // แสดงแค่ส่วนหน้าเพื่อความปลอดภัย
      fullToken: token,
      appId: process.env[`FACEBOOK_APP_ID_${pageIndex}`]
    });
    pageIndex++;
  }
  
  console.log(`📊 พบ Token ที่ตั้งค่าไว้ทั้งหมด ${configuredTokens.length} ตัวในไฟล์ .env\n`);
  
  // ทดสอบ token แต่ละตัว
  const results = [];
  
  for (const config of configuredTokens) {
    console.log(`🧪 กำลังทดสอบ token ${config.index}... (App ID: ${config.appId})`);
    
    try {
      const response = await axios.get('https://graph.facebook.com/v18.0/me', {
        params: {
          access_token: config.fullToken,
          fields: 'id,name,category,followers_count,verification_status'
        },
        timeout: 10000
      });
      
      const result = {
        index: config.index,
        status: 'valid',
        pageId: response.data.id,
        pageName: response.data.name,
        appId: config.appId,
        followers: response.data.followers_count || 0,
        verification: response.data.verification_status || 'not_verified'
      };
      
      results.push(result);
      console.log(`  ✅ ใช้งานได้ - ${result.pageName} (${result.pageId})`);
      console.log(`     👥 ผู้ติดตาม: ${result.followers}, สถานะ: ${result.verification}`);
      
    } catch (error) {
      const result = {
        index: config.index,
        status: 'invalid',
        error: error.response?.data?.error?.message || error.message,
        errorCode: error.response?.data?.error?.code || 'UNKNOWN',
        appId: config.appId
      };
      
      results.push(result);
      console.log(`  ❌ ใช้งานไม่ได้ - ${result.error} (Code: ${result.errorCode})`);
    }
    
    // รอสักครู่เพื่อป้องกัน rate limiting
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  // สรุปผล
  const validTokens = results.filter(r => r.status === 'valid');
  const invalidTokens = results.filter(r => r.status === 'invalid');
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 สรุปผลการทดสอบ Token:');
  console.log('='.repeat(60));
  console.log(`จำนวน Token ที่ตั้งค่าไว้: ${results.length}`);
  console.log(`Token ที่ใช้งานได้: ${validTokens.length}`);
  console.log(`Token ที่ใช้งานไม่ได้: ${invalidTokens.length}`);
  
  if (invalidTokens.length > 0) {
    console.log('\n❌ Token ที่มีปัญหา:');
    invalidTokens.forEach(token => {
      console.log(`   Token ${token.index} (App ID: ${token.appId})`);
      console.log(`   ├─ Error: ${token.error}`);
      console.log(`   └─ Code: ${token.errorCode}`);
    });
  }
  
  if (validTokens.length > 0) {
    console.log('\n✅ Token ที่ใช้งานได้:');
    validTokens.forEach(token => {
      console.log(`   Token ${token.index}: ${token.pageName}`);
      console.log(`   ├─ Page ID: ${token.pageId}`);
      console.log(`   ├─ App ID: ${token.appId}`);
      console.log(`   ├─ ผู้ติดตาม: ${token.followers}`);
      console.log(`   └─ สถานะ: ${token.verification}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🔍 ทดสอบ FacebookPagesManager:');
  console.log('='.repeat(60));
  
  // ทดสอบ FacebookPagesManager
  const pagesManager = new FacebookPagesManager();
  await pagesManager.initialize();
  
  const enabledPages = await pagesManager.getEnabledPages();
  const totalPages = await pagesManager.getTotalPages();
  
  console.log(`📊 ผลลัพธ์จาก FacebookPagesManager:`);
  console.log(`  จำนวนเพจที่ประมวลผลได้: ${totalPages}`);
  console.log(`  จำนวนเพจที่เปิดใช้งาน: ${enabledPages.length}`);
  console.log(`  จำนวนเพจที่ปิดใช้งาน: ${totalPages - enabledPages.length}`);
  
  // แสดงเพจที่ปิดใช้งานและเหตุผล
  const allPages = pagesManager.pages;
  const disabledPages = allPages.filter(page => !page.enabled);
  
  if (disabledPages.length > 0) {
    console.log('\n⚠️  เพจที่ปิดใช้งานและเหตุผล:');
    disabledPages.forEach(page => {
      console.log(`   เพจ ${page.id}: ${page.name || 'ไม่ทราบชื่อ'}`);
      console.log(`   ├─ Page ID: ${page.pageId || 'ไม่ทราบ'}`);
      console.log(`   ├─ App ID: ${page.appId || 'ไม่ทราบ'}`);
      console.log(`   └─ เหตุผล: ${page.error || 'ไม่ทราบสาเหตุ'}`);
    });
  }
  
  // แสดงเพจที่เปิดใช้งาน
  if (enabledPages.length > 0) {
    console.log('\n✅ เพจที่เปิดใช้งาน:');
    enabledPages.forEach((page, index) => {
      console.log(`   ${index + 1}. ${page.name}`);
      console.log(`   ├─ Page ID: ${page.pageId}`);
      console.log(`   ├─ App ID: ${page.appId}`);
      console.log(`   ├─ ผู้ติดตาม: ${page.followers || 0}`);
      console.log(`   └─ สถานะ: ${page.verification || 'ไม่ทราบ'}`);
    });
  }
  
  // เปรียบเทียบผลลัพธ์
  console.log('\n' + '='.repeat(60));
  console.log('📊 สรุปการเปรียบเทียบ:');
  console.log('='.repeat(60));
  console.log(`Token ที่ตั้งค่าใน .env: ${configuredTokens.length}`);
  console.log(`Token ที่ใช้งานได้จริง: ${validTokens.length}`);
  console.log(`เพจที่ FacebookPagesManager ประมวลผล: ${totalPages}`);
  console.log(`เพจที่เปิดใช้งานได้: ${enabledPages.length}`);
  
  if (configuredTokens.length !== totalPages) {
    console.log(`\n⚠️  ความไม่สอดคล้อง: มี ${configuredTokens.length} token แต่ประมวลผลได้แค่ ${totalPages} เพจ`);
    console.log(`   สาเหตุอาจเป็น: Token หมดอายุ, App ID ไม่ถูกต้อง, หรือ API Rate Limiting`);
  }
  
  if (validTokens.length !== enabledPages.length) {
    console.log(`\n⚠️  ความไม่สอดคล้อง: มี ${validTokens.length} token ใช้งานได้ แต่เปิดใช้งานได้แค่ ${enabledPages.length} เพจ`);
    console.log(`   สาเหตุอาจเป็น: การ validate เพิ่มเติมใน FacebookPagesManager`);
  }
  
  return {
    configured: configuredTokens.length,
    valid: validTokens.length,
    invalid: invalidTokens.length,
    processed: totalPages,
    enabled: enabledPages.length,
    disabled: totalPages - enabledPages.length,
    invalidTokens: invalidTokens,
    validTokens: validTokens
  };
}

// รันสคริปต์หากไฟล์นี้ถูกเรียกใช้โดยตรง
if (require.main === module) {
  debugFacebookPages().then(results => {
    console.log('\n✅ การตรวจสอบเสร็จสิ้น');
    
    if (results.invalid > 0) {
      console.log('\n🔧 คำแนะนำการแก้ไข:');
      console.log('1. ต่ออายุ Token ที่หมดอายุใน Facebook Developer Console');
      console.log('2. ตรวจสอบสิทธิ์ Token ว่ามี pages_manage_posts และ pages_read_engagement');
      console.log('3. ตรวจสอบว่า Facebook App ยังทำงานได้อยู่หรือไม่');
      console.log('4. อัพเดต Token ใหม่ในไฟล์ .env');
    }
    
    if (results.configured !== results.enabled) {
      console.log('\n📝 สิ่งที่ควรตรวจสอบ:');
      console.log(`- มี Token ${results.configured} ตัว แต่ใช้งานได้แค่ ${results.enabled} เพจ`);
      console.log('- ตรวจสอบ Token ที่มีปัญหาและแก้ไข');
    }
    
    process.exit(0);
  }).catch(error => {
    console.error('❌ การตรวจสอบล้มเหลว:', error.message);
    process.exit(1);
  });
}

module.exports = { debugFacebookPages };