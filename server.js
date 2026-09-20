import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3001);
const dbFilePath = path.join(__dirname, 'data', 'forum.sqlite');
const SQL = await initSqlJs();
const sessions = new Map();
const authAttempts = new Map();
const SESSION_TTL = 8 * 60 * 60 * 1000;
const PRESENCE_TTL = 45 * 1000;
const CREATOR_EMAIL = 'rexgamor613@gmail.com';
const CREATOR_USERNAMES = new Set(['@mikashiiiok', '@rexgamor613']);
const CREATOR_USERNAME = '@rexgamor613';
const CREATOR_NAME = 'Rex Gamor';
const CREATOR_INITIAL_PASSWORD = process.env.CREATOR_PASSWORD || 'RexGamor613!';

const isCreatorIdentity = (username = '', email = '') => {
  const normalizedUsername = normalizeText(username).toLowerCase();
  const normalizedEmail = normalizeText(email).toLowerCase();
  return CREATOR_USERNAMES.has(normalizedUsername) || normalizedEmail === CREATOR_EMAIL.toLowerCase();
};

const hashPassword = (password) => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password, storedHash) => {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, expected] = storedHash.split(':');
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, 'hex');
  return expectedBuffer.length === actual.length && timingSafeEqual(actual, expectedBuffer);
};

const createSession = (userId) => {
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  sessions.set(token, { userId: Number(userId), expiresAt: now + SESSION_TTL, lastSeenAt: now });
  return token;
};

const getOnlineUserIds = () => {
  const now = Date.now();
  const onlineUserIds = new Set();
  sessions.forEach((session, token) => {
    if (session.expiresAt <= now) {
      sessions.delete(token);
    } else if (now - (session.lastSeenAt || 0) < PRESENCE_TTL) {
      onlineUserIds.add(session.userId);
    }
  });
  return onlineUserIds;
};

const consumeAuthAttempt = (key) => {
  const now = Date.now();
  const recent = (authAttempts.get(key) || []).filter((timestamp) => now - timestamp < 15 * 60 * 1000);
  if (recent.length >= 10) return false;
  recent.push(now);
  authAttempts.set(key, recent);
  return true;
};

fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
const db = fs.existsSync(dbFilePath) ? new SQL.Database(fs.readFileSync(dbFilePath)) : new SQL.Database();

const runSql = (query, params = []) => {
  const statement = db.prepare(query);
  statement.bind(params);
  const result = statement.step();
  statement.free();
  return result;
};

const queryAll = (query, params = []) => {
  const statement = db.prepare(query);
  statement.bind(params);
  const rows = [];
  while (statement.step()) rows.push(statement.getAsObject());
  statement.free();
  return rows;
};

const queryOne = (query, params = []) => queryAll(query, params)[0] || null;
const persistDb = () => fs.writeFileSync(dbFilePath, Buffer.from(db.export()));
const normalizeText = (value) => (value == null ? '' : String(value).trim());

