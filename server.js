import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import OpenAI from 'openai';
import crypto from 'crypto';

const app = express();
const db = new Database('star-ai.sqlite');
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 plan TEXT NOT NULL DEFAULT 'free',
 credits INTEGER NOT NULL DEFAULT 100,
 role TEXT NOT NULL DEFAULT 'user',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS credit_ledger (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 amount INTEGER NOT NULL,
 reason TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS subscriptions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 plan TEXT NOT NULL,
 status TEXT NOT NULL,
 iyzico_subscription_ref TEXT,
 iyzico_customer_ref TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS webhook_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 event_ref TEXT UNIQUE,
 event_type TEXT,
 payload TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

app.use(express.json({limit:'1mb'}));
app.use(cookieParser());
app.use(express.static('.'));

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '');
const openai = process.env.OPENAI_API_KEY ? new OpenAI({apiKey:process.env.OPENAI_API_KEY}) : null;
const PLANS = {
  free: {name:'Ücretsiz', price:0, credits:100},
  basic: {name:'Basic', price:199, credits:5000, iyzico:process.env.IYZICO_PLAN_BASIC},
  pro: {name:'Pro', price:399, credits:15000, iyzico:process.env.IYZICO_PLAN_PRO},
  business: {name:'Business', price:799, credits:30000, iyzico:process.env.IYZICO_PLAN_BUSINESS}
};

function tokenFor(user){ return jwt.sign({id:user.id}, JWT_SECRET, {expiresIn:'30d'}); }
function auth(req,res,next){
  try{
    const token=req.cookies.star_token;
    if(!token) return res.status(401).json({error:'Giriş yapmanız gerekiyor.'});
    const payload=jwt.verify(token,JWT_SECRET);
    const user=db.prepare('SELECT id,name,email,plan,credits,role FROM users WHERE id=?').get(payload.id);
    if(!user) return res.status(401).json({error:'Kullanıcı bulunamadı.'});
    req.user=user; next();
  }catch{ return res.status(401).json({error:'Oturum geçersiz.'}); }
}
if (ADMIN_EMAIL && ADMIN_PASSWORD) {
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email=?').get(ADMIN_EMAIL);
  if (!existingAdmin) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    db.prepare("INSERT INTO users(name,email,password_hash,plan,credits,role) VALUES(?,?,?,?,?,?)")
      .run('STAR AI Admin', ADMIN_EMAIL, hash, 'business', 0, 'admin');
  } else {
    db.prepare("UPDATE users SET role='admin' WHERE email=?").run(ADMIN_EMAIL);
  }
}

function addCredits(userId, amount, reason){
  db.prepare('UPDATE users SET credits=credits+? WHERE id=?').run(amount,userId);
  db.prepare('INSERT INTO credit_ledger(user_id,amount,reason) VALUES(?,?,?)').run(userId,amount,reason);
}
function spendCredit(userId){
  const info=db.prepare('UPDATE users SET credits=credits-1 WHERE id=? AND credits>0').run(userId);
  if(info.changes!==1) return false;
  db.prepare('INSERT INTO credit_ledger(user_id,amount,reason) VALUES(?,?,?)').run(userId,-1,'AI kullanımı');
  return true;
}

app.get('/api/health',(req,res)=>res.json({
  ok:true,
  aiConnected:Boolean(openai),
  paymentConfigured:Boolean(process.env.IYZICO_API_KEY && process.env.IYZICO_SECRET_KEY),
  model:process.env.AI_MODEL || 'gpt-5.6-luna'
}));

app.post('/api/auth/register', async (req,res)=>{
  try{
    const name=String(req.body?.name||'').trim();
    const email=String(req.body?.email||'').trim().toLowerCase();
    const password=String(req.body?.password||'');
    if(name.length<2 || !email.includes('@') || password.length<8) return res.status(400).json({error:'Ad, geçerli e-posta ve en az 8 karakterli şifre gerekli.'});
    const exists=db.prepare('SELECT id FROM users WHERE email=?').get(email);
    if(exists) return res.status(409).json({error:'Bu e-posta zaten kayıtlı.'});
    const hash=await bcrypt.hash(password,12);
    const info=db.prepare('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)').run(name,email,hash);
    const user=db.prepare('SELECT id,name,email,plan,credits,role FROM users WHERE id=?').get(info.lastInsertRowid);
    res.cookie('star_token',tokenFor(user),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:30*86400000});
    res.json({user});
  }catch(e){res.status(500).json({error:'Kayıt sırasında hata oluştu.'});}
});

app.post('/api/auth/login', async (req,res)=>{
  try{
    const email=String(req.body?.email||'').trim().toLowerCase();
    const password=String(req.body?.password||'');
    const row=db.prepare('SELECT * FROM users WHERE email=?').get(email);
    if(!row || !(await bcrypt.compare(password,row.password_hash))) return res.status(401).json({error:'E-posta veya şifre hatalı.'});
    const user={id:row.id,name:row.name,email:row.email,plan:row.plan,credits:row.credits,role:row.role};
    res.cookie('star_token',tokenFor(user),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:30*86400000});
    res.json({user});
  }catch{res.status(500).json({error:'Giriş sırasında hata oluştu.'});}
});

