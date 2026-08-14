# คู่มือย้าย Expense Tracker ไป Ubuntu Server

คู่มือนี้อธิบายการติดตั้งระบบบน Ubuntu server ของคุณเอง โดยใช้ **Docker Compose** ซึ่งเป็นเส้นทางที่เหมาะกับไฟล์ `Dockerfile`, `docker-compose.yml` และ `nginx.conf` ที่มีอยู่ในโครงการแล้ว ระบบจะประกอบด้วย MySQL, แอปพลิเคชัน และ Nginx reverse proxy ในชุดเดียว

> **ข้อสำคัญก่อนเริ่ม:** โครงการปัจจุบันยังไม่มีไฟล์ migration SQL ที่ commit ไว้ใน `drizzle/migrations/` และไม่มี script สร้างผู้ดูแลเริ่มต้นสำหรับฐานข้อมูลใหม่ ดังนั้นห้ามคาดหวังว่า `docker compose up` จะย้ายข้อมูลเดิมจาก Manus ไปให้โดยอัตโนมัติ หากต้องการเก็บข้อมูลเดิม ต้องจัดทำแผน export/import database และไฟล์แนบก่อนดำเนินการจริง

| ทางเลือก | เหมาะกับ | ข้อควรทราบ |
|---|---|---|
| **Docker Compose** | ต้องการติดตั้งและอัปเดตง่าย | แนะนำ เพราะ project มีไฟล์พร้อมใช้งาน |
| Node.js + systemd | ไม่ต้องการใช้ Docker | ต้องติดตั้ง/ดูแล MySQL, Node.js และ systemd เอง |
| Manus Hosting | ไม่ต้องดูแล server | เป็นตัวเลือกที่ใช้งานอยู่ในปัจจุบัน |

## 1. สิ่งที่ต้องเตรียม

ใช้ Ubuntu 22.04 หรือ 24.04 แบบ 64-bit, DNS record ของโดเมน (เช่น `expense.example.com`) ชี้มายัง public IP ของ server, และ SSH account ที่ใช้ `sudo` ได้ Docker ระบุว่า Ubuntu 22.04 และ 24.04 เป็นรุ่นที่รองรับ และแนะนำให้ติดตั้ง Engine/Compose จาก repository ทางการ [1] [2]

ควรเปิดเฉพาะ port `22`, `80` และ `443` จาก internet หลีกเลี่ยงการเปิด MySQL (`3306`) หรือ app (`3000`) ออกสู่สาธารณะโดยตรง

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl git ufw
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 2. ติดตั้ง Docker และ Docker Compose

ใช้ Docker repository ทางการแทน convenience script สำหรับ production [1]

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo docker run hello-world
sudo docker compose version
```

## 3. นำ source code ขึ้น server และตั้งค่า secrets

ส่ง source code ผ่าน private GitHub repository หรือ Download ZIP จากหน้า Code ของโครงการ แล้วสร้างไฟล์ `.env` บน server เท่านั้น ไฟล์นี้ต้องไม่ commit ขึ้น Git และไม่ควรส่งรหัสผ่านผ่าน chat

```bash
sudo mkdir -p /opt/expense-tracker
sudo chown "$USER":"$USER" /opt/expense-tracker
cd /opt/expense-tracker

# เลือกหนึ่งวิธี
git clone <PRIVATE_GIT_URL> .
# หรือแตกไฟล์ ZIP ที่ดาวน์โหลดมาไว้ในโฟลเดอร์นี้

