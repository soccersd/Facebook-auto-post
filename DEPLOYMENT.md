# 🖥️ คู่มือ Deploy Telegram Bot บน Ubuntu VPS

## 📋 ข้อกำหนดระบบ

### VPS ขั้นต่ำ:
- **RAM**: 1GB ขึ้นไป (แนะนำ 2GB)
- **Storage**: 20GB ขึ้นไป
- **OS**: Ubuntu 20.04 LTS หรือใหม่กว่า
- **Network**: Bandwidth ไม่จำกัด (สำหรับอัพโหลดวิดีโอ)

### Software Requirements:
- Node.js 16+ 
- FFmpeg
- PM2
- Redis (optional)
- Nginx (optional)

## 🚀 ขั้นตอนการ Deploy

### 1. เตรียม VPS

```bash
# เชื่อมต่อ VPS
ssh username@your-vps-ip

# อัพเดตระบบ
sudo apt update && sudo apt upgrade -y

# ติดตั้ง dependencies พื้นฐาน
sudo apt install -y curl wget git build-essential
```

### 2. รัน Auto Setup Script

```bash
# ดาวน์โหลดและรัน deployment script
wget https://raw.githubusercontent.com/your-repo/telegram-facebook-bot/main/deploy-ubuntu.sh
chmod +x deploy-ubuntu.sh
./deploy-ubuntu.sh
```

หรือติดตั้งแบบ manual:

### 3. ติดตั้ง Node.js

```bash
# ติดตั้ง Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# ตรวจสอบ version
node -v  # ควรเป็น v18.x.x หรือใหม่กว่า
npm -v
```

### 4. ติดตั้ง FFmpeg

```bash
sudo apt install -y ffmpeg

# ตรวจสอบการติดตั้ง
ffmpeg -version
```

### 5. ติดตั้ง PM2

```bash
sudo npm install -g pm2

# ตั้งค่าให้ PM2 เริ่มต้นอัตโนมัติ
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $(whoami) --hp $(eval echo ~$(whoami))
```

### 6. Clone โปรเจค

```bash
# สร้างโฟลเดอร์โปรเจค
mkdir -p ~/telegram-facebook-bot
cd ~/telegram-facebook-bot

# Clone หรือ upload โค้ด
git clone https://github.com/your-repo/telegram-facebook-bot.git .

# หรือ upload ไฟล์ด้วย scp/sftp
```

### 7. ติดตั้ง Dependencies

```bash
cd ~/telegram-facebook-bot

# ติดตั้ง Node.js packages
npm install --production

# สร้างโฟลเดอร์ที่จำเป็น
mkdir -p uploads/temp uploads/processed logs
```

### 8. ตั้งค่า Environment

```bash
# คัดลอกและแก้ไข environment file
cp .env.production .env

# แก้ไขไฟล์ .env
nano .env
```

แก้ไขค่าต่อไปนี้ใน `.env`:
```env
TELEGRAM_BOT_TOKEN=your_actual_bot_token
FACEBOOK_APP_ID=your_actual_app_id  
FACEBOOK_APP_SECRET=your_actual_app_secret
```

### 9. ตั้งค่า Facebook Pages

```bash
# แก้ไขไฟล์ Facebook pages configuration
nano src/config/facebookPages.js
```

ใส่ข้อมูลเพจ Facebook จริง:
```javascript
{
  id: 1,
  pageId: 'your_actual_page_id',
  accessToken: 'your_actual_page_access_token',
  name: 'Your Page Name',
  enabled: true
}
```

### 10. รัน Application ด้วย PM2

```bash
# เริ่มต้นแอปพลิเคชัน
pm2 start ecosystem.config.js --env production

# ตรวจสอบสถานะ
pm2 status
pm2 logs telegram-facebook-bot

# บันทึกการตั้งค่า PM2
pm2 save
```

## 🔧 การตั้งค่าเพิ่มเติม

### ติดตั้ง Nginx (Reverse Proxy)

```bash
# ติดตั้ง Nginx
sudo apt install -y nginx

# คัดลอก configuration
sudo cp nginx.conf /etc/nginx/sites-available/telegram-bot

# เปิดใช้งาน site
sudo ln -s /etc/nginx/sites-available/telegram-bot /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# ทดสอบ configuration
sudo nginx -t

# รีสตาร์ท Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### ติดตั้ง SSL Certificate (Let's Encrypt)

```bash
# ติดตั้ง Certbot
sudo apt install -y certbot python3-certbot-nginx

# ขอ SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# ตั้งค่าการต่ออายุอัตโนมัติ
sudo crontab -e
# เพิ่มบรรทัด: 0 12 * * * /usr/bin/certbot renew --quiet
```

### ติดตั้ง Redis (Optional)

```bash
# ติดตั้ง Redis
sudo apt install -y redis-server

