#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 กำลังแก้ไขช่องโหว่ด้านความปลอดภัย...\n');

// Function to run command safely
const runCommand = (command, description) => {
  try {
    console.log(`📦 ${description}...`);
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} เสร็จสิ้น`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} ล้มเหลว:`, error.message);
    return false;
  }
};

// 1. ลบ node_modules และ package-lock.json
console.log('🧹 ทำความสะอาดไฟล์เก่า...');
if (fs.existsSync('node_modules')) {
  runCommand('rm -rf node_modules', 'ลบ node_modules');
}
if (fs.existsSync('package-lock.json')) {
  runCommand('rm -f package-lock.json', 'ลบ package-lock.json');
}

// 2. Clear npm cache
runCommand('npm cache clean --force', 'ล้าง npm cache');

// 3. ติดตั้ง dependencies ใหม่
runCommand('npm install', 'ติดตั้ง dependencies ใหม่');

// 4. Force update vulnerable packages
console.log('\n🔄 บังคับอัพเดต packages ที่มีช่องโหว่...');
runCommand('npm install tough-cookie@^4.1.4 --save', 'อัพเดต tough-cookie');
runCommand('npm install form-data@^4.0.4 --save', 'อัพเดต form-data');
runCommand('npm install node-telegram-bot-api@latest --save', 'อัพเดต node-telegram-bot-api');

// 5. ลองใช้ npm audit fix
console.log('\n🔍 รัน npm audit fix...');
runCommand('npm audit fix', 'แก้ไขช่องโหว่อัตโนมัติ');

// 6. ถ้ายังมีปัญหา ลองใช้ --force
console.log('\n⚡ ลอง npm audit fix --force...');
runCommand('npm audit fix --force', 'แก้ไขช่องโหว่แบบบังคับ');

// 7. ตรวจสอบผลลัพธ์
console.log('\n🔍 ตรวจสอบช่องโหว่หลังการแก้ไข...');
runCommand('npm audit', 'ตรวจสอบช่องโหว่');

console.log('\n🎉 การแก้ไขช่องโหว่เสร็จสิ้น!');
console.log('\n📝 ขั้นตอนถัดไป:');
console.log('   1. ทดสอบ Bot: npm start');
console.log('   2. ตรวจสอบ breaking changes');
console.log('   3. ทดสอบการส่งวิดีโอผ่าน Telegram');