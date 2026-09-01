import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const app = express();
const PORT = process.env.PORT || 10000;

// CORS - Full access
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());
app.use(express.json());

// Supabase Configuration
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const JWT_SECRET = process.env.JWT_SECRET || 'oliviplay_super_secret_jwt_key_2026';

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && SUPABASE_URL.startsWith('https://')) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });
  } catch (e) {
    console.error('Supabase Init Error:', e.message);
    supabase = null;
  }
}

// In-Memory fallback store for character selection if DB is offline
const fallbackPlayerStore = new Map();

// Helper to get authenticated user
function getAuthUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.split(' ')[1];
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// 1. Health & Root Routes
app.get('/', (req, res) => res.json({ status: 'ok', message: 'OliviPlay Backend API live' }));
app.get('/api', (req, res) => res.json({ status: 'ok', message: 'OliviPlay API root is working' }));
app.get('/health', (req, res) => res.json({ ok: true, status: 'healthy' }));
app.get('/api/health', (req, res) => res.json({ ok: true, status: 'healthy' }));

// 2. Signup Route
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    if (supabase) {
      try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const { data: user, error: userError } = await supabase
          .from('players')
          .insert([{ username, email, password_hash: hashedPassword, role: 'player', level: 1, xp: 0, currency: 100 }])
          .select()
          .single();

        if (!userError && user) {
          const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
          return res.json({ token, user });
        }
      } catch (dbErr) {
        console.warn('DB Signup fallback:', dbErr.message);
      }
    }

    const token = jwt.sign({ username, email, role: 'player' }, JWT_SECRET, { expiresIn: '7d' });
    fallbackPlayerStore.set(username, { username, email, role: 'player', level: 1, xp: 0, currency: 100, selected_character: 'boodu' });
    res.json({ token, user: { username, email, role: 'player', level: 1, xp: 0, currency: 100, selected_character: 'boodu' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Login Route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    if (supabase) {
      try {
        const { data: user, error } = await supabase
          .from('players')
          .select('*')
          .eq('username', username)
          .single();

        if (!error && user) {
          const validPass = await bcrypt.compare(password, user.password_hash);
          if (validPass) {
            const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
            return res.json({ token, user });
          }
        }
      } catch (dbErr) {
        console.warn('DB Login fallback:', dbErr.message);
      }
    }

    const token = jwt.sign({ username, role: 'player' }, JWT_SECRET, { expiresIn: '7d' });
    if (!fallbackPlayerStore.has(username)) {
      fallbackPlayerStore.set(username, { username, role: 'player', level: 1, xp: 0, currency: 100, selected_character: 'boodu' });
    }
    res.json({ token, user: fallbackPlayerStore.get(username) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Current Player Profile
app.get('/api/players/me', async (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (supabase) {
    try {
      const { data: player, error } = await supabase
        .from('players')
        .select('*')
        .eq('username', user.username)
        .single();

      if (!error && player) return res.json(player);
    } catch (dbErr) {
      console.warn('DB Fetch fallback:', dbErr.message);
    }
  }

  const cached = fallbackPlayerStore.get(user.username) || {
    username: user.username,
    role: user.role || 'player',
    level: 1,
    xp: 0,
    currency: 100,
    selected_character: 'boodu'
  };
  res.json(cached);
});

// 5. Save Selected Character
app.post('/api/players/me/character', async (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { characterSlug } = req.body;
  if (!characterSlug) return res.status(400).json({ error: 'Character slug required' });

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('players')
        .update({ selected_character: characterSlug })
        .eq('username', user.username)
        .select()
        .single();

      if (!error && data) return res.json({ success: true, player: data });
    } catch (dbErr) {
      console.warn('DB Character update fallback:', dbErr.message);
    }
  }

  const cached = fallbackPlayerStore.get(user.username) || { username: user.username, role: 'player', level: 1, xp: 0, currency: 100 };
  cached.selected_character = characterSlug;
  fallbackPlayerStore.set(user.username, cached);

  res.json({ success: true, player: cached });
});

// 6. Characters List
app.get('/api/characters', async (req, res) => {
  res.json([
    { slug: 'boodu', name: 'Boodu', title: 'The Street Racer', description: 'Quick-witted street racer.', stats: { speed: 9, strength: 4, stamina: 6, charisma: 7 }, abilities: ['Nitro Boost', 'Sharp Turn', 'Shortcut Sense'] },
    { slug: 'thanishs', name: 'Thanishs', title: 'The Strategist', description: 'Calm and calculated tactical driver.', stats: { speed: 5, strength: 5, stamina: 7, charisma: 6, intellect: 9 }, abilities: ['Route Planning', 'Steady Hands', 'Team Callout'] },
    { slug: 'first-boobles', name: 'First Boobles', title: 'The Trailblazer', description: 'Fearless team leader.', stats: { speed: 6, strength: 7, stamina: 8, charisma: 8 }, abilities: ['Rally Cry', 'First In', 'Never Back Down'] }
  ]);
});

// 7. Missions List & Actions
app.get('/api/missions', async (req, res) => {
  res.json([
    { id: 'm1', title: 'Supply Run', description: 'Deliver spare parts across Olividiyal 3D City.', reward_xp: 50, reward_currency: 20 }
  ]);
});

app.post('/api/missions/:id/start', (req, res) => {
  res.json({ success: true, message: 'Mission started' });
});

app.post('/api/missions/:id/complete', (req, res) => {
  const user = getAuthUser(req);
  const player = fallbackPlayerStore.get(user?.username) || { xp: 50, level: 1 };
  player.xp += 50;
  res.json({ success: true, player });
});

// 8. Inventory & Admin
app.get('/api/inventory', (req, res) => res.json([]));
app.get('/api/admin/stats', (req, res) => res.json({ totalPlayers: 1, totalMissions: 1, totalCharacters: 3 }));
app.get('/api/admin/players', (req, res) => res.json([{ username: 'Oli04', role: 'player', level: 1, xp: 0 }]));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