const initializeDatabase = () => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    avatar TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    createdAt TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    mutedUntil TEXT DEFAULT NULL,
    muteReason TEXT DEFAULT '',
    bannedUntil TEXT DEFAULT NULL,
    banReason TEXT DEFAULT ''
  );`);
  db.run(`CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT
  );`);
  db.run(`CREATE TABLE IF NOT EXISTS threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    boardId TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    authorId INTEGER NOT NULL,
    createdAt TEXT NOT NULL,
    locked INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (boardId) REFERENCES boards(id),
    FOREIGN KEY (authorId) REFERENCES users(id)
  );`);
  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    threadId INTEGER NOT NULL,
    authorId INTEGER NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'visible',
    FOREIGN KEY (threadId) REFERENCES threads(id),
    FOREIGN KEY (authorId) REFERENCES users(id)
  );`);
  db.run(`CREATE TABLE IF NOT EXISTS support_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
  );`);
  db.run(`CREATE TABLE IF NOT EXISTS support_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticketId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (ticketId) REFERENCES support_messages(id),
    FOREIGN KEY (userId) REFERENCES users(id)
  );`);

  const columns = queryAll('PRAGMA table_info(users)').map((column) => column.name);
  const addColumn = (name, definition) => {
    if (!columns.includes(name)) db.run(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
  };
  addColumn('avatar', "TEXT DEFAULT ''");
  addColumn('username', "TEXT DEFAULT ''");
  addColumn('passwordHash', "TEXT DEFAULT ''");
  addColumn('bio', "TEXT DEFAULT ''");
  addColumn('createdAt', "TEXT NOT NULL DEFAULT ''");
  addColumn('status', "TEXT NOT NULL DEFAULT 'active'");
  addColumn('mutedUntil', 'TEXT DEFAULT NULL');
  addColumn('muteReason', "TEXT DEFAULT ''");
  addColumn('bannedUntil', 'TEXT DEFAULT NULL');
  addColumn('banReason', "TEXT DEFAULT ''");
  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)');

  runSql("UPDATE users SET username = '@user' || id WHERE username IS NULL OR username = ''", []);
  runSql("UPDATE users SET createdAt = ? WHERE createdAt = '' OR createdAt IS NULL", [new Date().toISOString()]);
  queryAll("SELECT id, password FROM users WHERE passwordHash IS NULL OR passwordHash = ''").forEach((user) => {
    if (user.password && user.password !== '[protected]') {
      runSql("UPDATE users SET passwordHash = ?, password = '[protected]' WHERE id = ?", [hashPassword(user.password), user.id]);
    }
  });
  runSql('UPDATE users SET role = ? WHERE LOWER(email) = ? OR LOWER(username) IN (?, ?)', ['creator', CREATOR_EMAIL, '@mikashiiiok', '@rexgamor613']);

  let creator = queryOne('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) IN (?, ?)', [CREATOR_EMAIL, '@mikashiiiok', '@rexgamor613']);
  if (!creator) {
    const now = new Date().toISOString();
    const statement = db.prepare('INSERT INTO users (name, username, email, password, passwordHash, role, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)');
    statement.run([CREATOR_NAME, CREATOR_USERNAME, CREATOR_EMAIL, '[protected]', hashPassword(CREATOR_INITIAL_PASSWORD), 'creator', now]);
    statement.free();
  } else if (creator.role !== 'creator') {
    runSql('UPDATE users SET role = ? WHERE id = ?', ['creator', creator.id]);
  }

  if (Number(queryOne('SELECT COUNT(*) AS count FROM boards')?.count || 0) === 0) {
    runSql('INSERT INTO boards (id, name, description) VALUES (?, ?, ?)', ['general', 'General', 'Habla de todo y comparte ideas con la comunidad.']);
    runSql('INSERT INTO boards (id, name, description) VALUES (?, ?, ?)', ['proyectos', 'Proyectos', 'Discute avances, dudas y colaboración entre miembros.']);
  }

  if (Number(queryOne('SELECT COUNT(*) AS count FROM threads')?.count || 0) === 0) {
    const adminId = queryOne('SELECT id FROM users WHERE LOWER(email) = ?', [CREATOR_EMAIL])?.id;
    const anaId = adminId;
    const luisId = adminId;
    if (!adminId) return persistDb();
    const now = new Date().toISOString();
    runSql('INSERT INTO threads (boardId, title, content, authorId, createdAt, locked) VALUES (?, ?, ?, ?, ?, ?)', ['general', 'Bienvenidos al foro', 'Este es el espacio para presentarte y compartir tus primeras ideas.', anaId, now, 0]);
    runSql('INSERT INTO threads (boardId, title, content, authorId, createdAt, locked) VALUES (?, ?, ?, ?, ?, ?)', ['proyectos', 'Ideas para la próxima versión', '¿Qué funcionalidades te gustaría ver en el siguiente proyecto?', luisId, now, 0]);
    const thread1Id = queryOne('SELECT id FROM threads WHERE title = ?', ['Bienvenidos al foro']).id;
    const thread2Id = queryOne('SELECT id FROM threads WHERE title = ?', ['Ideas para la próxima versión']).id;
    runSql('INSERT INTO posts (threadId, authorId, content, createdAt, status) VALUES (?, ?, ?, ?, ?)', [thread1Id, adminId, '¡Excelente! Este foro está listo para crecer con nuevas ideas.', now, 'visible']);
    runSql('INSERT INTO posts (threadId, authorId, content, createdAt, status) VALUES (?, ?, ?, ?, ?)', [thread1Id, anaId, 'Gracias por la bienvenida. Estoy emocionada por aprender React y diseño de foros.', now, 'visible']);
    runSql('INSERT INTO posts (threadId, authorId, content, createdAt, status) VALUES (?, ?, ?, ?, ?)', [thread2Id, luisId, 'Me gustaría una área de documentación y un panel de moderación más potente.', now, 'visible']);
  }
  persistDb();
};

