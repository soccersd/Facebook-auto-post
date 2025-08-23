#!/bin/bash

echo "🛠️ แก้ไขช่องโหว่ Telegram Bot - Step by Step"
echo "=================================================="

# Step 1: ทำความสะอาด
echo ""
echo "📝 Step 1: ทำความสะอาดไฟล์เก่า..."
rm -rf node_modules
rm -f package-lock.json
echo "✅ ลบ node_modules และ package-lock.json เสร็จสิ้น"

# Step 2: Clear cache
echo ""
echo "📝 Step 2: ทำความสะอาด npm cache..."
npm cache clean --force
echo "✅ ทำความสะอาด npm cache เสร็จสิ้น"

# Step 3: ติดตั้ง dependencies ใหม่
echo ""
echo "📝 Step 3: ติดตั้ง dependencies ใหม่..."
npm install --legacy-peer-deps
echo "✅ ติดตั้ง dependencies เสร็จสิ้น"

# Step 4: ตรวจสอบช่องโหว่
echo ""
echo "📝 Step 4: ตรวจสอบช่องโหว่..."
npm audit

# Step 5: แก้ไขช่องโหว่อัตโนมัติ
echo ""
echo "📝 Step 5: แก้ไขช่องโหว่อัตโนมัติ..."
npm audit fix --legacy-peer-deps

# Step 6: ตรวจสอบผลลัพธ์
echo ""
echo "📝 Step 6: ตรวจสอบผลลัพธ์สุดท้าย..."
npm audit

echo ""
echo "🎉 เสร็จสิ้น!"
echo ""
echo "📋 สรุปขั้นตอนถัดไป:"
echo "   1. ตรวจสอบว่าช่องโหว่ลดลงหรือไม่"
echo "   2. ทดสอบ Bot: npm start"
echo "   3. ส่งวิดีโอทดสอบผ่าน Telegram"
echo "   4. ตรวจสอบการทำงานของ Facebook posting"