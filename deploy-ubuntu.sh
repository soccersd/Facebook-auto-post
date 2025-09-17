#!/bin/bash

# Telegram Bot Facebook Reels Auto-Poster Deployment Script for Ubuntu VPS
# สคริปต์สำหรับ deploy บน Ubuntu VPS

echo "🚀 Starting Telegram Bot deployment on Ubuntu VPS..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}================================${NC}"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "ห้ามรันในฐานะ root user กรุณาใช้ user ธรรมดา"
    exit 1
fi

print_header "ขั้นตอนที่ 1: อัพเดตระบบ"
sudo apt update && sudo apt upgrade -y

print_header "ขั้นตอนที่ 2: ติดตั้ง Node.js"
# Install Node.js 18.x
if ! command -v node &> /dev/null; then
    print_status "กำลังติดตั้ง Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    print_status "Node.js ได้ติดตั้งแล้ว: $(node -v)"
fi

print_header "ขั้นตอนที่ 3: ติดตั้ง FFmpeg"
if ! command -v ffmpeg &> /dev/null; then
    print_status "กำลังติดตั้ง FFmpeg..."
    sudo apt install -y ffmpeg
else
    print_status "FFmpeg ได้ติดตั้งแล้ว: $(ffmpeg -version | head -n1)"
fi

print_header "ขั้นตอนที่ 4: ติดตั้ง PM2"
if ! command -v pm2 &> /dev/null; then
    print_status "กำลังติดตั้ง PM2..."
    sudo npm install -g pm2
else
    print_status "PM2 ได้ติดตั้งแล้ว: $(pm2 -v)"
fi

print_header "ขั้นตอนที่ 5: ติดตั้ง Redis (Optional)"
if ! command -v redis-server &> /dev/null; then
    print_status "กำลังติดตั้ง Redis..."
    sudo apt install -y redis-server
    sudo systemctl enable redis-server
    sudo systemctl start redis-server
else
    print_status "Redis ได้ติดตั้งแล้ว"
fi

print_header "ขั้นตอนที่ 6: สร้างโฟลเดอร์โปรเจค"
PROJECT_DIR="$HOME/telegram-facebook-bot"
if [ ! -d "$PROJECT_DIR" ]; then
    mkdir -p "$PROJECT_DIR"
    print_status "สร้างโฟลเดอร์โปรเจค: $PROJECT_DIR"
else
    print_status "โฟลเดอร์โปรเจคมีอยู่แล้ว: $PROJECT_DIR"
fi

print_header "ขั้นตอนที่ 7: ตั้งค่า Firewall"
print_status "เปิด port 3001 สำหรับแอปพลิเคชัน..."
sudo ufw allow 3001
sudo ufw allow ssh
sudo ufw --force enable

print_header "ขั้นตอนถัดไป"
print_status "1. อัพโหลดโค้ดไปยัง: $PROJECT_DIR"
print_status "2. ตั้งค่า .env file"
print_status "3. รัน: npm install"
print_status "4. รัน: pm2 start ecosystem.config.js"

echo ""
print_header "ข้อมูลสำคัญ"
echo "📁 Project Directory: $PROJECT_DIR"
echo "🔗 Node.js Version: $(node -v)"
echo "📦 NPM Version: $(npm -v)"
echo "🎬 FFmpeg: $(ffmpeg -version | head -n1 | cut -d' ' -f3)"
echo "⚡ PM2 Version: $(pm2 -v)"
echo "🗄️  Redis Status: $(systemctl is-active redis-server)"

echo ""
print_status "✅ VPS setup เสร็จสิ้น! พร้อม deploy แอปพลิเคชันแล้ว"