initializeDatabase();
app.disable('x-powered-by');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || process.env.NODE_ENV === 'production' || /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return callback(null, true);
    return callback(new Error('Origen no permitido'));
  },
}));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' http://localhost:3001 http://127.0.0.1:3001 ws://localhost:* ws://127.0.0.1:*");
  next();
});
app.use(express.json({ limit: '32kb' }));

const serializeUser = (user) => ({
  id: user.id,
  name: user.name,
  username: user.username,
  email: user.email,
  role: user.role,
  avatar: user.avatar || '',
  bio: user.bio || '',
  createdAt: user.createdAt,
  status: user.status || 'active',
  mutedUntil: user.mutedUntil || null,
  muteReason: user.muteReason || '',
  bannedUntil: user.bannedUntil || null,
  banReason: user.banReason || '',
});
const getUser = (id) => {
  const user = queryOne('SELECT * FROM users WHERE id = ?', [Number(id)]);
  if (!user) return null;
  const now = new Date();
  if (user.bannedUntil && new Date(user.bannedUntil) <= now) {
    runSql("UPDATE users SET status = 'active', bannedUntil = NULL, banReason = '' WHERE id = ?", [Number(id)]);
    user.status = 'active';
    user.bannedUntil = null;
    user.banReason = '';
  }
  if (user.mutedUntil && new Date(user.mutedUntil) <= now) {
    runSql("UPDATE users SET mutedUntil = NULL, muteReason = '' WHERE id = ?", [Number(id)]);
    user.mutedUntil = null;
    user.muteReason = '';
  }
  return user;
};
const hasRole = (user, roles) => Boolean(user && (user.role === 'creator' || roles.includes(user.role)) && user.status !== 'banned');
const isMuted = (user) => Boolean(user?.mutedUntil && new Date(user.mutedUntil) > new Date());
const sanctionMessage = (user, action) => {
  if (user?.status === 'banned') return `Tu cuenta fue suspendida${user.bannedUntil ? ` hasta ${user.bannedUntil}` : ' permanentemente'}${user.banReason ? ` por: ${user.banReason}` : '.'}`;
  if (isMuted(user)) return `Fuiste muteado hasta ${user.mutedUntil}${user.muteReason ? ` por: ${user.muteReason}` : '.'}`;
  return `Tu cuenta no puede ${action} en este momento.`;
};
const actorFromRequest = (req) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  session.lastSeenAt = Date.now();
  return getUser(session.userId);
};
const requireRole = (req, res, roles) => {
  const actor = actorFromRequest(req);
  if (!actor) {
    res.status(401).json({ message: 'Sesión no válida o expirada' });
    return null;
  }
  if (!hasRole(actor, roles) && !(actor && actor.role === 'creator')) {
    res.status(403).json({ message: 'No tienes permisos para realizar esta acción' });
    return null;
  }
  return actor;
};
const requireAuth = (req, res) => {
  const actor = actorFromRequest(req);
  if (!actor) {
    res.status(401).json({ message: 'Sesión no válida o expirada' });
    return null;
  }
  return actor;
};
const getForumData = () => {
  const onlineUserIds = getOnlineUserIds();
  return {
    ...(() => {
    const now = new Date().toISOString();
    runSql("UPDATE users SET status = 'active', bannedUntil = NULL, banReason = '' WHERE bannedUntil IS NOT NULL AND bannedUntil <= ?", [now]);
    runSql("UPDATE users SET mutedUntil = NULL, muteReason = '' WHERE mutedUntil IS NOT NULL AND mutedUntil <= ?", [now]);
    return {};
    })(),
    users: queryAll('SELECT id, name, username, email, role, avatar, bio, createdAt, status, mutedUntil, muteReason, bannedUntil, banReason FROM users ORDER BY id ASC').map((user) => ({
      ...user,
      name: normalizeText(user.name) || normalizeText(user.username) || 'Usuario',
      username: normalizeText(user.username) || `@user${user.id}`,
      isOnline: onlineUserIds.has(user.id),
    })),
    boards: queryAll('SELECT * FROM boards ORDER BY name ASC'),
    threads: queryAll('SELECT * FROM threads ORDER BY createdAt DESC'),
    posts: queryAll('SELECT * FROM posts ORDER BY createdAt ASC'),
    supportMessages: queryAll('SELECT * FROM support_messages ORDER BY updatedAt DESC'),
    supportReplies: queryAll('SELECT * FROM support_replies ORDER BY createdAt ASC'),
  };
};

