import fs from 'node:fs';

const serverFile = new URL('./server.js', import.meta.url);
const dashboardFile = new URL('./dashboard.html', import.meta.url);

let server = fs.readFileSync(serverFile, 'utf8');

if (!server.includes('STAR_AI_MULTIMODAL_CHAT_V1')) {
  const oldValidate = `  const maxTokens = Number.isInteger(requestedMaxTokens) ? Math.min(2000, Math.max(100, requestedMaxTokens)) : 800;\n  return { message, conversationId, model, temperature, maxTokens };`;
  const newValidate = `  const imageData = String(body?.image_data || '').trim();\n  if (imageData && imageData.length > 7000000) throw Object.assign(new Error('IMAGE_TOO_LARGE'), { status: 400 });\n  if (imageData && !/^data:image\\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(imageData)) throw Object.assign(new Error('INVALID_IMAGE'), { status: 400 });\n  const maxTokens = Number.isInteger(requestedMaxTokens) ? Math.min(3000, Math.max(100, requestedMaxTokens)) : 1000;\n  return { message, conversationId, model, temperature, maxTokens, imageData };`;
  if (server.includes(oldValidate)) server = server.replace(oldValidate, newValidate);

  server = server.replace(
    `const { message, conversationId, model, temperature, maxTokens } = validateChatInput(req.body);`,
    `const { message, conversationId, model, temperature, maxTokens, imageData } = validateChatInput(req.body);`
  );

  const oldCreate = `    const completion = await openai.chat.completions.create({\n      model,\n      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history, { role: 'user', content: message }],\n      temperature,\n      max_tokens: maxTokens\n    });`;
  const newCreate = `    const multimodalMessage = imageData\n      ? { role: 'user', content: [\n          { type: 'text', text: message + '\\n\\nحلّل الصورة المرفقة بدقة واستند إليها في إجابتك. إذا كان المطلوب اقتراح تعديل أو إضافة، اشرح ما يمكن تنفيذه بوضوح ولا تدّعِ أنك عدّلت الصورة ما لم تُستخدم خدمة التعديل.' },\n          { type: 'image_url', image_url: { url: imageData } }\n        ] }\n      : { role: 'user', content: message };\n    const completion = await openai.chat.completions.create({\n      model,\n      messages: [{ role: 'system', content: SYSTEM_PROMPT + ' يمكنك تحليل الصور المرفقة والإجابة عن الأسئلة المتعلقة بها. كن عملياً، دقيقاً، واكتب خطوات واضحة عند طلب التعديل أو الإضافة.' }, ...history, multimodalMessage],\n      temperature,\n      max_tokens: maxTokens\n    });`;
  if (server.includes(oldCreate)) server = server.replace(oldCreate, newCreate);

  server = server.replace(
    `    if (e.status === 404) return res.status(404).json({ error: 'Konuşma bulunamadı.' });\n    if (e.status === 402) return res.status(402).json({ error: 'Yeterli Credits bulunmuyor.' });`,
    `    if (e.status === 400 && e.message === 'IMAGE_TOO_LARGE') return res.status(400).json({ error: 'الصورة كبيرة جداً. اختر صورة أصغر.' });\n    if (e.status === 400 && e.message === 'INVALID_IMAGE') return res.status(400).json({ error: 'صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WEBP.' });\n    if (e.status === 404) return res.status(404).json({ error: 'Konuşma bulunamadı.' });\n    if (e.status === 402) return res.status(402).json({ error: 'Yeterli Credits bulunmuyor.' });`
  );
  server = server.replace(`console.error('Chat error:', e);`, `console.error('STAR_AI_MULTIMODAL_CHAT_V1', { name: e?.name, message: e?.message, status: e?.status, code: e?.code });`);
  fs.writeFileSync(serverFile, server);
}