cp deploy/env-template.txt .env
chmod 600 .env
nano .env
```

กำหนดค่าอย่างน้อยดังนี้ โดยใช้รหัสผ่านที่สุ่มและยาวพอ:

```dotenv
MYSQL_ROOT_PASSWORD=<random-root-password>
MYSQL_USER=expense_user
MYSQL_PASSWORD=<random-database-password>
JWT_SECRET=<ผลลัพธ์จาก openssl rand -base64 32>
VITE_APP_TITLE=Expense Tracker
```

สร้าง JWT secret ได้ด้วยคำสั่งนี้:

```bash
openssl rand -base64 32
```

ระบบมี login แบบ username/password อยู่แล้ว จึงใช้งานภายในได้โดยไม่ต้องพึ่ง Manus OAuth สำหรับการเข้าสู่ระบบ อย่างไรก็ตาม ต้องตั้ง Storage เป็น **Local Disk** หรือ **Custom S3** หลังติดตั้ง เพราะ Manus Built-in Storage ใช้ได้เฉพาะบน Manus platform

## 4. ปรับ compose สำหรับ production

ก่อน start ให้แก้ `docker-compose.yml` ตามหลักการนี้:

| Service | การเปิด port ที่แนะนำ |
|---|---|
| `db` | ลบบรรทัด `3306:3306` เพื่อไม่ให้ MySQL ออก internet |
| `app` | ลบบรรทัด `3000:3000` เมื่อใช้ Nginx container |
| `nginx` | คง `80:80` และ `443:443` |

เปลี่ยน `server_name _;` ใน `nginx.conf` เป็นโดเมนจริงของคุณ เช่น `expense.example.com` จากนั้น build และ start services:

```bash
cd /opt/expense-tracker
sudo docker compose up -d --build
sudo docker compose ps
sudo docker compose logs -f app
```

## 5. ฐานข้อมูลและข้อมูลเดิม

การสร้าง container MySQL ไม่ได้สร้าง schema และผู้ใช้ application ให้อัตโนมัติในโครงการเวอร์ชันนี้ เนื่องจากยังไม่มี migration SQL ที่บันทึกไว้ใน repository ดังนั้นให้เลือกระหว่างสองแนวทางก่อนเปิดใช้งานจริง:

| กรณี | งานที่ต้องทำ |
|---|---|
| เริ่มระบบใหม่ | จัดทำ migration SQL และ seed ผู้ดูแลเริ่มต้น แล้ว run บน MySQL container |
| ย้ายข้อมูลเดิมจาก Manus | Export schema/data และไฟล์แนบ, import เข้า MySQL ใหม่, ตรวจสอบจำนวน expense/attachment และเปลี่ยน Storage เป็น Local Disk หรือ S3 |

> แนะนำให้ทำการทดสอบบน subdomain หรือ server ทดสอบก่อน ห้ามยกเลิก instance เดิมจนกว่าจะตรวจสอบ login, ค่าใช้จ่าย, ไฟล์แนบ และ export ได้ครบถ้วน

## 6. ตั้งค่า HTTPS

หลัง DNS ชี้มาที่ server แล้ว ให้ขอ certificate ด้วย Let's Encrypt และเปิด server block HTTPS ใน `nginx.conf` ตามไฟล์ตัวอย่างของโครงการ จากนั้น mount certificate ให้ container Nginx และ restart service

```bash
sudo apt install -y certbot
sudo certbot certonly --standalone -d expense.example.com
sudo docker compose restart nginx
```

ก่อนสั่ง `certbot --standalone` ต้องหยุด service ที่จับ port 80 ชั่วคราว หรือใช้ Certbot webroot/reverse-proxy workflow ที่ตรงกับ Nginx ที่ใช้งานอยู่

## 7. การตั้งค่า Storage และ backup

เมื่อ login ด้วยผู้ดูแลแล้ว ให้ไปที่ **ผู้ดูแลระบบ → ตั้งค่า Storage** แล้วเลือก **Local Disk** ด้วย path `/app/uploads` ซึ่งสอดคล้องกับ Docker volume `app_uploads` ใน compose file หรือเลือก Custom S3/MinIO หากมีอยู่แล้ว

ควร backup ทั้ง MySQL และไฟล์แนบทุกวัน:

```bash
cd /opt/expense-tracker
sudo docker compose exec -T db \
  mysqldump -u expense_user -p expense_tracker > /opt/backups/expense_$(date +%F).sql

sudo docker compose exec app tar czf /tmp/uploads.tar.gz /app/uploads
sudo docker compose cp app:/tmp/uploads.tar.gz /opt/backups/uploads_$(date +%F).tar.gz
```

อย่าใช้ `docker compose down -v` บน production เพราะคำสั่งนี้ลบ persistent volumes รวมถึงฐานข้อมูลและไฟล์แนบ

## 8. ทางเลือกแบบไม่ใช้ Docker

หากไม่ต้องการ Docker สามารถติดตั้ง Node.js 22, pnpm, MySQL และ Nginx บน host โดยตรง จากนั้นใช้ `pnpm install --frozen-lockfile`, `pnpm build` และ `pnpm start` ผ่าน systemd service แต่ยังต้องจัดทำ schema migration, ผู้ดูแลเริ่มต้น, HTTPS และ backup เองทั้งหมด ดังนั้นสำหรับโครงการปัจจุบัน Docker Compose จะลดขั้นตอนดูแลบริการได้มากกว่า

## ขั้นตอนถัดไปสำหรับการย้ายจริง

สำหรับให้ช่วยดำเนินการ migration จริง กรุณาระบุว่า **ต้องย้ายข้อมูลเดิมทั้งหมดหรือเริ่มฐานข้อมูลใหม่**, Ubuntu version, domain ที่จะใช้ และวิธีเข้าถึง server ที่ปลอดภัย (เช่น SSH key แบบชั่วคราว) โดยไม่ส่ง password ผ่าน chat

## References

[1]: https://docs.docker.com/engine/install/ubuntu/ "Docker: Install Docker Engine on Ubuntu"
[2]: https://docs.docker.com/compose/install/linux/ "Docker: Install Docker Compose plugin on Linux"