app.get('/api/data', (req, res) => {
  const actor = actorFromRequest(req);
  const data = getForumData();
  if (!hasRole(actor, ['admin', 'creator'])) {
    data.users = data.users.map((user) => {
      if (user.role === 'creator') {
        const { email, ...publicUser } = user;
        return publicUser;
      }
      return user;
    });
  }
  return res.json(data);
});

app.post('/api/register', (req, res) => {
  if (!consumeAuthAttempt(`register:${req.ip}`)) return res.status(429).json({ message: 'Demasiados intentos. Espera unos minutos.' });
  const name = normalizeText(req.body.name);
  const username = normalizeText(req.body.username).toLowerCase();
  const email = normalizeText(req.body.email).toLowerCase();
  const password = normalizeText(req.body.password);
  if (!name || !username || !email || !password) return res.status(400).json({ message: 'Completa todos los campos' });
  if (!/^@[a-z0-9_]{3,24}$/.test(username)) return res.status(400).json({ message: 'El username debe comenzar con @ y tener 3-24 caracteres' });
  if (password.length < 6) return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
  if (queryOne('SELECT id FROM users WHERE LOWER(email) = ?', [email])) return res.status(409).json({ message: 'Ese correo ya está registrado' });
  if (queryOne('SELECT id FROM users WHERE LOWER(username) = ?', [username])) return res.status(409).json({ message: 'Ese username ya está registrado' });
  try {
    const now = new Date().toISOString();
    const role = isCreatorIdentity(username, email) ? 'creator' : 'member';
    const statement = db.prepare('INSERT INTO users (name, username, email, password, passwordHash, role, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)');
    statement.run([name, username, email, '[protected]', hashPassword(password), role, now]);
    statement.free();
    const user = getUser(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]);
    persistDb();
    return res.status(201).json({ user: serializeUser(user), token: createSession(user.id) });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'No se pudo completar el registro' });
  }
});

