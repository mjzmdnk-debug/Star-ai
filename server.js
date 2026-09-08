import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pgPromise from 'pg-promise';
import OpenAI from 'openai';
import crypto from 'node:crypto';

const pgp = pgPromise();
const databaseUrl = String(process.env.DATABASE_URL || '').trim();
if (!databaseUrl && process.env.NODE_ENV === 'production') {
  throw new Error('DATABASE_URL must be set in production.');
}
const db = pgp(databaseUrl || 'postgresql://localhost/star_ai');
const app = express();

const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET = String(process.env.JWT_SECRET || '').trim();
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '');
const AI_MODEL = String(process.env.AI_MODEL || 'gpt-4o-mini').trim() || 'gpt-4o-mini';
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

if (isProduction && JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a strong value (at least 32 characters) in production.');
}
const SIGNING_SECRET = JWT_SECRET || 'local-development-secret';

const PLANS = {
  free: { name: 'Ücretsiz', price: 0, credits: 100 },
  basic: { name: 'Basic', price: 199, credits: 5000 },
  pro: { name: 'Pro', price: 399, credits: 15000 },
  business: { name: 'Business', price: 799, credits: 30000 }
};

const basicId = String(process.env.SHOPIER_PRODUCT_BASIC_ID || '50673465').trim();
const proId = String(process.env.SHOPIER_PRODUCT_PRO_ID || '50673487').trim();
const businessId = String(process.env.SHOPIER_PRODUCT_BUSINESS_ID || '').trim();
const SHOPIER_PRODUCTS = {
  basic: { id: basicId, name: 'STAR AI Basic', price: 199, credits: 5000, url: `https://shopier.com/${basicId}` },
  pro: { id: proId, name: 'STAR AI Pro', price: 399, credits: 15000, url: `https://shopier.com/${proId}` },
  ...(businessId ? { business: { id: businessId, name: 'STAR AI Business', price: 799, credits: 30000, url: `https://shopier.com/${businessId}` } } : {})
};

const allowedModels = new Set([AI_MODEL, 'gpt-4o-mini']);
const SYSTEM_PROMPT = 'Sen STAR AI platformunun Türkçe yapay zekâ asistanısın. Net, faydalı ve profesyonel cevaplar ver.';

function parseTrustProxy(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw || raw === 'false' || raw === '0' || raw === 'off' || raw === 'none') return false;
  if (raw === 'true') return 1;
  if (/^\d+$/.test(raw)) return Number(raw);
  if (raw.includes(',')) return raw.split(',').map(v => v.trim()).filter(Boolean);
  return raw;
}
const defaultTrustProxy = String(process.env.RENDER || '').toLowerCase() === 'true' ? 1 : 0;
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY ?? defaultTrustProxy));

