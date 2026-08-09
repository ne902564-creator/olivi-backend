import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { randomUUID } from 'crypto';
import db from '../config/db.js';

const router = Router();

router.post(
  '/signup',
  [
    body('username').trim().isLength({ min: 3, max: 20 }).matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username must be 3-20 chars, letters/numbers/underscore only'),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { username, email, password } = req.body;
    await db.read();

    const exists = db.data.players.find(
      p => p.username.toLowerCase() === username.toLowerCase() || p.email === email
    );
    if (exists) {
      return res.status(409).json({ error: 'Username or email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const player = {
      id: randomUUID(),
      username,
      email,
      passwordHash,
      level: 1,
      xp: 0,
      currency: 0,
      createdAt: new Date().toISOString()
    };

    db.data.players.push(player);
    await db.write();

    const token = signToken(player);
    res.status(201).json({ token, player: publicPlayer(player) });
  }
);

router.post(
  '/login',
  [
    body('username').trim().notEmpty(),
    body('password').notEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { username, password } = req.body;
    await db.read();

    const player = db.data.players.find(
      p => p.username.toLowerCase() === username.toLowerCase()
    );
    if (!player) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, player.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(player);
    res.json({ token, player: publicPlayer(player) });
  }
);

function signToken(player) {
  return jwt.sign(
    { id: player.id, username: player.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function publicPlayer(player) {
  const { passwordHash, ...safe } = player;
  return safe;
}

export default router;
