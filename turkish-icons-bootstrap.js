import fs from 'node:fs';

const dashboardFile = new URL('./dashboard.html', import.meta.url);
let dashboard = fs.readFileSync(dashboardFile, 'utf8');

const translations = new Map([
  ['✦ محادثة', '✦ Sohbet'],
  ['◉ تحليل الصورة', '◉ Görsel analizi'],
  ['✎ تعديل الصورة', '✎ Görseli düzenle'],
  ['＋ إضافة إلى الصورة', '＋ Görsele ekle'],
  ['تحسين الصورة', 'Görseli iyileştir'],
  ['إزالة عنصر', 'Ögeyi kaldır'],
  ['تغيير الخلفية', 'Arka planı değiştir'],
  ['إضافة عنصر', 'Öge ekle'],
  ['تحسين النص', 'Metni iyileştir'],
  ['تلخيص', 'Özetle'],
  ['أرفق صورة واسأل عنها مباشرة. سيحللها STAR AI ويجيبك بالتفصيل.', 'Bir görsel ekleyin ve doğrudan soru sorun. STAR AI görseli analiz edip ayrıntılı yanıt verir.'],
  ['أرفق صورة واكتب التعديل المطلوب. سيُستخدم محرر الصور المتخصص.', 'Bir görsel ekleyin ve istediğiniz düzenlemeyi yazın. Uzman görsel düzenleyici kullanılacaktır.'],
  ['أرفق صورة واكتب الشيء الذي تريد إضافته إليها.', 'Bir görsel ekleyin ve eklemek istediğiniz şeyi yazın.'],
  [' لم تُرفق صورة بعد.', ' Henüz bir görsel eklenmedi.'],
  ['أرفق صورة أولاً حتى أستطيع تحليلها أو تعديلها.', 'Önce bir görsel ekleyin; ardından görseli analiz edebilir veya düzenleyebilirim.'],
  ['اكتب سؤالك عن الصورة أولاً.', 'Önce görsel hakkında sorunuzu yazın.'],
  ['اكتب ما تريد إضافته إلى الصورة أولاً.', 'Önce görsele eklemek istediğiniz şeyi yazın.'],
  ['تعذر الحصول على إجابة.', 'Yanıt alınamadı.'],
  ['لم تصل إجابة من المساعد.', 'Asistandan yanıt alınamadı.'],
  ['حدث خطأ أثناء معالجة الصورة.', 'Görsel işlenirken bir hata oluştu.'],
  ['الصورة كبيرة جداً. اختر صورة أصغر.', 'Görsel çok büyük. Daha küçük bir görsel seçin.'],
  ['صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WEBP.', 'Görsel biçimi desteklenmiyor. JPG, PNG veya WEBP kullanın.'],
  ['يمكنك تحليل الصور المرفقة والإجابة عن الأسئلة المتعلقة بها. كن عملياً، دقيقاً، واكتب خطوات واضحة عند طلب التعديل أو الإضافة.', 'Eklenen görselleri analiz edebilir ve görsellerle ilgili soruları yanıtlayabilirsin. Düzenleme veya ekleme istendiğinde pratik, doğru ve net adımlar sun.'],
  ['حلّل الصورة المرفقة بدقة واستند إليها في إجابتك. إذا كان المطلوب اقتراح تعديل أو إضافة، اشرح ما يمكن تنفيذه بوضوح ولا تدّعِ أنك عدّلت الصورة ما لم تُستخدم خدمة التعديل.', 'Eklenen görseli dikkatlice analiz et ve yanıtını görsele dayandır. Düzenleme veya ekleme istenirse yapılabilecek işlemi açıkça anlat ve görsel düzenleme hizmeti kullanılmadıkça düzenleme yaptığını iddia et.']
]);

for (const [from, to] of translations) dashboard = dashboard.split(from).join(to);
fs.writeFileSync(dashboardFile, dashboard);

let serverFile = new URL('./server.js', import.meta.url);
let server = fs.readFileSync(serverFile, 'utf8');
for (const [from, to] of translations) server = server.split(from).join(to);
fs.writeFileSync(serverFile, server);

console.log('STAR AI Turkish icon and multimodal text localization enabled.');
