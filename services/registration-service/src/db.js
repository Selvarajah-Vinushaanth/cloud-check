const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME     || 'registrations_db',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max:      10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => console.error('[registration-service] DB pool error:', err.message));

async function init() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS registrations (
        registration_id  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id         INTEGER       NOT NULL,
        name             VARCHAR(200)  NOT NULL,
        email            VARCHAR(254)  NOT NULL,
        ticket_count     INTEGER       NOT NULL CHECK (ticket_count >= 1 AND ticket_count <= 10),
        status           VARCHAR(20)   NOT NULL DEFAULT 'confirmed',
        created_at       TIMESTAMPTZ   DEFAULT NOW(),
        CONSTRAINT valid_status CHECK (status IN ('confirmed', 'cancelled', 'pending'))
      );

      CREATE INDEX IF NOT EXISTS idx_reg_event ON registrations(event_id);
      CREATE INDEX IF NOT EXISTS idx_reg_email  ON registrations(email);
    `);
    console.log('[registration-service] DB initialised');
  } finally {
    client.release();
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  init
};
