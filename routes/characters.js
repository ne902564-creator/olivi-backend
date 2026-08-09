import { Router } from 'express';
import db from '../config/db.js';

const router = Router();

// Public: list all playable characters (original, fictional designs only)
router.get('/', async (req, res) => {
  await db.read();
  res.json(db.data.characters);
});

router.get('/:slug', async (req, res) => {
  await db.read();
  const character = db.data.characters.find(c => c.slug === req.params.slug);
  if (!character) return res.status(404).json({ error: 'Character not found' });
  res.json(character);
});

export default router;