const RATE_LIMIT_MAX_KEY_LENGTH = 200;
async function enforceRateLimit(req, res, next, { windowMs, max, scope, getKey = clientKey }) {
  const identifier = String(getKey(req) || 'unknown').slice(0, RATE_LIMIT_MAX_KEY_LENGTH);
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  try {
    const result = await db.one(`
      INSERT INTO rate_limits(scope,bucket_key,window_started,count)
      VALUES($1,$2,$3,1)
      ON CONFLICT(scope,bucket_key) DO UPDATE
      SET window_started=CASE WHEN rate_limits.window_started=$3 THEN rate_limits.window_started ELSE $3 END,
          count=CASE WHEN rate_limits.window_started=$3 THEN rate_limits.count+1 ELSE 1 END
      RETURNING count
    `, [scope, identifier, windowStart]);
    if (Number(result.count) > max) {
      const retryAfter = Math.max(1, Math.ceil(((windowStart + windowMs) - now) / 1000));
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({ error: 'Çok fazla istek gönderildi. Lütfen biraz sonra tekrar deneyin.' });
    }
    next();
  } catch (error) {
    console.error('Rate limit error:', error);
    return res.status(503).json({ error: 'İstek sınırı servisi geçici olarak kullanılamıyor.' });
  }
}
function clientKey(req) {
  return String(req.ip || req.socket?.remoteAddress || 'unknown');
}
function rateLimit(options) {
  return (req, res, next) => enforceRateLimit(req, res, next, options);
}
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  db.none('DELETE FROM rate_limits WHERE window_started < $1', [cutoff]).catch(error => {
    console.error('Rate limit cleanup error:', error);
  });
}, 15 * 60 * 1000).unref();

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function sameOrigin(req) {
  const origin = req.get('origin');
  if (!origin) return true;
  const expected = `${req.protocol}://${req.get('host')}`;
  return safeEqual(origin, expected);
}
function csrfProtection(req, res, next) {
  if (req.path === '/api/shopier/webhook') return next();
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Origin not allowed.' });
  next();
}
function setAuthCookie(res, user) {
  res.cookie('star_token', jwt.sign({ id: user.id }, SIGNING_SECRET, { expiresIn: '30d' }), {
    httpOnly: true, sameSite: 'lax', secure: isProduction, maxAge: 30 * 86400000, path: '/'
  });
}
function auth(req, res, next) {
  try {
    const token = req.cookies?.star_token;
    if (!token) return res.status(401).json({ error: 'Giriş yapmanız gerekiyor.' });
    const payload = jwt.verify(token, SIGNING_SECRET);
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

async function initializeDatabase() {
  await db.none(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'free', credits INTEGER NOT NULL DEFAULT 100 CHECK (credits >= 0),
      role TEXT NOT NULL DEFAULT 'user', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS credit_ledger (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), amount INTEGER NOT NULL,
      reason TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), plan TEXT NOT NULL, status TEXT NOT NULL,
      iyzico_subscription_ref TEXT, iyzico_customer_ref TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS webhook_events (
      id SERIAL PRIMARY KEY, event_ref TEXT UNIQUE, event_type TEXT, payload TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS payment_transactions (
      id SERIAL PRIMARY KEY, order_id TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL REFERENCES users(id),
      plan TEXT NOT NULL, amount NUMERIC(12,2) NOT NULL, currency TEXT NOT NULL DEFAULT 'TRY',
      status TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS rate_limits (
      scope TEXT NOT NULL, bucket_key TEXT NOT NULL, window_started BIGINT NOT NULL, count INTEGER NOT NULL,
      PRIMARY KEY (scope, bucket_key)
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY, conversation_id INTEGER NOT NULL REFERENCES conversations(id),
      role TEXT NOT NULL CHECK (role IN ('user','assistant','system')), content TEXT NOT NULL, model TEXT NOT NULL,
      temperature REAL NOT NULL, max_tokens INTEGER NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE credit_ledger ADD COLUMN IF NOT EXISTS order_id TEXT;
    ALTER TABLE credit_ledger ADD COLUMN IF NOT EXISTS currency TEXT;
    ALTER TABLE credit_ledger ADD COLUMN IF NOT EXISTS amount_value NUMERIC(12,2);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_id ON credit_ledger(user_id);
    CREATE INDEX IF NOT EXISTS idx_credit_ledger_order_id ON credit_ledger(order_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_rate_limits_window_started ON rate_limits(window_started);
  `);
}
async function createAdminIfNotExists() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return;
  const existing = await db.oneOrNone('SELECT id FROM users WHERE email=$1', [ADMIN_EMAIL]);
  if (!existing) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await db.none('INSERT INTO users(name,email,password_hash,plan,credits,role) VALUES($1,$2,$3,$4,$5,$6)',
      ['STAR AI Admin', ADMIN_EMAIL, hash, 'business', 0, 'admin']);
  }
}
function validateChatInput(body) {
  const message = String(body?.message || '').trim().slice(0, 12000);
  const rawId = Number(body?.conversation_id || 0);
  const conversationId = Number.isInteger(rawId) && rawId > 0 ? rawId : 0;
  const requestedModel = String(body?.model || AI_MODEL);
  const model = allowedModels.has(requestedModel) ? requestedModel : AI_MODEL;
  const requestedTemperature = Number(body?.temperature);
  const temperature = Number.isFinite(requestedTemperature) ? Math.min(1.5, Math.max(0, requestedTemperature)) : 0.7;
  const requestedMaxTokens = Number(body?.max_tokens);
  const maxTokens = Number.isInteger(requestedMaxTokens) ? Math.min(2000, Math.max(100, requestedMaxTokens)) : 800;
  return { message, conversationId, model, temperature, maxTokens };
}
function firstValue(...values) {
  for (const value of values) if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  return null;
}
function findNestedValue(root, keys, maxDepth = 5) {
  const wanted = new Set(keys.map(k => k.toLowerCase()));
  const seen = new Set();
  function walk(value, depth) {
    if (!value || depth > maxDepth || typeof value !== 'object' || seen.has(value)) return null;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) { const found = walk(item, depth + 1); if (found !== null) return found; }
      return null;
    }
    for (const [key, val] of Object.entries(value)) {
      if (wanted.has(key.toLowerCase()) && val !== undefined && val !== null && typeof val !== 'object') return val;
    }
    for (const val of Object.values(value)) { const found = walk(val, depth + 1); if (found !== null) return found; }
    return null;
  }
  return walk(root, 0);
}
function extractOrder(body) {
  const order = body?.order && typeof body.order === 'object' ? body.order : (body?.data && typeof body.data === 'object' ? body.data : body);
  const orderId = String(firstValue(
    order?.id, order?.orderId, order?.order_id, body?.orderId, body?.order_id,
    findNestedValue(body, ['order_id', 'orderId', 'orderNumber', 'orderNo', 'order_number'])
  ) || '').trim();
  const buyerEmail = String(firstValue(
    order?.buyer?.email, order?.customer?.email, order?.customer_email, order?.buyerEmail,
    order?.email, body?.buyerEmail, body?.email, findNestedValue(body, ['buyer_email', 'customer_email', 'email'])
  ) || '').trim().toLowerCase();
  const status = String(firstValue(
    order?.paymentStatus, order?.payment_status, order?.status, body?.paymentStatus, body?.payment_status, body?.status,
    findNestedValue(body, ['payment_status', 'paymentStatus', 'payment_state'])
  ) || '').trim().toLowerCase();
  const currency = String(firstValue(order?.currency, order?.currencyCode, body?.currency, findNestedValue(body, ['currency', 'currencyCode'])) || 'TRY').trim().toUpperCase();
  const amountRaw = firstValue(
    order?.total, order?.totalAmount, order?.amount, order?.grandTotal, body?.amount, body?.total,
    findNestedValue(body, ['total_amount', 'totalAmount', 'grand_total'])
  );
  const amount = Number(amountRaw);
  const items = firstValue(order?.lineItems, order?.line_items, order?.items, body?.lineItems, body?.line_items, body?.items);
  let productId = '';
  const list = Array.isArray(items) ? items : [];
  for (const item of list) {
    productId = String(firstValue(item?.productId, item?.product_id, item?.id, item?.product?.id) || '').trim();
    if (productId) break;
  }
  if (!productId) productId = String(firstValue(order?.productId, order?.product_id, body?.productId, body?.product_id, findNestedValue(body, ['product_id', 'productId'])) || '').trim();
  return { orderId, buyerEmail, status, currency, amount: Number.isFinite(amount) ? amount : null, productId };
}
function isPaidStatus(status) {
  return new Set(['paid', 'success', 'completed', 'payment_success', 'succeeded']).has(status);
}

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb', verify: (req, res, buffer) => { req.rawBody = Buffer.from(buffer); } }));
app.use(cookieParser());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cache-Control', req.path.startsWith('/api/') ? 'no-store' : 'public, max-age=300');
  if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
app.use(csrfProtection);

const blockedPublicPaths = new Set(['/server.js', '/package.json', '/package-lock.json', '/.env', '/STAR-AI-COMMERCIAL-MVP-ADMIN.zip']);
app.use((req, res, next) => {
  if (blockedPublicPaths.has(req.path) || req.path.startsWith('/.git') || /\.(js|map|zip|env)$/i.test(req.path)) return res.status(404).end();
  next();
});
app.use(express.static('.'));

app.get('/api/health', async (req, res) => {
  let database = false;
  try { await db.one('SELECT 1 AS ok'); database = true; } catch {}
  res.status(database ? 200 : 503).json({
    ok: database,
    database,
    aiConfigured: Boolean(openai),
    paymentConfigured: Boolean(process.env.SHOPIER_WEBHOOK_SECRET),
    model: AI_MODEL,
    environment: isProduction ? 'production' : 'development'
  });
});

app.post('/api/billing/checkout', auth, rateLimit({ windowMs: 60000, max: 20, scope: 'checkout', getKey: req => `user:${req.user_id}` }), async (req, res) => {
  const plan = String(req.body?.plan || '').toLowerCase();
  const product = SHOPIER_PRODUCTS[plan];
  if (!product) return res.status(400).json({ error: 'Bu plan için ödeme bağlantısı mevcut değil.' });
  res.json({ ok: true, plan, name: product.name, price: product.price, credits: product.credits, paymentPageUrl: product.url });
});

app.post('/api/shopier/webhook', rateLimit({ windowMs: 60000, max: 60, scope: 'webhook' }), async (req, res) => {
  try {
    const secret = String(process.env.SHOPIER_WEBHOOK_SECRET || '').trim();
    if (!secret) return res.status(503).json({ error: 'Webhook token is not configured.' });
    const received = String(req.get('Shopier-Signature') || '').trim();
    const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(JSON.stringify(req.body || {}));
    const expectedHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const expectedBase64 = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
    if (!received || (!safeEqual(received, expectedHex) && !safeEqual(received, expectedBase64))) {
      return res.status(401).json({ error: 'Invalid webhook signature.' });
    }

    const body = req.body || {};
    const event = String(body.event || body.type || body.event_type || '').trim().toLowerCase();
    if (event && !['order.created', 'order.paid', 'payment.succeeded', 'payment.created', 'payment.completed'].includes(event)) {
      return res.status(200).json({ ok: true, ignored: true });
    }
    const order = extractOrder(body);
    if (!order.orderId) return res.status(400).json({ error: 'Order ID missing.' });
    if (!isPaidStatus(order.status)) return res.status(200).json({ ok: true, paymentStatus: order.status || 'unknown' });
    if (!order.buyerEmail) return res.status(400).json({ error: 'Buyer email missing.' });

    let plan = null;
    for (const [candidate, product] of Object.entries(SHOPIER_PRODUCTS)) {
      if (product.id === order.productId) { plan = candidate; break; }
    }
    if (!plan) return res.status(400).json({ error: 'Product not recognized.' });
    const product = SHOPIER_PRODUCTS[plan];
    const eventRef = `shopier-order-${order.orderId}`;

    await db.tx(async t => {
      const inserted = await t.result(
        'INSERT INTO webhook_events(event_ref,event_type,payload) VALUES($1,$2,$3) ON CONFLICT(event_ref) DO NOTHING',
        [eventRef, event || 'shopier.payment', JSON.stringify(body)]
      );
      if (inserted.rowCount !== 1) return;

      const user = await t.oneOrNone('SELECT id FROM users WHERE email=$1 FOR UPDATE', [order.buyerEmail]);
      if (!user) throw new Error('STAR AI user not found.');

      await t.none('UPDATE users SET credits=credits+$1, plan=$2 WHERE id=$3', [product.credits, plan, user.id]);
      await t.none(
        'INSERT INTO credit_ledger(user_id,amount,reason,order_id,currency,amount_value) VALUES($1,$2,$3,$4,$5,$6)',
        [user.id, product.credits, `Shopier ${product.name} - Order ${order.orderId}`, order.orderId, order.currency, order.amount ?? product.price]
      );
      await t.none(
        'INSERT INTO payment_transactions(order_id,user_id,plan,amount,currency,status) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(order_id) DO NOTHING',
        [order.orderId, user.id, plan, order.amount ?? product.price, order.currency, 'paid']
      );
      await t.none(
        'INSERT INTO subscriptions(user_id,plan,status,iyzico_subscription_ref,iyzico_customer_ref) VALUES($1,$2,$3,$4,$5)',
        [user.id, plan, 'active', order.orderId, 'shopier']);
    });
    res.status(200).json({ ok: true, plan, credits: product.credits });
  } catch (e) {
    console.error('Shopier webhook error:', e);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
});

app.post('/api/auth/register', rateLimit({ windowMs: 15 * 60000, max: 10, scope: 'register' }), async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim().slice(0, 100);
    const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 254);
    const password = String(req.body?.password || '');
    if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || password.length > 200) {
      return res.status(400).json({ error: 'Ad, geçerli e-posta ve 8-200 karakterli şifre gerekli.' });
    }
    const hash = await bcrypt.hash(password, 12);
    const result = await db.one(
      'INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,plan,credits,role',
      [name, email, hash]
    );
    setAuthCookie(res, result);
    res.status(201).json({ user: result });
  } catch (e) {
    if (e?.code === '23505') return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı.' });
    console.error('Register error:', e);
    res.status(500).json({ error: 'Kayıt işlemi başarısız.' });
  }
});

app.post('/api/auth/login', rateLimit({ windowMs: 15 * 60000, max: 10, scope: 'login' }), async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 254);
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ error: 'E-posta ve şifre gerekli.' });
    const user = await db.oneOrNone('SELECT id,name,email,password_hash,plan,credits,role FROM users WHERE email=$1', [email]);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
    const safeUser = { id: user.id, name: user.name, email: user.email, plan: user.plan, credits: user.credits, role: user.role };
    setAuthCookie(res, safeUser);
    res.json({ user: safeUser });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Giriş işlemi başarısız.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('star_token', { httpOnly: true, sameSite: 'lax', secure: isProduction, path: '/' });
  res.json({ ok: true });
});

app.get('/api/me', auth, async (req, res) => {
  const user = await db.oneOrNone('SELECT id,name,email,plan,credits,role,created_at FROM users WHERE id=$1', [req.user_id]);
  if (!user) return res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
  res.json({ user });
});

app.get('/api/credits/history', auth, async (req, res) => {
  const rows = await db.any('SELECT id,amount,reason,order_id,currency,amount_value,created_at FROM credit_ledger WHERE user_id=$1 ORDER BY id DESC LIMIT 100', [req.user_id]);
  res.json({ rows });
});

app.get('/api/conversations', auth, async (req, res) => {
  const conversations = await db.any('SELECT id,title,created_at,updated_at FROM conversations WHERE user_id=$1 ORDER BY updated_at DESC,id DESC LIMIT 100', [req.user_id]);
  res.json({ conversations });
});
app.get('/api/conversations/:id/messages', auth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Geçersiz konuşma.' });
  const conversation = await db.oneOrNone('SELECT id FROM conversations WHERE id=$1 AND user_id=$2', [id, req.user_id]);
  if (!conversation) return res.status(404).json({ error: 'Konuşma bulunamadı.' });
  const messages = await db.any('SELECT id,role,content,model,temperature,max_tokens,created_at FROM messages WHERE conversation_id=$1 ORDER BY id ASC LIMIT 200', [id]);
  res.json({ messages });
});
app.delete('/api/conversations/:id', auth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Geçersiz konuşma.' });
  const exists = await db.oneOrNone('SELECT id FROM conversations WHERE id=$1 AND user_id=$2', [id, req.user_id]);
  if (!exists) return res.status(404).json({ error: 'Konuşma bulunamadı.' });
  await db.tx(async t => {
    await t.none('DELETE FROM messages WHERE conversation_id=$1', [id]);
    await t.none('DELETE FROM conversations WHERE id=$1 AND user_id=$2', [id, req.user_id]);
  });
  res.json({ ok: true });
});
app.get('/api/conversations/:id/export', auth, async (req, res) => {
  const id = Number(req.params.id);
  const conversation = await db.oneOrNone('SELECT id,title,created_at,updated_at FROM conversations WHERE id=$1 AND user_id=$2', [id, req.user_id]);
  if (!conversation) return res.status(404).json({ error: 'Konuşma bulunamadı.' });
  const messages = await db.any('SELECT role,content,model,created_at FROM messages WHERE conversation_id=$1 ORDER BY id ASC', [id]);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="star-ai-conversation-${id}.json"`);
  res.json({ conversation, messages });
});
app.get('/api/search/:query', auth, async (req, res) => {
  const query = String(req.params.query || '').trim().slice(0, 200);
  if (!query) return res.json({ rows: [] });
  const pattern = `%${query.replace(/[%_]/g, '\\$&')}%`;
  const rows = await db.any(
    `SELECT c.id,c.title,c.updated_at FROM conversations c WHERE c.user_id=$1 AND (c.title ILIKE $2 OR EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id=c.id AND m.content ILIKE $2)) ORDER BY c.updated_at DESC LIMIT 50`,
    [req.user_id, pattern]
  );
  res.json({ rows });
});

app.post('/api/chat', auth, rateLimit({ windowMs: 60000, max: 30, scope: 'chat', getKey: req => `user:${req.user_id}` }), async (req, res) => {
  if (!openai) return res.status(503).json({ error: 'AI service is not configured.' });
  const { message, conversationId, model, temperature, maxTokens } = validateChatInput(req.body);
  if (!message) return res.status(400).json({ error: 'Mesaj gerekli.' });

  let reserved = false;
  let convId = conversationId;
  try {
    await db.tx(async t => {
      if (convId) {
        const conversation = await t.oneOrNone('SELECT id FROM conversations WHERE id=$1 AND user_id=$2 FOR UPDATE', [convId, req.user_id]);
        if (!conversation) throw Object.assign(new Error('CONVERSATION_NOT_FOUND'), { status: 404 });
      } else {
        const created = await t.one('INSERT INTO conversations(user_id,title) VALUES($1,$2) RETURNING id', [req.user_id, message.slice(0, 80)]);
        convId = created.id;
      }
      const updated = await t.oneOrNone('UPDATE users SET credits=credits-1 WHERE id=$1 AND credits>0 RETURNING credits', [req.user_id]);
      if (!updated) throw Object.assign(new Error('INSUFFICIENT_CREDITS'), { status: 402 });
      await t.none('INSERT INTO credit_ledger(user_id,amount,reason) VALUES($1,$2,$3)', [req.user_id, -1, 'AI usage']);
      reserved = true;
    });

    const history = await db.any(
      `SELECT role,content FROM messages WHERE conversation_id=$1 AND role IN ('user','assistant') ORDER BY id DESC LIMIT 20`,
      [convId]
    );
    history.reverse();
    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history, { role: 'user', content: message }],
      temperature,
      max_tokens: maxTokens
    });
    const answer = String(completion.choices?.[0]?.message?.content || '').trim();
    if (!answer) throw new Error('Empty AI response');

    const saved = await db.tx(async t => {
      await t.none('INSERT INTO messages(conversation_id,role,content,model,temperature,max_tokens) VALUES($1,$2,$3,$4,$5,$6)',
        [convId, 'user', message, model, temperature, maxTokens]);
      await t.none('INSERT INTO messages(conversation_id,role,content,model,temperature,max_tokens) VALUES($1,$2,$3,$4,$5,$6)',
        [convId, 'assistant', answer, model, temperature, maxTokens]);
      await t.none('UPDATE conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=$1', [convId]);
      return t.one('SELECT credits FROM users WHERE id=$1', [req.user_id]);
    });
    reserved = false;
    res.json({ ok: true, answer, conversation_id: convId, credits: saved.credits });
  } catch (e) {
    if (reserved) {
      try {
        await db.tx(async t => {
          await t.none('UPDATE users SET credits=credits+1 WHERE id=$1', [req.user_id]);
          await t.none('INSERT INTO credit_ledger(user_id,amount,reason) VALUES($1,$2,$3)', [req.user_id, 1, 'AI request refund']);
        });
      } catch (refundError) {
        console.error('Credit refund failed:', refundError);
      }
    }
    if (e.status === 404) return res.status(404).json({ error: 'Konuşma bulunamadı.' });
    if (e.status === 402) return res.status(402).json({ error: 'Yeterli Credits bulunmuyor.' });
    console.error('Chat error:', e);
    res.status(500).json({ error: 'AI yanıtı alınamadı.' });
  }
});

app.get('/api/admin/overview', auth, adminOnly, async (req, res) => {
  const [stats, byPlan, recent, usage, revenue] = await Promise.all([
    db.one(`SELECT COUNT(*)::int AS users, COUNT(*) FILTER (WHERE plan <> 'free')::int AS paid, COALESCE(SUM(credits),0)::int AS credits FROM users`),
    db.any(`SELECT plan, COUNT(*)::int AS count FROM users GROUP BY plan ORDER BY plan`),
    db.any(`SELECT u.id,u.name,u.email,u.plan,u.credits,u.role,u.created_at FROM users u ORDER BY u.created_at DESC LIMIT 10`),
    db.one(`SELECT COALESCE(-SUM(amount),0)::int AS usage FROM credit_ledger WHERE reason='AI usage'`),
    db.one(`SELECT COALESCE(SUM(amount),0)::numeric(12,2) AS revenue FROM payment_transactions WHERE status='paid'`)
  ]);
  res.json({
    stats: {
      users: Number(stats.users),
      paid: Number(stats.paid),
      credits: Number(stats.credits),
      usage: Number(usage.usage),
      revenue: Number(revenue.revenue)
    },
    byPlan,
    recent
  });
});
app.get('/api/admin/users', auth, adminOnly, async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  const pattern = `%${q.replace(/[%_]/g, '\\$&')}%`;
  const rows = await db.any(
    `SELECT id,name,email,plan,credits,role,created_at FROM users WHERE ($1='' OR name ILIKE $2 OR email ILIKE $2) ORDER BY id DESC LIMIT 200`,
    [q, pattern]
  );
  res.json({ rows });
});
app.post('/api/admin/users/:id/credits', auth, adminOnly, async (req, res) => {
  const userId = Number(req.params.id);
  const amount = Number(req.body?.amount);
  if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 1000000) {
    return res.status(400).json({ error: 'Geçerli bir credits miktarı gerekli.' });
  }
  try {
    const user = await db.tx(async t => {
      const current = await t.oneOrNone('SELECT id,credits FROM users WHERE id=$1 FOR UPDATE', [userId]);
      if (!current) throw Object.assign(new Error('NOT_FOUND'), { status: 404 });
      const next = Number(current.credits) + amount;
      if (next < 0) throw Object.assign(new Error('NEGATIVE'), { status: 400 });
      const updated = await t.one('UPDATE users SET credits=$1 WHERE id=$2 RETURNING id,name,email,plan,credits,role', [next, userId]);
      await t.none('INSERT INTO credit_ledger(user_id,amount,reason) VALUES($1,$2,$3)', [userId, amount, `Admin adjustment by ${req.user_id}`]);
      return updated;
    });
    res.json({ user });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message === 'NEGATIVE' ? 'Credits negatif olamaz.' : 'Kullanıcı bulunamadı.' });
    console.error('Admin credit error:', e);
    res.status(500).json({ error: 'Credits güncellenemedi.' });
  }
});
app.post('/api/admin/users/:id/plan', auth, adminOnly, async (req, res) => {
  const userId = Number(req.params.id);
  const plan = String(req.body?.plan || '').toLowerCase();
  if (!Number.isInteger(userId) || userId <= 0 || !PLANS[plan]) return res.status(400).json({ error: 'Geçersiz kullanıcı veya plan.' });
  const user = await db.oneOrNone('UPDATE users SET plan=$1 WHERE id=$2 RETURNING id,name,email,plan,credits,role', [plan, userId]);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  res.json({ user });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
app.get('/{*splat}', (req, res) => res.sendFile('index.html', { root: process.cwd() }));

app.use((error, req, res, next) => {
  console.error('Unhandled request error:', error);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: 'Beklenmeyen sunucu hatası.' });
});

const port = Number(process.env.PORT || 3000);
async function start() {
  await initializeDatabase();
  await createAdminIfNotExists();
  await db.one('SELECT 1');
  app.listen(port, '0.0.0.0', () => console.log(`STAR AI listening on ${port}`));
}
start().catch(error => {
  console.error('Startup failed:', error);
  process.exit(1);
});
