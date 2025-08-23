#!/bin/bash

# LINE Bot Facebook Reels Auto-Poster Setup Script
# สคริปต์สำหรับติดตั้งและตั้งค่าระบบ

echo "🚀 LINE Bot Facebook Reels Auto-Poster Setup"
echo "============================================="

# ตรวจสอบ Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# ตรวจสอบ npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi

echo "✅ npm $(npm -v) detected"

# ติดตั้ง dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# ตรวจสอบ FFmpeg
if command -v ffmpeg &> /dev/null; then
    echo "✅ FFmpeg $(ffmpeg -version | head -n1 | cut -d' ' -f3) detected"
else
    echo "⚠️  FFmpeg not detected. Installing..."
    
    if command -v brew &> /dev/null; then
        # macOS with Homebrew
        brew install ffmpeg
    elif command -v apt-get &> /dev/null; then
        # Ubuntu/Debian
        sudo apt-get update
        sudo apt-get install -y ffmpeg
    else
        echo "❌ Please install FFmpeg manually:"
        echo "   macOS: brew install ffmpeg"
        echo "   Ubuntu/Debian: sudo apt-get install ffmpeg"
        echo "   Windows: Download from https://ffmpeg.org/download.html"
    fi
fi

# สร้าง .env file หากยังไม่มี
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created. Please edit it with your API credentials."
else
    echo "✅ .env file already exists"
fi

# สร้างโฟลเดอร์ที่จำเป็น
echo "📁 Creating necessary directories..."
mkdir -p uploads/temp uploads/processed logs

echo "✅ Directories created"

# แสดงขั้นตอนถัดไป
echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Edit .env file with your LINE Bot and Facebook credentials"
echo "2. Update Facebook pages configuration in src/config/facebookPages.js"
echo "3. Start the development server: npm run dev"
echo "4. Set up ngrok for webhook: ngrok http 3000"
echo "5. Configure LINE Bot webhook URL in LINE Developers Console"
echo ""
echo "📚 Documentation: See README.md for detailed instructions"
echo "🔗 Webhook URL format: https://your-ngrok-url.ngrok.io/webhook/line"
echo ""
echo "Happy coding! 🚀"