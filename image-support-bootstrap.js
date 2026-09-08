import fs from 'node:fs';

const serverFile = new URL('./server.js', import.meta.url);
const dashboardFile = new URL('./dashboard.html', import.meta.url);

let server = fs.readFileSync(serverFile, 'utf8');
server = server.replace(
  "app.use(express.json({ limit: '1mb', verify: (req, res, buffer) => { req.rawBody = Buffer.from(buffer); } }));",
  "app.use(express.json({ limit: '8mb', verify: (req, res, buffer) => { req.rawBody = Buffer.from(buffer); } }));"
);
server = server.replace(
  "res.setHeader('Cache-Control', req.path.startsWith('/api/') ? 'no-store' : 'public, max-age=300');",
  "res.setHeader('Cache-Control', req.path.startsWith('/api/') || req.path === '/' || req.path.endsWith('.html') ? 'no-store' : 'public, max-age=300');"
);

if (!server.includes("app.post('/api/image-edit'")) {
  const imageEditRoute = String.raw`

app.post('/api/image-edit', auth, rateLimit({ windowMs: 60000, max: 6, scope: 'image-edit', getKey: req => 'user:' + req.user_id }), async (req, res) => {
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Origin not allowed.' });
  if (!openai) return res.status(503).json({ error: 'AI image service is not configured.' });
  const prompt = String(req.body?.prompt || '').trim().slice(0, 12000);
  const imageData = String(req.body?.image_data || '').trim();
  const separator = imageData.indexOf(',');
  const header = separator > 0 ? imageData.slice(0, separator) : '';
  const payload = separator > 0 ? imageData.slice(separator + 1) : '';
  const allowedHeader = header === 'data:image/jpeg;base64' || header === 'data:image/jpg;base64' || header === 'data:image/png;base64' || header === 'data:image/webp;base64';
  if (!prompt) return res.status(400).json({ error: 'اكتب وصف التعديل المطلوب.' });
  if (!allowedHeader || !payload || !/^[A-Za-z0-9+/=]+$/.test(payload)) return res.status(400).json({ error: 'الصورة غير صالحة. استخدم JPG أو PNG أو WEBP.' });
  if (imageData.length > 7000000) return res.status(400).json({ error: 'حجم الصورة كبير جداً. اختر صورة أصغر.' });
  const IMAGE_EDIT_COST = 5;
  let reserved = false;
  try {
    await db.tx(async t => {
      const updated = await t.oneOrNone('UPDATE users SET credits=credits-$1 WHERE id=$2 AND credits >= $1 RETURNING credits', [IMAGE_EDIT_COST, req.user_id]);
      if (!updated) throw Object.assign(new Error('INSUFFICIENT_CREDITS'), { status: 402 });
      await t.none('INSERT INTO credit_ledger(user_id,amount,reason) VALUES($1,$2,$3)', [req.user_id, -IMAGE_EDIT_COST, 'AI image edit']);
      reserved = true;
    });
    const response = await openai.responses.create({
      model: 'gpt-5.6-luna',
      input: [{ role: 'user', content: [
        { type: 'input_text', text: 'Edit this image according to the following instruction: ' + prompt + '. Preserve identity, face, composition, camera perspective, lighting, background, clothing, and every detail that was not explicitly requested to change. Make only the requested changes and keep the result photorealistic and natural.' },
        { type: 'input_image', image_url: imageData }
      ]}],
      tools: [{ type: 'image_generation', model: 'gpt-image-2', action: 'edit', quality: 'medium' }],
      tool_choice: { type: 'image_generation' }
    });
    const imageCall = Array.isArray(response?.output) ? response.output.find(item => item?.type === 'image_generation_call' && item?.result) : null;
    const b64 = imageCall?.result;
    if (!b64) throw new Error('EMPTY_IMAGE_RESULT');
    const credits = await db.one('SELECT credits FROM users WHERE id=$1', [req.user_id]);
    reserved = false;
    return res.json({ ok: true, image: 'data:image/png;base64,' + b64, credits: credits.credits, cost: IMAGE_EDIT_COST });
  } catch (error) {
    if (reserved) {
      try {
        await db.tx(async t => {
          await t.none('UPDATE users SET credits=credits+$1 WHERE id=$2', [IMAGE_EDIT_COST, req.user_id]);
          await t.none('INSERT INTO credit_ledger(user_id,amount,reason) VALUES($1,$2,$3)', [req.user_id, IMAGE_EDIT_COST, 'AI image edit refund']);
        });
      } catch (refundError) { console.error('Image edit credit refund failed:', refundError); }
    }
    console.error('IMAGE_EDIT_ERROR', { name: error?.name, message: error?.message, status: error?.status, code: error?.code, type: error?.type });
    if (error?.status === 402) return res.status(402).json({ error: 'Yeterli Credits bulunmuyor. Bir görsel düzenleme 5 kredi kullanır.' });
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('safety') || message.includes('content') || message.includes('policy')) return res.status(400).json({ error: 'Bu görsel veya düzenleme isteği güvenlik kuralları nedeniyle işlenemedi.' });
    if (message.includes('quota') || message.includes('billing') || message.includes('credit')) return res.status(503).json({ error: 'OpenAI görsel servisi için bakiye/kullanım limiti yetersiz.' });
    return res.status(502).json({ error: 'Görsel düzenleme servisi yanıt vermedi. Lütfen tekrar deneyin.' });
  }
});
`;
  const anchor = 'app.use(csrfProtection);';
  if (server.includes(anchor)) server = server.replace(anchor, anchor + imageEditRoute);
}

