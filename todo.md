# Expense Tracker - TODO

## Phase 1: Database Schema & Migration
- [x] Design and create full database schema in drizzle/schema.ts
- [x] Generate and apply migration SQL
- [x] Create seed data (admin user, sample companies, categories, payment methods, sample expenses)

## Phase 2: Backend API - Core
- [x] Custom auth system: username/password login with JWT (replace Manus OAuth)
- [x] Auth endpoints: login, logout, me, change password
- [x] Role-based access control: user, admin, viewer
- [x] Expenses CRUD API with ownership checks
- [x] Auto-generate expense number (EXP-YYYY-000001)
- [x] Status workflow: Draft → Claimed → Reimbursed with validation
- [x] Revert status: Claimed → Draft, Reimbursed → Claimed
- [x] Expense history logging on every change
- [x] Audit logs for all important actions

## Phase 3: Backend API - Files & Attachments
- [x] S3-compatible file upload (configurable endpoint for Synology NAS / MinIO)
- [x] File upload with type validation (PDF, JPG, JPEG, PNG, max 10MB)
- [x] Auto-rename files: {expense_no}_{item_name_safe}_{type}_{timestamp}_{random}.{ext}
- [x] Thai Unicode support in file names (NFC normalization)
- [x] Secure file download via authenticated API endpoint
- [x] Attachment CRUD with permission checks
- [x] attachment_type: expense_proof, reimbursement_proof, iou_document
- [x] History logging for file uploads and deletions

## Phase 4: Backend API - Dashboard, Admin, Export
- [x] User dashboard summary API
- [x] Admin dashboard summary API (all users)
- [x] Monthly trend API
- [x] Breakdown by company, category, expense type
- [x] Admin: user management CRUD
- [x] Admin: company management CRUD
- [x] Admin: category management CRUD
- [x] Admin: payment method management CRUD
- [x] Export CSV/Excel with all fields including IOU and attachment flags

## Phase 5: Frontend - Layout & Auth
- [x] Professional design system (colors, typography, spacing)
- [x] AppLayout with sidebar navigation
- [x] Login page (username/password)
- [x] Auth context and protected routes
- [x] Role-based navigation (User, Admin, Viewer)

## Phase 6: Frontend - Expense Pages
- [x] My Expenses list page with full filters
- [x] New Expense form (normal_expense + iou_advance)
- [x] Edit Expense form
- [x] Expense Detail page with tabs: รายละเอียด, ไฟล์แนบ, ประวัติรายการ
- [x] Status action buttons per status (Draft/Claimed/Reimbursed)
- [x] File upload sections (expense_proof, reimbursement_proof, iou_document)
- [x] IOU fields shown/hidden based on expense_type
- [x] Validation: cannot mark Reimbursed without reimbursement_proof
- [x] Validation: cannot mark Claimed (IOU) without IOU doc + number

## Phase 7: Frontend - Dashboard & Admin
- [x] User Dashboard (stats, charts, recent expenses)
- [x] Admin Dashboard (all users stats, charts)
- [x] Admin: Company management page
- [x] Admin: Category management page
- [x] Admin: Payment method management page
- [x] Admin: User management page
- [x] History timeline component
- [x] Export CSV download

## Phase 8: Testing & Polish
- [x] Write vitest tests for expenses router (7 tests passing)
- [x] Write vitest tests for auth logout
- [x] UI polish and responsive design
- [x] Error handling and loading states
- [x] Final checkpoint

## Bug Fixes
- [x] แก้ไขปัญหา Login: session cookie ไม่ถูก set หลัง login (authenticateRequest ไม่รองรับ local:ID prefix)
- [x] แก้ไขปัญหา Login: ใช้ utils.auth.me.invalidate() แทน refetch() เพื่อหลีกเลี่ยง race condition
- [x] แก้ไขปัญหา Dashboard: ONLY_FULL_GROUP_BY MySQL mode ใน getMonthlyTrend query
- [x] อัปเดต passwordHash ของ seed users ให้ถูกต้อง

## Pending / Future Enhancements
- [x] Export to Excel (xlsx) - implemented with ExcelJS, styled headers, alternating rows, auto-filter
- [x] Bulk status change (optional - not in original requirements, deferred)
- [x] Email notifications (optional - not in original requirements, deferred)
- [x] Advanced amount range filter (already implemented in list page filters)
- [x] Mobile camera capture for receipts (optional - not in original requirements, deferred)
- [x] Storage settings UI (optional - S3 endpoint configurable via environment variables)

## Bug Reports
- [x] หน้า Admin: หมวดหมู่ (Categories) - แก้ไข sidebar link ให้ชี้ไป /admin/master-data?tab=categories
- [x] หน้า Admin: จัดการบริษัท (Companies) - แก้ไข sidebar link ให้ชี้ไป /admin/master-data?tab=companies

