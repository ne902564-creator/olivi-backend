import express from 'express';
import cors from 'cors';
import { initDb } from './config/db.js';
import authRoutes from './routes/auth.js';
import characterRoutes from './routes/characters.js';
import leaderboardRoutes from './routes/leaderboard.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Base Health Check Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is healthy and running' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is healthy and running' });
});

// App Routes
app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);

app.use('/characters', characterRoutes);
app.use('/api/characters', characterRoutes);

app.use('/leaderboard', leaderboardRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Start server after DB init
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to init DB:', err);
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (DB init failed)`);
  });
});
