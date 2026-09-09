import fs from 'node:fs';

const serverFile = new URL('./server.js', import.meta.url);
const dashboardFile = new URL('./dashboard.html', import.meta.url);
let server = fs.readFileSync(serverFile, 'utf8');

if (!server.includes("app.post('/api/image-analyze'")) {
  const route = String.raw`

app.post('/api/image-analyze', auth, rateLimit({ windowMs: 60000, max: 10, scope: 'image-analyze', getKey: req => 'user:' + req.user_id }), async (req, res) => {
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Origin not allowed.' });
  if (!openai) return res.status(503).json({ error: 'AI image service is not configured.' });
  const imageData = String(req.body?.image_data || '').trim();
  const question = String(req.body?.question || '').trim().slice(0, 8000);
  const separator = imageData.indexOf(',');
  const header = separator > 0 ? imageData.slice(0, separator) : '';
  const payload = separator > 0 ? imageData.slice(separator + 1) : '';
  const allowedHeader = ['data:image/jpeg;base64', 'data:image/jpg;base64', 'data:image/png;base64', 'data:image/webp;base64'].includes(header);
  if (!allowedHeader || !payload || !/^[A-Za-z0-9+/=]+$/.test(payload)) return res.status(400).json({ error: 'Görsel geçersiz. JPG, PNG veya WEBP kullanın.' });
  if (imageData.length > 7000000) return res.status(400).json({ error: 'Görsel çok büyük. Daha küçük bir görsel seçin.' });
  const ANALYZE_COST = 2;
  let reserved = false;
  try {
    await db.tx(async t => {
      const updated = await t.oneOrNone('UPDATE users SET credits=credits-$1 WHERE id=$2 AND credits >= $1 RETURNING credits', [ANALYZE_COST, req.user_id]);
      if (!updated) throw Object.assign(new Error('INSUFFICIENT_CREDITS'), { status: 402 });
      await t.none('INSERT INTO credit_ledger(user_id,amount,reason) VALUES($1,$2,$3)', [req.user_id, -ANALYZE_COST, 'AI image analysis']);
      reserved = true;
    });
    const response = await openai.responses.create({
      model: 'gpt-5.6-luna',
      input: [{ role: 'user', content: [
        { type: 'input_text', text: question || 'حلل هذه الصورة بدقة. صف العناصر المهمة، النصوص الظاهرة، المشهد، الألوان، التفاصيل البصرية، وأي ملاحظات مفيدة. لا تدّعِ معرفة هوية الأشخاص في الصورة.' },
        { type: 'input_image', image_url: imageData }
      ]}],
      max_output_tokens: 1200
    });
    const answer = String(response?.output_text || '').trim();
    if (!answer) throw new Error('EMPTY_IMAGE_ANALYSIS');
    const credits = await db.one('SELECT credits FROM users WHERE id=$1', [req.user_id]);
    reserved = false;
    return res.json({ ok: true, answer, credits: credits.credits, cost: ANALYZE_COST });
  } catch (error) {
    if (reserved) {
      try {
        await db.tx(async t => {
          await t.none('UPDATE users SET credits=credits+$1 WHERE id=$2', [ANALYZE_COST, req.user_id]);
          await t.none('INSERT INTO credit_ledger(user_id,amount,reason) VALUES($1,$2,$3)', [req.user_id, ANALYZE_COST, 'AI image analysis refund']);
        });
      } catch (refundError) { console.error('Image analysis credit refund failed:', refundError); }
    }
    console.error('IMAGE_ANALYZE_ERROR', { name: error?.name, message: error?.message, status: error?.status, code: error?.code, type: error?.type });
    if (error?.status === 402) return res.status(402).json({ error: 'Yeterli Credits bulunmuyor. Görsel analizi 2 kredi kullanır.' });
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('safety') || message.includes('content') || message.includes('policy')) return res.status(400).json({ error: 'Bu görsel güvenlik kuralları nedeniyle analiz edilemedi.' });
    if (message.includes('quota') || message.includes('billing') || message.includes('credit')) return res.status(503).json({ error: 'OpenAI görsel servisi için bakiye/kullanım limiti yetersiz.' });
    return res.status(502).json({ error: 'Görsel analiz servisi yanıt vermedi. Lütfen tekrar deneyin.' });
  }
});
`;
  const anchor = 'app.use(csrfProtection);';
  if (server.includes(anchor)) server = server.replace(anchor, anchor + route);
  fs.writeFileSync(serverFile, server);
}

let dashboard = fs.readFileSync(dashboardFile, 'utf8');
if (!dashboard.includes('STAR_AI_IMAGE_ANALYZE_UI_V1')) {
  const script = String.raw`
<script data-star-image-analyze="STAR_AI_IMAGE_ANALYZE_UI_V1">
(() => {
  function init() {
    const form = document.getElementById('chat');
    const input = document.getElementById('message');
    const fileInput = document.getElementById('imageInput');
    const messages = document.getElementById('messagesInner');
    const send = document.getElementById('sendButton');
    if (!form || !input || !fileInput || !messages || !send) return;
    const readFile = file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = reject; reader.readAsDataURL(file); });
    const append = (text, kind = 'ai') => { const box = document.createElement('div'); box.className = 'msg ' + kind; box.textContent = text; messages.appendChild(box); const scroller = document.getElementById('messages'); if (scroller) scroller.scrollTop = scroller.scrollHeight; };
    form.addEventListener('submit', async event => {
      const analyzeButton = document.querySelector('.star-image-tool[data-mode="analyze"]');
      if (!fileInput.files?.[0] || !analyzeButton?.classList.contains('active')) return;
      event.preventDefault(); event.stopImmediatePropagation();
      send.disabled = true;
      try {
        const file = fileInput.files[0];
        const imageData = await readFile(file);
        const question = String(input.value || '').trim();
        const response = await fetch('/api/image-analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ image_data: imageData, question }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || ('Görsel analizi başarısız oldu (' + response.status + ')'));
        const userBox = document.createElement('div'); userBox.className = 'msg user'; const img = document.createElement('img'); img.className = 'message-image'; img.src = imageData; userBox.appendChild(img); if (question) { const caption = document.createElement('div'); caption.textContent = question; userBox.appendChild(caption); } messages.appendChild(userBox);
        append(data.answer || 'Görsel analiz edildi.');
        if (data.credits !== undefined) { const c = document.getElementById('credits'); const cs = document.getElementById('creditsSide'); if (c) c.textContent = data.credits; if (cs) cs.textContent = data.credits; }
        input.value = ''; fileInput.value = ''; const preview = document.getElementById('imagePreview'); if (preview) preview.classList.remove('open');
      } catch (error) { append(String(error?.message || 'Görsel analiz hizmetine bağlanılamadı.'), 'ai star-error'); }
      finally { send.disabled = false; }
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
</script>`;
  dashboard = dashboard.replace('</body>', script + '\n</body>', 1);
  fs.writeFileSync(dashboardFile, dashboard);
}
console.log('STAR AI image analysis enabled.');