app.delete('/api/creator/users/:id', (req, res) => {
  const creator = requireRole(req, res, ['creator']);
  if (!creator) return;
  const target = getUser(req.params.id);
  if (!target) return res.status(404).json({ message: 'Usuario no encontrado' });
  if (target.id === creator.id) return res.status(400).json({ message: 'La cuenta creadora no se puede eliminar' });
  runSql('DELETE FROM support_replies WHERE userId = ?', [target.id]);
  runSql('DELETE FROM support_messages WHERE userId = ?', [target.id]);
  runSql('DELETE FROM posts WHERE authorId = ?', [target.id]);
  runSql('DELETE FROM threads WHERE authorId = ?', [target.id]);
  runSql('DELETE FROM users WHERE id = ?', [target.id]);
  persistDb();
  return res.json({ ok: true });
});

app.post('/api/creator/reset', (req, res) => {
  const creator = requireRole(req, res, ['creator']);
  if (!creator) return;
  runSql('DELETE FROM support_replies', []);
  runSql('DELETE FROM support_messages', []);
  runSql('DELETE FROM posts', []);
  runSql('DELETE FROM threads', []);
  runSql('DELETE FROM users WHERE id != ?', [creator.id]);
  runSql('DELETE FROM boards WHERE id NOT IN (?, ?)', ['general', 'proyectos']);
  persistDb();
  return res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  if (!consumeAuthAttempt(`login:${req.ip}`)) return res.status(429).json({ message: 'Demasiados intentos. Espera unos minutos.' });
  const identifier = normalizeText(req.body.identifier || req.body.email).toLowerCase();
  const password = normalizeText(req.body.password);
  if (!identifier || !password) return res.status(400).json({ message: 'Usuario/correo y contraseña obligatorios' });
  const user = queryOne('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?', [identifier, identifier]);
  if (!user) {
    const missingMessage = identifier.startsWith('@') ? 'Ese usuario no existe.' : 'Ese correo no existe.';
    return res.status(404).json({ message: missingMessage });
  }
  if (!verifyPassword(password, user.passwordHash)) return res.status(401).json({ message: 'La contraseña es incorrecta.' });
  if (user.status === 'banned') return res.status(403).json({ message: sanctionMessage(user, 'iniciar sesión') });
  return res.json({ user: serializeUser(user), token: createSession(user.id) });
});

app.post('/api/logout', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token) sessions.delete(token);
  return res.json({ ok: true });
});

app.post('/api/presence/offline', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : normalizeText(req.body.token);
  if (token) sessions.delete(token);
  return res.json({ ok: true });
});

app.patch('/api/users/:id/role', (req, res) => {
  if (!requireRole(req, res, ['admin', 'creator'])) return;
  const role = req.body.role;
  if (!['member', 'moderator', 'support', 'admin', 'creator'].includes(role)) return res.status(400).json({ message: 'Rol inválido' });
  if (!getUser(req.params.id)) return res.status(404).json({ message: 'Usuario no encontrado' });
  runSql('UPDATE users SET role = ? WHERE id = ?', [role, Number(req.params.id)]);
  persistDb();
  return res.json({ user: serializeUser(getUser(req.params.id)) });
});

app.patch('/api/users/:id/profile', (req, res) => {
  const actor = requireAuth(req, res);
  if (!actor) return;
  if (Number(actor.id) !== Number(req.params.id)) return res.status(403).json({ message: 'Solo puedes editar tu propio perfil' });
  const name = normalizeText(req.body.name);
  const username = normalizeText(req.body.username).toLowerCase();
  if (!name) return res.status(400).json({ message: 'El nombre es obligatorio' });
  if (!/^@[a-z0-9_]{3,24}$/.test(username)) return res.status(400).json({ message: 'El username debe comenzar con @ y tener 3-24 caracteres' });
  const duplicate = queryOne('SELECT id FROM users WHERE LOWER(username) = ? AND id != ?', [username, Number(req.params.id)]);
  if (duplicate) return res.status(409).json({ message: 'Ese username ya está registrado' });
  runSql('UPDATE users SET name = ?, username = ?, avatar = ?, bio = ? WHERE id = ?', [name, username, normalizeText(req.body.avatar), normalizeText(req.body.bio), Number(req.params.id)]);
  persistDb();
  return res.json({ user: serializeUser(getUser(req.params.id)) });
});

