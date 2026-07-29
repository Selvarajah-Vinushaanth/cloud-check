require('dotenv').config();
const express        = require('express');
const helmet         = require('helmet');
const cors           = require('cors');
const rateLimit      = require('express-rate-limit');
const morgan         = require('morgan');
const promClient     = require('prom-client');
const db             = require('./db');
const eventRoutes    = require('./routes/events');

const app  = express();
const PORT = process.env.PORT || 3001;

/* ---- Security Middleware ---- */
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

/* ---- Rate Limiting ---- */
app.use(rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
}));

/* ---- Body Parsing ---- */
app.use(express.json({ limit: '100kb' }));

/* ---- Logging ---- */
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

/* ---- Prometheus Metrics ---- */
promClient.collectDefaultMetrics({ prefix: 'event_service_' });
const httpRequestDuration = new promClient.Histogram({
  name: 'event_service_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2]
});

app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => end({ method: req.method, route: req.route?.path || req.path, status_code: res.statusCode }));
  next();
});

/* ---- Routes ---- */
app.use('/api/events', eventRoutes);

/* ---- Health ---- */
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'healthy', service: 'event-service', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: 'DB unreachable' });
  }
});

/* ---- Metrics Endpoint ---- */
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

/* ---- 404 Handler ---- */
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

/* ---- Global Error Handler ---- */
app.use((err, req, res, next) => {
  console.error('[event-service] Error:', err.message);
  const status = err.status || 500;
  res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message });
});

/* ---- Start ---- */
db.init().then(() => {
  app.listen(PORT, () => console.log(`[event-service] Listening on port ${PORT}`));
}).catch(err => {
  console.error('[event-service] Failed to connect to DB:', err.message);
  process.exit(1);
});

module.exports = app;
