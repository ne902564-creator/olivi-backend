import express from 'express';
import cors from 'cors';
import { initDb } from './config/db.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Allow CORS for all origins so Hostinger frontend can communicate
app.use(cors());
app.use(express.json());

// Initialize Database
await initDb();

// Health Check Endpoint for Frontend
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is healthy and running' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is healthy and running' });
});

// Import and use routes
import authRoutes from './routes/auth.js';
import characterRoutes from './routes/characters.js';
import leaderboardRoutes from './routes/leaderboard.js';

app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);

app.use('/characters', characterRoutes);
app.use('/api/characters', characterRoutes);

app.use('/leaderboard', leaderboardRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
