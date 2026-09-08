import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pgPromise from 'pg-promise';
import OpenAI from 'openai';
import crypto from 'node:crypto';

const pgp = pgPromise();
const db = pgp(process.env.DATABASE_URL || 'postgresql://localhost/star_ai');
const app = express();

const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET = String(process.env.JWT_SECRET || '').trim();
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '');
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

if (isProduction && JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a strong value (at least 32 characters) in production.');
}

const PLANS = {
  free: { name: 'Ücretsiz', price: 0, credits: 100 },
  basic: { name: 'Basic', price: 199, credits: 5000, iyzico: process.env.IYZICO_PLAN_BASIC },
  pro: { name: 'Pro', price: 399, credits: 15000, iyzico: process.env.IYZICO_PLAN_PRO },
  business: { name: 'Business', price: 799, credits: 30000, iyzico: process.env.IYZICO_PLAN_BUSINESS }
};

const SHOPIER_PRODUCTS = {
  basic: { id: process.env.SHOPIER_PRODUCT_BASIC_ID || '50673465', name: 'STAR AI Basic', price: 199, credits: 5000, url: 'https://shopier.com/50673465' },
  pro: { id: process.env.SHOPIER_PRODUCT_PRO_ID || '50673487', name: 'STAR AI Pro', price: 399, credits: 15000, url: 'https://shopier.com/50673487' },
  ...(process.env.SHOPIER_PRODUCT_BUSINESS_ID ? { business: { id: process.env.SHOPIER_PRODUCT_BUSINESS_ID, name: 'STAR AI Business', price: 799, credits: 30000, url: `https://shopier.com/${process.env.SHOPIER_PRODUCT_BUSINESS_ID}` } } : {})
};

const allowedModels = new Set([AI_MODEL, 'gpt-4o-mini']);
const rateBuckets = new Map();

function rateLimit({ windowMs, max, key }) {
  return (req, res, next) => {
    const identifier = typeof key === 'function' ? key(req) : req.ip;
    const bucketKey = `${key?.name || 'rate'}:${identifier}`;
    const now = Date.now();
    let bucket = rateBuckets.get(bucketKey);
    if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + windowMs };
    bucket.count += 1;
    rateBuckets.set(bucketKey, bucket);
    if (bucket.count > max) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      return res.status(429).json({ error: 'Çok fazla istek gönderildi. Lütfen biraz sonra tekrar deneyin.' });
    }
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) if (bucket.resetAt <= now) rateBuckets.delete(key);
}, 60000).unref();

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

async function initializeDatabase() {
  await db.none(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'free',
      credits INTEGER NOT NULL DEFAULT 100 CHECK (credits >= 0),
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
      role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
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
}

async function createAdminIfNotExists() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return;
  const existing = await db.oneOrNone('SELECT id FROM users WHERE email=$1', [ADMIN_EMAIL]);
  if (!existing) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await db.none('INSERT INTO users(name,email,password_hash,plan,credits,role) VALUES($1,$2,$3,$4,$5,$6)', ['STAR AI Admin', ADMIN_EMAIL, hash, 'business', 0, 'admin']);
  }
}

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

const blockedPublicPaths = new Set(['/server.js', '/package.json', '/package-lock.json', '/.env']);
app.use((req, res, next) => {
  if (blockedPublicPaths.has(req.path) || req.path.startsWith('/.git') || (req.path.endsWith('.js') && !req.path.startsWith('/api/'))) return res.status(404).end();
  next();
});
app.use(express.static('.'));

function tokenFor(user) {
  return jwt.sign({ id: user.id }, JWT_SECRET || 'local-development-secret', { expiresIn: '30d' });
}

function auth(req, res, next) {
  try {
    const token = req.cookies?.star_token;
    if (!token) return res.status(401).json({ error: 'Giriş yapmanız gerekiyor.' });
    const payload = jwt.verify(token, JWT_SECRET || 'local-development-secret');
    if (!Number.isInteger(Number(payload.id))) return res.status(401).json({ error: 'Oturum geçersiz.' });
    req.user_id = Number(payload.id);
    next();
  } catch {
    return res.status(401).json({ error: 'Oturum geçersiz.' });
  }
}