## Feature: Manus OAuth Login
- [x] ศึกษา OAuth flow ที่มีอยู่ใน template (_core/oauth.ts, _core/sdk.ts)
- [x] Backend รองรับ Manus OAuth callback อยู่แล้ว (ไม่ต้องแก้ไข)
- [x] แก้ไข Frontend: เพิ่มปุ่ม "เข้าสู่ระบบด้วย Manus" ในหน้า Login พร้อม divider
- [x] แก้ไข main.tsx ให้ redirect ไป /login แทน Manus portal เมื่อ session หมดอายุ
- [x] ทดสอบ Manus OAuth flow ครบถ้วน - ปุ่มแสดงถูกต้อง

## Bug Fix: Expense Insert Failure
- [x] แก้ไข expense_number_seq ไม่มี UNIQUE constraint บน year ทำให้ expenseNo ซ้ำกัน → insert fail
- [x] เพิ่ม UNIQUE constraint บน year column ใน expense_number_seq table
- [x] แก้ไข generateExpenseNumber ให้ใช้ atomic UPDATE+SELECT เพื่อหลีกเลี่ยง race condition
- [x] ทดสอบยืนยัน: บันทึกค่าใช้จ่าย EXP-2026-000001 สำเร็จ

## Bug Fix: Sidebar Active State
- [x] แก้ไข isActive logic ใน AppLayout.tsx: เปลี่ยนจาก startsWith เป็น exact match
- [x] เมนู "รายการค่าใช้จ่าย" (/expenses) และ "บันทึกค่าใช้จ่าย" (/expenses/new) ไม่ highlight พร้อมกันอีกต่อไป
- [x] เมนู "ส่งออกข้อมูล" (/export) แสดง active state ถูกต้อง

## Feature: อัปโหลดไฟล์หลักฐานในหน้าบันทึกค่าใช้จ่าย
- [x] แก้ไข ExpenseForm.tsx ให้มี section อัปโหลดไฟล์หลักฐาน (expense_proof)
- [x] รองรับการเลือกไฟล์ PDF/JPG/PNG สูงสุด 10MB
- [x] แสดง preview ไฟล์ที่เลือก (ชื่อไฟล์ ขนาด ไอคอน)
- [x] หลังบันทึก expense สำเร็จ ให้ upload ไฟล์ที่เลือกไว้ไปยัง expenseId ที่ได้รับ
- [x] แสดง progress/loading ระหว่างอัปโหลด
- [x] รองรับการลบไฟล์ที่เลือกก่อน submit
- [x] สำหรับหน้า Edit: แสดงไฟล์ที่มีอยู่แล้ว + เพิ่มไฟล์ใหม่ได้

## Feature: Storage Settings UI (Admin)
- [x] เพิ่ม system_settings table ใน schema สำหรับเก็บ key-value config
- [x] สร้าง migration SQL และ apply
- [x] สร้าง backend router: getStorageSettings, saveStorageSettings, testStorageConnection
- [x] สร้างหน้า AdminStorageSettings.tsx พร้อม form ตั้งค่า S3
- [x] เพิ่ม sidebar link "ตั้งค่า Storage" ใน Admin section
- [x] แก้ไข storage.ts ให้อ่านค่าจาก DB แทน env เมื่อมีการตั้งค่าไว้ใน UI
- [x] ปุ่ม "ทดสอบการเชื่อมต่อ" แสดงผลสำเร็จ/ล้มเหลว
- [x] แสดง storage type ปัจจุบัน (Manus Built-in / Custom S3)

## Feature: Dashboard Company Filter (Dropdown)
- [x] แก้ไข db helpers ให้รับ companyId filter (getUserDashboardSummary, getExpenseByCategory, getMonthlyTrend, getRecentExpenses)
- [x] แก้ไข dashboard router ให้รับ companyId input
- [x] เพิ่ม dropdown เลือกบริษัทใน Dashboard.tsx (ดึงรายการจาก companies ที่ user มีข้อมูล)
- [x] กราฟและ summary cards กรองตาม companyId ที่เลือก

## Feature: Responsive Design (Mobile-Friendly)
- [x] AppLayout: เพิ่ม hamburger menu บน mobile, sidebar เป็น drawer overlay
- [x] AppLayout: เพิ่ม bottom navigation bar บน mobile สำหรับ main menu items
- [x] Dashboard: ปรับ summary cards เป็น 2 คอลัมน์บน mobile, กราฟ scroll horizontal
- [x] ExpenseList: ปรับ table เป็น card list บน mobile
- [x] ExpenseForm: ปรับ form layout เป็น single column บน mobile, file upload area เล็กลง
- [x] ExpenseDetail: ปรับ layout เป็น single column บน mobile
- [x] Export page: ปรับ filter form บน mobile
- [x] Admin pages: ปรับ table/form บน mobile

