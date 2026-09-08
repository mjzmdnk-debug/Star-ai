import fs from 'node:fs';

const serverFile = new URL('./server.js', import.meta.url);
const dashboardFile = new URL('./dashboard.html', import.meta.url);

let server = fs.readFileSync(serverFile, 'utf8');

// The normal chat can accept an image for vision. Keep the payload large enough for
// a compressed data URL, while the edit endpoint applies its own strict validation.
server = server.replace("app.use(express.json({ limit: '1mb', verify: (req, res, buffer) => { req.rawBody = Buffer.from(buffer); } }));", "app.use(express.json({ limit: '8mb', verify: (req, res, buffer) => { req.rawBody = Buffer.from(buffer); } }));");

if (!server.includes("app.post('/api/image-edit'")) {
  const imageEditRoute = String.raw`

// Image editing: the OpenAI API key stays server-side. The browser sends only a
// compressed data URL and an editing instruction. Five credits are reserved per edit.
app.post('/api/image-edit', auth, rateLimit({ windowMs: 60000, max: 6, scope: 'image-edit', getKey: req => \`user:\${req.user_id}\` }), async (req, res) => {
  if (!openai) return res.status(503).json({ error: 'AI image service is not configured.' });

  const prompt = String(req.body?.prompt || '').trim().slice(0, 12000);
  const imageData = String(req.body?.image_data || '').trim();
  const match = imageData.match(/^data:(image\\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!prompt) return res.status(400).json({ error: 'اكتب وصف التعديل المطلوب.' });
  if (!match) return res.status(400).json({ error: 'الصورة غير صالحة. استخدم JPG أو PNG أو WEBP.' });
  if (imageData.length > 7000000) return res.status(400).json({ error: 'حجم الصورة كبير جداً. اختر صورة أصغر.' });

  const imageMime = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  const imageBuffer = Buffer.from(match[2], 'base64');
  if (imageBuffer.length > 5000000) return res.status(400).json({ error: 'حجم الصورة كبير جداً. اختر صورة أصغر.' });

  const IMAGE_EDIT_COST = 5;
  let reserved = false;
  try {
    await db.tx(async t => {
      const updated = await t.oneOrNone(
        'UPDATE users SET credits=credits-$1 WHERE id=$2 AND credits >= $1 RETURNING credits',
        [IMAGE_EDIT_COST, req.user_id]
      );
      if (!updated) throw Object.assign(new Error('INSUFFICIENT_CREDITS'), { status: 402 });
      await t.none(
        'INSERT INTO credit_ledger(user_id,amount,reason) VALUES($1,$2,$3)',
        [req.user_id, -IMAGE_EDIT_COST, 'AI image edit']
      );
      reserved = true;
    });

    const { toFile } = await import('openai');
    const ext = imageMime === 'image/png' ? 'png' : imageMime === 'image/webp' ? 'webp' : 'jpg';
    const imageFile = await toFile(imageBuffer, \`star-ai-source.\${ext}\`, { type: imageMime });
    const edit = await openai.images.edit({
      model: 'gpt-image-2',
      image: imageFile,
      prompt: \`Edit the supplied image according to this instruction: \${prompt}. Preserve the person's identity, composition, camera perspective, and every detail not explicitly requested to change. Make only the requested changes and keep everything else as close to the original as possible.\`,
      quality: 'medium',
      input_fidelity: 'high'
    });

    const b64 = edit?.data?.[0]?.b64_json;
    if (!b64) throw new Error('EMPTY_IMAGE_RESULT');
    const resultDataUrl = \`data:image/png;base64,\${b64}\`;
    const credits = await db.one('SELECT credits FROM users WHERE id=$1', [req.user_id]);
    reserved = false;
    return res.json({ ok: true, image: resultDataUrl, credits: credits.credits, cost: IMAGE_EDIT_COST });
  } catch (error) {
    if (reserved) {
      try {
        await db.tx(async t => {
          await t.none('UPDATE users SET credits=credits+$1 WHERE id=$2', [IMAGE_EDIT_COST, req.user_id]);
          await t.none('INSERT INTO credit_ledger(user_id,amount,reason) VALUES($1,$2,$3)', [req.user_id, IMAGE_EDIT_COST, 'AI image edit refund']);
        });
      } catch (refundError) {
        console.error('Image edit credit refund failed:', refundError);
      }
    }
    if (error?.status === 402) return res.status(402).json({ error: 'Yeterli Credits bulunmuyor. Bir görsel düzenleme 5 kredi kullanır.' });
    console.error('Image edit error:', error);
    const message = String(error?.message || '');
    if (message.toLowerCase().includes('content') || message.toLowerCase().includes('safety')) {
      return res.status(400).json({ error: 'Bu görsel veya düzenleme isteği güvenlik kuralları nedeniyle işlenemedi.' });
    }
    return res.status(500).json({ error: 'Görsel düzenlenemedi. Lütfen tekrar deneyin.' });
  }
});
`;
  const anchor = "app.use(cookieParser());";
  if (server.includes(anchor)) server = server.replace(anchor, anchor + imageEditRoute);
}

