import express from 'express';
import cors from 'cors';
import routes from './routes.js';

const PORT = process.env.PORT || 3001;

// ─── API secret ───────────────────────────────────────────────────────────────
// Set API_SECRET in your environment / Render dashboard.
// In dev mode (NODE_ENV !== 'production') the check is skipped so you can run
// the backend without any configuration.
const API_SECRET = process.env.API_SECRET || '';
const isProd = process.env.NODE_ENV === 'production';

function requireAuth(req, res, next) {
  // Always allow preflight requests (CORS)
  if (req.method === 'OPTIONS') return next();

  // In development without a configured secret, skip the check
  if (!isProd && !API_SECRET) return next();

  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token || token !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

const app = express();
app.use(cors({
  origin: [
    'https://gr8aarkays-tech.github.io',
    'http://localhost:5173',
    'http://localhost:4173',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));
app.use(express.json());

// Public endpoints
app.get('/', (_, res) => res.json({ name: 'SchoolBuddy API', status: 'ok' }));
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// All /api/* routes require auth
app.use('/api', requireAuth, routes);

app.listen(PORT, () => {
  console.log(`SchoolBuddy backend v${process.env.npm_package_version ?? '1.0'} running on port ${PORT}`);
  console.log(`DB path: ${process.env.DATA_DIR ?? 'default (relative)'}`);
});
