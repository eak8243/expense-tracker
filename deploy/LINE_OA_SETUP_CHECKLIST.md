# Checklist: สร้าง LINE OA และ Messaging API สำหรับ Expense Tracker

ก่อนเชื่อม LINE กับ Expense Tracker ต้องมี **LINE Official Account** และเปิดใช้ **Messaging API Channel** ก่อน LINE กำหนดขั้นตอนนี้เป็นลำดับการสร้าง channel สำหรับรับ webhook และส่งข้อความตอบกลับ [1]

## ขั้นตอนที่ 1: สร้าง LINE Official Account

1. เปิด [LINE Business ID](https://account.line.biz/signup?redirectUri=https://entry.line.biz/form/entry/unverified) และสมัครด้วยบัญชี LINE หรืออีเมลของผู้ดูแล
2. กรอกแบบฟอร์มสร้าง LINE Official Account ที่ [LINE Official Account entry form](https://entry.line.biz/form/entry/unverified) โดยใช้ชื่อ เช่น **Expense Tracker** และเลือกหมวดธุรกิจที่เหมาะสม
3. เข้า [LINE Official Account Manager](https://manager.line.biz/) เพื่อตรวจสอบว่า OA ถูกสร้างแล้ว

> ผู้ที่สร้าง OA และผู้ดูแลระบบควรใช้บัญชีองค์กร ไม่ควรผูกกับบัญชีส่วนตัวเพียงคนเดียว เพื่อให้ทีมเข้าถึงและโอนงานได้อย่างปลอดภัย

## ขั้นตอนที่ 2: เปิด Messaging API Channel

1. ใน LINE Official Account Manager เปิด **Settings → Messaging API** แล้วเลือกเปิดใช้ Messaging API
2. ถ้าระบบขอสร้าง LINE Developers account ให้กรอกชื่อและอีเมล
3. เลือกหรือสร้าง **Provider** ขององค์กรอย่างรอบคอบ เพราะ LINE ระบุว่าไม่สามารถย้ายหรือยกเลิกการผูก OA กับ Provider ภายหลังได้ [1]
4. เปิด [LINE Developers Console](https://developers.line.biz/console/) แล้วเลือก Provider และ Messaging API Channel ที่เพิ่งสร้าง

## ขั้นตอนที่ 3: เก็บค่าที่จำเป็นอย่างปลอดภัย

ในแท็บ **Messaging API** ของ channel ให้เตรียมข้อมูลตามตารางนี้ แต่ยังไม่ต้องส่ง token ในแชต

| ค่า | ตำแหน่งใน LINE Developers Console | ใช้ทำอะไร |
|---|---|---|
| Channel secret | Basic settings | ตรวจลายเซ็น webhook |
| Channel access token | Messaging API | ดาวน์โหลดรูป/ไฟล์ และตอบข้อความ |
| Basic ID / QR code | OA Manager | ให้พนักงานเพิ่มเพื่อน OA |
| Provider name | Developers Console | ใช้ยืนยัน channel ที่ถูกต้อง |

Channel access token คือ credential ที่ให้สิทธิ์เรียก Messaging API จึงต้องเก็บเป็น secret ฝั่ง server เท่านั้น หากสงสัยว่ารั่ว ให้ revoke token และออก token ใหม่ทันที [2]

## ขั้นตอนที่ 4: รอ webhook URL จากระบบ

**ยังไม่ต้องเปิด Use webhook หรือกด Verify** จนกว่าการพัฒนา endpoint จะเสร็จ ระบบจะสร้าง URL นี้ให้หลัง implementation:

```text
https://<โดเมนของคุณ>/api/line/webhook
```

จากนั้นจึงใส่ URL ใน LINE Developers Console, เปิด **Use webhook**, กด **Verify**, และเปิด **Webhook redelivery** เพื่อให้ระบบรับ event ซ้ำได้อย่างปลอดภัย โดย application จะป้องกันรายการค่าใช้จ่ายซ้ำด้วย `webhookEventId` [3]

## ขั้นตอนที่ 5: เลือกรูปแบบการบันทึก

ก่อนพัฒนา ให้เลือกรูปแบบเดียวสำหรับระยะแรก:

| เลือก | วิธีใช้ | แนะนำเมื่อ |
|---|---|---|
| **A — Mobile Form** | กดเมนู LINE เพื่อเปิดฟอร์มกรอกข้อมูลบนมือถือ | ต้องการข้อมูลถูกต้องและการใช้งานเป็นระบบ |
| **B — Chat Capture** | ส่งข้อความและรูปใบเสร็จในแชต แล้วได้รายการร่าง | ต้องการบันทึกเร็วจากหน้าห้องแชต |

## ข้อมูลที่กรุณาแจ้งกลับ

เมื่อเสร็จขั้นตอน 1–3 กรุณาแจ้งเพียงว่า **OA และ Messaging API Channel พร้อมแล้ว** พร้อมเลือก A หรือ B จากนั้นจะเปิดช่องกรอก secret ที่ปลอดภัยในระบบเพื่อรับ `LINE_CHANNEL_SECRET` และ `LINE_CHANNEL_ACCESS_TOKEN` โดยไม่ต้องส่ง token ผ่านข้อความสนทนา

## References

[1]: https://developers.line.biz/en/docs/messaging-api/getting-started/ "LINE Developers: Get started with the Messaging API"
[2]: https://developers.line.biz/en/docs/basics/channel-access-token/ "LINE Developers: Channel access token"
[3]: https://developers.line.biz/en/docs/messaging-api/receiving-messages/ "LINE Developers: Receive messages (webhook)"