app.patch('/api/users/:id/account', (req, res) => {
  const actor = requireRole(req, res, ['creator']);
  if (!actor) return;
  const target = getUser(req.params.id);
  if (!target) return res.status(404).json({ message: 'Usuario no encontrado' });
  const email = normalizeText(req.body.email).toLowerCase();
  const password = normalizeText(req.body.password);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Correo inválido' });
  if (email && queryOne('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?', [email, Number(req.params.id)])) return res.status(409).json({ message: 'Ese correo ya está registrado' });
  const finalEmail = email || target.email;
  const finalPasswordHash = password ? hashPassword(password) : target.passwordHash;
  runSql('UPDATE users SET email = ?, password = ?, passwordHash = ? WHERE id = ?', [finalEmail, '[protected]', finalPasswordHash, Number(req.params.id)]);
  persistDb();
  return res.json({ user: serializeUser(getUser(req.params.id)) });
});

app.patch('/api/users/:id/ban', (req, res) => {
  const actor = requireRole(req, res, ['admin', 'moderator', 'creator']);
  if (!actor) return;
  const target = getUser(req.params.id);
  if (!target) return res.status(404).json({ message: 'Usuario no encontrado' });
  if (target.role === 'admin' && actor.role !== 'admin') return res.status(403).json({ message: 'No puedes suspender a un administrador' });
  const banned = req.body.banned !== false;
  const durationMinutes = Math.max(0, Number(req.body.durationMinutes || 0));
  const bannedUntil = banned && durationMinutes ? new Date(Date.now() + durationMinutes * 60000).toISOString() : null;
  runSql('UPDATE users SET status = ?, bannedUntil = ?, banReason = ? WHERE id = ?', [banned ? 'banned' : 'active', bannedUntil, banned ? normalizeText(req.body.reason) : '', Number(req.params.id)]);
  persistDb();
  return res.json({ user: serializeUser(getUser(req.params.id)) });
});

app.patch('/api/users/:id/mute', (req, res) => {
  if (!requireRole(req, res, ['admin', 'moderator', 'creator'])) return;
  const requestedMinutes = Number(req.body.minutes || 0);
  const minutes = requestedMinutes < 0 ? -1 : Math.max(0, requestedMinutes);
  const mutedUntil = minutes < 0 ? '9999-12-31T23:59:59.999Z' : minutes ? new Date(Date.now() + minutes * 60000).toISOString() : null;
  const reason = normalizeText(req.body.reason);
  runSql('UPDATE users SET mutedUntil = ?, muteReason = ? WHERE id = ?', [mutedUntil, minutes ? reason : '', Number(req.params.id)]);
  persistDb();
  return res.json({ user: serializeUser(getUser(req.params.id)) });
});

app.post('/api/boards', (req, res) => {
  if (!requireRole(req, res, ['admin', 'creator'])) return;
  const name = normalizeText(req.body.name);
  const description = normalizeText(req.body.description) || 'Nueva tabla de discusión.';
  if (!name) return res.status(400).json({ message: 'El nombre es obligatorio' });
  const id = name.toLowerCase().replace(/\s+/g, '-');
  if (queryOne('SELECT id FROM boards WHERE id = ?', [id])) return res.status(409).json({ message: 'Ya existe una tabla con ese nombre' });
  runSql('INSERT INTO boards (id, name, description) VALUES (?, ?, ?)', [id, name, description]);
  persistDb();
  return res.status(201).json({ board: { id, name, description } });
});

