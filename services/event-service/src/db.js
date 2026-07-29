const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME     || 'events_db',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max:      10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('[event-service] DB pool error:', err.message);
});

async function init() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id              SERIAL PRIMARY KEY,
        title           VARCHAR(255)   NOT NULL,
        venue           VARCHAR(255)   NOT NULL,
        event_datetime  TIMESTAMPTZ    NOT NULL,
        ticket_price    NUMERIC(10,2)  NOT NULL DEFAULT 0,
        capacity        INTEGER        NOT NULL DEFAULT 100,
        seats_available INTEGER        NOT NULL DEFAULT 100,
        created_at      TIMESTAMPTZ    DEFAULT NOW(),
        updated_at      TIMESTAMPTZ    DEFAULT NOW(),
        CONSTRAINT seats_lte_capacity CHECK (seats_available <= capacity),
        CONSTRAINT seats_non_negative CHECK (seats_available >= 0)
      );

      CREATE INDEX IF NOT EXISTS idx_events_datetime ON events(event_datetime);

      -- Seed initial event if none exists
      INSERT INTO events (title, venue, event_datetime, ticket_price, capacity, seats_available)
      SELECT 'Cloud Summit 2026', 'Aberdeen Exhibition Centre, Scotland',
             '2026-08-15 09:00:00+00', 299.00, 500, 487
      WHERE NOT EXISTS (SELECT 1 FROM events);
    `);
    console.log('[event-service] DB initialised');
  } finally {
    client.release();
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  init
};
