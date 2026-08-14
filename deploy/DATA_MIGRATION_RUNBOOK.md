# Runbook: ย้ายข้อมูล Expense Tracker ไป Ubuntu Server

เอกสารนี้เป็นแผนการย้ายข้อมูลแบบ **copy → validate → cut over → retain rollback** เพื่อย้ายระบบจาก Manus ไป Ubuntu server โดยไม่ลดทอนข้อมูลธุรกิจ ไฟล์แนบ หรือประวัติการตรวจสอบย้อนหลัง เป้าหมายคือทำให้ server ใหม่มีข้อมูลตรงกับระบบเดิม ณ เวลาปิดรับการแก้ไขครั้งสุดท้าย แล้วจึงเปลี่ยน DNS ไปยัง server ใหม่

> **ข้อควรระวังเรื่องข้อมูล Manus:** หากบัญชีได้รับผลกระทบจากการเปลี่ยนแปลงบริการเดือนสิงหาคม 2026 หรือไม่แน่ใจ ให้ตรวจสอบ in-app notice และอีเมล แล้วสร้าง **Task Data Backup** ที่ [manus.im/backup](https://manus.im/backup) ก่อนวันที่ 23 สิงหาคม 2026 เวลา 07:59 น. SGT เพราะ backup ชนิดนี้ครอบคลุม code, database, uploaded files, secrets และ integration settings แต่การดาวน์โหลด source code เพียงอย่างเดียวไม่ครอบคลุมข้อมูลเหล่านี้ [1] [2]

## 1. Inventory ที่ตรวจสอบแล้ว

ข้อมูลปัจจุบันมีขนาดเหมาะกับการย้ายแบบ full snapshot แต่ทุกตารางต้องรักษา primary key เดิมเพื่อให้ความสัมพันธ์ระหว่าง expense, attachment, history และ batch ยังถูกต้อง

| กลุ่มข้อมูล | จำนวนปัจจุบัน | วิธีจัดการระหว่างย้าย |
|---|---:|---|
| ผู้ใช้ | 7 | Export พร้อม `id`, role, password hash และสถานะใช้งาน |
| บริษัท | 2 | Import ก่อน expense |
| หมวดหมู่ / วิธีชำระ | 7 / 11 | Import ก่อน expense |
| ค่าใช้จ่าย | 43 | รักษา `id`, `expenseNo`, วันที่ และสถานะเดิม |
| ไฟล์แนบ | 52 ไฟล์, 14.65 MiB | ดาวน์โหลดไฟล์จริงพร้อม metadata และตรวจ hash |
| ประวัติค่าใช้จ่าย | 226 | Import หลัง expense และ attachments |
| กลุ่มเบิกรวม / รายการในกลุ่ม | 1 / 3 | Import หลัง expense |
| Audit logs | 0 | ตรวจผลอีกครั้งก่อน final export |
| System settings | 3 | ย้ายเฉพาะ setting ธุรกิจ ไม่ย้าย credential ของ Manus |

## 2. หลักการย้ายข้อมูล

การย้ายควรใช้ **สองรอบ** เพื่อจำกัด downtime: รอบแรกเป็น full snapshot ไปยัง staging server และรอบสุดท้ายเป็น final snapshot หลังประกาศช่วงหยุดแก้ไขข้อมูล ทั้งสองรอบต้องเก็บ manifest ที่มีจำนวนแถว, จำนวนไฟล์, ขนาดรวม และ SHA-256 ของ bundle เพื่อเปรียบเทียบก่อนอนุมัติ cutover

| ข้อมูล | ต้นทาง | ปลายทาง | กฎการแปลง |
|---|---|---|---|
| ตารางฐานข้อมูล | Manus database | MySQL 8 บน Ubuntu | รักษา primary/foreign keys และ timestamps |
| ไฟล์แนบ | Manus storage | `/app/uploads` หรือ Custom S3 | เก็บ `fileStorageKey`, สร้าง path/url ใหม่ให้เข้ากับ storage ปลายทาง |
| Password hashes | ตาราง `users` | ตาราง `users` | ย้าย hash เดิม ห้าม reset หรือ hash ซ้ำ |
| System settings | ตาราง `system_settings` | ตาราง `system_settings` | ไม่ย้าย Forge/OAuth/S3 secrets; กำหนด storage ปลายทางใหม่ |
| Domain | DNS ของโดเมนเดิม | Nginx บน Ubuntu | เปลี่ยน record หลัง validation เท่านั้น; ไม่ต้องโอนกรรมสิทธิ์โดเมน |

## 3. สิ่งที่ต้องเตรียมก่อนเริ่ม

การย้ายจริงต้องเตรียม server ใหม่ให้พร้อมก่อน export รอบแรก ได้แก่ Docker Compose หรือ Node.js + systemd, MySQL 8, Nginx, HTTPS certificate, `.env` ใหม่, พื้นที่ disk อย่างน้อยมากกว่าขนาด backup หลายเท่า และโหมด storage ปลายทาง หากใช้ Local Disk ต้องมี persistent volume ที่ `/app/uploads` หากใช้ S3/MinIO ต้องทดสอบ credentials และ bucket ก่อน

ต้องมี **migration/seed สำหรับฐานข้อมูลว่าง** ก่อน เพราะ repository ปัจจุบันไม่มี migration SQL ที่ commit อยู่ใน `drizzle/migrations/` และไม่มี seed admin สำหรับ fresh database ขั้นตอนนี้ต้องเสร็จก่อนรับ import data ไม่ควรสร้าง schema ด้วยการเดา column หรือกดสร้างผ่าน UI ด้วยมือ

## 4. เตรียมเครื่องมือ export/import แบบครั้งเดียว

แนะนำให้เพิ่ม **admin-only migration tool** ในระบบต้นทางและปลายทาง แทนการพยายามเข้าถึงฐานข้อมูล Manus จากภายนอก เครื่องมือต้องใช้งานโดย admin ที่ login อยู่, ไม่แสดงข้อมูลต่อผู้ใช้ทั่วไป, สร้างไฟล์ download ชั่วคราว และลบไฟล์ชั่วคราวเมื่อเสร็จงาน

### 4.1 รูปแบบ migration bundle

```text
expense-tracker-migration-YYYYMMDD-HHMMSS.zip
├── manifest.json
├── database/
│   ├── users.ndjson
│   ├── companies.ndjson
│   ├── expense_categories.ndjson
│   ├── payment_methods.ndjson
│   ├── expenses.ndjson
│   ├── expense_attachments.ndjson
│   ├── expense_history_logs.ndjson
│   ├── audit_logs.ndjson
│   ├── reimbursement_batches.ndjson
│   ├── expense_batch_items.ndjson
│   ├── expense_number_seq.ndjson
│   └── system_settings.ndjson
└── attachments/
    └── <fileStorageKey ของแต่ละไฟล์>
```

`manifest.json` ต้องบันทึก schema version, เวลา export (UTC), row count รายตาราง, byte count, SHA-256 รายไฟล์ และ checksum รวมของ bundle ไม่ต้องบันทึก secrets ใน manifest หรือ bundle

### 4.2 ลำดับ import ที่ปลอดภัย

ให้ import โดยรักษา ID เดิมและทำตามลำดับต่อไปนี้ เพื่อไม่ให้ foreign key ขาด:

1. `users`, `companies`, `expense_categories`, `payment_methods`
2. `expenses`, `expense_number_seq`
3. คัดลอกไฟล์จริงไป storage ปลายทาง แล้ว import `expense_attachments`
4. `expense_history_logs`, `audit_logs`, `system_settings` ที่ผ่านการกรอง
5. `reimbursement_batches`, `expense_batch_items`
6. ตั้ง storage เป็น `local_disk` หรือ `custom_s3` และทดสอบเปิดไฟล์อย่างน้อยหนึ่งไฟล์จากแต่ละประเภท

> ห้าม import credential ของ Manus Forge, OAuth, หรือ custom S3 เดิมโดยอัตโนมัติ ให้สร้าง secret ใหม่บน Ubuntu server และยืนยัน storage ปลายทางด้วย admin หลัง import

## 5. Runbook ปฏิบัติการ

| ลำดับ | ผู้รับผิดชอบ | งาน | เกณฑ์ผ่าน |
|---:|---|---|---|
| 1 | ผู้ดูแลระบบ | สร้าง Task Data Backup หาก account อยู่ในขอบเขต/ไม่แน่ใจ | เก็บไฟล์ backup ในที่ปลอดภัยและไม่เปลี่ยนชื่อ [1] |
| 2 | ผู้ดูแลระบบ | Deploy code ไป staging Ubuntu, สร้าง MySQL schema และ admin เริ่มต้น | เปิด staging domain และ login ได้ |
| 3 | ผู้ดูแลระบบ | สร้าง export bundle รอบแรกจากต้นทาง | Manifest มี row count และ file hash ครบ |
| 4 | ผู้ดูแลระบบ | Import bundle รอบแรกเข้า staging | ไม่มี FK/unique constraint error |
| 5 | ผู้ตรวจสอบ | เทียบ counts, เปิดไฟล์, ทดลอง login, export CSV/Excel และตรวจ batch | ทุกเกณฑ์ validation ผ่าน |
| 6 | ผู้ดูแลระบบ | แจ้ง maintenance window และหยุดสร้าง/แก้ไขข้อมูลบนต้นทาง | ไม่มี write ใหม่ระหว่าง final export |
| 7 | ผู้ดูแลระบบ | สร้าง final bundle และ import ทับ staging ตาม runbook | Counts/checksums ของ final bundle ตรง |
| 8 | ผู้ตรวจสอบ | Sign-off ผลตรวจสอบ | ยืนยันใช้งานระบบใหม่ได้ |
| 9 | ผู้ดูแลระบบ | เปลี่ยน DNS ไป server ใหม่ | HTTPS และ login ทำงานจาก domain จริง |
| 10 | ผู้ดูแลระบบ | เก็บระบบเดิมแบบ read-only สำหรับ rollback | มีทางย้อนกลับอย่างน้อย 7 วัน |

## 6. SQL ตรวจสอบหลัง import

คำสั่งนี้ใช้เทียบจำนวนแถวต้นทางและปลายทางหลัง import ได้ โดยค่า expected สำหรับ snapshot ปัจจุบันให้ดูใน Inventory ข้างต้น

```sql
SELECT 'users' AS table_name, COUNT(*) AS row_count FROM users
UNION ALL SELECT 'companies', COUNT(*) FROM companies
UNION ALL SELECT 'expense_categories', COUNT(*) FROM expense_categories
UNION ALL SELECT 'payment_methods', COUNT(*) FROM payment_methods
UNION ALL SELECT 'expenses', COUNT(*) FROM expenses
UNION ALL SELECT 'expense_attachments', COUNT(*) FROM expense_attachments
UNION ALL SELECT 'expense_history_logs', COUNT(*) FROM expense_history_logs
UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs
UNION ALL SELECT 'reimbursement_batches', COUNT(*) FROM reimbursement_batches
UNION ALL SELECT 'expense_batch_items', COUNT(*) FROM expense_batch_items;
```

ตรวจ integrity ของ relationship และ metadata ไฟล์แนบด้วย:

```sql
SELECT COUNT(*) AS attachments_without_expense
FROM expense_attachments a
LEFT JOIN expenses e ON e.id = a.expenseId
WHERE e.id IS NULL;

SELECT COUNT(*) AS history_without_expense
FROM expense_history_logs h
LEFT JOIN expenses e ON e.id = h.expenseId
WHERE e.id IS NULL;

SELECT COUNT(*) AS batch_items_without_expense
FROM expense_batch_items bi
LEFT JOIN expenses e ON e.id = bi.expenseId
WHERE e.id IS NULL;

SELECT COUNT(*) AS attachment_count,
       COALESCE(SUM(fileSize), 0) AS attachment_bytes
FROM expense_attachments;
```

ทั้งสาม query ตรวจ orphan ต้องคืนค่า `0` และจำนวน/ขนาดไฟล์ต้องเท่ากับ manifest final bundle นอกจากนี้ควรสุ่มเปิด PDF และรูปภาพจาก `expense_proof`, `reimbursement_proof`, และ `iou_document` อย่างน้อยประเภทละ 3 ไฟล์ และทดสอบการ download ผ่าน domain จริง

## 7. Cutover และ rollback

ลด DNS TTL ของโดเมนเหลือ 300 วินาทีล่วงหน้า 24 ชั่วโมง เฉพาะเมื่อพร้อมเปลี่ยนไป server ใหม่ จากนั้นประกาศ maintenance window สั้น ๆ, บังคับให้ต้นทางเป็น read-only, ทำ final export/import, ทดสอบหน้า login และไฟล์แนบ, แล้วเปลี่ยน A/AAAA/CNAME ไปยัง server ใหม่

หากเกิดปัญหา critical เช่น login ไม่ได้, เปิดไฟล์แนบไม่ได้, จำนวนข้อมูลไม่ตรง, หรือ export ผิดพลาด ให้คืน DNS ไปปลายทางเดิมทันทีและเปิดสิทธิ์เขียนบนต้นทางหลังยืนยันสาเหตุแล้ว ห้ามลบ deployment, database, storage หรือ backup ของระบบเดิมในช่วง rollback window

สำหรับช่วงการเปลี่ยนแปลงบริการของ Manus เอกสารทางการระบุว่าไม่มีเส้นทาง official สำหรับย้าย full service ออกไปแทนการ restore และแนะนำให้ทำ Task Data Backup โดยเร็วสำหรับผู้ที่อยู่ในขอบเขต [2] ดังนั้น Task Data Backup ควรเก็บไว้เป็นหลักฐานการกู้คืนแยกจาก export bundle ที่ใช้ย้ายไป Ubuntu

## 8. ข้อมูลที่ต้องยืนยันก่อนเริ่มปฏิบัติจริง

| ข้อมูลที่ต้องการ | เหตุผล |
|---|---|
| Ubuntu version, public IP และขนาด disk/RAM | ตรวจความพร้อมของ target server |
| Domain ที่ต้องการใช้ | เตรียม DNS, Nginx และ TLS certificate |
| เลือก Local Disk หรือ S3/MinIO | กำหนดที่เก็บไฟล์แนบและขั้นตอน copy |
| ช่วงเวลาที่หยุดแก้ไขข้อมูลได้ | วาง final export และ cutover |
| สถานะ in-app notice / email ของ Manus | ยืนยันความจำเป็นของ Task Data Backup [1] |
| วิธีเข้าถึง server แบบปลอดภัย | ใช้ SSH key ชั่วคราว; ไม่ส่ง password ใน chat |

## References

[1]: https://help.manus.im/en/articles/16147892-service-change-overview-how-to-back-up-your-data "Manus Help Center: How to Back Up Your Data"
[2]: https://help.manus.im/en/articles/16147831-service-change-overview-what-s-happening-and-am-i-affected "Manus Help Center: What’s Happening and Am I Affected?"