async function adminOnly(req, res, next) {
  try {
    const user = await db.oneOrNone('SELECT role FROM users WHERE id=$1', [req.user_id]);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin yetkisi gerekli.' });
    next();
  } catch {
    res.status(500).json({ error: 'Yetki kontrolü başarısız.' });
  }
}

function setAuthCookie(res, user) {
  res.cookie('star_token', tokenFor(user), { httpOnly: true, sameSite: 'lax', secure: isProduction, maxAge: 30 * 86400000, path: '/' });
}

function addCredits(userId, amount, reason) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Invalid credit amount');
  return db.tx(async t => {
    await t.none('UPDATE users SET credits=credits+$1 WHERE id=$2', [amount, userId]);
    await t.none('INSERT INTO credit_ledger(user_id,amount,reason) VALUES($1,$2,$3)', [userId, amount, reason]);
  });
}

function validateChatInput(body) {
  const message = String(body?.message || '').trim().slice(0, 12000);
  const convIdRaw = Number(body?.conversation_id || 0);
  const conversationId = Number.isInteger(convIdRaw) && convIdRaw > 0 ? convIdRaw : 0;
  const requestedModel = String(body?.model || AI_MODEL);
  const model = allowedModels.has(requestedModel) ? requestedModel : AI_MODEL;
  const requestedTemperature = Number(body?.temperature);
  const temperature = Number.isFinite(requestedTemperature) ? Math.min(1.5, Math.max(0, requestedTemperature)) : 0.7;
  const requestedMaxTokens = Number(body?.max_tokens);
  const maxTokens = Number.isInteger(requestedMaxTokens) ? Math.min(2000, Math.max(100, requestedMaxTokens)) : 800;
  return { message, conversationId, model, temperature, maxTokens };
}

app.get('/api/health', (req, res) => res.json({ ok: true, aiConnected: Boolean(openai), paymentConfigured: Boolean(process.env.SHOPIER_WEBHOOK_SECRET), model: AI_MODEL }));

app.post('/api/billing/checkout', auth, async (req, res) => {
  try {
    const plan = String(req.body?.plan || '').toLowerCase();
    const product = SHOPIER_PRODUCTS[plan];
    if (!product) return res.status(400).json({ error: 'Bu plan için ödeme bağlantısı mevcut değil.' });
    res.json({ ok: true, plan, name: product.name, price: product.price, credits: product.credits, paymentPageUrl: product.url });
  } catch (e) {
    console.error('Shopier checkout error:', e);
    res.status(500).json({ error: 'Ödeme bağlantısı oluşturulamadı.' });
  }
});

