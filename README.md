# Telegram Bot Facebook Reels Auto-Poster

ระบบ Telegram Bot ที่รับวิดีโอจากผู้ใช้และโพสต์ไปยัง Facebook Reels อัตโนมัติในหลายเพจตามลำดับ

## ✨ คุณสมบัติหลัก

- 🤖 **Telegram Bot Integration**: รับวิดีโอผ่าน Telegram Bot
- 🎬 **Video Processing**: ประมวลผลวิดีโอให้เหมาะกับ Facebook Reels (9:16 ratio)
- 📘 **Multi-Page Posting**: โพสต์ไปยังหลายเพจ Facebook ตามลำดับ (ปัจจุบัน 20 เพจ)
- 🔄 **Sequential Processing**: โพสต์ทีละเพจตามลำดับ ไม่พร้อมกัน
- 📈 **Scalable Design**: เพิ่มเพจใหม่ได้ง่ายในอนาคต
- 📊 **Comprehensive Logging**: ระบบ logging ที่ครอบคลุม
- ⚡ **Real-time Notifications**: แจ้งเตือนผลการโพสต์ผ่าน LINE

## 🏗️ สถาปัตยกรรมระบบ

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Telegram User   │────│ Telegram Bot    │────│ Video Processor │
│  (Send Video)   │    │   (Polling)     │    │  (FFmpeg)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Facebook Reels Service                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Page 1    │  │   Page 2    │  │   Page N    │            │
│  │  (Sequential│  │  (Sequential│  │  (Sequential│  ...       │
│  │   Posting)  │  │   Posting)  │  │   Posting)  │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## 🖥️ การ Deploy บน Ubuntu VPS

### Quick Start สำหรับ VPS:

```bash
# 1. เชื่อมต่อ VPS
ssh username@your-vps-ip

# 2. รัน auto setup script
wget https://your-repo.com/deploy-ubuntu.sh
chmod +x deploy-ubuntu.sh
./deploy-ubuntu.sh

# 3. Clone โปรเจค
git clone https://github.com/your-repo/telegram-facebook-bot.git
cd telegram-facebook-bot

# 4. รัน quick start
chmod +x start-vps.sh
./start-vps.sh

# 5. แก้ไข configuration
nano .env  # ใส่ TELEGRAM_BOT_TOKEN
nano src/config/facebookPages.js  # ใส่ Facebook Page tokens

# 6. รีสตาร์ท
pm2 restart telegram-facebook-bot
```

### System Requirements สำหรับ VPS:
- **RAM**: 1GB+ (แนะนำ 2GB)
- **Storage**: 20GB+
- **OS**: Ubuntu 20.04 LTS+
- **Network**: Unlimited bandwidth

### Production Features:
- ✅ PM2 Process Management
- ✅ Auto Restart on Crash
- ✅ Log Rotation
- ✅ Nginx Reverse Proxy (Optional)
- ✅ SSL Certificate (Optional)
- ✅ Redis Support (Optional)
- ✅ System Monitoring

