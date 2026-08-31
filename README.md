# STAR AI — Commercial MVP

Bu sürüm, STAR AI'ı ticari ürüne dönüştürmek için gereken temel backend'i içerir.

## Hazır
- Kullanıcı kayıt/giriş/çıkış
- HttpOnly JWT cookie
- SQLite kullanıcı ve kredi muhasebesi
- Gerçek OpenAI Responses API chat
- Plan/credit yapısı
- iyzico Subscription Checkout Form entegrasyon noktası
- iyzico Subscription webhook V3 doğrulaması
- Dashboard + chat + plan yükseltme ekranı

## Kurulum
1. Node.js 20+ kur.
2. `npm install`
3. `.env.example` → `.env`
4. `OPENAI_API_KEY` ekle.
5. iyzico sandbox hesabından API Key / Secret Key ve plan reference code'larını ekle.
6. `npm start`
7. `http://localhost:3000`

## iyzico
iyzico'da önce STAR AI ürünü ve Basic/Pro/Business aylık planları oluşturup her planın `pricingPlanReferenceCode` değerini `.env` dosyasına koymalısın.
Webhook adresi:
`https://SENIN-DOMAININ/api/webhooks/iyzico`

İlk testte sandbox kullan. Canlıya geçerken IYZICO_BASE_URL ve merchant bilgilerini production değerleriyle değiştir.

## Önemli
Bu paket gerçek üretim öncesi MVP'dir. Canlıya almadan önce HTTPS, rate limiting, CSRF politikası, e-posta doğrulama/şifre sıfırlama, KVKK metinleri, yedekleme, PostgreSQL ve izleme eklenmelidir.


## Admin Panel
ضع `ADMIN_EMAIL` و `ADMIN_PASSWORD` في `.env` قبل أول تشغيل. عند التشغيل سيُنشأ حساب Admin تلقائياً إذا لم يكن موجوداً.
بعد الدخول، افتح `/admin.html`.

اللوحة تعرض:
- عدد المستخدمين
- عدد المشتركين المدفوعين
- Credits المتداولة والمستهلكة
- قيمة الخطط الشهرية الحالية (ليست تقريراً محاسبياً نهائياً)
- قائمة المستخدمين
- تغيير الخطة
- إضافة/خصم Credits
