---
title: Codenames Telegram Bot
emoji: 🎮
colorFrom: blue
colorTo: red
sdk: docker
app_port: 7860
pinned: false
---

# بوت كود نيمز على تلجرام 🎮

بوت لعبة **Codenames (كود نيمز)** بالعربي لتلجرام — يلعب بالقنوات والمجموعات،
مع وضع **الرسالة الواحدة** (لوحة اللعبة تتنعدّل باستمرار بدل إرسال رسائل جديدة).

## المميزات

- 🕵️ **القائد (الجاسوس)** يكتب التلميح **بالخاص** بلا أي أوامر (كلمة + رقم).
- 📢 **اللعب بالقنوات**: أرسل `/start` للبوت بالخاص ثم شارك اللعبة بقناتك.
- 👥 الأعضاء يخمّنون بالضغط على الأزرار فقط — بلا أوامر.
- 🔄 رسالة لعبة واحدة تتنعدّل باستمرار.

## التشغيل

يحتاج متغير بيئة واحد:

- `TELEGRAM_BOT_TOKEN` = توكن البوت من BotFather.

## نشر التعديلات تلقائياً

ملف `.github/workflows/deploy-bot.yml` يفحص الكود وينشر الـ Cloudflare Worker عند دفع تعديل إلى فرع `arena/**` أو `main`. حتى يشتغل، أضف **من إعدادات مستودع GitHub** → Settings → Secrets and variables → Actions → New repository secret:

- `CLOUDFLARE_API_TOKEN`: توكن Cloudflare بصلاحية نشر Workers على حسابك.
- `CLOUDFLARE_ACCOUNT_ID`: معرّف حساب Cloudflare الذي يستضيف البوت.

لا ترسل قيمها بالمحادثة ولا تضعها بالكود. أبقِ `TELEGRAM_BOT_TOKEN` و`WEBHOOK_SECRET` مخزّنين كأسرار في Cloudflare Worker مثل ما هما. كل تعديل يصير مباشر **بعد** حفظه في commit ودفعه إلى GitHub ونجاح الاختبارات؛ تعديل الملفات محلياً وحده ما ينشر البوت. راقب نتيجة النشر في تبويب **Actions** على GitHub.
