import fs from 'node:fs';

const serverFile = new URL('./server.js', import.meta.url);
let server = fs.readFileSync(serverFile, 'utf8');

if (!server.includes('STAR_AI_MOBILE_AUTH_V1')) {
  const marker = '// STAR_AI_MOBILE_AUTH_V1';
  const authPatch = `

// STAR_AI_MOBILE_AUTH_V1
function issueMobileTokens(user) {
  const accessToken = jwt.sign({ id: user.id, typ: 'access' }, SIGNING_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: user.id, typ: 'refresh' }, SIGNING_SECRET, { expiresIn: '30d' });
  return { access_token: accessToken, refresh_token: refreshToken, token_type: 'Bearer', expires_in: 900 };
}
function mobileBearer(req) {
  const header = String(req.get('authorization') || '');
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}
function mobileAuth(req, res, next) {
  try {
    const token = mobileBearer(req);
    if (!token) return res.status(401).json({ error: 'Bearer token gerekli.' });
    const payload = jwt.verify(token, SIGNING_SECRET);
    if (payload.typ !== 'access' || !Number.isInteger(Number(payload.id))) return res.status(401).json({ error: 'Access token geçersiz.' });
    req.user_id = Number(payload.id);
    next();
  } catch { return res.status(401).json({ error: 'Access token geçersiz veya süresi dolmuş.' }); }
}

app.post('/api/auth/mobile/login', rateLimit({ windowMs: 15 * 60000, max: 10, scope: 'mobile-login' }), async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 254);
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ error: 'E-posta ve şifre gerekli.' });
    const user = await db.oneOrNone('SELECT id,name,email,password_hash,plan,credits,role FROM users WHERE email=$1', [email]);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
    res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, plan: user.plan, credits: user.credits, role: user.role }, ...issueMobileTokens(user) });
  } catch (error) { console.error('Mobile login error:', error); res.status(500).json({ error: 'Giriş işlemi başarısız.' }); }
});

app.post('/api/auth/mobile/register', rateLimit({ windowMs: 15 * 60000, max: 5, scope: 'mobile-register' }), async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim().slice(0, 100);
    const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 254);
    const password = String(req.body?.password || '');
    if (name.length < 2 || !email || password.length < 8) return res.status(400).json({ error: 'İsim, geçerli e-posta ve en az 8 karakterli şifre gerekli.' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await db.one('INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,plan,credits,role', [name, email, passwordHash]);
    await db.none('INSERT INTO credit_ledger(user_id,amount,reason) VALUES($1,$2,$3)', [user.id, user.credits, 'Initial credits']);
    res.status(201).json({ ok: true, user, ...issueMobileTokens(user) });
  } catch (error) {
    if (error?.code === '23505') return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı.' });
    console.error('Mobile register error:', error); res.status(500).json({ error: 'Kayıt işlemi başarısız.' });
  }
});

app.post('/api/auth/mobile/refresh', rateLimit({ windowMs: 15 * 60000, max: 30, scope: 'mobile-refresh' }), async (req, res) => {
  try {
    const token = String(req.body?.refresh_token || '').trim();
    const payload = jwt.verify(token, SIGNING_SECRET);
    if (payload.typ !== 'refresh' || !Number.isInteger(Number(payload.id))) return res.status(401).json({ error: 'Refresh token geçersiz.' });
    const user = await db.oneOrNone('SELECT id,name,email,plan,credits,role FROM users WHERE id=$1', [payload.id]);
    if (!user) return res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
    res.json({ ok: true, user, ...issueMobileTokens(user) });
  } catch { res.status(401).json({ error: 'Refresh token geçersiz veya süresi dolmuş.' }); }
});

app.get('/api/auth/mobile/me', mobileAuth, async (req, res) => {
  const user = await db.oneOrNone('SELECT id,name,email,plan,credits,role FROM users WHERE id=$1', [req.user_id]);
  if (!user) return res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
  res.json({ ok: true, user });
});
`;
  server = server.replace("function auth(req, res, next) {", authPatch + "\nfunction auth(req, res, next) {");
  const originalAuth = `    const token = req.cookies?.star_token;\n    if (!token) return res.status(401).json({ error: 'Giriş yapmanız gerekiyor.' });`;
  const patchedAuth = `    const token = req.cookies?.star_token || mobileBearer(req);\n    if (!token) return res.status(401).json({ error: 'Giriş yapmanız gerekiyor.' });`;
  if (server.includes(originalAuth)) server = server.replace(originalAuth, patchedAuth);
  fs.writeFileSync(serverFile, server);
}
console.log('STAR AI mobile bearer authentication enabled.');