let dashboard = fs.readFileSync(dashboardFile, 'utf8');
if (!dashboard.includes('STAR_AI_CHAT_PRO_V1')) {
  const script = String.raw`<script data-star-chat-pro="v1">
(() => {
  function init() {
    if (window.__starChatProReady) return;
    window.__starChatProReady = true;
    const form = document.getElementById('chat');
    const input = document.getElementById('message');
    const fileInput = document.getElementById('imageInput');
    const preview = document.getElementById('imagePreview');
    const messages = document.getElementById('messagesInner');
    const send = document.getElementById('sendButton');
    if (!form || !input || !fileInput || !messages) return;
    const style = document.createElement('style');
    style.textContent = `
      .star-chat-modes{display:flex;gap:6px;overflow-x:auto;padding:0 2px 7px;scrollbar-width:none}.star-chat-modes::-webkit-scrollbar{display:none}
      .star-chat-mode{flex:0 0 auto;border:1px solid rgba(168,85,247,.22);border-radius:10px;background:rgba(255,255,255,.025);color:#aaa3b7;padding:7px 10px;font-size:11px;font-weight:800;cursor:pointer}.star-chat-mode.active,.star-chat-mode:hover{color:#fff;background:rgba(124,60,255,.18);border-color:rgba(168,85,247,.42)}
      .star-image-hint{display:none;margin:0 0 7px;color:#8c8499;font-size:10px}.star-image-hint.open{display:block}
      .star-action-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.star-action{border:1px solid rgba(168,85,247,.24);border-radius:9px;background:rgba(124,60,255,.08);color:#c9bcdf;padding:6px 9px;font-size:10px;font-weight:800;cursor:pointer}.star-action:hover{background:rgba(124,60,255,.2);color:#fff}
    `;
    document.head.appendChild(style);
    const wrap = form.parentElement;
    const modes = document.createElement('div');
    modes.className = 'star-chat-modes';
    modes.innerHTML = '<button type="button" class="star-chat-mode active" data-mode="chat">✦ محادثة</button><button type="button" class="star-chat-mode" data-mode="analyze">◉ تحليل الصورة</button><button type="button" class="star-chat-mode" data-mode="edit">✎ تعديل الصورة</button><button type="button" class="star-chat-mode" data-mode="add">＋ إضافة إلى الصورة</button>';
    wrap.insertBefore(modes, wrap.firstChild);
    const hint = document.createElement('div'); hint.className='star-image-hint'; wrap.insertBefore(hint, form);
    const actions = document.createElement('div'); actions.className='star-action-row';
    actions.innerHTML='<button type="button" class="star-action">تحسين الصورة</button><button type="button" class="star-action">إزالة عنصر</button><button type="button" class="star-action">تغيير الخلفية</button><button type="button" class="star-action">إضافة عنصر</button><button type="button" class="star-action">تحسين النص</button><button type="button" class="star-action">تلخيص</button>';
    wrap.insertBefore(actions, form);
    let mode='chat';
    function setMode(next){mode=next;modes.querySelectorAll('.star-chat-mode').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));const hasImage=!!(fileInput.files&&fileInput.files[0]);hint.classList.toggle('open',mode!=='chat');hint.textContent=mode==='analyze'?'أرفق صورة واسأل عنها مباشرة. سيحللها STAR AI ويجيبك بالتفصيل.':mode==='edit'?'أرفق صورة واكتب التعديل المطلوب. سيُستخدم محرر الصور المتخصص.':mode==='add'?'أرفق صورة واكتب الشيء الذي تريد إضافته إليها.':'';if(mode!=='chat'&&!hasImage) hint.textContent += ' لم تُرفق صورة بعد.';}
    modes.querySelectorAll('.star-chat-mode').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
    actions.querySelectorAll('.star-action').forEach(b=>b.addEventListener('click',()=>{const t=b.textContent.trim();const map={'تحسين الصورة':'حسّن هذه الصورة بشكل احترافي وطبيعي مع الحفاظ على الهوية والتفاصيل الأساسية.','إزالة عنصر':'أزل العنصر الذي سأحدده من الصورة مع إعادة بناء الخلفية بشكل طبيعي.','تغيير الخلفية':'غيّر الخلفية إلى: ','إضافة عنصر':'أضف إلى الصورة: ','تحسين النص':'حسّن صياغة النص التالي واجعله أوضح وأكثر احترافية مع الحفاظ على المعنى: ','تلخيص':'لخّص النص التالي في نقاط واضحة ومختصرة: '};input.value=(map[t]||'')+(input.value||'');input.focus();if(t==='تحسين الصورة'||t==='إزالة عنصر'||t==='تغيير الخلفية'||t==='إضافة عنصر')setMode('edit');}));
    function read(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=reject;r.readAsDataURL(file);});}
    function append(text,role='ai',imageUrl=''){const box=document.createElement('div');box.className='msg '+role;if(imageUrl){const img=document.createElement('img');img.className='message-image';img.src=imageUrl;box.appendChild(img);}if(text){const p=document.createElement('div');p.textContent=text;box.appendChild(p);}messages.appendChild(box);const sc=document.getElementById('messages');if(sc)sc.scrollTop=sc.scrollHeight;}
    form.addEventListener('submit',async e=>{
      if(mode==='chat'||mode==='edit') return;
      e.preventDefault();e.stopImmediatePropagation();
      const file=fileInput.files&&fileInput.files[0];const prompt=String(input.value||'').trim();
      if(!file){append('أرفق صورة أولاً حتى أستطيع تحليلها أو تعديلها.','ai');return;}
      if(!prompt){append(mode==='analyze'?'اكتب سؤالك عن الصورة أولاً.':'اكتب ما تريد إضافته إلى الصورة أولاً.','ai');return;}
      if(send)send.disabled=true;
      try{
        const imageData=await read(file);append(prompt,'user',imageData);
        const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({message:prompt,image_data:imageData})});
        const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'تعذر الحصول على إجابة.');
        append(data.answer||'لم تصل إجابة من المساعد.','ai');
        if(data.credits!==undefined){const a=document.getElementById('credits');const b=document.getElementById('creditsSide');if(a)a.textContent=String(data.credits);if(b)b.textContent=String(data.credits);}
      }catch(err){append(String(err?.message||'حدث خطأ أثناء معالجة الصورة.'),'ai');}finally{if(send)send.disabled=false;}
    },true);
    fileInput.addEventListener('change',()=>setMode(mode));
    setMode('chat');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
</script>`;
  dashboard = dashboard.replace('</body>', script+'\n</body>');
  fs.writeFileSync(dashboardFile,dashboard);
}
console.log('STAR_AI_CHAT_PRO_V1 enabled.');
await import('./server.js');
