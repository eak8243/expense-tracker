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
- [ ] Export to Excel (xlsx) - currently CSV only
- [ ] Bulk status change
- [ ] Email notifications
- [ ] Advanced amount range filter
- [ ] Mobile camera capture for receipts
- [ ] Storage settings UI (configure NAS endpoint from UI)