app.post('/api/shopier/webhook', rateLimit({ windowMs: 60000, max: 60, key: function webhookIp(req) { return req.ip; } }), async (req, res) => {
  try {
    const secret = String(process.env.SHOPIER_WEBHOOK_SECRET || '').trim();
    if (!secret) return res.status(503).json({ error: 'Webhook secret is not configured.' });
    const received = String(req.query?.secret || req.headers['x-shopier-secret'] || '').trim();
    if (!received || !safeEqual(received, secret)) return res.status(401).json({ error: 'Unauthorized' });
    const body = req.body || {};
    if (body.event && body.event !== 'order.created') return res.status(200).json({ ok: true });
    const order = body.order || body.data || body;
    const orderId = String(order.id || order.orderId || order.order_id || body.orderId || '').trim();
    if (!orderId) return res.status(400).json({ error: 'Order ID missing.' });
    const paymentStatus = String(order.paymentStatus || order.payment_status || body.paymentStatus || '').toLowerCase();
    if (paymentStatus && !['paid', 'success', 'completed'].includes(paymentStatus)) return res.status(200).json({ ok: true, paymentStatus });
    const buyerEmail = String(order.buyer?.email || order.buyerEmail || order.email || body.buyerEmail || '').trim().toLowerCase();
    if (!buyerEmail) return res.status(400).json({ error: 'Buyer email missing.' });
    const lineItems = order.lineItems || order.line_items || body.lineItems || [];
    const firstItem = Array.isArray(lineItems) ? lineItems[0] : null;
    const productId = String(firstItem?.productId || firstItem?.product_id || '').trim();
    const title = String(firstItem?.title || firstItem?.name || order.productName || '').toLowerCase();
    let plan = null;
    if (productId === SHOPIER_PRODUCTS.basic.id || (!productId && title.includes('basic'))) plan = 'basic';
    if (productId === SHOPIER_PRODUCTS.pro.id || (!productId && title.includes('pro'))) plan = 'pro';
    if (SHOPIER_PRODUCTS.business && (productId === SHOPIER_PRODUCTS.business.id || (!productId && title.includes('business')))) plan = 'business';
    if (!plan) return res.status(400).json({ error: 'Product not recognized.' });
    const product = SHOPIER_PRODUCTS[plan];
    const eventRef = `shopier-order-${orderId}`;
    await db.tx(async t => {
      const inserted = await t.result('INSERT INTO webhook_events(event_ref,event_type,payload) VALUES($1,$2,$3) ON CONFLICT(event_ref) DO NOTHING', [eventRef, 'shopier.order.created', JSON.stringify(body)]);
      if (inserted.rowCount !== 1) return;
      const user = await t.oneOrNone('SELECT id FROM users WHERE email=$1 FOR UPDATE', [buyerEmail]);
      if (!user) throw new Error('STAR AI user not found.');
      await t.none('UPDATE users SET credits=credits+$1, plan=$2 WHERE id=$3', [product.credits, plan, user.id]);
      await t.none('INSERT INTO credit_ledger(user_id,amount,reason) VALUES($1,$2,$3)', [user.id, product.credits, `Shopier ${product.name} - Order ${orderId}`]);
      await t.none('INSERT INTO subscriptions(user_id,plan,status,iyzico_subscription_ref,iyzico_customer_ref) VALUES($1,$2,$3,$4,$5)', [user.id, plan, 'active', orderId, 'shopier']);
    });
    res.status(200).json({ ok: true, plan, credits: product.credits });
  } catch (e) {
    console.error('Shopier webhook error:', e);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
});

app.post('/api/auth/register', rateLimit({ windowMs: 15 * 60000, max: 10, key: function registerIp(req) { return req.ip; } }), async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim().slice(0, 100);
    const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 254);
    const password = String(req.body?.password || '');
    if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || password.length > 200) return res.status(400).json({ error: 'Ad, geçerli e-posta ve 8-200 karakterli şifre gerekli.' });
    const hash = await bcrypt.hash(password, 12);
    const result = await db.one('INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,plan,credits,role', [name, email, hash]);
    setAuthCookie(res, result);
    res.status(201).json({ user: result });
  } catch (e) {
    if (e?.code === '23505') return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı.' });
    console.error('Register error:', e);
    res.status(500).json({ error: 'Kayıt sırasında hata oluştu.' });
  }
});

app.post('/api/auth/login', rateLimit({ windowMs: 15 * 60000, max: 10, key: function loginIp(req) { return req.ip; } }), async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 254);
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ error: 'E-posta ve şifre gerekli.' });
    const row = await db.oneOrNone('SELECT * FROM users WHERE email=$1', [email]);
    if (!row || !(await bcrypt.compare(password, row.password_hash))) return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
    const user = { id: row.id, name: row.name, email: row.email, plan: row.plan, credits: row.credits, role: row.role };
    setAuthCookie(res, user);
    res.json({ user });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Giriş sırasında hata oluştu.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('star_token', { httpOnly: true, sameSite: 'lax', secure: isProduction, path: '/' });
  res.json({ ok: true });
});

app.get('/api/me', auth, async (req, res) => {
  try {
    const user = await db.one('SELECT id,name,email,plan,credits,role FROM users WHERE id=$1', [req.user_id]);
    res.json({ user });
  } catch {
    res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
  }
});

