import { Router } from 'express';
import db from '../config/db.js';

const router = Router();

router.get('/', async (req, res) => {
  await db.read();
  const top = [...db.data.players]
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 50)
    .map((p, idx) => ({ rank: idx + 1, username: p.username, level: p.level, xp: p.xp }));
  res.json(top);
});

export default router;