app.post('/api/auth/logout',(req,res)=>{res.clearCookie('star_token');res.json({ok:true});});
app.get('/api/me',auth,(req,res)=>res.json({user:req.user}));

app.get('/api/credits/history',auth,(req,res)=>{
  const rows=db.prepare('SELECT amount,reason,created_at FROM credit_ledger WHERE user_id=? ORDER BY id DESC LIMIT 50').all(req.user.id);
  res.json({rows});
});

app.post('/api/chat',auth,async(req,res)=>{
  const message=String(req.body?.message||'').trim();
  if(!message) return res.status(400).json({error:'Mesaj gerekli.'});
  if(!openai) return res.status(503).json({error:'AI bağlantısı için OPENAI_API_KEY ayarlanmalı.'});
  if(req.user.credits<1) return res.status(402).json({error:'Kredi bakiyeniz bitti.'});
  try{
    const response=await openai.responses.create({
      model:process.env.AI_MODEL || 'gpt-5.6-luna',
      instructions:'Sen STAR AI platformunun Türkçe yapay zekâ asistanısın. Net, faydalı ve profesyonel cevaplar ver. Gereksiz uzatma.',
      input:message,
      max_output_tokens:800
    });
    if(!spendCredit(req.user.id)) return res.status(402).json({error:'Kredi bakiyeniz bitti.'});
    const fresh=db.prepare('SELECT credits FROM users WHERE id=?').get(req.user.id);
    res.json({answer:response.output_text,credits:fresh.credits});
  }catch(e){console.error(e);res.status(500).json({error:'AI isteği başarısız oldu.'});}
});


function adminOnly(req,res,next){
  if(req.user?.role!=='admin') return res.status(403).json({error:'Admin yetkisi gerekli.'});
  next();
}

app.get('/api/admin/overview',auth,adminOnly,(req,res)=>{
  const users=db.prepare('SELECT COUNT(*) c FROM users').get().c;
  const paid=db.prepare("SELECT COUNT(*) c FROM users WHERE plan!='free'").get().c;
  const credits=db.prepare('SELECT COALESCE(SUM(credits),0) c FROM users').get().c;
  const usage=db.prepare("SELECT COALESCE(SUM(-amount),0) c FROM credit_ledger WHERE amount<0").get().c;
  const revenue=db.prepare("SELECT COALESCE(SUM(CASE WHEN plan='basic' THEN 199 WHEN plan='pro' THEN 399 WHEN plan='business' THEN 799 ELSE 0 END),0) c FROM users WHERE plan!='free'").get().c;
  const byPlan=db.prepare("SELECT plan,COUNT(*) count FROM users GROUP BY plan ORDER BY count DESC").all();
  const recent=db.prepare("SELECT id,name,email,plan,credits,created_at FROM users ORDER BY id DESC LIMIT 20").all();
  res.json({stats:{users,paid,credits,usage,revenue},byPlan,recent});
});

app.get('/api/admin/users',auth,adminOnly,(req,res)=>{
  const q=String(req.query.q||'').trim();
  const rows=q
    ? db.prepare("SELECT id,name,email,plan,credits,role,created_at FROM users WHERE name LIKE ? OR email LIKE ? ORDER BY id DESC LIMIT 100").all('%'+q+'%','%'+q+'%')
    : db.prepare("SELECT id,name,email,plan,credits,role,created_at FROM users ORDER BY id DESC LIMIT 100").all();
  res.json({rows});
});

app.post('/api/admin/users/:id/credits',auth,adminOnly,(req,res)=>{
  const id=Number(req.params.id), amount=Number(req.body?.amount);
  if(!Number.isInteger(id) || !Number.isInteger(amount) || amount===0) return res.status(400).json({error:'Geçerli bir miktar girin.'});
  const u=db.prepare('SELECT id FROM users WHERE id=?').get(id);
  if(!u) return res.status(404).json({error:'Kullanıcı bulunamadı.'});
  addCredits(id,amount,'Admin kredi ayarlaması');
  res.json({ok:true});
});

app.post('/api/admin/users/:id/plan',auth,adminOnly,(req,res)=>{
  const id=Number(req.params.id), plan=String(req.body?.plan||'');
  if(!PLANS[plan]) return res.status(400).json({error:'Geçersiz plan.'});
  const u=db.prepare('SELECT id FROM users WHERE id=?').get(id);
  if(!u) return res.status(404).json({error:'Kullanıcı bulunamadı.'});
  db.prepare('UPDATE users SET plan=? WHERE id=?').run(plan,id);
  res.json({ok:true});
});

