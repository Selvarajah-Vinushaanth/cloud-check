require('dotenv').config();
const express       = require('express');
const helmet        = require('helmet');
const cors          = require('cors');
const rateLimit     = require('express-rate-limit');
const morgan        = require('morgan');
const promClient    = require('prom-client');
const db            = require('./db');
const programRoutes = require('./routes/programs');

const app  = express();
const PORT = process.env.PORT || 3002;

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(rateLimit({ windowMs: 60000, max: 200, standardHeaders: true, legacyHeaders: false }));
app.use(express.json({ limit: '100kb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

promClient.collectDefaultMetrics({ prefix: 'program_service_' });

app.use('/api/programs', programRoutes);

app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'healthy', service: 'program-service', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'unhealthy', error: 'DB unreachable' });
  }
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error('[program-service] Error:', err.message);
  res.status(err.status || 500).json({ error: err.status === 500 || !err.status ? 'Internal server error' : err.message });
});

db.init().then(() => {
  app.listen(PORT, () => console.log(`[program-service] Listening on port ${PORT}`));
}).catch(err => {
  console.error('[program-service] Failed to connect to DB:', err.message);
  process.exit(1);
});

module.exports = app;
