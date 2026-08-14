# คู่มือสร้าง LIFF Mobile Form สำหรับบันทึกค่าใช้จ่าย

คู่มือนี้อธิบายการสร้าง **LIFF mobile form** เพื่อให้พนักงานเปิดฟอร์ม “บันทึกค่าใช้จ่าย” จาก LINE แล้วสร้างรายการใน Expense Tracker เป็นสถานะ **ร่าง** เท่านั้น LINE กำหนดให้ LIFF app อยู่ภายใต้ **LINE Login channel** และเปิดผ่าน endpoint URL ที่เป็น HTTPS [1]

> **ขอบเขตระยะแรก:** LIFF form จะสร้าง expense แบบ `draft` พร้อมไฟล์แนบ ผู้ใช้ต้องตรวจสอบ/แก้ไขใน Expense Tracker ก่อนเปลี่ยนสถานะเป็น “ทำเบิกแล้ว” เสมอ

## ภาพรวมการทำงาน

```text
ผู้ใช้กดเมนู “เพิ่มค่าใช้จ่าย” ใน LINE OA
             ↓
LIFF URL → https://expense.permsub.xyz/liff/expense/new
             ↓
LIFF SDK ยืนยันตัวตน LINE และส่ง ID token ให้ server
             ↓
Server ตรวจ token → เชื่อมกับบัญชี Expense Tracker
             ↓
กรอกฟอร์ม + แนบใบเสร็จ → สร้าง expense สถานะ draft
```

LIFF สามารถเปิดได้ทั้งภายใน LINE และ browser ภายนอก โดย `liff.init()` ต้องรันบน endpoint URL หรือ path ที่อยู่ใต้ endpoint นั้น เพื่อให้การทำงานของ SDK อยู่ในขอบเขตที่รองรับ [2]

## 1. สร้าง Provider และ LINE Login Channel

แม้จะยังไม่สร้าง LINE OA ในตอนนี้ ก็สร้าง LIFF ได้โดยใช้ **LINE Login channel** ก่อน เมื่อสร้าง OA/Messaging API ในภายหลัง ให้เลือก **Provider เดียวกัน** เพื่อให้การจัดการ channel อยู่ภายใต้องค์กรเดียวกัน และหลีกเลี่ยงปัญหา identifier ผู้ใช้แยกตาม Provider [3]

