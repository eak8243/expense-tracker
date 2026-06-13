# คู่มือ Deploy Expense Tracker บน On-Premise Linux Server (Docker)

## ข้อกำหนดเบื้องต้น

| รายการ | เวอร์ชันขั้นต่ำ |
|---|---|
| Docker | 24.x ขึ้นไป |
| Docker Compose | v2.x ขึ้นไป (`docker compose` ไม่ใช่ `docker-compose`) |
| RAM | 1 GB ขึ้นไป |
| Disk | 5 GB ขึ้นไป |

ตรวจสอบเวอร์ชัน:
```bash
docker --version
docker compose version
```

---

## ขั้นตอนที่ 1 — ดาวน์โหลด Source Code

**วิธีที่ 1: Download ZIP จาก Manus**

ไปที่ Management UI → More (⋯) → **Download as ZIP** แล้วแตกไฟล์บน server:

```bash
unzip expense-tracker.zip -d expense-tracker
cd expense-tracker
```

**วิธีที่ 2: Clone จาก GitHub** (ถ้า export ไปแล้ว)

```bash
git clone https://github.com/your-org/expense-tracker.git
cd expense-tracker
```

---

## ขั้นตอนที่ 2 — สร้างไฟล์ Environment Variables

```bash
cp deploy/env-template.txt .env
nano .env   # หรือ vim .env
```

แก้ไขค่าต่อไปนี้ให้ครบ:

```bash
# Database (ตั้งรหัสผ่านที่แข็งแกร่ง)
MYSQL_ROOT_PASSWORD=MyStr0ngR00tPass!
MYSQL_USER=expense_user
MYSQL_PASSWORD=MyStr0ngDbPass!

# JWT Secret (สร้างแบบสุ่ม)
JWT_SECRET=$(openssl rand -base64 32)

# Manus OAuth — ดูค่าจาก Manus Project Settings → Secrets
VITE_APP_ID=your_app_id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://manus.im
OWNER_OPEN_ID=your_owner_open_id
OWNER_NAME=your_name

# Manus Built-in APIs — ดูค่าจาก Manus Project Settings → Secrets
BUILT_IN_FORGE_API_URL=https://...
BUILT_IN_FORGE_API_KEY=your_key
VITE_FRONTEND_FORGE_API_KEY=your_frontend_key
VITE_FRONTEND_FORGE_API_URL=https://...

VITE_APP_TITLE=Expense Tracker
```

> **หมายเหตุ:** ค่า Manus secrets ดูได้จาก Management UI → Settings → Secrets

---

## ขั้นตอนที่ 3 — Build และ Start

```bash
# Build image และ start ทุก services
docker compose up -d --build

# ดู logs ระหว่าง startup
docker compose logs -f app
```

รอจนเห็น:
```
Server running on http://localhost:3000/
```

---

## ขั้นตอนที่ 4 — รัน Database Migration

ครั้งแรกต้องสร้าง tables ในฐานข้อมูล:

```bash
docker compose exec app node -e "
import('./drizzle/migrate.js').catch(() => {
  console.log('Migration via drizzle-kit');
})
"
```

หรือใช้วิธีง่ายกว่า — รัน migration SQL โดยตรง:

```bash
# เข้า MySQL container
docker compose exec db mysql -u expense_user -p expense_tracker

# วาง SQL migration จาก drizzle/migrations/*.sql ทีละไฟล์ตามลำดับ
```

> **แนะนำ:** ใช้ MySQL client tool เช่น DBeaver เชื่อมต่อที่ `localhost:3306` แล้ว run migration SQL ไฟล์ตามลำดับใน `drizzle/migrations/`

---

## ขั้นตอนที่ 5 — ตรวจสอบว่าทำงานได้

```bash
# ดูสถานะ containers
docker compose ps

# ทดสอบ health check
curl http://localhost:3000/api/health
```

เปิด browser ไปที่ `http://your-server-ip:3000`

---

## ขั้นตอนที่ 6 — ตั้งค่า Nginx (แนะนำ)

แก้ไข `nginx.conf` ให้ตรงกับ domain ของคุณ:

```nginx
server {
    listen 80;
    server_name expense.yourcompany.com;   # เปลี่ยนตรงนี้
    ...
}
```

แล้ว restart nginx:

```bash
docker compose restart nginx
```

---

## การตั้งค่า SSL (HTTPS) ด้วย Let's Encrypt

