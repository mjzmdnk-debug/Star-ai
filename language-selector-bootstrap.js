import fs from 'node:fs';

const dashboardFile = new URL('./dashboard.html', import.meta.url);
let dashboard = fs.readFileSync(dashboardFile, 'utf8');

if (!dashboard.includes('STAR_AI_LANGUAGE_SELECTOR_V1')) {
  const script = String.raw`
<script data-star-language="STAR_AI_LANGUAGE_SELECTOR_V1">
(() => {
  const translations = {
    tr: { name: 'Türkçe', newChat: 'Yeni sohbet', chats: 'SOHBETLER', credits: 'Kalan kredi', logout: 'Çıkış', online: 'Çevrimiçi • Hızlı yanıt', welcome: 'Bugün sana nasıl yardımcı olabilirim?', welcomeSub: 'Bir soru sor, fikir üret veya birlikte bir şeyler oluşturalım.', placeholder: "STAR AI'a bir mesaj yazın…", selected: 'Görsel seçildi', imageInfo: 'STAR AI bu görseli analiz edebilir.', remove: 'Görseli kaldır', imageEdit: 'Görseli düzenle', imageAnalyze: 'Görsel analizi', improve: 'Metni iyileştir', ideas: 'Fikirler', summary: 'Özetle', translate: 'Çevir', language: 'Dil' },
    en: { name: 'English', newChat: 'New chat', chats: 'CHATS', credits: 'Remaining credits', logout: 'Log out', online: 'Online • Fast response', welcome: 'How can I help you today?', welcomeSub: 'Ask a question, generate an idea, or let’s create something together.', placeholder: 'Write a message to STAR AI…', selected: 'Image selected', imageInfo: 'STAR AI can analyze this image.', remove: 'Remove image', imageEdit: 'Edit image', imageAnalyze: 'Image analysis', improve: 'Improve text', ideas: 'Ideas', summary: 'Summarize', translate: 'Translate', language: 'Language' },
    ar: { name: 'العربية', newChat: 'محادثة جديدة', chats: 'المحادثات', credits: 'الرصيد المتبقي', logout: 'تسجيل الخروج', online: 'متصل • استجابة سريعة', welcome: 'كيف يمكنني مساعدتك اليوم؟', welcomeSub: 'اطرح سؤالاً، أنشئ فكرة، أو لننشئ شيئاً معاً.', placeholder: 'اكتب رسالة إلى STAR AI…', selected: 'تم اختيار الصورة', imageInfo: 'يمكن لـ STAR AI تحليل هذه الصورة.', remove: 'إزالة الصورة', imageEdit: 'تعديل الصورة', imageAnalyze: 'تحليل الصورة', improve: 'تحسين النص', ideas: 'أفكار', summary: 'تلخيص', translate: 'ترجمة', language: 'اللغة' }
  };
  const get = id => document.getElementById(id);
  function applyLanguage(lang) {
    const t = translations[lang] || translations.tr;
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    const setText = (id, value) => { const el = get(id); if (el) el.textContent = value; };
    setText('newChat', t.newChat); setText('logout', t.logout);
    const label = document.querySelector('.sidebar-label'); if (label) label.textContent = t.chats;
    const small = document.querySelector('.credit-mini small'); if (small) small.textContent = t.credits;
    const online = document.querySelector('.chat-title small'); if (online) online.innerHTML = '<span class="online-dot"></span>' + t.online;
    const welcome = document.querySelector('.welcome h1'); if (welcome) welcome.textContent = t.welcome;
    const welcomeSub = document.querySelector('.welcome p'); if (welcomeSub) welcomeSub.textContent = t.welcomeSub;
    const input = get('message'); if (input) input.placeholder = t.placeholder;
    const previewName = get('previewName'); if (previewName) previewName.textContent = t.selected;
    const previewInfo = document.querySelector('.image-preview-info small'); if (previewInfo) previewInfo.textContent = t.imageInfo;
    const remove = get('removeImage'); if (remove) { remove.setAttribute('aria-label', t.remove); remove.title = t.remove; }
    document.querySelectorAll('.star-image-tool').forEach(btn => { if (btn.dataset.mode === 'edit') btn.textContent = '✦ ' + t.imageEdit; if (btn.dataset.mode === 'analyze') btn.textContent = '◉ ' + t.imageAnalyze; });
    document.querySelectorAll('.star-quick-tool').forEach((btn, i) => { const values = ['✨ ' + t.improve, '💡 ' + t.ideas, '📝 ' + t.summary, '🌐 ' + t.translate]; if (values[i]) btn.textContent = values[i]; });
    const select = get('starLanguageSelect'); if (select) select.value = lang;
    localStorage.setItem('star-ai-language', lang);
    window.__starAiLanguage = lang;
  }
  function init() {
    if (!get('starLanguageSelect')) {
      const user = document.querySelector('.dash-user'); if (!user) return;
      const wrap = document.createElement('label'); wrap.className = 'star-language-wrap'; wrap.title = 'Dil';
      wrap.innerHTML = '<span aria-hidden="true">🌐</span><select id="starLanguageSelect" aria-label="Dil"><option value="tr">Türkçe</option><option value="en">English</option><option value="ar">العربية</option></select>';
      user.insertBefore(wrap, user.firstChild);
      const style = document.createElement('style'); style.textContent = '.star-language-wrap{display:flex;align-items:center;gap:6px;height:38px;padding:0 9px;border:1px solid rgba(255,255,255,.1);border-radius:11px;background:rgba(255,255,255,.035);color:#bdb7c9}.star-language-wrap select{border:0;outline:0;background:transparent;color:#d8d3df;font:600 12px inherit;cursor:pointer}.star-language-wrap option{background:#171321;color:#fff}@media(max-width:600px){.star-language-wrap{padding:0 7px}.star-language-wrap select{max-width:76px}.star-language-wrap span{display:none}}[dir="rtl"] .dashboard-page .msg.user{margin-left:0;margin-right:auto}[dir="rtl"] .dashboard-page .msg.ai{margin-right:0;margin-left:auto}[dir="rtl"] .conversation-item{text-align:right}'; document.head.appendChild(style);
      get('starLanguageSelect').addEventListener('change', () => applyLanguage(get('starLanguageSelect').value));
    }
    applyLanguage(localStorage.getItem('star-ai-language') || 'tr');
  }
  const originalFetch = window.fetch;
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (String(url).includes('/api/chat') && init && init.body && typeof init.body === 'string') {
      try { const body = JSON.parse(init.body); body.language = window.__starAiLanguage || localStorage.getItem('star-ai-language') || 'tr'; init = { ...init, body: JSON.stringify(body) }; } catch {}
    }
    return originalFetch.apply(this, [input, init]);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
</script>`;
  dashboard = dashboard.replace('</body>', script + '\n</body>', 1);
  fs.writeFileSync(dashboardFile, dashboard);
  console.log('STAR AI language selector enabled.');
}