1. เปิด [LINE Developers Console](https://developers.line.biz/console/) และ login ด้วยบัญชีผู้ดูแลขององค์กร
2. สร้าง Provider ใหม่ เช่น `Permsub Expense Tracker` หากยังไม่มี Provider ขององค์กร
3. สร้าง **LINE Login channel** ภายใต้ Provider นี้ ตามข้อมูลนิติบุคคล/บริการที่ LINE ขอ
4. บันทึกชื่อ Provider และ Channel ID ไว้กับเอกสารโครงการ แต่ห้ามส่ง client secret ผ่านแชต

## 2. เพิ่ม LIFF app

ใน LINE Developers Console ให้เลือก LINE Login channel ที่สร้างไว้ แล้วเปิดแท็บ **LIFF** → **Add** จากนั้นกรอกค่าตามตารางนี้

| ช่องตั้งค่า | ค่าที่แนะนำสำหรับ Expense Tracker |
|---|---|
| LIFF app name | `บันทึกค่าใช้จ่าย` |
| Size | `Full` เพื่อรองรับฟอร์มและแนบไฟล์ |
| Endpoint URL | `https://expense.permsub.xyz/liff/expense/new` |
| Scopes | `openid` และ `profile` |
| `email` scope | ไม่จำเป็นสำหรับระยะแรก |
| Add friend option | `Off` ก่อน เพราะยังไม่มี LINE OA |
| Scan QR | `Off` เว้นแต่ต้องการสแกน QR ในอนาคต |
| Module mode | `Off` สำหรับระยะแรก |

Endpoint URL ต้องเป็น HTTPS และห้ามมี URL fragment (`#`) เมื่อกด **Add** ระบบจะสร้าง **LIFF ID** และ LIFF URL รูปแบบ `https://liff.line.me/<LIFF_ID>` [1]

LINE แนะนำให้สร้าง LIFF app ใหม่เป็น LINE MINI App เนื่องจากสองผลิตภัณฑ์กำลังรวมแบรนด์กัน อย่างไรก็ตาม สำหรับการใช้งานภายในที่ต้องการเปิดฟอร์มเร็ว สามารถเริ่มด้วย LIFF app ภายใต้ LINE Login channel ตามขั้นตอนนี้ก่อน แล้วประเมินการย้ายเป็น LINE MINI App ในระยะถัดไป [1]

## 3. ฟอร์มที่ระบบจะพัฒนา

หน้า `/liff/expense/new` จะเป็น mobile-first form ใช้ข้อมูล master เดิมของ Expense Tracker และแสดงวันที่รูปแบบภาษาไทย

| ส่วนข้อมูล | ฟิลด์ | พฤติกรรม |
|---|---|---|
| ผู้บันทึก | ชื่อผู้ใช้/บริษัท | กรอกจากบัญชี Expense Tracker ที่เชื่อมสำเร็จ |
| รายการ | ชื่อรายการ, ร้านค้า/ผู้รับเงิน | บังคับชื่อรายการ; ร้านค้าสามารถแนะนำจากประวัติได้ |
| จำนวนเงิน | ยอดเงิน, สกุลเงิน, ยอด THB | ตรวจรูปแบบตัวเลขและไม่อนุญาตยอดติดลบ |
| วันที่ | วันที่ค่าใช้จ่าย | ใช้วัน/เดือน/ปี พ.ศ. เช่น `15/08/2569` |
| จัดหมวด | หมวดหมู่, วิธีชำระ | ดึงเฉพาะรายการที่ผู้ใช้มีสิทธิ์เลือก |
| หลักฐาน | รูปหรือไฟล์ใบเสร็จ | ตรวจชนิด/ขนาดไฟล์ก่อนเก็บลง storage |
| ผลลัพธ์ | expense draft | แสดงเลขอ้างอิงและปุ่มเปิดหน้า detail |

## 4. ขั้นตอนเชื่อมบัญชี LINE กับ Expense Tracker

อย่าเชื่อมบัญชีจาก display name ของ LINE เพราะไม่ใช่ identifier ที่เชื่อถือได้ Flow ที่ถูกต้องมีดังนี้:

1. LIFF app เรียก `liff.init({ liffId, withLoginOnExternalBrowser: true })`
2. ถ้าเปิดภายนอก LINE และยังไม่ login ให้เรียก `liff.login()`
3. ส่ง **ID token หรือ access token** ไปยัง server ผ่าน HTTPS
4. Server ตรวจ token กับ LINE แล้วดึง LINE user ID จากผลการตรวจสอบ
5. ถ้ายังไม่มีการเชื่อมบัญชี ให้แสดงหน้า login ของ Expense Tracker หรือรหัสเชื่อมบัญชีแบบใช้ครั้งเดียว
6. หลังผู้ใช้ยืนยันตัวตนใน Expense Tracker สำเร็จ จึงบันทึกความสัมพันธ์ `lineUserId ↔ userId`
7. ทุกครั้งหลังจากนั้น LIFF form จะรู้ user เดิมและอนุญาตให้สร้าง draft ได้

LINE ระบุว่า server ต้องใช้ ID token หรือ access token เพื่อตรวจสอบและดึงข้อมูลผู้ใช้จาก LINE โดยตรง ไม่ควรส่งข้อมูลจาก `liff.getProfile()` หรือ `liff.getDecodedIDToken()` ไปให้ server เป็นหลักฐานตัวตน [4]

## 5. ตัวอย่างโครงสร้าง client และ server ที่จะพัฒนา

```ts
// ฝั่ง LIFF browser: เริ่ม SDK แล้วส่ง token เท่านั้น
await liff.init({ liffId: import.meta.env.VITE_LINE_LIFF_ID, withLoginOnExternalBrowser: true });
if (!liff.isLoggedIn()) liff.login();

const idToken = liff.getIDToken();
await trpc.line.verifyLiffIdentity.mutate({ idToken });
```

```text
LIFF browser
  → verifyLiffIdentity(idToken)
  → LINE token verification
  → line_user_links lookup
  → Expense Tracker session / one-time link flow
  → expenses.create(... status: draft)
```

`VITE_LINE_LIFF_ID` เป็น public identifier ที่ client ต้องใช้เพื่อ initialize LIFF SDK แต่ค่า credential อื่น เช่น LINE Login client secret หรือ Messaging API token ต้องเก็บ server-side ใน secrets เท่านั้น

## 6. การตั้งค่า LINE OA ภายหลัง

หลัง LIFF form พร้อมใช้งาน จึงสร้าง LINE OA และ Messaging API channel ภายใต้ **Provider เดียวกัน** แล้วทำตามลำดับนี้:

1. ตั้ง Rich Menu ปุ่ม “เพิ่มค่าใช้จ่าย” ให้เปิด `https://liff.line.me/<LIFF_ID>`
2. เปิด webhook เมื่อพร้อมรับข้อความ/แจ้งเตือนเท่านั้น
3. เพิ่ม Channel secret และ Channel access token ผ่านการจัดการ secrets ที่ปลอดภัย
4. ทดสอบจากบัญชี LINE ทดสอบก่อนเผยแพร่ให้พนักงานใช้จริง

การเปิด LIFF form ไม่จำเป็นต้องรอ Messaging API token แต่การเปิดจาก Rich Menu ของ OA และการส่งการแจ้งเตือนกลับไปที่ LINE จะต้องตั้งค่า OA ในภายหลัง

## 7. สิ่งที่ต้องแจ้งกลับเพื่อเริ่มพัฒนา

เมื่อทำตามข้อ 1–2 แล้ว กรุณาแจ้งว่า **สร้าง LINE Login channel และ LIFF app แล้ว** จากนั้นระบุ LIFF ID (เป็น public ID) หรือแจ้งให้เปิดช่องตั้งค่า environment สำหรับ `VITE_LINE_LIFF_ID` ระบบจะจึงเริ่มพัฒนาหน้า `/liff/expense/new`, schema การเชื่อมบัญชี และ token verification ได้

## References

[1]: https://developers.line.biz/en/docs/liff/registering-liff-apps/ "LINE Developers: Adding a LIFF app to your channel"
[2]: https://developers.line.biz/en/reference/liff/ "LINE Developers: LIFF API reference"
[3]: https://developers.line.biz/en/docs/messaging-api/getting-started/ "LINE Developers: Get started with the Messaging API"
[4]: https://developers.line.biz/en/docs/liff/using-user-profile/ "LINE Developers: Using user data in LIFF apps and servers"
