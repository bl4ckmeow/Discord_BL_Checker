# Discord Blacklist Bot 🤖

บอทสำหรับจัดการรายชื่อผู้ใช้ที่ถูกแบล็คลิสต์ในเซิร์ฟเวอร์ Discord พร้อมระบบฐานข้อมูล MySQL

## 📋 คุณสมบัติหลัก

- ✅ เพิ่มผู้ใช้เข้าสู่รายการแบล็คลิสต์ (เฉพาะแอดมิน)
- 🔍 ตรวจสอบสถานะแบล็คลิสต์ของผู้ใช้ (ทุกคนใช้ได้)
- ❌ ลบผู้ใช้ออกจากรายการแบล็คลิสต์ (เฉพาะแอดมิน)
- 🔐 ระบบควบคุมสิทธิ์ตามบทบาท (Role-based Access Control)
- 💾 เก็บข้อมูลในฐานข้อมูล MySQL
- 📝 ระบบ Logging ที่ครบถ้วน
- 🧪 Unit Tests และ Integration Tests

## 🚀 การติดตั้งและใช้งาน

### ข้อกำหนดระบบ
- Node.js >= 18.0.0
- MySQL Database
- Discord Bot Token

### ขั้นตอนการติดตั้ง

1. **Clone โปรเจค**
   ```bash
   git clone <repository-url>
   cd discord-blacklist-bot
   ```

2. **ติดตั้ง Dependencies**
   ```bash
   npm install
   ```

3. **ตั้งค่าตัวแปรสภาพแวดล้อม**
   ```bash
   cp .env.example .env
   ```
   แก้ไขไฟล์ `.env` ตามข้อมูลของคุณ

4. **สร้างฐานข้อมูล**
   ```bash
   npm run db:init
   ```

5. **Build โปรเจค**
   ```bash
   npm run build
   ```

6. **เริ่มใช้งานบอท**
   ```bash
   npm start
   ```

## ⚙️ ตัวแปรสภาพแวดล้อม

สร้างไฟล์ `.env` และกำหนดค่าดังนี้:

```env
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here

# MySQL Database Configuration  
MYSQL_URL=mysql://username:password@localhost:3306/blacklist_db

# Admin Role Configuration
ADMIN_ROLE_ID=your_discord_admin_role_id_here

# Environment
NODE_ENV=development
```

## 🎮 คำสั่งที่ใช้ได้

| คำสั่ง | คำอธิบาย | สิทธิ์ |
|--------|----------|--------|
| `/addbl <user>` | เพิ่มผู้ใช้เข้าสู่รายการแบล็คลิสต์ | แอดมินเท่านั้น |
| `/checkbl <user>` | ตรวจสอบสถานะแบล็คลิสต์ของผู้ใช้ | ทุกคน |
| `/removebl <user>` | ลบผู้ใช้ออกจากรายการแบล็คลิสต์ | แอดมินเท่านั้น |

## 🛠️ การพัฒนา

### คำสั่งสำหรับนักพัฒนา

```bash
# รันในโหมดพัฒนา
npm run dev

# Build โปรเจค
npm run build

# รัน Unit Tests
npm run test

# รัน Integration Tests  
npm run test:integration

# รันทุก Tests
npm run test:all

# ตรวจสอบ Code Style
npm run lint

# แก้ไข Code Style อัตโนมัติ
npm run lint:fix

# รัน Tests แบบ Watch Mode
npm run test:watch
npm run test:integration:watch
```

### โครงสร้างโปรเจค

```
src/
├── bot/              # Discord client และ event handlers
├── commands/         # Slash commands
├── config/           # การตั้งค่าระบบ
├── database/         # ฐานข้อมูลและ repositories
├── models/           # Data models
├── services/         # Business logic
├── utils/            # Utilities (Logger, ErrorHandler)
└── __tests__/        # Tests
    ├── unit/         # Unit tests
    └── integration/  # Integration tests
```

## 🧪 การทดสอบ

โปรเจคนี้มีระบบทดสอบที่ครอบคลุม:

- **Unit Tests**: ทดสอบฟังก์ชันแต่ละส่วน
- **Integration Tests**: ทดสอบการทำงานร่วมกันของระบบ
- **Database Tests**: ทดสอบการเชื่อมต่อและการทำงานของฐานข้อมูล

## 📚 เทคโนโลยีที่ใช้

- **TypeScript**: ภาษาหลักในการพัฒนา
- **Discord.js v14**: สำหรับสร้าง Discord Bot
- **MySQL2**: สำหรับเชื่อมต่อฐานข้อมูล MySQL
- **Jest**: สำหรับการทดสอบ
- **ESLint**: สำหรับตรวจสอบ Code Quality

## 🤝 การมีส่วนร่วม

ยินดีรับการมีส่วนร่วมจากทุกคน! สามารถ:
- รายงานปัญหาผ่าน Issues
- เสนอฟีเจอร์ใหม่
- ส่ง Pull Request

## 📄 License

MIT License - ดูรายละเอียดในไฟล์ LICENSE

---

**หมายเหตุ**: โปรเจคนี้สร้างขึ้นเพื่อการศึกษาและทดสอบประสิทธิภาพของ IDE สามารถนำไปพัฒนาต่อได้ตามต้องการ