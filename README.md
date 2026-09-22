# Coffee QR Ordering System

ระบบสั่งเครื่องดื่มและขนมผ่าน QR Code สำหรับโครงการศึกษา

## เทคโนโลยี

- Node.js
- Express.js
- EJS
- Bootstrap 5
- SQLite
- sqlite3
- MVC
- Monolithic Architecture

## การติดตั้ง

1. นำไฟล์ฐานข้อมูลเดิมชื่อ coffee.db มาวางในโฟลเดอร์หลักของโปรเจกต์
2. ติดตั้ง Dependency

    npm install

3. เริ่มระบบ

    npm start

4. เปิดระบบที่ http://localhost:3000

## URL ตัวอย่าง

- ลูกค้าโต๊ะ 1: http://localhost:3000/customer?table=1
- Cashier: http://localhost:3000/cashier/dashboard
- Barista: http://localhost:3000/barista/dashboard

## ข้อกำหนดฐานข้อมูล

โปรเจกต์นี้ไม่สร้างฐานข้อมูล ไม่สร้าง Table ไม่ทำ Migration และไม่ทำ Seed Data

ระบบจะตรวจสอบไฟล์ coffee.db ก่อนเปิด Connection และใช้ SQLite ในโหมด
OPEN_READWRITE เท่านั้น หากไม่พบไฟล์ ระบบจะหยุดทำงานพร้อมแสดงข้อผิดพลาด

ชื่อคอลัมน์ Product ที่ใช้ตาม ERD ล่าสุดคือ category ไม่ใช่ category_id

## Payment QR

QR Payment ในโปรเจกต์เป็น Simulation เพื่อการศึกษา การนำไปใช้งานจริงต้องเชื่อมต่อ
Payment Gateway และตรวจสอบผลชำระเงินจาก Server-to-Server Callback ห้ามเชื่อถือ
การยืนยันจาก Browser เพียงอย่างเดียว

## หมายเหตุ Schema

Payment ที่สร้างจาก QR Payment จะยังไม่มี emp_id ดังนั้น Schema ควรอนุญาตให้ emp_id
เป็น NULL หากฐานข้อมูลกำหนด NOT NULL จำเป็นต้องปรับ Flow ให้ Payment Gateway หรือ
Cashier Employee เป็นผู้ดำเนินการ โดยไม่ควรให้ Application เปลี่ยน Schema อัตโนมัติ

## Production

ก่อนนำขึ้น Production ควรเพิ่ม:

- Authentication และ Authorization สำหรับ Cashier และ Barista
- Session Store ภายนอกแทน MemoryStore
- CSRF Protection
- HTTPS
- Secure Cookie
- Rate Limiting
- Payment Gateway จริง
- Validation และ Logging เพิ่มเติม
