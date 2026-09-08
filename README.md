# STAR AI — Commercial MVP

STAR AI هو تطبيق ويب تركيّز نسخته الحالية على حسابات المستخدمين، محادثات AI، إدارة الرصيد، وخطط الاشتراك عبر Shopier.

## الحالة الحالية
- تسجيل / دخول / خروج للمستخدمين
- JWT داخل HttpOnly cookie مع SameSite وSecure في الإنتاج
- PostgreSQL عبر `pg-promise`
- OpenAI Chat Completions مع سياق آخر 20 رسالة
- نظام Credits مع سجل محاسبي
- حجز الرصيد ذريًا قبل طلب AI مع استرداده عند فشل الطلب
- محادثات خاصة بكل مستخدم مع تحقق من الملكية
- بحث وتصدير وحذف للمحادثات
- Shopier checkout + webhook محمي بسر سري وidempotency
- Basic وPro متاحان عبر Shopier
- Business يظهر كـ"قريبًا" حتى يتم ضبط `SHOPIER_PRODUCT_BUSINESS_ID`
- لوحة Admin مع إحصاءات ومستخدمين وتعديل الخطة والرصيد
- Rate limiting على نقاط الدخول الحساسة
- حماية CSRF/Origin لطلبات المتصفح التي تعتمد على cookies
- حجب ملفات المصدر وملفات البيئة وخرائط JavaScript وأرشيف المشروع من العرض العام

## المتطلبات
- Node.js 20+
- PostgreSQL
- حساب OpenAI ومفتاح API
- حساب Shopier إذا أردت تفعيل المدفوعات

## التشغيل
```bash
npm install
cp .env.example .env
```

ثم اضبط المتغيرات المطلوبة في `.env`، وبعدها:

```bash
npm start
```

افتح `http://localhost:3000`.

## متغيرات البيئة الأساسية
- `NODE_ENV=production`
- `PORT`
- `DATABASE_URL`
- `JWT_SECRET` — في الإنتاج يجب أن يكون 32 حرفًا على الأقل
- `OPENAI_API_KEY`
- `AI_MODEL` — الافتراضي `gpt-4o-mini`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `SHOPIER_WEBHOOK_SECRET`
- `SHOPIER_PRODUCT_BASIC_ID`
- `SHOPIER_PRODUCT_PRO_ID`
- `SHOPIER_PRODUCT_BUSINESS_ID` — اختياري، وعند ضبطه فقط يصبح Business متاحًا

## Shopier Webhook
العنوان:
`https://YOUR-DOMAIN/api/shopier/webhook`

أرسل سر الـWebhook في HTTP header باسم:
`x-shopier-secret`

يجب أن يحتوي الحدث على حالة دفع ناجحة (`paid` أو `success` أو `completed`) ومعرّف منتج مطابق لمعرّفات Shopier المضبوطة في البيئة. لا يعتمد النظام على اسم المنتج لتحديد الخطة.

## Admin
ضع `ADMIN_EMAIL` و`ADMIN_PASSWORD` قبل أول تشغيل. سيُنشأ حساب Admin تلقائيًا إذا لم يكن موجودًا.

بعد تسجيل الدخول افتح `/admin.html`.

لوحة الإدارة تعرض:
- إجمالي المستخدمين
- المستخدمين المدفوعين
- إجمالي Credits الحالية
- Credits المستهلكة
- القيمة الشهرية التقريبية للخطط
- توزيع الخطط
- المستخدمين
- تعديل الخطة
- إضافة أو خصم Credits

## ملاحظات الإنتاج
قبل الإطلاق التجاري النهائي يجب أيضًا إعداد HTTPS فعلي، نسخ احتياطية PostgreSQL، مراقبة وتنبيهات، سياسة احتفاظ بالسجلات، التحقق من البريد الإلكتروني واستعادة كلمة المرور، وصفحات الخصوصية والشروط المناسبة للسوق المستهدف، ومراجعة إعدادات الاستضافة وProxy بحيث تكون `trust proxy` صحيحة للبيئة المستخدمة.
