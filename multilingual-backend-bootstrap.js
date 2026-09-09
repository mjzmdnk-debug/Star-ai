import fs from 'node:fs';

const serverFile = new URL('./server.js', import.meta.url);
let server = fs.readFileSync(serverFile, 'utf8');

if (!server.includes('STAR_AI_MULTILINGUAL_BACKEND_V1')) {
  const marker = '// STAR_AI_MULTILINGUAL_BACKEND_V1';
  const helper = `

${marker}
function normalizeLanguage(value) {
  const language = String(value || '').trim().toLowerCase().split('-')[0];
  return ['tr', 'en', 'ar'].includes(language) ? language : 'tr';
}
function localizedSystemPrompt(language) {
  const lang = normalizeLanguage(language);
  if (lang === 'ar') return 'أنت مساعد STAR AI. أجب باللغة العربية عندما يختار المستخدم العربية أو يكتب بالعربية. كن واضحًا ومفيدًا ومحترفًا، ولا تدّعِ معرفة هوية الأشخاص في الصور.';
  if (lang === 'en') return 'You are the STAR AI assistant. Reply in English when the user selects English or writes in English. Be clear, useful, and professional, and do not claim to know the identity of people in images.';
  return 'Sen STAR AI platformunun Türkçe yapay zekâ asistanısın. Kullanıcı Türkçe seçtiğinde veya Türkçe yazdığında Türkçe yanıt ver. Net, faydalı ve profesyonel cevaplar ver; görsellerdeki kişilerin kimliğini bildiğini iddia etme.';
}
`;
  server = server.replace("const SYSTEM_PROMPT = 'Sen STAR AI platformunun Türkçe yapay zekâ asistanısın. Net, faydalı ve profesyonel cevaplar ver.';", "const SYSTEM_PROMPT = 'STAR AI multilingual assistant.';" + helper);
  const oldReturn = "  return { message, conversationId, model, temperature, maxTokens };";
  if (server.includes(oldReturn)) server = server.replace(oldReturn, "  const language = normalizeLanguage(body?.language || body?.lang || 'tr');\n  return { message, conversationId, model, temperature, maxTokens, language };");
  const oldDestructure = 'const { message, conversationId, model, temperature, maxTokens } = validateChatInput(req.body);';
  if (server.includes(oldDestructure)) server = server.replace(oldDestructure, 'const { message, conversationId, model, temperature, maxTokens, language } = validateChatInput(req.body);');
  const oldMessages = 'messages: [{ role: \'system\', content: SYSTEM_PROMPT }, ...history, { role: \'user\', content: message }],';
  if (server.includes(oldMessages)) server = server.replace(oldMessages, 'messages: [{ role: \'system\', content: localizedSystemPrompt(language) }, ...history, { role: \'user\', content: message }],');
  fs.writeFileSync(serverFile, server);
}
console.log('STAR AI multilingual backend enabled.');
