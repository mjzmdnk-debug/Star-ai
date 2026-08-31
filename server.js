import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pgPromise from 'pg-promise';
import OpenAI from 'openai';
import crypto from 'crypto';

// إنشاء اتصال PostgreSQL
const pgp = pgPromise();
const db = pgp(process.env.DATABASE_URL || 'postgresql://localhost/star_ai');

const app = express();

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

// إنشاء الجداول
async function initializeDatabase() {
  try {
    await db.none(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        plan TEXT NOT NULL DEFAULT 'free',
        credits INTEGER NOT NULL DEFAULT 100,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS credit_ledger (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        amount INTEGER NOT NULL,
        reason TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        plan TEXT NOT NULL,
        status TEXT NOT NULL,
        iyzico_subscription_ref TEXT,
        iyzico_customer_ref TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS webhook_events (
        id SERIAL PRIMARY KEY,
        event_ref TEXT UNIQUE,
        event_type TEXT,
        payload TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id),
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        model TEXT NOT NULL,
        temperature REAL NOT NULL,
        max_tokens INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_id ON credit_ledger(user_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    `);
    console.log('✅ جداول قاعدة البيانات جاهزة');
  } catch (error) {
    console.error('❌ خطأ في إنشاء الجداول:', error);
  }
}

// إنشاء حساب Admin
async function createAdminIfNotExists() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return;
  
  try {
    const existing = await db.oneOrNone('SELECT id FROM users WHERE email = $1', [ADMIN_EMAIL]);
    if (!existing) {
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
      await db.none('INSERT INTO users(name, email, password_hash, plan, credits, role) VALUES($1, $2, $3, $4, $5, $6)',
        ['STAR AI Admin', ADMIN_EMAIL, hash, 'business', 0, 'admin']);
      console.log('✅ حساب Admin تم إنشاؤه');
    }
  } catch (error) {
    console.error('❌ خطأ في إنشاء Admin:', error);
  }
}

app.use(express.json({limit:'1mb'}));
app.use(cookieParser());
app.use(express.static('public'));

function tokenFor(user){ return jwt.sign({id:user.id}, JWT_SECRET, {expiresIn:'30d'}); }
function auth(req,res,next){
  try{
    const token=req.cookies.star_token;
    if(!token) return res.status(401).json({error:'Giriş yapmanız gerekiyor.'});
    const payload=jwt.verify(token,JWT_SECRET);
    req.user_id=payload.id; next();
  }catch{ return res.status(401).json({error:'Oturum geçersiz.'}); }
}

function addCredits(userId, amount, reason){
  return db.none('UPDATE users SET credits=credits+$1 WHERE id=$2', [amount, userId])
    .then(() => db.none('INSERT INTO credit_ledger(user_id,amount,reason) VALUES($1,$2,$3)', [userId,amount,reason]));
}

function spendCredit(userId){
  return db.result('UPDATE users SET credits=credits-1 WHERE id=$1 AND credits>0', [userId])
    .then(result => {
      if(result.rowCount !== 1) return false;
      return db.none('INSERT INTO credit_ledger(user_id,amount,reason) VALUES($1,$2,$3)', [userId,-1,'AI kullanımı'])
        .then(() => true);
    });
}

app.get('/api/health',(req,res)=>res.json({
  ok:true,
  aiConnected:Boolean(openai),
  paymentConfigured:Boolean(process.env.IYZICO_API_KEY && process.env.IYZICO_SECRET_KEY),
  model:process.env.AI_MODEL || 'gpt-4o-mini'
}));

app.post('/api/auth/register', async (req,res)=>{
  try{
    const name=String(req.body?.name||'').trim();
    const email=String(req.body?.email||'').trim().toLowerCase();
    const password=String(req.body?.password||'');
    if(name.length<2 || !email.includes('@') || password.length<8) return res.status(400).json({error:'Ad, geçerli e-posta ve en az 8 karakterli şifre gerekli.'});
    
    const exists=await db.oneOrNone('SELECT id FROM users WHERE email=$1', [email]);
    if(exists) return res.status(409).json({error:'Bu e-posta zaten kayıtlı.'});
    
    const hash=await bcrypt.hash(password,12);
    const result=await db.one('INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,plan,credits,role', [name,email,hash]);
    
    res.cookie('star_token',tokenFor(result),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:30*86400000});
    res.json({user:result});
  }catch(e){console.error(e);res.status(500).json({error:'Kayıt sırasında hata oluştu.'});}
});

app.post('/api/auth/login', async (req,res)=>{
  try{
    const email=String(req.body?.email||'').trim().toLowerCase();
    const password=String(req.body?.password||'');
    const row=await db.oneOrNone('SELECT * FROM users WHERE email=$1', [email]);
    
    if(!row || !(await bcrypt.compare(password,row.password_hash))) return res.status(401).json({error:'E-posta veya şifre hatalı.'});
    
    const user={id:row.id,name:row.name,email:row.email,plan:row.plan,credits:row.credits,role:row.role};
    res.cookie('star_token',tokenFor(user),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:30*86400000});
    res.json({user});
  }catch(e){console.error(e);res.status(500).json({error:'Giriş sırasında hata oluştu.'});}
});

app.post('/api/auth/logout',(req,res)=>{res.clearCookie('star_token');res.json({ok:true});});

app.get('/api/me',auth,async(req,res)=>{
  try{
    const user=await db.one('SELECT id,name,email,plan,credits,role FROM users WHERE id=$1', [req.user_id]);
    res.json({user});
  }catch{res.status(401).json({error:'Kullanıcı bulunamadı.'});}
});

app.get('/api/credits/history',auth,async(req,res)=>{
  const rows=await db.any('SELECT amount,reason,created_at FROM credit_ledger WHERE user_id=$1 ORDER BY id DESC LIMIT 50', [req.user_id]);
  res.json({rows});
});

// ✨ API للمحادثات المتقدمة
app.post('/api/conversations', auth, async(req, res) => {
  try{
    const title = String(req.body?.title || 'محادثة جديدة').substring(0, 100);
    const conv = await db.one('INSERT INTO conversations(user_id, title) VALUES($1, $2) RETURNING id', [req.user_id, title]);
    res.json({id: conv.id});
  }catch(e){res.status(500).json({error:'خطأ في إنشاء المحادثة'});}
});

app.get('/api/conversations', auth, async(req, res) => {
  try{
    const rows = await db.any('SELECT id, title, created_at, updated_at FROM conversations WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 50', [req.user_id]);
    res.json({conversations: rows});
  }catch(e){res.status(500).json({error:'خطأ في جلب المحادثات'});}
});

app.get('/api/conversations/:id/messages', auth, async(req, res) => {
  try{
    const convId = Number(req.params.id);
    const conv = await db.oneOrNone('SELECT user_id FROM conversations WHERE id=$1', [convId]);
    if (!conv || conv.user_id !== req.user_id) return res.status(403).json({error:'الوصول مرفوض'});
    
    const messages = await db.any('SELECT id, role, content, model, temperature, max_tokens, created_at FROM messages WHERE conversation_id=$1 ORDER BY id ASC', [convId]);
    res.json({messages});
  }catch(e){res.status(500).json({error:'خطأ في جلب الرسائل'});}
});

app.post('/api/chat', auth, async(req, res) => {
  const message = String(req.body?.message || '').trim();
  const convId = Number(req.body?.conversation_id || 0);
  const model = String(req.body?.model || 'gpt-4o-mini');
  const temperature = parseFloat(req.body?.temperature || 0.7);
  const maxTokens = parseInt(req.body?.max_tokens || 800);
  const systemPrompt = String(req.body?.system_prompt || 'Sen STAR AI platformunun Türkçe yapay zekâ asistanısın. Net, faydalı ve profesyonel cevaplar ver. Gereksiz uzatma.');

  if (!message) return res.status(400).json({error:'Mesaj gerekli.'});
  if (!openai) return res.status(503).json({error:'AI bağlantısı için OPENAI_API_KEY ayarlanmalı.'});

  try{
    // التحقق من الأرصدة
    const user = await db.one('SELECT credits FROM users WHERE id=$1', [req.user_id]);
    if (user.credits < 1) return res.status(402).json({error:'Kredi bakiyeniz bitti.'});

    // إنشاء محادثة جديدة إذا لزم الأمر
    let conversation_id = convId;
    if (!conversation_id) {
      const conv = await db.one('INSERT INTO conversations(user_id, title) VALUES($1, $2) RETURNING id', [req.user_id, message.substring(0, 50)]);
      conversation_id = conv.id;
    }

    // حفظ رسالة المستخدم
    await db.none('INSERT INTO messages(conversation_id, role, content, model, temperature, max_tokens) VALUES($1,$2,$3,$4,$5,$6)',
      [conversation_id, 'user', message, model, temperature, maxTokens]);

    // استدعاء OpenAI
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {role: 'system', content: systemPrompt},
        {role: 'user', content: message}
      ],
      max_tokens: maxTokens,
      temperature: temperature
    });

    // خفض الأرصدة
    const spent = await spendCredit(req.user_id);
    if (!spent) return res.status(402).json({error:'Kredi bakiyeniz bitti.'});

    const answer = response.choices[0]?.message?.content || 'خطأ في الحصول على الرد';
    
    // حفظ الرد
    await db.none('INSERT INTO messages(conversation_id, role, content, model, temperature, max_tokens) VALUES($1,$2,$3,$4,$5,$6)',
      [conversation_id, 'assistant', answer, model, temperature, maxTokens]);

    // تحديث وقت المحادثة
    await db.none('UPDATE conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=$1', [conversation_id]);

    const fresh = await db.one('SELECT credits FROM users WHERE id=$1', [req.user_id]);
    res.json({answer, credits: fresh.credits, conversation_id});
  } catch (e) {
    console.error('OpenAI Error:', e);
    res.status(500).json({error: 'AI isteği başarısız oldu: ' + e.message});
  }
});

// تصدير المحادثة
app.get('/api/conversations/:id/export', auth, async(req, res) => {
  try{
    const convId = Number(req.params.id);
    const conv = await db.oneOrNone('SELECT user_id, title FROM conversations WHERE id=$1', [convId]);
    if (!conv || conv.user_id !== req.user_id) return res.status(403).json({error:'الوصول مرفوض'});
    
    const messages = await db.any('SELECT role, content, created_at FROM messages WHERE conversation_id=$1 ORDER BY id ASC', [convId]);
    const exported = {
      title: conv.title,
      exported_at: new Date().toISOString(),
      messages: messages
    };
    
    res.json(exported);
  }catch(e){res.status(500).json({error:'خطأ في التصدير'});}
});

// البحث
app.get('/api/search/:query', auth, async(req, res) => {
  try{
    const query = '%' + String(req.params.query || '').substring(0, 100) + '%';
    const results = await db.any(`
      SELECT DISTINCT c.id, c.title, c.created_at 
      FROM conversations c 
      LEFT JOIN messages m ON c.id = m.conversation_id 
      WHERE c.user_id=$1 AND (c.title ILIKE $2 OR m.content ILIKE $2)
      ORDER BY c.updated_at DESC LIMIT 20
    `, [req.user_id, query]);
    res.json({results});
  }catch(e){res.status(500).json({error:'خطأ في البحث'});}
});

// حذف المحادثة
app.delete('/api/conversations/:id', auth, async(req, res) => {
  try{
    const convId = Number(req.params.id);
    const conv = await db.oneOrNone('SELECT user_id FROM conversations WHERE id=$1', [convId]);
    if (!conv || conv.user_id !== req.user_id) return res.status(403).json({error:'الوصول مرفوض'});
    
    await db.none('DELETE FROM messages WHERE conversation_id=$1', [convId]);
    await db.none('DELETE FROM conversations WHERE id=$1', [convId]);
    res.json({ok:true});
  }catch(e){res.status(500).json({error:'خطأ في الحذف'});}
});

function adminOnly(req,res,next){
  if(!req.user_id) return res.status(401).json({error:'Oturum gerekli'});
  next();
}

app.get('/api/admin/overview', auth, adminOnly, async(req,res)=>{
  try{
    const user = await db.one('SELECT role FROM users WHERE id=$1', [req.user_id]);
    if(user.role !== 'admin') return res.status(403).json({error:'Admin yetkisi gerekli.'});
    
    const users = await db.one('SELECT COUNT(*) as c FROM users');
    const paid = await db.one("SELECT COUNT(*) as c FROM users WHERE plan!='free'");
    const credits = await db.one('SELECT COALESCE(SUM(credits),0) as c FROM users');
    const usage = await db.one("SELECT COALESCE(SUM(-amount),0) as c FROM credit_ledger WHERE amount<0");
    
    res.json({
      stats:{
        users: users.c,
        paid: paid.c,
        credits: credits.c,
        usage: usage.c,
        revenue: 0
      }
    });
  }catch(e){res.status(500).json({error:'خطأ في جلب الإحصائيات'});}
});

app.get('/{*splat}',(req,res)=>res.sendFile(process.cwd()+'/public/index.html'));

// بدء التطبيق
async function start(){
  await initializeDatabase();
  await createAdminIfNotExists();
  app.listen(process.env.PORT||3000,()=>console.log(`✅ STAR AI: http://localhost:${process.env.PORT||3000}`));
}

start().catch(error => {
  console.error('❌ خطأ في بدء التطبيق:', error);
  process.exit(1);
});
