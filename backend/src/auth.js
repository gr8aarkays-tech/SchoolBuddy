/**
 * Auth routes — /auth/register, /auth/login, /auth/me
 *
 * Passwords:  scrypt (Node built-in crypto) with a per-user random salt.
 * Tokens:     HMAC-SHA256 signed tokens — "<userId>.<expiry>.<signature>"
 *             No extra npm packages needed (pure Node crypto).
 *
 * Token lifetime: 90 days (plenty for a personal learning app).
 */

import { Router } from 'express';
import { randomBytes, scrypt, timingSafeEqual, createHmac } from 'crypto';
import { promisify } from 'util';
import { db } from './db.js';

const scryptAsync = promisify(scrypt);
const router      = Router();

// ─── Token helpers ────────────────────────────────────────────────────────────

const TOKEN_SECRET  = process.env.TOKEN_SECRET || process.env.API_SECRET || 'dev-token-secret-change-me';
const TOKEN_TTL_MS  = 90 * 24 * 60 * 60 * 1000; // 90 days

function signToken(userId) {
  const expiry    = Date.now() + TOKEN_TTL_MS;
  const payload   = `${userId}.${expiry}`;
  const signature = createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, expiry, signature] = parts;
  if (Date.now() > Number(expiry)) return null;           // expired
  const expected = createHmac('sha256', TOKEN_SECRET).update(`${userId}.${expiry}`).digest('hex');
  try {
    const match = timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
    return match ? userId : null;
  } catch {
    return null;
  }
}

// ─── Password helpers ─────────────────────────────────────────────────────────

async function hashPassword(password, salt) {
  const buf = await scryptAsync(password, salt, 64);
  return buf.toString('hex');
}

async function verifyPassword(password, salt, storedHash) {
  const hash = await hashPassword(password, salt);
  try {
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}

// ─── POST /auth/register ──────────────────────────────────────────────────────

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body ?? {};

  if (!name?.trim())                  return res.status(400).json({ error: 'Name is required.' });
  if (!email?.includes('@'))          return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const normalEmail = email.toLowerCase().trim();

  // Check for duplicate
  const { rows: existing } = await db.execute({
    sql: 'SELECT id FROM users WHERE email = ?',
    args: [normalEmail],
  });
  if (existing.length > 0) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const salt         = randomBytes(16).toString('hex');
  const passwordHash = await hashPassword(password, salt);
  const id           = `user-${Date.now()}-${randomBytes(4).toString('hex')}`;
  const createdAt    = new Date().toISOString();

  await db.execute({
    sql: 'INSERT INTO users (id, name, email, passwordHash, salt, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    args: [id, name.trim(), normalEmail, passwordHash, salt, createdAt],
  });

  const token = signToken(id);
  return res.status(201).json({
    token,
    user: { id, name: name.trim(), email: normalEmail, createdAt },
  });
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalEmail = email.toLowerCase().trim();
  const { rows } = await db.execute({
    sql: 'SELECT * FROM users WHERE email = ?',
    args: [normalEmail],
  });

  if (rows.length === 0) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const u = Object.fromEntries(Object.entries(rows[0]));
  const ok = await verifyPassword(password, u.salt, u.passwordHash);

  if (!ok) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = signToken(u.id);
  return res.json({
    token,
    user: { id: u.id, name: u.name, email: u.email, createdAt: u.createdAt },
  });
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

router.get('/me', async (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const userId = verifyToken(token);

  if (!userId) return res.status(401).json({ error: 'Invalid or expired token.' });

  const { rows } = await db.execute({
    sql: 'SELECT id, name, email, createdAt FROM users WHERE id = ?',
    args: [userId],
  });
  if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });

  const u = Object.fromEntries(Object.entries(rows[0]));
  return res.json({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt });
});

export default router;
