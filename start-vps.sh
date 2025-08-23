#!/bin/bash

# Quick Start Script สำหรับ Telegram Bot บน Ubuntu VPS
# รันคำสั่งนี้หลังจาก upload โค้ดไปยัง VPS แล้ว

set -e  # Exit on any error

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

echo "🚀 เริ่มต้น Quick Setup สำหรับ Telegram Bot..."

# ตรวจสอบว่าอยู่ในโฟลเดอร์โปรเจคหรือไม่
if [ ! -f "package.json" ]; then
    print_error "ไม่พบไฟล์ package.json กรุณารันคำสั่งนี้ในโฟลเดอร์โปรเจค"
    exit 1
fi

print_status "พบไฟล์ package.json"

# ติดตั้ง dependencies
print_status "กำลังติดตั้ง Node.js dependencies..."
npm install --production

# สร้างโฟลเดอร์ที่จำเป็น
print_status "สร้างโฟลเดอร์ที่จำเป็น..."
mkdir -p uploads/temp uploads/processed logs

# ตรวจสอบไฟล์ .env
if [ ! -f ".env" ]; then
    if [ -f ".env.production" ]; then
        print_status "คัดลอกไฟล์ .env.production เป็น .env"
        cp .env.production .env
    else
        print_warning "ไม่พบไฟล์ .env กรุณาสร้างไฟล์ .env และใส่ tokens ที่จำเป็น"
        cp .env.example .env
    fi
else
    print_status "พบไฟล์ .env แล้ว"
fi

# ตรวจสอบ PM2
if ! command -v pm2 &> /dev/null; then
    print_status "กำลังติดตั้ง PM2..."
    sudo npm install -g pm2
else
    print_status "PM2 ได้ติดตั้งแล้ว"
fi

# ตรวจสอบว่ามี TELEGRAM_BOT_TOKEN หรือไม่
if grep -q "your_telegram_bot_token_here" .env; then
    print_warning "⚠️  กรุณาแก้ไข TELEGRAM_BOT_TOKEN ในไฟล์ .env"
    echo "   nano .env"
    echo ""
fi

# ตรวจสอบ Facebook configuration
if grep -q "YOUR_PAGE_ID_" src/config/facebookPages.js; then
    print_warning "⚠️  กรุณาแก้ไข Facebook Pages configuration"
    echo "   nano src/config/facebookPages.js"
    echo ""
fi

# หยุด PM2 process ถ้ามี
if pm2 describe telegram-facebook-bot > /dev/null 2>&1; then
    print_status "หยุด PM2 process ที่มีอยู่..."
    pm2 stop telegram-facebook-bot
    pm2 delete telegram-facebook-bot
fi

# เริ่มต้นแอปพลิเคชันด้วย PM2
print_status "เริ่มต้นแอปพลิเคชันด้วย PM2..."
pm2 start ecosystem.config.js --env production

# บันทึกการตั้งค่า PM2
pm2 save

# แสดงสถานะ
print_status "ตรวจสอบสถานะแอปพลิเคชัน..."
pm2 status

echo ""
echo "🎉 Setup เสร็จสิ้น!"
echo ""
echo "📋 คำสั่งที่มีประโยชน์:"
echo "   pm2 status                    - ดูสถานะแอปพลิเคชัน"
echo "   pm2 logs telegram-facebook-bot - ดู logs"
echo "   pm2 restart telegram-facebook-bot - รีสตาร์ท"
echo "   pm2 monit                     - monitoring"
echo ""
echo "🔗 API Endpoints:"
echo "   http://localhost:3000/health     - Health check"
echo "   http://localhost:3000/api/status - System status"
echo ""
echo "📝 Next Steps:"
echo "   1. แก้ไขไฟล์ .env ใส่ TELEGRAM_BOT_TOKEN"
echo "   2. แก้ไขไฟล์ src/config/facebookPages.js"
echo "   3. ทดสอบ Bot ใน Telegram"
echo ""

# ตรวจสอบว่าแอปพลิเคชันทำงานหรือไม่
sleep 3
if curl -s http://localhost:3000/health > /dev/null; then
    print_status "✅ แอปพลิเคชันทำงานปกติที่ port 3000"
else
    print_warning "⚠️  แอปพลิเคชันอาจยังไม่พร้อม ให้ตรวจสอบ logs: pm2 logs telegram-facebook-bot"
fi