/* iyzico V2 authorization, following iyzico's HMACSHA256 scheme. */
function iyzicoAuth(uri, body){
  const apiKey=process.env.IYZICO_API_KEY, secret=process.env.IYZICO_SECRET_KEY;
  const randomKey=Date.now().toString()+crypto.randomInt(100000,999999);
  const url=new URL(uri);
  const path=url.pathname + (url.search || '');
  const payload=randomKey + path + JSON.stringify(body);
  const signature=crypto.createHmac('sha256',secret).update(payload).digest('hex');
  const authString=`apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`;
  return {Authorization:'IYZWSv2 '+Buffer.from(authString).toString('base64'),'x-iyzi-rnd':randomKey,'Content-Type':'application/json'};
}
async function iyzicoPost(path,body){
  const base=process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com';
  const uri=base+path;
  const headers=iyzicoAuth(uri,body);
  const r=await fetch(uri,{method:'POST',headers,body:JSON.stringify(body)});
  const text=await r.text();
  let data; try{data=JSON.parse(text)}catch{data={raw:text}};
  if(!r.ok) throw new Error(data.errorMessage||`iyzico HTTP ${r.status}`);
  return data;
}

app.post('/api/billing/checkout',auth,async(req,res)=>{
  const plan=String(req.body?.plan||'');
  const p=PLANS[plan];
  if(!p || plan==='free') return res.status(400).json({error:'Geçerli bir ücretli plan seçin.'});
  if(!p.iyzico) return res.status(503).json({error:'Bu plan için iyzico pricing plan reference code henüz ayarlanmadı.'});
  if(!process.env.APP_URL) return res.status(500).json({error:'APP_URL ayarlanmalı.'});
  try{
    const body={
      locale:'tr',
      callbackUrl:process.env.APP_URL+'/api/billing/callback',
      pricingPlanReferenceCode:p.iyzico,
      subscriptionInitialStatus:'ACTIVE',
      conversationId:`star-${req.user.id}-${Date.now()}`,
      customer:{
        name:req.user.name.split(' ')[0] || req.user.name,
        surname:req.user.name.split(' ').slice(1).join(' ') || 'STAR',
        email:req.user.email,
        gsmNumber:'+905000000000',
        billingContactName:req.user.name,
        billingCity:'Istanbul',
        billingCountry:'Turkey',
        billingAddress:'Digital service',
        billingZipCode:'34000',
        shippingContactName:req.user.name,
        shippingCity:'Istanbul',
        shippingCountry:'Turkey',
        shippingAddress:'Digital service',
        shippingZipCode:'34000'
      }
    };
    const result=await iyzicoPost('/v2/subscription/checkoutform/initialize',body);
    if(result.status!=='success') return res.status(400).json({error:result.errorMessage||'iyzico checkout başlatılamadı.'});
    res.json({token:result.token,checkoutFormContent:result.checkoutFormContent,paymentPageUrl:result.paymentPageUrl});
  }catch(e){console.error(e);res.status(502).json({error:'Ödeme sağlayıcısına bağlanılamadı.'});}
});

app.post('/api/billing/callback',(req,res)=>{
  res.redirect('/billing-result.html');
});

/* iyzico Subscription webhook V3 validation. */
app.post('/api/webhooks/iyzico', (req,res)=>{
  try{
    const p=req.body||{};
    const signature=req.get('X-IYZ-SIGNATURE-V3')||'';
    if(!process.env.IYZICO_SECRET_KEY || !process.env.IYZICO_MERCHANT_ID) return res.status(503).send('not configured');
    const message=String(process.env.IYZICO_MERCHANT_ID)+process.env.IYZICO_SECRET_KEY+String(p.iyziEventType||'')+String(p.subscriptionReferenceCode||'')+String(p.orderReferenceCode||'')+String(p.customerReferenceCode||'');
    const expected=crypto.createHmac('sha256',process.env.IYZICO_SECRET_KEY).update(message).digest('hex');
    if(!signature || !crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected))) return res.status(401).send('invalid signature');
    const eventRef=p.iyziReferenceCode||`${p.orderReferenceCode}:${p.iyziEventType}`;
    try{db.prepare('INSERT INTO webhook_events(event_ref,event_type,payload) VALUES(?,?,?)').run(eventRef,p.iyziEventType,JSON.stringify(p));}catch{return res.sendStatus(200)}
    const sub=db.prepare('SELECT * FROM subscriptions WHERE iyzico_subscription_ref=?').get(p.subscriptionReferenceCode);
    if(sub){
      if(p.iyziEventType==='subscription.order.success'){
        const plan=sub.plan, credits=PLANS[plan]?.credits||0;
        db.prepare('UPDATE users SET plan=? WHERE id=?').run(plan,sub.user_id);
        if(credits) addCredits(sub.user_id,credits,'Abonelik yenileme');
      } else if(p.iyziEventType==='subscription.order.failure'){
        db.prepare('UPDATE subscriptions SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run('payment_failed',sub.id);
      }
    }
    res.sendStatus(200);
  }catch(e){console.error(e);res.status(500).send('error');}
});

app.get('/{*splat}',(req,res)=>res.sendFile(process.cwd()+'/public/index.html'));
app.listen(process.env.PORT||3000,()=>console.log(`STAR AI: http://localhost:${process.env.PORT||3000}`));