# ตั้งค่าให้เริ่มต้นอัตโนมัติ
sudo systemctl enable redis-server
sudo systemctl start redis-server

# ทดสอบ Redis
redis-cli ping  # ควรได้ PONG
```

### ตั้งค่า Firewall

```bash
# เปิด ports ที่จำเป็น
sudo ufw allow ssh
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw allow 3000  # Application (ถ้าไม่ใช้ Nginx)

# เปิดใช้งาน firewall
sudo ufw enable

# ตรวจสอบสถานะ
sudo ufw status
```

## 📊 Monitoring และ Management

### คำสั่ง PM2 สำคัญ

```bash
# ตรวจสอบสถานะ
pm2 status
pm2 info telegram-facebook-bot

# ดู logs
pm2 logs telegram-facebook-bot
pm2 logs telegram-facebook-bot --lines 100

# รีสตาร์ท
pm2 restart telegram-facebook-bot

# อัพเดตแอปพลิเคชัน
pm2 stop telegram-facebook-bot
git pull origin main
npm install --production
pm2 start telegram-facebook-bot

# Monitoring
pm2 monit
```

### ตรวจสอบ System Resources

```bash
# ตรวจสอบ memory และ CPU
htop
free -h
df -h

# ตรวจสอบ network
netstat -tlnp | grep :3000

# ตรวจสอบ logs
tail -f ~/telegram-facebook-bot/logs/combined.log
tail -f /var/log/nginx/access.log
```

## 🔍 Troubleshooting

### ปัญหาที่พบบ่อย

1. **Bot ไม่ตอบสนอง**
   ```bash
   pm2 logs telegram-facebook-bot
   # ตรวจสอบ TELEGRAM_BOT_TOKEN
   ```

2. **ไม่สามารถโพสต์ Facebook ได้**
   ```bash
   # ตรวจสอบ Facebook tokens ใน config
   curl http://localhost:3000/api/facebook/pages
   ```

3. **FFmpeg ไม่ทำงาน**
   ```bash
   ffmpeg -version
   which ffmpeg
   ```

4. **Memory หมด**
   ```bash
   # เพิ่ม swap file
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

### Log Files ที่สำคัญ

- Application logs: `~/telegram-facebook-bot/logs/`
- PM2 logs: `~/.pm2/logs/`
- Nginx logs: `/var/log/nginx/`
- System logs: `/var/log/syslog`

## 📱 การทดสอบ

### ทดสอบ Basic Functions

```bash
# ทดสอบ health check
curl http://localhost:3000/health

# ทดสอบ API status
curl http://localhost:3000/api/status

# ทดสอบ Facebook pages
curl http://localhost:3000/api/facebook/pages
```

### ทดสอบ Telegram Bot

1. ไปหา Bot ใน Telegram
2. ส่งคำสั่ง `/start`
3. ส่งวิดีโอทดสอบ
4. ตรวจสอบ logs: `pm2 logs telegram-facebook-bot`

## 🔄 การอัพเดต

### อัพเดตแอปพลิเคชัน

```bash
cd ~/telegram-facebook-bot

# หยุดแอปพลิเคชัน
pm2 stop telegram-facebook-bot

# อัพเดตโค้ด
git pull origin main

# ติดตั้ง dependencies ใหม่
npm install --production

# เริ่มต้นแอปพลิเคชันใหม่
pm2 start telegram-facebook-bot

# ตรวจสอบสถานะ
pm2 status
pm2 logs telegram-facebook-bot --lines 50
```

## 💡 Tips สำหรับ Production

1. **Security**
   - เปลี่ยน SSH port เริ่มต้น
   - ใช้ SSH key แทน password
   - ตั้งค่า fail2ban
   - อัพเดตระบบเป็นประจำ

2. **Performance**
   - ใช้ SSD storage
   - ตั้งค่า swap file
   - ใช้ CDN สำหรับไฟล์ขนาดใหญ่
   - Monitor resource usage

3. **Backup**
   - สำรองข้อมูล configuration files
   - สำรอง Facebook tokens
   - ใช้ version control (Git)

4. **Monitoring**
   - ตั้งค่า uptime monitoring
   - ใช้ PM2+ หรือ external monitoring
   - ตั้งค่า alerts สำหรับ errors

---

🎉 **การ Deploy เสร็จสิ้น!** 

Bot ของคุณพร้อมทำงานบน VPS แล้ว สามารถส่งวิดีโอผ่าน Telegram และระบบจะโพสต์ไปยัง Facebook Reels ทั้ง 20 เพจอัตโนมัติ!