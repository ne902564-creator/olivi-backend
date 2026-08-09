// config/db.js
// Demo persistence layer using lowdb (a JSON file on disk).
// This is fine for local dev / prototyping. Before real users and real money
// (virtual currency, purchases) touch this, migrate to Postgres or MongoDB
// with proper transactions - lowdb has no locking/ACID guarantees.

import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbFile = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'db.json');

const defaultData = {
  players: [],       // { id, username, email, passwordHash, level, xp, createdAt }
  characters: [],     // { id, slug, name, description, unlockLevel }
  missions: [],        // { id, title, description, rewardXp, rewardCurrency }
  inventoryItems: [],   // { id, playerId, itemSlug, quantity }
  playerMissions: [],   // { id, playerId, missionId, status, progress }
  leaderboard: [],      // { playerId, score, updatedAt }
  auditLog: []          // { id, actor, action, target, timestamp }
};

const adapter = new JSONFile(dbFile);
const db = new Low(adapter, defaultData);

export async function initDb() {
  await db.read();
  db.data ||= defaultData;

  // Seed original (non-photo-based) characters on first run
  if (db.data.characters.length === 0) {
    db.data.characters = [
      {
        id: 'char_boodu',
        slug: 'boodu',
        name: 'Boodu',
        title: 'The Street Racer',
        description: 'A quick-witted young driver who knows every shortcut in Olividiyal City. Original character - fictional design.',
        unlockLevel: 1
      },
      {
        id: 'char_thanishs',
        slug: 'thanishs',
        name: 'Thanishs',
        title: 'The Strategist',
        description: 'Calm and calculated, plans every mission three moves ahead. Original character - fictional design.',
        unlockLevel: 1
      },
      {
        id: 'char_boobles',
        slug: 'first-boobles',
        name: 'First Boobles',
        title: 'The Trailblazer',
        description: 'Fearless team leader who takes on the toughest missions first. Original character - fictional design.',
        unlockLevel: 1
      }
    ];
    await db.write();
  }

  if (db.data.missions.length === 0) {
    db.data.missions = [
      {
        id: 'mission_supply_run',
        title: 'Supply Run',
        description: 'Deliver spare parts from the garage to the depot on the east side of town.',
        rewardXp: 50,
        rewardCurrency: 20
      }
    ];
    await db.write();
  }

  return db;
}

export default db;
