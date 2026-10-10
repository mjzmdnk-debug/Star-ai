import fs from 'node:fs';

const serverFile = new URL('./server.js', import.meta.url);
const dashboardFile = new URL('./dashboard.html', import.meta.url);

let server = fs.readFileSync(serverFile, 'utf8');
server = server.replace("import OpenAI from 'openai';", "import OpenAI from 'openai';\nimport { toFile } from 'openai/uploads';");
server = server.replace("const app = express();", "const app = express();\nconst POLLINATIONS_API_KEY = String(process.env.POLLINATIONS_API_KEY || '').trim();\nconst imageClient = POLLINATIONS_API_KEY ? new OpenAI({ apiKey: POLLINATIONS_API_KEY, baseURL: 'https://gen.pollinations.ai/v1' }) : null;");
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
  if (!imageClient) return res.status(503).json({ error: 'Görsel servisi henüz bağlanmadı. Railway ortamına POLLINATIONS_API_KEY eklenmesi gerekiyor.' });
  const prompt = String(req.body?.prompt || '').trim().slice(0, 12000);
  const imageData = String(req.body?.image_data || '').trim();
  const separator = imageData.indexOf(',');
  const header = separator > 0 ? imageData.slice(0, separator) : '';
  const payload = separator > 0 ? imageData.slice(separator + 1) : '';
  const allowedHeader = header === 'data:image/jpeg;base64' || header === 'data:image/jpg;base64' || header === 'data:image/png;base64' || header === 'data:image/webp;base64';
  if (!prompt) return res.status(400).json({ error: 'İstediğiniz görsel düzenlemesini yazın.' });
  if (!allowedHeader || !payload || !/^[A-Za-z0-9+/=]+$/.test(payload)) return res.status(400).json({ error: 'Görsel geçersiz. JPG, PNG veya WEBP kullanın.' });
  if (imageData.length > 7000000) return res.status(400).json({ error: 'Görsel çok büyük. Daha küçük bir görsel seçin.' });
  const IMAGE_EDIT_COST = 5;
  let reserved = false;
  try {
    await db.tx(async t => {
      const updated = await t.oneOrNone('UPDATE users SET credits=credits-$1 WHERE id=$2 AND credits >= $1 RETURNING credits', [IMAGE_EDIT_COST, req.user_id]);
      if (!updated) throw Object.assign(new Error('INSUFFICIENT_CREDITS'), { status: 402 });
      await t.none('INSERT INTO credit_ledger(user_id,amount,reason) VALUES($1,$2,$3)', [req.user_id, -IMAGE_EDIT_COST, 'AI image edit']);
      reserved = true;
    });
    const mime = header.slice(5, header.indexOf(';')) || 'image/png';
    const imageFile = await toFile(Buffer.from(payload, 'base64'), 'upload.' + (mime.split('/')[1] || 'png'), { type: mime });
    const response = await imageClient.images.edit({
      model: 'openai/gpt-image-2',
      image: imageFile,
      prompt: 'Edit this image according to the following instruction: ' + prompt + '. Preserve identity, face, composition, camera perspective, lighting, background, clothing, and every detail that was not explicitly requested to change. Make only the requested changes and keep the result photorealistic and natural.',
      size: 'auto',
      quality: 'medium',
      response_format: 'b64_json'
    });
    const b64 = response?.data?.[0]?.b64_json;
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
    if (message.includes('quota') || message.includes('billing') || message.includes('credit') || message.includes('401') || message.includes('403')) return res.status(503).json({ error: 'Pollinations görsel servisi anahtarı veya kullanım bakiyesi kontrol edilmeli.' });
    return res.status(502).json({ error: 'Görsel düzenleme servisi yanıt vermedi. Lütfen tekrar deneyin.' });
  }
});
`;
  const anchor = 'app.use(csrfProtection);';
  if (server.includes(anchor)) server = server.replace(anchor, anchor + imageEditRoute);
}

fs.writeFileSync(serverFile, server);

if (!server.includes("app.post('/api/image-generate'")) {
  const imageGenerateRoute = "\napp.post('/api/image-generate', auth, rateLimit({ windowMs: 60000, max: 6, scope: 'image-generate', getKey: req => 'user:' + req.user_id }), async (req, res) => {\n  if (!sameOrigin(req)) return res.status(403).json({ error: 'Origin not allowed.' });\n  const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();\n  const apiToken = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();\n  if (!accountId || !apiToken) return res.status(503).json({ error: 'خدمة إنشاء الصور المجانية لم تُربط بعد. يلزم إعداد Cloudflare على الخادم.' });\n  const prompt = String(req.body?.prompt || '').trim().slice(0, 2000);\n  if (!prompt) return res.status(400).json({ error: 'Lütfen oluşturulacak görseli tarif edin.' });\n  const cost = 5;\n  let reserved = false;\n  try {\n    await db.tx(async t => {\n      const updated = await t.oneOrNone('UPDATE users SET credits=credits-$1 WHERE id=$2 AND credits >= $1 RETURNING credits', [cost, req.user_id]);\n      if (!updated) throw Object.assign(new Error('INSUFFICIENT_CREDITS'), { status: 402 });\n      await t.none('INSERT INTO credit_ledger(user_id,amount,reason) VALUES($1,$2,$3)', [req.user_id, -cost, 'AI image generation']);\n      reserved = true;\n    });\n    const cfResponse = await fetch('https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(accountId) + '/ai/run/@cf/black-forest-labs/flux-1-schnell', {\n      method: 'POST',\n      headers: { 'Authorization': 'Bearer ' + apiToken, 'Content-Type': 'application/json' },\n      body: JSON.stringify({ prompt, steps: 4 })\n    });\n    const providerData = await cfResponse.json().catch(() => ({}));\n    if (!cfResponse.ok || providerData?.success === false) {\n      const providerError = new Error('CLOUDFLARE_IMAGE_PROVIDER_ERROR');\n      providerError.status = cfResponse.status;\n      throw providerError;\n    }\n    const b64 = providerData?.result?.image || providerData?.image;\n    if (!b64 || typeof b64 !== 'string') throw new Error('EMPTY_IMAGE_RESULT');\n    const balance = await db.one('SELECT credits FROM users WHERE id=$1', [req.user_id]);\n    reserved = false;\n    return res.json({ ok: true, image: 'data:image/jpeg;base64,' + b64, credits: balance.credits, cost });\n  } catch (error) {\n    if (reserved) {\n      try {\n        await db.tx(async t => {\n          await t.none('UPDATE users SET credits=credits+$1 WHERE id=$2', [cost, req.user_id]);\n          await t.none('INSERT INTO credit_ledger(user_id,amount,reason) VALUES($1,$2,$3)', [cost, req.user_id, 'AI image generation refund']);\n        });\n      } catch (refundError) { console.error('Image generation refund failed:', refundError); }\n    }\n    console.error('IMAGE_GENERATE_ERROR', { status: error?.status, code: error?.code, name: error?.name });\n    if (error?.status === 402) return res.status(402).json({ error: 'Yeterli kredi yok. Görsel oluşturma 5 kredi kullanır.' });\n    if (error?.status === 429) return res.status(429).json({ error: 'Günlük ücretsiz görsel oluşturma sınırı doldu veya servis yoğun. Daha sonra tekrar deneyin.' });\n    if (error?.status === 401 || error?.status === 403) return res.status(503).json({ error: 'Cloudflare bağlantı ayarları kontrol edilmeli.' });\n    return res.status(502).json({ error: 'Görsel oluşturma başarısız. Lütfen tekrar deneyin.' });\n  }\n});\n";
  const routeAnchor = 'app.use(csrfProtection);';
  if (server.includes(routeAnchor)) server = server.replace(routeAnchor, routeAnchor + imageGenerateRoute);
}


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
    let generateButton = document.getElementById('starVisibleGenerateButton');
    if (!generateButton) {
      generateButton = document.createElement('button');
      generateButton.type = 'button';
      generateButton.id = 'starVisibleGenerateButton';
      generateButton.textContent = '🖼️ Görsel oluştur';
      generateButton.className = 'star-quick-tool';
      generateButton.setAttribute('aria-label', 'Görsel oluştur');
      generateButton.style.cssText = 'display:flex!important;visibility:visible!important;opacity:1!important;position:relative!important;z-index:99!important;align-items:center;justify-content:center;margin:8px 0;padding:10px 14px;min-height:40px;border-radius:12px;border:1px solid #9564ff;background:#36205f;color:#fff;font-size:13px;font-weight:700;cursor:pointer;width:max-content;max-width:100%;';
      form.parentElement.insertBefore(generateButton, form);
    }
    if (!generateButton.dataset.starBound) {
      generateButton.dataset.starBound = '1';
      generateButton.addEventListener('click', function () {
        imageMode = 'generate';
        tools.querySelectorAll('[data-mode]').forEach(function (b) { b.classList.toggle('active', b.dataset.mode === 'generate'); });
        input.placeholder = 'Görseli tarif edin...';
        input.focus();
      });
    }
    const style = document.createElement('style');
    style.textContent = '.star-image-tools{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}.star-image-tool,.star-quick-tool{border:1px solid rgba(168,85,247,.28);background:rgba(124,60,255,.10);color:#cfc3ff;border-radius:10px;padding:6px 9px;font-size:11px;font-weight:700;cursor:pointer;transition:.18s ease}.star-image-tool.active,.star-image-tool:hover,.star-quick-tool:hover{background:rgba(124,60,255,.28);color:#fff;border-color:rgba(183,135,255,.5);transform:translateY(-1px)}.star-quick-tools{width:min(920px,100%);margin:0 auto 8px;display:flex;gap:7px;overflow-x:auto;scrollbar-width:none}.star-quick-tools::-webkit-scrollbar{display:none}.star-result-label{font-size:11px;color:#8f879e;margin-bottom:8px;font-weight:700}.star-error{color:#ffb7c1!important;background:rgba(244,63,94,.08)!important;border-color:rgba(244,63,94,.25)!important}.dashboard-page #message{font-family:var(--star-font);letter-spacing:-.01em}';
    document.head.appendChild(style);
    const tools = document.createElement('div');
    tools.className = 'star-image-tools';
    tools.innerHTML = '<button type="button" class="star-image-tool active" data-mode="edit">✦ Görseli düzenle</button><button type="button" class="star-image-tool" data-mode="generate">✧ Görsel oluştur</button><button type="button" class="star-image-tool" data-mode="analyze">◉ Görsel analizi</button>';
    info.appendChild(tools);
    tools.querySelectorAll('[data-mode]').forEach(function (button) { button.addEventListener('click', function () { imageMode = button.dataset.mode; tools.querySelectorAll('[data-mode]').forEach(function (b) { b.classList.toggle('active', b === button); }); }); });
    const composerWrap = form.parentElement;
    const quick = document.createElement('div');
    quick.className = 'star-quick-tools';
    quick.innerHTML = '<button type="button" class="star-quick-tool" data-star-create-image>🖼️ Görsel oluştur</button><button type="button" class="star-quick-tool">✨ Metni iyileştir</button><button type="button" class="star-quick-tool">💡 Fikirler</button><button type="button" class="star-quick-tool">📝 Özetle</button><button type="button" class="star-quick-tool">🌐 Çevir</button>';
    composerWrap.insertBefore(quick, preview);
    quick.querySelectorAll('button').forEach(function (button) { button.addEventListener('click', function () { const label = button.textContent || ''; if (button.hasAttribute('data-star-create-image')) { imageMode = 'generate'; tools.querySelectorAll('[data-mode]').forEach(function (b) { b.classList.toggle('active', b.dataset.mode === 'generate'); }); input.placeholder = 'Görseli tarif edin (ör. fütüristik ejderha, sinematik ışık)...'; input.focus(); return; } const prompts = {'✨ Metni iyileştir':'Aşağıdaki metni anlamını koruyarak daha açık, akıcı ve profesyonel hale getir:','💡 Fikirler':'Şu konu hakkında pratik ve yaratıcı fikirler öner:','📝 Özetle':'Aşağıdaki metni açık ve kısa maddeler halinde özetle:','🌐 Çevir':'Aşağıdaki metni doğal ve doğru bir şekilde Türkçeye çevir:'}; input.value = (prompts[label] || '') + (input.value ? ' ' + input.value : ''); input.focus(); }); });
    function setCredits(value) { if (credits && value !== undefined) credits.textContent = String(value); if (creditsSide && value !== undefined) creditsSide.textContent = String(value); }
    function readFile(file) { return new Promise(function (resolve, reject) { const reader = new FileReader(); reader.onload = function () { resolve(String(reader.result || '')); }; reader.onerror = reject; reader.readAsDataURL(file); }); }
    function addResult(imageUrl, prompt) { const box = document.createElement('div'); box.className = 'msg ai'; const label = document.createElement('div'); label.className = 'star-result-label'; label.textContent = '✧ Görsel oluşturuldu'; const image = document.createElement('img'); image.className = 'message-image'; image.src = imageUrl; image.alt = prompt || 'Düzenlenmiş görsel'; box.appendChild(label); box.appendChild(image); messages.appendChild(box); const scroller = document.getElementById('messages'); if (scroller) scroller.scrollTop = scroller.scrollHeight; }
    function showError(text) { const box = document.createElement('div'); box.className = 'msg ai star-error'; box.textContent = text; messages.appendChild(box); const scroller = document.getElementById('messages'); if (scroller) scroller.scrollTop = scroller.scrollHeight; }
    form.addEventListener('submit', async function (event) {
      if (imageMode !== 'generate') return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (sendButton) sendButton.disabled = true;
      const prompt = String(input.value || '').trim();
      if (!prompt) { showError('Önce oluşturmak istediğiniz görseli tarif edin.'); if (sendButton) sendButton.disabled = false; input.focus(); return; }
      try {
        const response = await fetch('/api/image-generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ prompt }) });
        const data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.error || ('Görsel oluşturma başarısız oldu (' + response.status + ')'));
        if (!data.image) throw new Error('Görsel oluşturma sunucusundan sonuç alınamadı.');
        addResult(data.image, prompt);
        if (data.credits !== undefined) setCredits(data.credits);
        input.value = ''; if (preview) preview.classList.remove('open');
      } catch (error) { showError(String(error && error.message ? error.message : 'Görsel oluşturma hizmetine bağlanılamadı.')); }
      finally { if (sendButton) sendButton.disabled = false; }
    }, true);
    form.addEventListener('submit', async function (event) {
      if (imageMode !== 'edit' || !fileInput.files || !fileInput.files[0]) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (sendButton) sendButton.disabled = true;
      const file = fileInput.files[0];
      const prompt = String(input.value || '').trim();
      if (!prompt) { showError('Önce görselde neyi değiştirmek istediğinizi yazın. Örneğin: Kasları doğal görünecek şekilde belirginleştirirken yüzü ve arka planı koru.'); if (sendButton) sendButton.disabled = false; input.focus(); return; }
      try {
        const imageData = await readFile(file);
        const userBox = document.createElement('div'); userBox.className = 'msg user';
        const thumb = document.createElement('img'); thumb.className = 'message-image'; thumb.src = imageData; userBox.appendChild(thumb);
        const caption = document.createElement('div'); caption.textContent = prompt; userBox.appendChild(caption); messages.appendChild(userBox);
        const response = await fetch('/api/image-edit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ image_data: imageData, prompt: prompt }) });
        const data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.error || ('Görsel düzenleme başarısız oldu (' + response.status + ')'));
        if (!data.image) throw new Error('Düzenleme sunucusundan görsel alınamadı.');
        addResult(data.image, prompt);
        if (data.credits !== undefined) setCredits(data.credits);
        input.value = ''; fileInput.value = ''; if (preview) preview.classList.remove('open');
      } catch (error) { showError(String(error && error.message ? error.message : 'Görsel düzenleme hizmetine bağlanılamadı.')); }
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
