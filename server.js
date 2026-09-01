import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 10000;

// 1. CORS Setup
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());
app.use(express.json());

// 2. Socket.io Multiplayer & Voice Signaling Setup (100 Players)
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const players = {};

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // New Player Join
  socket.on('joinGame', (playerData) => {
    players[socket.id] = {
      id: socket.id,
      username: playerData.username || 'Player',
      char: playerData.char || 'boodu',
      x: playerData.x || 0,
      y: playerData.y || 0,
      z: playerData.z || 0,
      rotY: playerData.rotY || 0,
      speed: 0
    };
    // Send current players list to newcomer
    socket.emit('currentPlayers', players);
    // Broadcast new player to all others
    socket.broadcast.emit('newPlayer', players[socket.id]);
  });

  // Real-time Player Movement Sync (X, Y, Z, Rotation, Speed)
  socket.on('playerMovement', (movementData) => {
    if (players[socket.id]) {
      players[socket.id].x = movementData.x;
      players[socket.id].y = movementData.y;
      players[socket.id].z = movementData.z;
      players[socket.id].rotY = movementData.rotY;
      players[socket.id].speed = movementData.speed;
      // Broadcast movement to all other connected clients
      socket.broadcast.emit('playerMoved', players[socket.id]);
    }
  });

  // WebRTC Proximity Voice Chat Signaling
  socket.on('voiceSignal', (data) => {
    io.to(data.to).emit('voiceSignal', {
      from: socket.id,
      signal: data.signal
    });
  });

  // Player Disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

// 3. Supabase & Auth
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const JWT_SECRET = process.env.JWT_SECRET || 'oliviplay_super_secret_jwt_key_2026';

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && SUPABASE_URL.startsWith('https://')) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  } catch (e) {
    supabase = null;
  }
}

const fallbackStore = new Map();

function getAuthUser(req) {
  const auth = req.headers.authorization;
  if (!auth) return null;
  try { return jwt.verify(auth.split(' ')[1], JWT_SECRET); } catch { return null; }
}

// Routes
app.get('/', (req, res) => res.json({ status: 'ok', message: 'OliviPlay Multiplayer & Voice Server Live' }));
app.get('/api', (req, res) => res.json({ status: 'ok', message: 'API Root' }));
app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/auth/signup', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'All fields required' });
  const user = { username, email, role: 'player', level: 1, xp: 0, currency: 150, selected_character: 'boodu' };
  fallbackStore.set(username, user);
  const token = jwt.sign({ username, role: 'player' }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = fallbackStore.get(username) || { username, role: 'player', level: 1, xp: 0, currency: 150, selected_character: 'boodu' };
  fallbackStore.set(username, user);
  const token = jwt.sign({ username, role: 'player' }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user });
});

app.get('/api/players/me', (req, res) => {
  const u = getAuthUser(req);
  if (!u) return res.status(401).json({ error: 'Unauthorized' });
  res.json(fallbackStore.get(u.username) || { username: u.username, role: 'player', level: 1, xp: 0, currency: 150, selected_character: 'boodu' });
});

app.post('/api/players/me/character', (req, res) => {
  const u = getAuthUser(req);
  if (!u) return res.status(401).json({ error: 'Unauthorized' });
  const p = fallbackStore.get(u.username) || { username: u.username, role: 'player', level: 1, xp: 0, currency: 150 };
  p.selected_character = req.body.characterSlug || 'boodu';
  fallbackStore.set(u.username, p);
  res.json({ success: true, player: p });
});

app.get('/api/characters', (req, res) => {
  res.json([
    { slug: 'boodu', name: 'Boodu', title: 'The Street Racer', stats: { speed: 9, strength: 4, stamina: 6 }, abilities: ['Nitro Boost'] },
    { slug: 'thanishs', name: 'Thanishs', title: 'The Strategist', stats: { speed: 5, strength: 5, stamina: 7 }, abilities: ['Route Planning'] },
    { slug: 'first-boobles', name: 'First Boobles', title: 'The Trailblazer', stats: { speed: 6, strength: 7, stamina: 8 }, abilities: ['Rally Cry'] }
  ]);
});

app.get('/api/inventory', (req, res) => res.json([{ item_slug: 'Nitro Boost x2', quantity: 2 }, { item_slug: 'Olividiyal City Map', quantity: 1 }]));
app.get('/api/missions', (req, res) => res.json([{ id: 'm1', title: 'Supply Run', reward_xp: 50, reward_currency: 20 }]));

// Start HTTP + WebSocket Server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Multiplayer Game & Voice Server running on port ${PORT}`);
});
