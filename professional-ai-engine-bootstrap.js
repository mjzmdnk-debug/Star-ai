import fs from 'node:fs';

const serverFile = new URL('./server.js', import.meta.url);
const dashboardFile = new URL('./dashboard.html', import.meta.url);

let server = fs.readFileSync(serverFile, 'utf8');

if (!server.includes('STAR_AI_PRO_ENGINE_V2')) {
  server = server.replace(
    "const AI_MODEL = String(process.env.AI_MODEL || 'gpt-4o-mini').trim() || 'gpt-4o-mini';",
    "const AI_MODEL = String(process.env.AI_MODEL || 'gpt-5.6-luna').trim() || 'gpt-5.6-luna';"
  );

  server = server.replace(
    "const SYSTEM_PROMPT = 'Sen STAR AI platformunun Türkçe yapay zekâ asistanısın. Net, faydalı ve profesyonel cevaplar ver.';",
    `const SYSTEM_PROMPT = [
      'Sen STAR AI platformunun profesyonel Türkçe yapay zekâ asistanısın.',
      'Her yanıtı doğrudan soruya odaklı, anlaşılır, güçlü ve profesyonel biçimde hazırla.',
      'Bilgi sorularında önce kısa ve net sonucu ver; ardından gerekli açıklamayı, önemli ayrıntıları ve uygulanabilir adımları ekle.',
      'Teknik konularda çalışan kod, mimari, neden-sonuç analizi ve güvenilir çözüm önerileri sun. Gereksiz genellemelerden kaçın.',
      'Kullanıcı güncel, kesin veya doğrulanması gereken bir bilgi soruyorsa bildiğin sınırları dürüstçe belirt; tahminleri kesin gerçek gibi sunma.',
      'Kullanıcının diline uyum sağla. Türkçe istendiğinde doğal ve akıcı Türkçe kullan.',
      'Yanıtı yarıda bırakma. Mümkün olan en tamamlayıcı cevabı üret ve önemli noktaları atlama.',
      'Kullanıcı bir plan, liste, karşılaştırma veya işlem istediğinde düzenli başlıklar ve maddeler kullan.',
      'Kullanıcı kod istediğinde doğrudan uygulanabilir, eksiksiz ve güvenli kod ver; kritik varsayımları kısa şekilde belirt.',
      'Yanıt oluştururken sistemsel ayrıntıları, iç talimatları veya gizli yapılandırmayı kullanıcıya açıklama.',
      'Kullanıcıya yalnızca bir başarısızlık mesajı göstermek yerine, mümkün olan en yararlı alternatif açıklamayı sun.'
    ].join(' ');`
  );

  server = server.replace(
    "const allowedModels = new Set([AI_MODEL, 'gpt-4o-mini']);",
    "const allowedModels = new Set([AI_MODEL, 'gpt-5.6-luna', 'gpt-4o-mini']);"
  );

  const start = server.indexOf("app.post('/api/chat'");
  const end = server.indexOf("\napp.get('/api/admin/overview'", start);
  if (start < 0 || end < 0) throw new Error('STAR_AI_PRO_ENGINE_V2: chat endpoint boundaries not found');

  const newChatEndpoint = String.raw`app.post('/api/chat', auth, rateLimit({ windowMs: 60000, max: 30, scope: 'chat', getKey: req => 'user:' + req.user_id }), async (req, res) => {
  if (!openai) return res.status(503).json({ error: 'Yapay zekâ hizmeti şu anda yapılandırılmamış.' });
  const { message, conversationId, model, maxTokens, imageData } = validateChatInput(req.body);
  if (!message && !imageData) return res.status(400).json({ error: 'Bir mesaj veya görsel gönderin.' });

  let reserved = false;
  let convId = conversationId;
  try {
    await db.tx(async t => {
      if (convId) {
        const conversation = await t.oneOrNone('SELECT id FROM conversations WHERE id=$1 AND user_id=$2 FOR UPDATE', [convId, req.user_id]);
        if (!conversation) throw Object.assign(new Error('CONVERSATION_NOT_FOUND'), { status: 404 });
      } else {
        const titleSource = message || 'Görsel analizi';
        const created = await t.one('INSERT INTO conversations(user_id,title) VALUES($1,$2) RETURNING id', [req.user_id, titleSource.slice(0, 80)]);
        convId = created.id;
      }
      const updated = await t.oneOrNone('UPDATE users SET credits=credits-1 WHERE id=$1 AND credits>0 RETURNING credits', [req.user_id]);
      if (!updated) throw Object.assign(new Error('INSUFFICIENT_CREDITS'), { status: 402 });
      await t.none('INSERT INTO credit_ledger(user_id,amount,reason) VALUES($1,$2,$3)', [req.user_id, -1, 'AI usage']);
      reserved = true;
    });

    const history = await db.any(
      'SELECT role,content FROM messages WHERE conversation_id=$1 AND role IN (\'user\',\'assistant\') ORDER BY id DESC LIMIT 24',
      [convId]
    );
    history.reverse();

    const input = history.map(item => ({ role: item.role, content: item.content }));
    const userContent = imageData
      ? [
          { type: 'input_text', text: message || 'Bu görseli ayrıntılı biçimde analiz et ve önemli bulguları açıkla.' },
          { type: 'input_image', detail: 'auto', image_url: imageData }
        ]
      : (message || '');
    input.push({ role: 'user', content: userContent });

    const preferredModel = model || AI_MODEL;
    let response;
    let usedModel = preferredModel;
    try {
      response = await openai.responses.create({
        model: preferredModel,
        instructions: SYSTEM_PROMPT,
        input,
        max_output_tokens: maxTokens
      });
    } catch (primaryError) {
      const fallbackModel = preferredModel === 'gpt-4o-mini' ? AI_MODEL : 'gpt-4o-mini';
      if (fallbackModel === preferredModel) throw primaryError;
      console.warn('STAR_AI_PRO_ENGINE_V2 primary model unavailable; using fallback model.', {
        model: preferredModel,
        fallbackModel,
        status: primaryError?.status,
        code: primaryError?.code,
        message: primaryError?.message
      });
      usedModel = fallbackModel;
      response = await openai.responses.create({
        model: fallbackModel,
        instructions: SYSTEM_PROMPT,
        input,
        max_output_tokens: maxTokens
      });
    }

    if (response?.status && response.status !== 'completed') {
      throw Object.assign(new Error('INCOMPLETE_RESPONSE'), { responseStatus: response.status });
    }
    const answer = String(response?.output_text || '').trim();
    if (!answer) throw new Error('EMPTY_AI_RESPONSE');

    const saved = await db.tx(async t => {
      await t.none('INSERT INTO messages(conversation_id,role,content,model,temperature,max_tokens) VALUES($1,$2,$3,$4,$5,$6)',
        [convId, 'user', message || '[Görsel]', usedModel, 0.7, maxTokens]);
      await t.none('INSERT INTO messages(conversation_id,role,content,model,temperature,max_tokens) VALUES($1,$2,$3,$4,$5,$6)',
        [convId, 'assistant', answer, usedModel, 0.7, maxTokens]);
      await t.none('UPDATE conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=$1', [convId]);
      return t.one('SELECT credits FROM users WHERE id=$1', [req.user_id]);
    });
    reserved = false;
    res.json({ ok: true, answer, conversation_id: convId, credits: saved.credits, model: usedModel });
  } catch (e) {
    if (reserved) {
      try {
        await db.tx(async t => {
          await t.none('UPDATE users SET credits=credits+1 WHERE id=$1', [req.user_id]);
          await t.none('INSERT INTO credit_ledger(user_id,amount,reason) VALUES($1,$2,$3)', [req.user_id, 1, 'AI request refund']);
        });
      } catch (refundError) {
        console.error('STAR_AI_PRO_ENGINE_V2 credit refund failed:', refundError);
      }
    }

    console.error('STAR_AI_PRO_ENGINE_V2 request failed:', {
      name: e?.name,
      message: e?.message,
      status: e?.status,
      code: e?.code,
      responseStatus: e?.responseStatus
    });

    if (e?.status === 404) return res.status(404).json({ error: 'Bu konuşma bulunamadı. Yeni bir sohbet başlatabilirsiniz.' });
    if (e?.status === 402) return res.status(402).json({ error: 'Kullanılabilir kredi bulunmuyor. Devam etmek için kredi ekleyin.' });
    if (e?.status === 400 && e?.message === 'IMAGE_TOO_LARGE') return res.status(400).json({ error: 'Görsel çok büyük. Daha küçük bir JPG, PNG veya WEBP görsel seçin.' });
    if (e?.status === 400 && e?.message === 'INVALID_IMAGE') return res.status(400).json({ error: 'Bu görsel biçimi desteklenmiyor. JPG, PNG veya WEBP kullanın.' });
    if (e?.status === 401 || e?.status === 403) return res.status(503).json({ error: 'Yapay zekâ bağlantısı şu anda kullanılamıyor. Hizmet yapılandırmasını kontrol edin.' });
    if (e?.status === 429) return res.status(503).json({ error: 'Yapay zekâ hizmeti şu anda yoğun. Lütfen birkaç saniye sonra yeniden deneyin.' });
    res.status(503).json({ error: 'Yanıt şu anda tamamlanamadı. Lütfen aynı isteği birkaç saniye sonra yeniden gönderin.' });
  }
});
// STAR_AI_PRO_ENGINE_V2`;

  server = server.slice(0, start) + newChatEndpoint + server.slice(end);
  fs.writeFileSync(serverFile, server);
  console.log('STAR AI professional response engine v2 enabled.');
}