app.get('/api/credits/history', auth, async (req, res) => {
  try {
    const rows = await db.any('SELECT amount,reason,created_at FROM credit_ledger WHERE user_id=$1 ORDER BY id DESC LIMIT 50', [req.user_id]);
    res.json({ rows });
  } catch {
    res.status(500).json({ error: 'Kredi geçmişi alınamadı.' });
  }
});

app.post('/api/conversations', auth, async (req, res) => {
  try {
    const title = String(req.body?.title || 'محادثة جديدة').trim().slice(0, 100) || 'محادثة جديدة';
    const conv = await db.one('INSERT INTO conversations(user_id,title) VALUES($1,$2) RETURNING id', [req.user_id, title]);
    res.status(201).json({ id: conv.id });
  } catch {
    res.status(500).json({ error: 'خطأ في إنشاء المحادثة' });
  }
});

app.get('/api/conversations', auth, async (req, res) => {
  try {
    const rows = await db.any('SELECT id,title,created_at,updated_at FROM conversations WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 50', [req.user_id]);
    res.json({ conversations: rows });
  } catch {
    res.status(500).json({ error: 'خطأ في جلب المحادثات' });
  }
});

async function ownedConversation(userId, conversationId) {
  if (!Number.isInteger(conversationId) || conversationId <= 0) return null;
  return db.oneOrNone('SELECT id,user_id,title FROM conversations WHERE id=$1 AND user_id=$2', [conversationId, userId]);
}

app.get('/api/conversations/:id/messages', auth, async (req, res) => {
  try {
    const convId = Number(req.params.id);
    const conv = await ownedConversation(req.user_id, convId);
    if (!conv) return res.status(404).json({ error: 'المحادثة غير موجودة.' });
    const messages = await db.any('SELECT id,role,content,model,temperature,max_tokens,created_at FROM messages WHERE conversation_id=$1 ORDER BY id ASC', [convId]);
    res.json({ messages });
  } catch {
    res.status(500).json({ error: 'خطأ في جلب الرسائل' });
  }
});

app.post('/api/chat', auth, rateLimit({ windowMs: 60000, max: 30, key: function chatUser(req) { return req.user_id; } }), async (req, res) => {
  const { message, conversationId, model, temperature, maxTokens } = validateChatInput(req.body);
  if (!message) return res.status(400).json({ error: 'Mesaj gerekli.' });
  if (!openai) return res.status(503).json({ error: 'AI bağlantısı için OPENAI_API_KEY ayarlanmalı.' });
  let reserved = false;
  let conversation_id = conversationId;
  try {
    if (conversation_id) {
      const owned = await ownedConversation(req.user_id, conversation_id);
      if (!owned) return res.status(404).json({ error: 'المحادثة غير موجودة.' });
    } else {
      const conv = await db.one('INSERT INTO conversations(user_id,title) VALUES($1,$2) RETURNING id', [req.user_id, message.slice(0, 50)]);
      conversation_id = conv.id;
    }

    const reservedResult = await db.tx(async t => {
      const result = await t.result('UPDATE users SET credits=credits-1 WHERE id=$1 AND credits>0', [req.user_id]);
      if (result.rowCount !== 1) return false;
      await t.none('INSERT INTO credit_ledger(user_id,amount,reason) VALUES($1,$2,$3)', [req.user_id, -1, 'AI kullanımı - rezervasyon']);
      return true;
    });
    if (!reservedResult) return res.status(402).json({ error: 'Kredi bakiyeniz bitti.' });
    reserved = true;

    const history = await db.any('SELECT role,content FROM messages WHERE conversation_id=$1 AND role IN ($2,$3) ORDER BY id DESC LIMIT 20', [conversation_id, 'user', 'assistant']);
    history.reverse();
    const messages = [
      { role: 'system', content: 'Sen STAR AI platformunun Türkçe yapay zekâ asistanısın. Net, faydalı ve profesyonel cevaplar ver.' },
      ...history,
      { role: 'user', content: message }
    ];

    const response = await openai.chat.completions.create({ model, messages, max_tokens: maxTokens, temperature });
    const answer = response.choices[0]?.message?.content || 'Yanıt alınamadı.';

    await db.tx(async t => {
      await t.none('INSERT INTO messages(conversation_id,role,content,model,temperature,max_tokens) VALUES($1,$2,$3,$4,$5,$6)', [conversation_id, 'user', message, model, temperature, maxTokens]);
      await t.none('INSERT INTO messages(conversation_id,role,content,model,temperature,max_tokens) VALUES($1,$2,$3,$4,$5,$6)', [conversation_id, 'assistant', answer, model, temperature, maxTokens]);
      await t.none('UPDATE conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND user_id=$2', [conversation_id, req.user_id]);
    });
    reserved = false;
    const fresh = await db.one('SELECT credits FROM users WHERE id=$1', [req.user_id]);
    res.json({ answer, credits: fresh.credits, conversation_id });
  } catch (e) {
    if (reserved) {
      try { await addCredits(req.user_id, 1, 'AI rezervasyon iadesi'); } catch (refundError) { console.error('Credit refund error:', refundError); }
    }
    console.error('OpenAI Error:', e);
    res.status(500).json({ error: 'AI isteği başarısız oldu.' });
  }
});

