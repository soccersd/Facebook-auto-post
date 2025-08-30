# 🖥️ คู่มือการติดตั้งบน Windows สำหรับ Telegram Bot Facebook Reels Auto-Poster

## 📋 ข้อกำหนดของระบบ
- Windows 10 หรือ Windows 11 (แนะนำ 64-bit)
- RAM ขั้นต่ำ 4GB, CPU 2 คอร์
- พื้นที่ว่างในดิสก์อย่างน้อย 20GB
- สิทธิ์ Administrator สำหรับการติดตั้ง

## 🔧 ขั้นตอนการติดตั้ง

### 1. ติดตั้ง Node.js
1. ไปที่ [nodejs.org](https://nodejs.org)
2. ดาวน์โหลดเวอร์ชัน **LTS** สำหรับ Windows (เช่น node-v18.x.x-x64.msi)
3. รันตัวติดตั้งในฐานะ Administrator
4. ทำตามตัวช่วยติดตั้งด้วยการตั้งค่าเริ่มต้น
5. ตรวจสอบการติดตั้งโดยเปิด Command Prompt และรัน:
   ```cmd
   node --version
   npm --version
   ```

### 2. ติดตั้ง FFmpeg
#### ตัวเลือก A: ใช้ Chocolatey (แนะนำ)
1. ติดตั้ง Chocolatey จาก [chocolatey.org](https://chocolatey.org/install)
2. เปิด Command Prompt ในฐานะ Administrator
3. รัน:
   ```cmd
   choco install ffmpeg
   ```

#### ตัวเลือก B: ติดตั้งด้วยตนเอง
1. ดาวน์โหลด FFmpeg จาก [ffmpeg.org](https://ffmpeg.org/download.html)
2. แตกไฟล์ไปที่ `C:\ffmpeg`
3. เพิ่ม `C:\ffmpeg\bin` ลงในระบบ PATH:
   - กด Win + X และเลือก "System"
   - คลิก "Advanced system settings"
   - คลิก "Environment Variables"
   - ภายใต้ "System Variables", หาและเลือก "Path", แล้วคลิก "Edit"
   - คลิก "New" และเพิ่ม `C:\ffmpeg\bin`
   - คลิก "OK" เพื่อบันทึก

### 3. ติดตั้ง Git (ไม่จำเป็นแต่แนะนำ)
1. ดาวน์โหลด Git จาก [git-scm.com](https://git-scm.com/download/win)
2. รันตัวติดตั้งด้วยการตั้งค่าเริ่มต้น
3. ตรวจสอบการติดตั้ง:
   ```cmd
   git --version
   ```

### 4. ติดตั้ง PM2 Process Manager
1. เปิด Command Prompt หรือ PowerShell
2. รัน:
   ```cmd
   npm install -g pm2
   ```
3. ตรวจสอบการติดตั้ง:
   ```cmd
   pm2 --version
   ```

### 5. ติดตั้ง Redis (ไม่จำเป็น - สำหรับระบบคิว)
#### ตัวเลือก A: ใช้ Docker (แนะนำ)
1. ติดตั้ง Docker Desktop จาก [docker.com](https://www.docker.com/products/docker-desktop)
2. รัน Redis container:
   ```cmd
   docker run -d -p 6379:6379 redis
   ```

#### ตัวเลือก B: ติดตั้ง Native
1. ดาวน์โหลด Redis สำหรับ Windows จาก [MicrosoftArchive](https://github.com/MicrosoftArchive/redis)
2. ทำตามขั้นตอนการติดตั้ง

## 🚀 การตั้งค่าโปรเจค

### 1. Clone หรือดาวน์โหลดโปรเจค
#### ใช้ Git:
```cmd
git clone <your-repository-url>
cd linebot
```

#### ดาวน์โหลดด้วยตนเอง:
1. ดาวน์โหลดไฟล์ ZIP ของโปรเจค
2. แตกไฟล์ไปยังโฟลเดอร์ (เช่น `C:\projects\linebot`)

### 2. ติดตั้ง Dependencies ของโปรเจค
```cmd
cd C:\projects\linebot  # หรือพาธของโปรเจคคุณ
npm install
```

### 3. ตั้งค่า Environment Variables
1. คัดลอก `.env.example` เป็น `.env`:
   ```cmd
   copy .env.example .env
   ```
2. แก้ไขไฟล์ `.env` ด้วยโปรแกรม text editor ที่คุณชอบ:
   - เพิ่ม Telegram Bot Token
   - เพิ่ม Facebook App IDs และ Page Tokens
   - ตั้งค่าอื่นๆ ตามต้องการ

### 4. สร้างไดเรกทอรี Upload และ Log
```cmd
mkdir uploads
mkdir logs
```

## ▶️ การรันแอปพลิเคชัน

### ใช้ PM2 (แนะนำสำหรับ Production)
```cmd
# เริ่มแอปพลิเคชัน
pm2 start ecosystem.config.js --env development

# ตรวจสอบสถานะ
pm2 status

# ดู log
pm2 logs

# restart แอปพลิเคชัน
pm2 restart telegram-facebook-bot

# หยุดแอปพลิเคชัน
pm2 stop telegram-facebook-bot
```

### ใช้ npm (Development)
```cmd
npm start
```

## 🔍 การตรวจสอบ

### ตรวจสอบว่าแอปพลิเคชันกำลังทำงาน:
```cmd
pm2 status
```

### ทดสอบ health endpoint:
```cmd
curl http://localhost:3000/health
```

### ตรวจสอบสถานะ Facebook pages:
```cmd
curl http://localhost:3000/api/facebook/pages
```

## 🛠️ การแก้ไขปัญหา

### ปัญหาที่พบบ่อย:

1. **Port ถูกใช้งานอยู่**:
   ```cmd
   # หา process ที่ใช้ port 3000
   netstat -ano | findstr :3000
   
   # ปิด process (แทนที่ PID ด้วย process ID จริง)
   taskkill /PID <PID> /F
   ```

2. **หา FFmpeg ไม่เจอ**:
   - ตรวจสอบว่า FFmpeg อยู่ใน PATH
   - รีสตาร์ท Command Prompt หลังจากเปลี่ยน PATH
   - ทดสอบด้วย: `ffmpeg -version`

3. **Permission errors**:
   - รัน Command Prompt ในฐานะ Administrator
   - ตรวจสอบสิทธิ์ของโฟลเดอร์

4. **npm install ผิดพลาด**:
   ```cmd
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

## 🔄 การอัปเดตแอปพลิเคชัน

### ใช้ Git:
```cmd
git pull origin main
npm install
pm2 restart telegram-facebook-bot --update-env
```

### อัปเดตด้วยตนเอง:
1. ดาวน์โหลดเวอร์ชันล่าสุด
2. สำรองไฟล์ `.env`
3. แทนที่ไฟล์
4. คืนค่าไฟล์ `.env`
5. รัน `npm install`
6. restart แอปพลิเคชัน

## 📊 การตรวจสอบและบำรุงรักษา

### ดู Application Logs:
```cmd
pm2 logs telegram-facebook-bot
```

### ตรวจสอบการใช้งานทรัพยากร:
```cmd
pm2 monit
```

### ตรวจสอบสถานะระบบ:
```cmd
pm2 status
```

## 🚫 การถอนการติดตั้ง

### หยุดและลบ PM2 Process:
```cmd
pm2 stop telegram-facebook-bot
pm2 delete telegram-facebook-bot
```

### ลบไฟล์โปรเจค:
- ลบโฟลเดอร์โปรเจค
- ลบไดเรกทอรีที่สร้าง (uploads, logs)

### ถอนการติดตั้ง Global Packages:
```cmd
npm uninstall -g pm2
```

## 📞 สนับสนุน

หากคุณพบปัญหา:
1. ตรวจสอบ log: `pm2 logs`
2. ตรวจสอบว่า environment variables ถูกตั้งค่าถูกต้อง
3. ตรวจสอบว่า service ที่จำเป็น (Redis) กำลังทำงาน
4. ตรวจสอบว่า Facebook tokens ของคุณยังใช้งานได้

สำหรับความช่วยเหลือเพิ่มเติม กรุณาดูเอกสารหลักหรือติดต่อ support