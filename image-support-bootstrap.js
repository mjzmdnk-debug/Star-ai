import fs from 'node:fs';

const file = new URL('./server.js', import.meta.url);
let source = fs.readFileSync(file, 'utf8');

if (!source.includes('const imageData = String(body?.image_data ||')) {
  source = source.replace("app.use(express.json({ limit: '1mb', verify: (req, res, buffer) => { req.rawBody = Buffer.from(buffer); } }));", "app.use(express.json({ limit: '6mb', verify: (req, res, buffer) => { req.rawBody = Buffer.from(buffer); } }));");
  source = source.replace("  const maxTokens = Number.isInteger(requestedMaxTokens) ? Math.min(2000, Math.max(100, requestedMaxTokens)) : 800;\n  return { message, conversationId, model, temperature, maxTokens };", "  const maxTokens = Number.isInteger(requestedMaxTokens) ? Math.min(2000, Math.max(100, requestedMaxTokens)) : 800;\n  const imageData = String(body?.image_data || '').trim();\n  if (imageData && (imageData.length > 4500000 || !/^data:image\\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(imageData))) throw Object.assign(new Error('INVALID_IMAGE'), { status: 400 });\n  return { message, conversationId, model, temperature, maxTokens, imageData };");
  source = source.replace("  const { message, conversationId, model, temperature, maxTokens } = validateChatInput(req.body);\n  if (!message) return res.status(400).json({ error: 'Mesaj gerekli.' });", "  let input;\n  try { input = validateChatInput(req.body); } catch (e) { if (e?.status === 400) return res.status(400).json({ error: 'Görsel geçersiz veya çok büyük.' }); throw e; }\n  const { message, conversationId, model, temperature, maxTokens, imageData } = input;\n  if (!message && !imageData) return res.status(400).json({ error: 'Mesaj veya görsel gerekli.' });");
  source = source.replace("    const completion = await openai.chat.completions.create({\n      model,\n      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history, { role: 'user', content: message }],\n      temperature,\n      max_tokens: maxTokens\n    });", "    const userContent = imageData ? [{ type: 'text', text: message || 'Bu görseli analiz et ve açıkla.' }, { type: 'image_url', image_url: { url: imageData, detail: 'auto' } }] : message;\n    const completion = await openai.chat.completions.create({\n      model,\n      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history, { role: 'user', content: userContent }],\n      temperature,\n      max_tokens: maxTokens\n    });");
  source = source.replace("    const answer = String(completion.choices?.[0]?.message?.content || '').trim();", "    const answer = String(completion.choices?.[0]?.message?.content || '').trim();\n    const savedUserMessage = imageData ? `${message || 'Bu görseli analiz et.'}\\n[📷 Görsel eklendi]` : message;");
  source = source.replace("        [convId, 'user', message, model, temperature, maxTokens]);", "        [convId, 'user', savedUserMessage, model, temperature, maxTokens]);");
  source = source.replace("    if (e.status === 404) return res.status(404).json({ error: 'Konuşma bulunamadı.' });", "    if (e.status === 400) return res.status(400).json({ error: 'Görsel veya istek geçersiz.' });\n    if (e.status === 404) return res.status(404).json({ error: 'Konuşma bulunamadı.' });");
  fs.writeFileSync(file, source);
  console.log('STAR AI image support enabled.');
}

await import('./server.js');