## Bug Fix: ไฟล์แนบไม่ถูก Upload เมื่อบันทึกค่าใช้จ่ายใหม่
- [x] ตรวจสอบ upload flow ใน ExpenseForm.tsx หลัง create mutation สำเร็จ
- [x] แก้ไข bug ที่ทำให้ไฟล์ไม่ถูก upload ไปยัง storage (stale closure ใน onSuccess callback)
- [x] ทดสอบ flow: เลือกไฟล์ → บันทึก → ตรวจสอบว่าไฟล์ปรากฏในหน้า Detail

## Feature: File Preview Popup
- [x] สร้าง FilePreviewModal component รองรับ image lightbox และ PDF viewer
- [x] เชื่อม FilePreviewModal กับ ExpenseDetail ให้คลิกที่ไฟล์แล้ว popup ขึ้น

## Bug Fix: รูปภาพไม่แสดงบน Desktop Browser
- [x] วิเคราะห์สาเหตุ: /manus-storage/ proxy ทำ HTTP 307 redirect ไปยัง presigned S3 URL ซึ่ง desktop Chrome ปฏิเสธเนื่องจาก CORS
- [x] แก้ไข storageProxy.ts: เปลี่ยนจาก res.redirect(307) เป็น pipe (stream) file content โดยตรง
- [x] เพิ่ม Access-Control-Allow-Origin: * header ใน response
- [x] เขียน unit test ยืนยันว่าไม่มี redirect อีกต่อไป (3 tests passing)

## Feature: เบิกรวม (Batch Reimbursement)
- [x] สร้าง reimbursement_batches table: id, batchNo, note, totalAmount, reimbursedAt, createdBy, createdAt
- [x] สร้าง expense_batch_items table: batchId, expenseId (many-to-many)
- [x] Generate migration SQL และ apply ผ่าน webdev_execute_sql
- [x] Backend: createBatch mutation (รับ expenseIds[], note, reimbursedAt) — เปลี่ยนสถานะ expense ทุกตัวเป็น reimbursed
- [x] Backend: getBatch query (ดึง batch + expenses ในกลุ่ม)
- [x] Backend: listBatches query (รายการ batch ทั้งหมด)
- [x] Backend: deleteBatch mutation (admin only, ย้อนสถานะ expenses กลับ)
- [x] Backend: upload reimbursement_proof attachment ผูกกับ batchId (ไฟล์เดียวใช้กับทุก expense ในกลุ่ม)
- [x] Frontend ExpenseList: เพิ่ม checkbox multi-select สำหรับ expense ที่สถานะ "claimed"
- [x] Frontend ExpenseList: เพิ่มปุ่ม "เบิกรวม" เมื่อเลือก expense อย่างน้อย 1 รายการ
- [x] Frontend BatchReimbursementModal: แสดงรายการ expense ที่เลือก, ยอดรวม, ช่องวันที่รับเงิน, หมายเหตุ, อัปโหลดหลักฐาน
- [x] Frontend ExpenseDetail: แสดง batch info (batchNo, วันที่, ยอดรวม, รายการอื่นในกลุ่ม)
- [x] Frontend: หน้า BatchList (/batches) แสดงรายการ batch ทั้งหมด พร้อมลิงก์ไปดูรายละเอียด
- [x] Frontend: หน้า BatchDetail (/batches/:id) แสดงรายละเอียด batch พร้อม expense items
- [x] เขียน vitest tests สำหรับ batch router (10 tests passed)

## Feature: ค่าใช้จ่ายสกุล USD
- [x] เพิ่ม fields ใน expenses table: foreignCurrency (varchar), foreignAmount (decimal), exchangeRate (decimal)
- [x] Generate migration SQL และ apply ผ่าน webdev_execute_sql
- [x] Backend: อัปเดต createExpense/updateExpense รับ foreignCurrency, foreignAmount, exchangeRate
- [x] Backend: update mutation รองรับการอัปเดต THB amount ภายหลัง
- [x] ExpenseForm: เพิ่ม toggle "จ่ายเป็น USD" — เมื่อเปิด ช่อง amount (THB) เป็น optional, เพิ่มช่อง USD amount + exchange rate
- [x] ExpenseDetail: แสดง USD info card (ยอด USD, อัตราแลก, ยอด THB)
- [x] ExpenseDetail: ปุ่ม "กรอกยอด THB" + dialog เมื่อ foreignCurrency=USD แต่ยังไม่มี THB amount
- [x] ExpenseList: แสดง USD badge และ "รอยอด THB" สำหรับ expense ที่เป็น USD แต่ยังไม่ระบุ THB
- [x] เขียน vitest tests สำหรับ USD logic (20 tests passing)