app.delete('/api/boards/:id', (req, res) => {
  if (!requireRole(req, res, ['admin', 'creator'])) return;
  const board = queryOne('SELECT id FROM boards WHERE id = ?', [req.params.id]);
  if (!board) return res.status(404).json({ message: 'Tabla no encontrada' });
  const threads = queryAll('SELECT id FROM threads WHERE boardId = ?', [req.params.id]);
  threads.forEach((thread) => runSql('DELETE FROM posts WHERE threadId = ?', [thread.id]));
  runSql('DELETE FROM threads WHERE boardId = ?', [req.params.id]);
  runSql('DELETE FROM boards WHERE id = ?', [req.params.id]);
  persistDb();
  return res.json({ ok: true });
});

app.post('/api/threads', (req, res) => {
  const boardId = normalizeText(req.body.boardId);
  const title = normalizeText(req.body.title);
  const content = normalizeText(req.body.content);
  const author = requireAuth(req, res);
  if (!author) return;
  if (!boardId || !title || !content || !author) return res.status(400).json({ message: 'Faltan datos para crear el tema' });
  if (author.status === 'banned' || isMuted(author)) return res.status(403).json({ message: sanctionMessage(author, 'publicar') });
  if (!queryOne('SELECT id FROM boards WHERE id = ?', [boardId])) return res.status(404).json({ message: 'La tabla no existe' });
  const now = new Date().toISOString();
  const statement = db.prepare('INSERT INTO threads (boardId, title, content, authorId, createdAt, locked) VALUES (?, ?, ?, ?, ?, ?)');
  statement.run([boardId, title, content, author.id, now, 0]);
  statement.free();
  const thread = queryOne('SELECT * FROM threads WHERE id = ?', [db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]]);
  persistDb();
  return res.status(201).json({ thread });
});

app.post('/api/posts', (req, res) => {
  const content = normalizeText(req.body.content);
  const author = requireAuth(req, res);
  if (!author) return;
  const thread = queryOne('SELECT id, locked FROM threads WHERE id = ?', [Number(req.body.threadId)]);
  if (!content || !author || !thread) return res.status(400).json({ message: 'Faltan datos para responder' });
  if (Number(thread.locked) === 1) return res.status(403).json({ message: 'Este tema está bloqueado por moderación' });
  if (author.status === 'banned' || isMuted(author)) return res.status(403).json({ message: sanctionMessage(author, 'responder') });
  const now = new Date().toISOString();
  const statement = db.prepare('INSERT INTO posts (threadId, authorId, content, createdAt, status) VALUES (?, ?, ?, ?, ?)');
  statement.run([Number(req.body.threadId), author.id, content, now, 'visible']);
  statement.free();
  const post = queryOne('SELECT * FROM posts WHERE id = ?', [db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]]);
  persistDb();
  return res.status(201).json({ post });
});

app.patch('/api/threads/:id/lock', (req, res) => {
  if (!requireRole(req, res, ['admin', 'moderator', 'creator'])) return;
  const thread = queryOne('SELECT locked FROM threads WHERE id = ?', [Number(req.params.id)]);
  if (!thread) return res.status(404).json({ message: 'Tema no encontrado' });
  const locked = Number(thread.locked) === 1 ? 0 : 1;
  runSql('UPDATE threads SET locked = ? WHERE id = ?', [locked, Number(req.params.id)]);
  persistDb();
  return res.json({ ok: true, locked: locked === 1 });
});

app.patch('/api/posts/:id/hide', (req, res) => {
  const actor = requireAuth(req, res);
  if (!actor) return;
  const post = queryOne('SELECT * FROM posts WHERE id = ?', [Number(req.params.id)]);
  if (!post) return res.status(404).json({ message: 'Publicación no encontrada' });
  if (!actor || (post.authorId !== actor.id && !hasRole(actor, ['admin', 'moderator']))) return res.status(403).json({ message: 'No puedes gestionar esta respuesta' });
  const status = post.status === 'hidden' ? 'visible' : 'hidden';
  runSql('UPDATE posts SET status = ? WHERE id = ?', [status, Number(req.params.id)]);
  persistDb();
  return res.json({ ok: true, status });
});

