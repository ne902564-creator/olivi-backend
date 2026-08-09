import { Router } from 'express';
import { randomUUID } from 'crypto';
import db from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res) => {
  await db.read();
  res.json(db.data.missions);
});

router.post('/:missionId/start', requireAuth, async (req, res) => {
  await db.read();
  const mission = db.data.missions.find(m => m.id === req.params.missionId);
  if (!mission) return res.status(404).json({ error: 'Mission not found' });

  const existing = db.data.playerMissions.find(
    pm => pm.playerId === req.player.id && pm.missionId === mission.id && pm.status !== 'completed'
  );
  if (existing) return res.json(existing);

  const record = {
    id: randomUUID(),
    playerId: req.player.id,
    missionId: mission.id,
    status: 'in_progress',
    progress: 0,
    startedAt: new Date().toISOString()
  };
  db.data.playerMissions.push(record);
  await db.write();
  res.status(201).json(record);
});

router.post('/:missionId/complete', requireAuth, async (req, res) => {
  await db.read();
  const mission = db.data.missions.find(m => m.id === req.params.missionId);
  if (!mission) return res.status(404).json({ error: 'Mission not found' });

  const record = db.data.playerMissions.find(
    pm => pm.playerId === req.player.id && pm.missionId === mission.id && pm.status === 'in_progress'
  );
  if (!record) return res.status(400).json({ error: 'Mission was not started' });

  record.status = 'completed';
  record.completedAt = new Date().toISOString();

  const player = db.data.players.find(p => p.id === req.player.id);
  player.xp += mission.rewardXp || 0;
  player.currency += mission.rewardCurrency || 0;

  await db.write();
  res.json({ mission: record, player: { xp: player.xp, currency: player.currency } });
});

export default router;