📖 **ดูคู่มือโดยละเอียด**: [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 📋 ข้อกำหนดระบบ (Development)

- Node.js >= 16.0.0
- FFmpeg (สำหรับประมวลผลวิดีโอ)
- Telegram Bot Token
- Facebook App และ Page Access Tokens
- Redis (อุปกรณ์เสริม - สำหรับ queue system ขั้นสูง)

## 🚀 การติดตั้ง

### 1. Clone และติดตั้ง Dependencies

```bash
cd linebot
npm install
```

### 2. ตั้งค่า Environment Variables

```bash
cp .env.example .env
```

แก้ไขไฟล์ `.env`:
```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Facebook Configuration  
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret

# Server Configuration
PORT=3000
NODE_ENV=development
```

### 3. กำหนดค่า Facebook Pages

แก้ไขไฟล์ `src/config/facebookPages.js`:

```javascript
// เปลี่ยนจาก placeholder เป็นข้อมูลจริง
{
  id: 1,
  pageId: 'your_actual_page_id_1',
  accessToken: 'your_actual_page_access_token_1', 
  name: 'Page Name 1',
  enabled: true
}
```

### 4. ติดตั้ง FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows:**
ดาวน์โหลดจาก [FFmpeg Official Site](https://ffmpeg.org/download.html)

## 🎯 การใช้งาน

### 1. เริ่มต้นเซิร์ฟเวอร์

```bash
# Development mode
npm run dev

# Production mode  
npm start
```

### 2. ทดสอบ Telegram Bot

1. ค้นหา Bot ใน Telegram ด้วย username ที่ได้จาก BotFather
2. เริ่มแชทด้วยคำสั่ง `/start`
3. ส่งวิดีโอไปยัง Bot
4. รอการแจ้งเตือนเมื่อโพสต์เสร็จสิ้น

## 📁 โครงสร้างโปรเจค

```
linebot/
├── src/
│   ├── config/
│   │   ├── index.js              # การตั้งค่าหลัก
│   │   └── facebookPages.js      # จัดการเพจ Facebook
│   ├── controllers/
│   │   └── lineBotController.js  # ควบคุม LINE Bot
│   ├── services/
│   │   ├── videoProcessor.js     # ประมวลผลวิดีโอ
│   │   └── facebookReelsService.js # โพสต์ Facebook Reels
│   ├── utils/
│   │   └── logger.js             # ระบบ logging
│   └── app.js                    # แอปพลิเคชันหลัก
├── uploads/                      # ไฟล์วิดีโอ
├── logs/                         # ไฟล์ log
├── package.json
├── .env.example
└── README.md
```

## 🔧 การกำหนดค่า

### Facebook Pages Management

เพิ่มเพจใหม่ใน `src/config/facebookPages.js`:

```javascript
// เพิ่มเพจใหม่
this.pagesManager.addPage({
  pageId: 'new_page_id',
  accessToken: 'new_page_access_token',
  name: 'New Page Name'
});
```

### Video Processing Settings

ปรับแต่งการประมวลผลวิดีโอใน `src/config/index.js`:

```javascript
reels: {
  delayBetweenPosts: 5,    // วินาทีรอระหว่างโพสต์
  maxRetries: 3,           // จำนวนครั้งที่ลองใหม่
  retryDelay: 10,          // วินาทีรอก่อนลองใหม่
}
```

## 📊 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | ตรวจสอบสถานะเซิร์ฟเวอร์ |
| POST | `/webhook/telegram` | Telegram Bot webhook (หากใช้ webhook mode) |
| GET | `/api/status` | สถานะระบบโดยรวม |
| GET | `/api/facebook/pages` | สถานะเพจ Facebook |

## 📝 คำสั่ง LINE Bot

| คำสั่ง | รายละเอียด |
|--------|-----------|
| ส่งวิดีโอ | โพสต์วิดีโอไปยัง Facebook Reels |
| `help` หรือ `ช่วยเหลือ` | แสดงวิธีใช้งาน |
| `status` หรือ `สถานะ` | ตรวจสอบสถานะระบบ |

## 🔍 การแก้ไขปัญหา

### 1. วิดีโอไม่สามารถประมวลผลได้

ตรวจสอบ:
- FFmpeg ติดตั้งถูกต้องหรือไม่
- รูปแบบไฟล์วิดีโอที่รองรับ (MP4, MOV, AVI)
- ขนาดไฟล์ไม่เกิน 100MB

### 2. ไม่สามารถโพสต์ไปยัง Facebook ได้

ตรวจสอบ:
- Page Access Token ถูกต้องและไม่หมดอายุ
- สิทธิ์ในการโพสต์ Reels
- Facebook API rate limits

### 2. Telegram Bot ไม่ตอบสนอง

ตรวจสอบ:
- Bot Token ถูกต้อง
- Bot ได้รับสิทธิ์ในการรับวิดีโอ
- ระบบกำลังทำงานในโหมด polling

## 📈 การ Monitoring

### Log Files

- `logs/combined.log` - Log ทั้งหมด
- `logs/error.log` - Error เท่านั้น  
- `logs/linebot.log` - LINE Bot activities
- `logs/facebook.log` - Facebook API activities
- `logs/video.log` - Video processing

### System Status

ตรวจสอบสถานะผ่าน API:
```bash
curl http://localhost:3000/api/status
```

## 🔒 ความปลอดภัย

- เก็บ API keys ใน environment variables
- ใช้ HTTPS ใน production
- Validate webhook signatures
- จำกัดขนาดไฟล์อัพโหลด
- ทำความสะอาดไฟล์เก่าอัตโนมัติ

## 🚀 การ Deploy

### Production Setup

1. ใช้ PM2 สำหรับ process management:
```bash
npm install -g pm2
pm2 start src/app.js --name linebot-facebook-reels
```

2. ตั้งค่า reverse proxy (Nginx):
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

3. SSL Certificate:
```bash
certbot --nginx -d your-domain.com
```

## 🤝 การสนับสนุน

หากพบปัญหาหรือต้องการความช่วยเหลือ:

1. ตรวจสอบ logs ใน `/logs` directory
2. ตรวจสอบ API status endpoints
3. ดู configuration ใน `/src/config`

## 📄 License

MIT License - ดูรายละเอียดใน LICENSE file

---

## 🎯 สรุปการใช้งาน

1. **Setup**: ติดตั้ง dependencies และกำหนดค่า Telegram Bot Token + Facebook API tokens
2. **Configure**: ปรับแต่งเพจ Facebook ใน config file  
3. **Deploy**: รัน server (Bot ใช้ polling mode - ไม่ต้องตั้ง webhook)
4. **Use**: ส่งวิดีโอผ่าน Telegram Bot และรอผลการโพสต์

ระบบจะโพสต์วิดีโอไปยัง Facebook Reels ทั้ง 20 เพจตามลำดับอัตโนมัติ! 🚀# Facebook-auto-post