app.delete('/api/threads/:id', (req, res) => {
  if (!requireRole(req, res, ['admin', 'moderator', 'creator'])) return;
  if (!queryOne('SELECT id FROM threads WHERE id = ?', [Number(req.params.id)])) return res.status(404).json({ message: 'Tema no encontrado' });
  runSql('DELETE FROM posts WHERE threadId = ?', [Number(req.params.id)]);
  runSql('DELETE FROM threads WHERE id = ?', [Number(req.params.id)]);
  persistDb();
  return res.json({ ok: true });
});

app.delete('/api/posts/:id', (req, res) => {
  if (!requireRole(req, res, ['admin', 'moderator', 'creator'])) return;
  if (!queryOne('SELECT id FROM posts WHERE id = ?', [Number(req.params.id)])) return res.status(404).json({ message: 'Respuesta no encontrada' });
  runSql('DELETE FROM posts WHERE id = ?', [Number(req.params.id)]);
  persistDb();
  return res.json({ ok: true });
});

app.post('/api/support-messages', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const subject = normalizeText(req.body.subject);
  const content = normalizeText(req.body.content);
  if (!user || !subject || !content) return res.status(400).json({ message: 'Completa el asunto y el mensaje' });
  const now = new Date().toISOString();
  runSql('INSERT INTO support_messages (userId, subject, content, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)', [user.id, subject, content, 'open', now, now]);
  const ticketId = db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
  const ticket = queryOne('SELECT * FROM support_messages WHERE id = ?', [ticketId]);
  persistDb();
  return res.status(201).json({ ok: true, ticket });
});

app.patch('/api/support-messages/:id', (req, res) => {
  const actor = actorFromRequest(req);
  const ticket = queryOne('SELECT * FROM support_messages WHERE id = ?', [Number(req.params.id)]);
  if (!ticket) return res.status(404).json({ message: 'Ticket no encontrado' });
  if (!hasRole(actor, ['admin', 'support']) && ticket.userId !== actor?.id) return res.status(403).json({ message: 'No puedes gestionar este ticket' });
  const status = ['open', 'pending', 'in_progress', 'resolved', 'closed'].includes(req.body.status) ? req.body.status : 'in_progress';
  runSql('UPDATE support_messages SET status = ?, updatedAt = ? WHERE id = ?', [status, new Date().toISOString(), Number(req.params.id)]);
  persistDb();
  return res.json({ ok: true });
});

app.post('/api/support-messages/:id/replies', (req, res) => {
  const actor = actorFromRequest(req);
  const ticket = queryOne('SELECT * FROM support_messages WHERE id = ?', [Number(req.params.id)]);
  const content = normalizeText(req.body.content);
  if (!ticket) return res.status(404).json({ message: 'Ticket no encontrado' });
  if (!actor || (!hasRole(actor, ['admin', 'support']) && ticket.userId !== actor.id)) return res.status(403).json({ message: 'No puedes responder en este ticket' });
  if (!content) return res.status(400).json({ message: 'Escribe un mensaje' });
  const now = new Date().toISOString();
  runSql('INSERT INTO support_replies (ticketId, userId, content, createdAt) VALUES (?, ?, ?, ?)', [ticket.id, actor.id, content, now]);
  runSql("UPDATE support_messages SET status = ?, updatedAt = ? WHERE id = ?", [hasRole(actor, ['admin', 'support']) ? 'in_progress' : 'open', now, ticket.id]);
  persistDb();
  return res.status(201).json({ ok: true });
});

app.use((error, req, res, next) => {
  console.error('Unhandled API error:', error);
  return res.status(500).json({ message: 'Error interno del servidor' });
});
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
app.listen(port, () => console.log(`Servidor listo en http://localhost:${port}`));