```bash
# ติดตั้ง certbot บน host
sudo apt install certbot

# ขอ certificate (ต้องมี domain และ port 80 เปิดอยู่)
sudo certbot certonly --standalone -d expense.yourcompany.com

# Copy certificates เข้า volume
sudo cp /etc/letsencrypt/live/expense.yourcompany.com/fullchain.pem \
        /var/lib/docker/volumes/expense-tracker_nginx_certs/_data/
sudo cp /etc/letsencrypt/live/expense.yourcompany.com/privkey.pem \
        /var/lib/docker/volumes/expense-tracker_nginx_certs/_data/
```

จากนั้นเปิด comment ส่วน HTTPS ใน `nginx.conf` และ restart nginx

---

## คำสั่งที่ใช้บ่อย

```bash
# ดู logs แบบ real-time
docker compose logs -f app

# Restart app เมื่อแก้ไข config
docker compose restart app

# อัปเดต app (pull code ใหม่ แล้ว rebuild)
git pull
docker compose up -d --build app

# หยุดทุก services
docker compose down

# หยุดและลบ volumes (ระวัง: ลบข้อมูล DB ด้วย!)
docker compose down -v

# ดูขนาด disk ที่ใช้
docker system df
```

---

## Backup ฐานข้อมูล

```bash
# Backup
docker compose exec db mysqldump -u expense_user -p expense_tracker > backup_$(date +%Y%m%d).sql

# Restore
docker compose exec -T db mysql -u expense_user -p expense_tracker < backup_20260101.sql
```

แนะนำให้ตั้ง cron job backup ทุกวัน:

```bash
# เพิ่มใน crontab (crontab -e)
0 2 * * * cd /path/to/expense-tracker && docker compose exec -T db mysqldump -u expense_user -pYourPassword expense_tracker > /backups/expense_$(date +\%Y\%m\%d).sql
```

---

## Troubleshooting

| ปัญหา | วิธีแก้ |
|---|---|
| App ไม่ start | `docker compose logs app` ดู error |
| DB connection failed | ตรวจสอบ `DATABASE_URL` ใน `.env` |
| Port 3000 ไม่ตอบสนอง | `docker compose ps` ดูว่า container running |
| Build ล้มเหลว | `docker compose build --no-cache app` |
| Migration ไม่ผ่าน | รัน SQL ไฟล์ใน `drizzle/migrations/` ตามลำดับ |

---

## การตั้งค่า File Storage

ระบบรองรับ 3 โหมดสำหรับจัดเก็บไฟล์แนบ (ใบเสร็จ, รูปภาพ, PDF):

| โหมด | เหมาะกับ | ข้อดี |
|---|---|---|
| **Manus Built-in** | ใช้งานบน Manus Cloud | ไม่ต้องตั้งค่า พร้อมใช้ทันที |
| **Local Disk** | Deploy on-premise บน server ตัวเอง | ไม่พึ่ง cloud ใดๆ ควบคุมข้อมูล 100% |
| **Custom S3 / NAS** | มี MinIO, Synology NAS, AWS S3 อยู่แล้ว | ใช้ infrastructure เดิม |

### วิธีเปิดใช้ Local Disk Storage

1. เข้าสู่ระบบด้วย account ที่มีสิทธิ์ Admin
2. ไปที่เมนู **Admin → ตั้งค่า Storage**
3. เลือก **Local Disk**
4. ระบุ path โฟลเดอร์ที่ต้องการ (ค่าเริ่มต้น: `/app/uploads`)
5. กด **บันทึกการตั้งค่า**

> **สำคัญ:** path ที่ระบุใน Admin Settings ต้องตรงกับ volume mount ใน `docker-compose.yml`

### ตัวอย่าง Volume Mount

**แบบ Named Volume** (ข้อมูลอยู่ใน Docker managed volume):
```yaml
services:
  app:
    volumes:
      - app_uploads:/app/uploads   # path ต้องตรงกับที่ตั้งใน Admin Settings

volumes:
  app_uploads:
```

**แบบ Bind Mount** (เห็นไฟล์บน host โดยตรง):
```yaml
services:
  app:
    volumes:
      - ./uploads:/app/uploads   # ./uploads คือโฟลเดอร์บน host
```

### Backup ไฟล์แนบ (Local Disk)

```bash
# Backup ไฟล์แนบทั้งหมด (named volume)
docker compose exec app tar czf /tmp/uploads_backup.tar.gz /app/uploads
docker compose cp app:/tmp/uploads_backup.tar.gz ./uploads_backup_$(date +%Y%m%d).tar.gz

# หรือ backup โดยตรงจาก bind mount
tar czf uploads_backup_$(date +%Y%m%d).tar.gz ./uploads/
```

แนะนำให้ตั้ง cron job backup ไฟล์แนบควบคู่กับ backup ฐานข้อมูลทุกวัน
