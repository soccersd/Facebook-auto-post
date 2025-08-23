#!/bin/bash

echo "🧹 ทำความสะอาดไฟล์และ cache..."

# ลบ node_modules และ package-lock.json
echo "📁 ลบ node_modules และ package-lock.json..."
rm -rf node_modules
rm -f package-lock.json

# ทำความสะอาด npm cache
echo "🗑️ ทำความสะอาด npm cache..."
npm cache clean --force

echo "✅ ทำความสะอาดเสร็จสิ้น"

echo "📦 ติดตั้ง dependencies ใหม่..."
npm install

echo "🔧 บังคับอัพเดต packages ที่มีช่องโหว่..."
npm install tough-cookie@^4.1.4 --save
npm install form-data@^4.0.4 --save  
npm install node-telegram-bot-api@latest --save

echo "🔍 รัน npm audit..."
npm audit

echo "⚡ ลองใช้ npm audit fix..."
npm audit fix

echo "💪 ลองใช้ npm audit fix --force..."
npm audit fix --force

echo "📊 ตรวจสอบผลลัพธ์สุดท้าย..."
npm audit

echo "🎉 เสร็จสิ้น! ลองทดสอบ Bot ด้วย: npm start"