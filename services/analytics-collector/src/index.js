require('dotenv').config();
const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const morgan     = require('morgan');
const promClient = require('prom-client');
const Joi        = require('joi');
const { createClient } = require('@clickhouse/client');

const app  = express();
const PORT = process.env.PORT || 3004;

/* ---- ClickHouse Client ---- */
// Connect to 'default' database first so we can CREATE the analytics DB
const clickhouse = createClient({
  host:     process.env.CLICKHOUSE_HOST     || 'http://clickhouse:8123',
  database: 'default',
  username: process.env.CLICKHOUSE_USER     || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || ''
});

/* ---- Create ClickHouse database + table on startup ---- */
async function initClickHouse() {
  // Create DB first (client is on 'default', so this always works)
  await clickhouse.exec({
    query: `CREATE DATABASE IF NOT EXISTS analytics`
  });

  await clickhouse.exec({
    query: `
      CREATE TABLE IF NOT EXISTS analytics.web_events (
        session_id      String,
        visitor_id      String,
        event_type      LowCardinality(String),
        page_url        String,
        referrer        String,
        user_agent      String,
        screen_width    UInt16,
        screen_height   UInt16,
        timestamp       DateTime64(3, 'UTC'),
        properties      String,   -- JSON blob for flexible properties
        ip_address      String    -- anonymised (last octet zeroed)
      )
      ENGINE = MergeTree()
      PARTITION BY toYYYYMM(timestamp)
      ORDER BY (event_type, session_id, timestamp)
      TTL toDateTime(timestamp) + INTERVAL 1 YEAR
      SETTINGS index_granularity = 8192
    `
  });
  console.log('[analytics-collector] ClickHouse tables ready');
}

/* ---- Middleware ---- */
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({ origin: '*', methods: ['POST', 'GET', 'OPTIONS'] }));
app.use(rateLimit({
  windowMs: 60000,
  max: 500,        // Analytics can be high-volume
  standardHeaders: true,
  legacyHeaders: false
}));
app.use(express.json({ limit: '20kb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

promClient.collectDefaultMetrics({ prefix: 'analytics_collector_' });

/* ---- Validation ---- */
const eventSchema = Joi.object({
  session_id:    Joi.string().max(80).required(),
  visitor_id:    Joi.string().max(80).required(),
  event_type:    Joi.string().max(50).required(),
  page_url:      Joi.string().max(500).allow('').optional(),
  referrer:      Joi.string().max(500).allow('').optional(),
  user_agent:    Joi.string().max(500).allow('').optional(),
  screen_width:  Joi.number().integer().min(0).max(9999).optional(),
  screen_height: Joi.number().integer().min(0).max(9999).optional(),
  timestamp:     Joi.string().isoDate().optional(),
  properties:    Joi.object().optional()
});

/* ---- Anonymise IP (last octet zeroed) ---- */
function anonymiseIp(ip) {
  if (!ip) return '0.0.0.0';
  const v4 = ip.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
  if (v4) return v4[1] + '.0';
  // IPv6: zero last group
  const parts = ip.split(':');
  if (parts.length >= 2) { parts[parts.length - 1] = '0'; return parts.join(':'); }
  return '0.0.0.0';
}

/* ---- POST /api/analytics/event ---- */
app.post('/api/analytics/event', async (req, res) => {
  const { error, value } = eventSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const rawIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '';
  const ip    = anonymiseIp(rawIp);

  const row = {
    session_id:    value.session_id,
    visitor_id:    value.visitor_id,
    event_type:    value.event_type,
    page_url:      value.page_url    || '',
    referrer:      value.referrer    || '',
    user_agent:    value.user_agent  || '',
    screen_width:  value.screen_width  || 0,
    screen_height: value.screen_height || 0,
    timestamp:     value.timestamp ? new Date(value.timestamp) : new Date(),
    properties:    JSON.stringify(value.properties || {}),
    ip_address:    ip
  };

  try {
    await clickhouse.insert({
      table:  'analytics.web_events',
      values: [row],
      format: 'JSONEachRow'
    });
    // Respond immediately with 204 (no content) for performance
    res.status(204).end();
  } catch (err) {
    console.error('[analytics-collector] ClickHouse insert error:', err.message);
    // Still return 204 to client - don't block frontend experience for analytics failures
    res.status(204).end();
  }
});

/* ---- GET /api/analytics/summary (for dashboards) ---- */
app.get('/api/analytics/summary', async (req, res, next) => {
  try {
    const result = await clickhouse.query({
      query: `
        SELECT
          event_type,
          count()                                        AS total_events,
          uniq(session_id)                               AS unique_sessions,
          uniq(visitor_id)                               AS unique_visitors,
          toStartOfHour(timestamp)                       AS hour
        FROM analytics.web_events
        WHERE timestamp >= now() - INTERVAL 24 HOUR
        GROUP BY event_type, hour
        ORDER BY hour DESC, total_events DESC
        LIMIT 200
      `,
      format: 'JSONEachRow'
    });
    const rows = await result.json();
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

/* ---- Health ---- */
app.get('/health', async (req, res) => {
  try {
    await clickhouse.ping();
    res.json({ status: 'healthy', service: 'analytics-collector', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'unhealthy', error: 'ClickHouse unreachable' });
  }
});

/* ---- Metrics ---- */
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error('[analytics-collector] Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

/* ---- Start ---- */
initClickHouse().then(() => {
  app.listen(PORT, () => console.log(`[analytics-collector] Listening on port ${PORT}`));
}).catch(err => {
  console.error('[analytics-collector] Startup failed:', err.message);
  process.exit(1);
});

module.exports = app;
