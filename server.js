import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const app = express();
const PORT = process.env.PORT || 10000;

// All Domain CORS Allow (லாகின் தடுப்பை முழுமையாக நீக்கும்)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const JWT_SECRET = process.env.JWT_SECRET || 'oliviplay_super_secret_jwt_key_2026';

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// Health Check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'OliviPlay Backend is fully live and running' });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'healthy' });
});

// Signup Route
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    if (!supabase) {
      const token = jwt.sign({ username, role: 'player' }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, user: { username, email, role: 'player' } });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const { data: user, error: userError } = await supabase
      .from('players')
      .insert([{ username, email, password_hash: hashedPassword, role: 'player', level: 1, xp: 0 }])
      .select()
      .single();

    if (userError) return res.status(400).json({ error: userError.message });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login Route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    if (!supabase) {
      const token = jwt.sign({ username, role: 'player' }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, user: { username, role: 'player' } });
    }

    const { data: user, error } = await supabase
      .from('players')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !user) return res.status(400).json({ error: 'Invalid username or password.' });

    const validPass = await bcrypt.compare(password, user.password_hash);
    if (!validPass) return res.status(400).json({ error: 'Invalid username or password.' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Current Player Info
app.get('/api/players/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided.' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!supabase) {
      return res.json({ username: decoded.username, role: decoded.role || 'player', level: 1, xp: 0, currency: 100 });
    }

    const { data: player, error } = await supabase
      .from('players')
      .select('*')
      .eq('username', decoded.username)
      .single();

    if (error || !player) return res.status(404).json({ error: 'Player profile not found.' });
    res.json(player);
  } catch (err) {
    res.status(401).json({ error: 'Invalid token.' });
  }
});

app.get('/api/missions', async (req, res) => {
  res.json([
    { id: 'm1', title: 'Supply Run', description: 'Deliver parts across 3D city', reward_xp: 50, reward_currency: 20 }
  ]);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