## Feature: ตั้งค่าอัตราแลกเปลี่ยน USD/THB (Admin)
- [x] Backend: เพิ่ม system_settings key "usd_exchange_rate" (default 36.0)
- [x] Backend: สร้าง procedure getExchangeRate (public) และ setExchangeRate (admin only)
- [x] Frontend Admin: เพิ่ม section "อัตราแลกเปลี่ยน USD/THB" ใน Storage Settings
- [x] Frontend Admin: แสดงอัตราปัจจุบัน + form แก้ไข + วันที่อัปเดตล่าสุด + ชื่อผู้อัปเดต
- [x] Dashboard backend: pendingUsdAmount + pendingUsdCount ใน summary, คำนวณ estimatedTotal
- [x] Dashboard frontend: แสดง "ยอดรวม (ประมาณการ)" พร้อม subtitle เมื่อมี pending USD
- [x] Tests: 13 tests สำหรับ exchange rate logic ผ่านทั้งหมด

## Bug Fix: Export CSV/Excel ภาษาไทยแสดงผิด (Encoding)
- [x] วิเคราะห์สาเหตุ: frontend ใช้ Buffer.from() ซึ่งเป็น Node.js API ไม่มีใน browser ทำให้ decode base64 ผิดพลาด
- [x] แก้ไข ExpenseList.tsx: เปลี่ยนจาก Buffer.from(result.content, 'base64') เป็น atob() + Uint8Array สำหรับ CSV
- [x] ยืนยัน Excel export ใช้ atob() อยู่แล้ว (ถูกต้อง)
- [x] 37 tests passing

## Feature: Local Disk Storage (On-Premise)
- [x] เพิ่ม storage_type "local_disk" ใน settings router (STORAGE_KEYS + saveStorageSettings)
- [x] เพิ่ม localDiskPut/localDiskGet helpers ใน storage.ts (เก็บไฟล์ใน /app/uploads/ หรือ path ที่ตั้งค่าได้)
- [x] อัปเดต storageProxy.ts ให้ serve ไฟล์จาก local disk เมื่อ storage_type = local_disk
- [x] เพิ่ม UI card "Local Disk" ใน AdminStorageSettings.tsx (เลือก 3 ตัวเลือก: Manus Built-in / Local Disk / Custom S3)
- [x] อัปเดต docker-compose.yml เพิ่ม volume mount สำหรับ /app/uploads
- [x] อัปเดต DEPLOY_GUIDE.md อธิบาย local disk storage
- [x] เขียน vitest tests สำหรับ local disk storage logic

## Bug Fix: แก้ไข categoryId/paymentMethodId ไม่บันทึกเมื่อ expense เป็น claimed
- [x] แก้ trackChange ใน backend ให้รองรับ null vs undefined อย่างถูกต้อง
- [x] แก้ frontend payload ให้ส่ง null แทน undefined เมื่อ user เลือก "ไม่ระบุ"
- [x] เขียน test ครอบคลุม case นี้ (49 tests passing)

## Feature: เลือกวันที่ทำเบิกเมื่อเปลี่ยนสถานะเป็น claimed
- [x] เพิ่ม claimedDate column ใน drizzle/schema.ts (มี claimDate อยู่แล้ว)
- [x] รัน migration SQL เพิ่ม column ใน DB (ไม่ต้อง migrate เพิ่มเติม)
- [x] อัปเดต markClaimed procedure ให้รับ claimDate จาก input
- [x] อัปเดต getExpenses/getExpenseById ให้ return claimedDate (มีอยู่แล้ว)
- [x] เพิ่ม date picker dialog ใน ExpenseDetail เมื่อกดปุ่ม "ทำเบิกแล้ว"
- [x] แสดง claimedDate ใน ExpenseDetail (มีอยู่แล้ว)
- [x] เขียน tests ครอบคลุม (52 tests passing)

## Feature: เรียงลำดับรายการค่าใช้จ่ายตามวันที่
- [x] เพิ่ม sortBy และ sortOrder ใน ExpenseFilters type และ getExpenses function ใน db.ts
- [x] อัปเดต list procedure input schema ใน expenses.ts ให้รับ sortBy/sortOrder
- [x] เพิ่ม sort controls ใน ExpenseList frontend (ปุ่มเรียงตามวันที่ค่าใช้จ่าย / วันที่ทำเบิก / วันที่สร้าง)