fs.writeFileSync(serverFile, server);

let dashboard = fs.readFileSync(dashboardFile, 'utf8');

if (!dashboard.includes('image-edit-mode')) {
  dashboard = dashboard.replace(
    '.image-preview-info{min-width:0;flex:1}',
    '.image-preview-info{min-width:0;flex:1}.image-edit-mode{display:flex;align-items:center;gap:6px;margin-top:5px}.image-mode-btn{border:1px solid rgba(168,85,247,.3);border-radius:8px;background:rgba(124,60,255,.1);color:#c7b3ff;padding:4px 8px;font-size:10px;font-weight:700;cursor:pointer}.image-mode-btn.active{background:rgba(124,60,255,.3);color:#fff}'
  );
  dashboard = dashboard.replace(
    '<div class="image-preview-info"><b id="previewName">Görsel seçildi</b><small>STAR AI bu görseli analiz edebilir.</small></div>',
    '<div class="image-preview-info"><b id="previewName">Görsel seçildi</b><small id="previewHint">Mod: تعديل الصورة • 5 kredi</small><div class="image-edit-mode"><button id="editMode" class="image-mode-btn active" type="button">✦ تعديل</button><button id="analyzeMode" class="image-mode-btn" type="button">◉ تحليل</button></div></div>'
  );
  dashboard = dashboard.replace(
    "let conversationId=null;let conversations=[];let busy=false;let selectedImageData=null;let selectedImageName='';",
    "let conversationId=null;let conversations=[];let busy=false;let selectedImageData=null;let selectedImageName='';let imageMode='edit';"
  );
  dashboard = dashboard.replace(
    "function showImagePreview(data,name){$('previewImage').src=data;$('previewName').textContent=name;$('imagePreview').classList.add('open');}",
    "function showImagePreview(data,name){$('previewImage').src=data;$('previewName').textContent=name;$('imagePreview').classList.add('open');updateImageMode();}function updateImageMode(){const edit=imageMode==='edit';$('editMode').classList.toggle('active',edit);$('analyzeMode').classList.toggle('active',!edit);$('previewHint').textContent=edit?'Mod: تعديل الصورة • 5 kredi':'Mod: تحليل الصورة • 1 kredi';}"
  );
  dashboard = dashboard.replace(
    "$('attachButton').addEventListener('click',()=>$('imageInput').click());",
    "$('editMode').addEventListener('click',()=>{imageMode='edit';updateImageMode();});$('analyzeMode').addEventListener('click',()=>{imageMode='analyze';updateImageMode();});$('attachButton').addEventListener('click',()=>$('imageInput').click());"
  );
  dashboard = dashboard.replace(
    "const body={message:text||'Bu görseli analiz et.'};if(conversationId)body.conversation_id=conversationId;if(imageToSend)body.image_data=imageToSend;const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json().catch(()=>({}));if(!response.ok){aiMessage.textContent=data.error||'Bir hata oluştu.';return;}aiMessage.textContent=data.answer||'Yanıt alınamadı.';",
    "let response;let data;const endpoint=imageToSend&&imageMode==='edit'?'/api/image-edit':'/api/chat';if(endpoint==='/api/image-edit'){response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image_data:imageToSend,prompt:text})});data=await response.json().catch(()=>({}));if(!response.ok){aiMessage.textContent=data.error||'Görsel düzenlenemedi.';return;}aiMessage.replaceChildren();const result=document.createElement('img');result.className='message-image';result.src=data.image;result.alt='Düzenlenmiş görsel';aiMessage.appendChild(result);if(data.credits!==undefined)setCredits(data.credits);}else{const body={message:text||'Bu görseli analiz et.'};if(conversationId)body.conversation_id=conversationId;if(imageToSend)body.image_data=imageToSend;response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});data=await response.json().catch(()=>({}));if(!response.ok){aiMessage.textContent=data.error||'Bir hata oluştu.';return;}aiMessage.textContent=data.answer||'Yanıt alınamadı.';}"
  );
  dashboard = dashboard.replace(
    "const wasNew=!conversationId;conversationId=data.conversation_id||conversationId;if(data.credits!==undefined)setCredits(data.credits);if(wasNew)await loadConversations();else renderConversations();",
    "const wasNew=!conversationId;if(data.conversation_id)conversationId=data.conversation_id;if(data.credits!==undefined)setCredits(data.credits);if(endpoint==='/api/chat'&&(wasNew||data.conversation_id))await loadConversations();else renderConversations();"
  );
}

fs.writeFileSync(dashboardFile, dashboard);
console.log('STAR AI image editing enabled.');

await import('./server.js');