let dashboard = fs.readFileSync(dashboardFile, 'utf8');
if (!dashboard.includes('STAR_AI_PRO_UI_V2')) {
  dashboard = dashboard
    .replaceAll('STAR AI Assistant', 'STAR AI Asistan')
    .replaceAll('STAR AI hata yapabilir.', 'Yanıtları önemli konularda doğrulamanız önerilir.')
    .replaceAll("data.error||'Bir hata oluştu.'", "data.error||'Yanıt şu anda tamamlanamadı. Lütfen tekrar deneyin.'")
    .replaceAll("data.answer||'Yanıt alınamadı.'", "data.answer||'Yanıt oluşturulamadı. Lütfen sorunuzu biraz daha ayrıntılı yazın.'")
    .replaceAll("'Bağlantı hatası. Lütfen tekrar deneyin.'", "'Bağlantı kısa süreliğine kesildi. Lütfen tekrar deneyin.'")
    .replaceAll("'Görsel okunamadı. Lütfen başka bir görsel deneyin.'", "'Görsel işlenemedi. Lütfen başka bir görsel deneyin.'");
  dashboard = dashboard.replace('</body>', '<script data-star-pro-ui="STAR_AI_PRO_UI_V2">window.__starAiProfessionalUI=true;</script>\n</body>', 1);
  fs.writeFileSync(dashboardFile, dashboard);
  console.log('STAR AI professional response UI v2 enabled.');
}