app.get('/api/conversations/:id/export', auth, async (req, res) => {
  try {
    const convId = Number(req.params.id);
    const conv = await ownedConversation(req.user_id, convId);
    if (!conv) return res.status(404).json({ error: 'المحادثة غير موجودة.' });
    const messages = await db.any('SELECT role,content,created_at FROM messages WHERE conversation_id=$1 ORDER BY id ASC', [convId]);
    res.json({ conversation: conv, messages });
  } catch {
    res.status(500).json({ error: 'Dışa aktarma başarısız.' });
  }
});

app.get('/api/search/:query', auth, async (req, res) => {
  try {
    const query = String(req.params.query || '').trim().slice(0, 200);
    if (!query) return res.json({ results: [] });
    const rows = await db.any(`SELECT m.id,m.conversation_id,m.role,m.content,m.created_at,c.title FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.user_id=$1 AND m.content ILIKE $2 ORDER BY m.id DESC LIMIT 50`, [req.user_id, `%${query}%`]);
    res.json({ results: rows });
  } catch {
    res.status(500).json({ error: 'Arama başarısız.' });
  }
});

app.delete('/api/conversations/:id', auth, async (req, res) => {
  try {
    const convId = Number(req.params.id);
    const conv = await ownedConversation(req.user_id, convId);
    if (!conv) return res.status(404).json({ error: 'المحادثة غير موجودة.' });
    await db.tx(async t => {
      await t.none('DELETE FROM messages WHERE conversation_id=$1', [convId]);
      await t.none('DELETE FROM conversations WHERE id=$1 AND user_id=$2', [convId, req.user_id]);
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Silme başarısız.' });
  }
});

app.get('/api/admin/overview', auth, adminOnly, async (req, res) => {
  try {
    const [users, revenue, recent] = await Promise.all([
      db.one('SELECT COUNT(*)::int AS count FROM users'),
      db.one('SELECT COALESCE(SUM(amount),0)::int AS credits_added FROM credit_ledger WHERE amount>0'),
      db.any('SELECT id,name,email,plan,credits,created_at FROM users ORDER BY id DESC LIMIT 20')
    ]);
    res.json({ users: users.count, credits_added: revenue.credits_added, recent });
  } catch {
    res.status(500).json({ error: 'Admin verileri alınamadı.' });
  }
});

app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
app.get('/{*splat}', (req, res) => res.sendFile('index.html', { root: process.cwd() }));

const PORT = Number(process.env.PORT || 3000);
async function start() {
  await initializeDatabase();
  await createAdminIfNotExists();
  app.listen(PORT, () => console.log(`STAR AI running on port ${PORT}`));
}
start().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
