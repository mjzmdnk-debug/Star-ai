import fs from 'node:fs';

const serverFile = new URL('./server.js', import.meta.url);
let server = fs.readFileSync(serverFile, 'utf8');

const hasResponsesResearch = server.includes('STAR_AI_WEB_RESEARCH_V3') && server.includes("type: 'web_search'") && server.includes('needsWebResearch');
if (!hasResponsesResearch) {
  const start = server.indexOf("app.post('/api/chat'");
  const end = server.indexOf("\napp.get('/api/admin/overview'", start);
  if (start < 0 || end < 0) throw new Error('STAR_AI_WEB_RESEARCH_V3: chat endpoint boundaries not found');

  let endpoint = server.slice(start, end);
  const oldCreate = `    const completion = await openai.chat.completions.create({\n      model,\n      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history, { role: 'user', content: message }],\n      temperature,\n      max_tokens: maxTokens\n    });\n    const answer = String(completion.choices?.[0]?.message?.content || '').trim();\n    if (!answer) throw new Error('Empty AI response');`;

  const newCreate = `    const researchText = String(message || '').toLowerCase();\n    const needsWebResearch = /(güncel|bugün|şimdi|son dakika|son gelişme|en son|2026|haber|fiyat|kur|borsa|piyasa|maç|skor|takvim|araştır|araştırma|bilimsel|makale|çalışma|kaynak|istatistik|veri|آخر|اليوم|الآن|حديث|أحدث|أخبار|سعر|بحث|دراسة|مصادر|إحصائيات|نتائج|مصدر|علمي|مقال|أسعار|سوق|مباراة|ترتيب|إحصاءات|current|today|latest|recent|news|price|market|research|study|paper|source|statistics)/i.test(researchText);\n    const input = [...history, { role: 'user', content: message }];\n    const response = await openai.responses.create({\n      model,\n      instructions: needsWebResearch ? [SYSTEM_PROMPT, 'Bu istek güncel veya doğrulanması gereken bir araştırma isteğidir. Web aramasını aktif biçimde kullan; mümkünse birden fazla güvenilir kaynağı karşılaştır, birincil ve resmi kaynakları önceliklendir, tarihleri kontrol et ve bulguları kaynaklara dayalı şekilde sentezle. Kaynaklarda çelişki varsa bunu açıkça belirt.'].join(' ') : SYSTEM_PROMPT,\n      input,\n      ...(needsWebResearch ? { tools: [{ type: 'web_search', search_context_size: 'high' }], include: ['web_search_call.action.sources'], tool_choice: { type: 'web_search' } } : {}),\n      max_output_tokens: Math.min(Math.max(Number(maxTokens) || 1800, 256), 4000)\n    });\n    let answer = String(response?.output_text || '').trim();\n    if (!answer) throw new Error('Empty AI response');\n\n    const sourceMap = new Map();\n    const addSource = (url, title) => {\n      const cleanUrl = String(url || '').trim();\n      if (!/^https?:\\/\\//i.test(cleanUrl) || sourceMap.has(cleanUrl)) return;\n      sourceMap.set(cleanUrl, String(title || cleanUrl).trim());\n    };\n    for (const item of (response?.output || [])) {\n      for (const source of (item?.action?.sources || [])) addSource(source?.url, source?.title);\n      for (const part of (item?.content || [])) {\n        for (const annotation of (part?.annotations || [])) {\n          if (annotation?.type === 'url_citation') addSource(annotation?.url, annotation?.title);\n        }\n      }\n    }\n    if (sourceMap.size) {\n      const sourceLines = [...sourceMap.entries()].slice(0, 8).map(([url, title], index) => (index + 1) + '. ' + title + '\\n   ' + url);\n      answer += '\\n\\n### Kaynaklar\\n' + sourceLines.join('\\n');\n    }`;

  if (endpoint.includes(oldCreate)) {
    endpoint = endpoint.replace(oldCreate, newCreate);
  } else if (!endpoint.includes('openai.responses.create')) {
    throw new Error('STAR_AI_WEB_RESEARCH_V3: unsupported chat endpoint shape');
  }

  if (!endpoint.includes("type: 'web_search'")) throw new Error('STAR_AI_WEB_RESEARCH_V3: web search injection failed');
  if (!endpoint.includes('needsWebResearch')) throw new Error('STAR_AI_WEB_RESEARCH_V3: research detection injection failed');

  server = server.slice(0, start) + endpoint + server.slice(end);
  if (!server.includes('// STAR_AI_WEB_RESEARCH_V3')) {
    server = server.replace('// STAR_AI_PRO_ENGINE_V3', '// STAR_AI_PRO_ENGINE_V3\n// STAR_AI_WEB_RESEARCH_V3');
  }
  fs.writeFileSync(serverFile, server);
  console.log('STAR AI live web research engine v3 enabled.');
}
