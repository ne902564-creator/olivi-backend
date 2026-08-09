import { Router } from 'express';
import { randomUUID } from 'crypto';
import db from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  await db.read();
  const items = db.data.inventoryItems.filter(i => i.playerId === req.player.id);
  res.json(items);
});

router.post('/add', requireAuth, async (req, res) => {
  const { itemSlug, quantity = 1 } = req.body;
  if (!itemSlug) return res.status(400).json({ error: 'itemSlug required' });

  await db.read();
  let item = db.data.inventoryItems.find(
    i => i.playerId === req.player.id && i.itemSlug === itemSlug
  );
  if (item) {
    item.quantity += quantity;
  } else {
    item = { id: randomUUID(), playerId: req.player.id, itemSlug, quantity };
    db.data.inventoryItems.push(item);
  }
  await db.write();
  res.status(201).json(item);
});

export default router;