fs.writeFileSync(serverFile, server);

let dashboard = fs.readFileSync(dashboardFile, 'utf8');
const enhancementScript = String.raw`
<script>
(function () {
  function initStarEnhancements() {
    if (window.__starEnhancementsReady) return;
    window.__starEnhancementsReady = true;
    document.documentElement.style.setProperty('--star-font', 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif');
    document.body.style.fontFamily = 'var(--star-font)';
    const preview = document.getElementById('imagePreview');
    const info = preview && preview.querySelector('.image-preview-info');
    const form = document.getElementById('chat');
    const input = document.getElementById('message');
    const fileInput = document.getElementById('imageInput');
    const messages = document.getElementById('messagesInner');
    const sendButton = document.getElementById('sendButton');
    const credits = document.getElementById('credits');
    const creditsSide = document.getElementById('creditsSide');
    if (!preview || !info || !form || !input || !fileInput || !messages) return;
    let imageMode = 'edit';
    const style = document.createElement('style');
    style.textContent = '.star-image-tools{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}.star-image-tool,.star-quick-tool{border:1px solid rgba(168,85,247,.28);background:rgba(124,60,255,.10);color:#cfc3ff;border-radius:10px;padding:6px 9px;font-size:11px;font-weight:700;cursor:pointer;transition:.18s ease}.star-image-tool.active,.star-image-tool:hover,.star-quick-tool:hover{background:rgba(124,60,255,.28);color:#fff;border-color:rgba(183,135,255,.5);transform:translateY(-1px)}.star-quick-tools{width:min(920px,100%);margin:0 auto 8px;display:flex;gap:7px;overflow-x:auto;scrollbar-width:none}.star-quick-tools::-webkit-scrollbar{display:none}.star-result-label{font-size:11px;color:#8f879e;margin-bottom:8px;font-weight:700}.star-error{color:#ffb7c1!important;background:rgba(244,63,94,.08)!important;border-color:rgba(244,63,94,.25)!important}.dashboard-page #message{font-family:var(--star-font);letter-spacing:-.01em}';
    document.head.appendChild(style);
    const tools = document.createElement('div');
    tools.className = 'star-image-tools';
    tools.innerHTML = '<button type="button" class="star-image-tool active" data-mode="edit">✦ تعديل الصورة</button><button type="button" class="star-image-tool" data-mode="analyze">◉ تحليل الصورة</button>';
    info.appendChild(tools);
    tools.querySelectorAll('[data-mode]').forEach(function (button) { button.addEventListener('click', function () { imageMode = button.dataset.mode; tools.querySelectorAll('[data-mode]').forEach(function (b) { b.classList.toggle('active', b === button); }); }); });
    const composerWrap = form.parentElement;
    const quick = document.createElement('div');
    quick.className = 'star-quick-tools';
    quick.innerHTML = '<button type="button" class="star-quick-tool">✨ تحسين النص</button><button type="button" class="star-quick-tool">💡 أفكار</button><button type="button" class="star-quick-tool">📝 تلخيص</button><button type="button" class="star-quick-tool">🌐 ترجمة</button>';
    composerWrap.insertBefore(quick, preview);
    quick.querySelectorAll('button').forEach(function (button) { button.addEventListener('click', function () { const label = button.textContent || ''; const prompts = {'✨ تحسين النص':'حسّن صياغة النص التالي واجعله أوضح وأجمل مع الحفاظ على المعنى:','💡 أفكار':'اقترح لي أفكاراً عملية ومبتكرة حول:','📝 تلخيص':'لخّص النص التالي في نقاط واضحة ومختصرة:','🌐 ترجمة':'ترجم النص التالي إلى العربية ترجمة طبيعية ودقيقة:'}; input.value = (prompts[label] || '') + (input.value ? ' ' + input.value : ''); input.focus(); }); });
    function setCredits(value) { if (credits && value !== undefined) credits.textContent = String(value); if (creditsSide && value !== undefined) creditsSide.textContent = String(value); }
    function readFile(file) { return new Promise(function (resolve, reject) { const reader = new FileReader(); reader.onload = function () { resolve(String(reader.result || '')); }; reader.onerror = reject; reader.readAsDataURL(file); }); }
    function addResult(imageUrl, prompt) { const box = document.createElement('div'); box.className = 'msg ai'; const label = document.createElement('div'); label.className = 'star-result-label'; label.textContent = '✦ تم تعديل الصورة'; const image = document.createElement('img'); image.className = 'message-image'; image.src = imageUrl; image.alt = prompt || 'Düzenlenmiş görsel'; box.appendChild(label); box.appendChild(image); messages.appendChild(box); const scroller = document.getElementById('messages'); if (scroller) scroller.scrollTop = scroller.scrollHeight; }
    function showError(text) { const box = document.createElement('div'); box.className = 'msg ai star-error'; box.textContent = text; messages.appendChild(box); const scroller = document.getElementById('messages'); if (scroller) scroller.scrollTop = scroller.scrollHeight; }
    form.addEventListener('submit', async function (event) {
      if (imageMode !== 'edit' || !fileInput.files || !fileInput.files[0]) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (sendButton) sendButton.disabled = true;
      const file = fileInput.files[0];
      const prompt = String(input.value || '').trim();
      if (!prompt) { showError('اكتب أولاً ما تريد تغييره في الصورة، مثلاً: كبر العضلات بشكل طبيعي مع الحفاظ على الوجه والخلفية.'); if (sendButton) sendButton.disabled = false; input.focus(); return; }
      try {
        const imageData = await readFile(file);
        const userBox = document.createElement('div'); userBox.className = 'msg user';
        const thumb = document.createElement('img'); thumb.className = 'message-image'; thumb.src = imageData; userBox.appendChild(thumb);
        const caption = document.createElement('div'); caption.textContent = prompt; userBox.appendChild(caption); messages.appendChild(userBox);
        const response = await fetch('/api/image-edit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ image_data: imageData, prompt: prompt }) });
        const data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.error || ('Image edit failed (' + response.status + ')'));
        if (!data.image) throw new Error('لم تصل صورة من خادم التعديل.');
        addResult(data.image, prompt);
        if (data.credits !== undefined) setCredits(data.credits);
        input.value = ''; fileInput.value = ''; if (preview) preview.classList.remove('open');
      } catch (error) { showError(String(error && error.message ? error.message : 'تعذر الاتصال بخدمة تعديل الصور.')); }
      finally { if (sendButton) sendButton.disabled = false; }
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initStarEnhancements); else initStarEnhancements();
})();
</script>
`;

if (!dashboard.includes('__starEnhancementsReady')) dashboard = dashboard.replace('</body>', enhancementScript + '</body>');
fs.writeFileSync(dashboardFile, dashboard);
console.log('STAR AI image editing and enhanced UI enabled.');
await import('./server.js');
