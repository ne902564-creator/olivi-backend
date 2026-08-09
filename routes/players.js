import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/me', requireAuth, async (req, res) => {
  await db.read();
  const player = db.data.players.find(p => p.id === req.player.id);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  const { passwordHash, ...safe } = player;
  res.json(safe);
});

router.get('/:id', async (req, res) => {
  await db.read();
  const player = db.data.players.find(p => p.id === req.params.id);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  // Only expose public fields to other players
  res.json({ id: player.id, username: player.username, level: player.level });
});

export default router;
