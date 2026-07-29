const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME     || 'programs_db',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max:      10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => console.error('[program-service] DB pool error:', err.message));

async function init() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS programs (
        id            SERIAL PRIMARY KEY,
        event_id      INTEGER        NOT NULL,
        day           INTEGER        NOT NULL CHECK (day BETWEEN 1 AND 7),
        track         VARCHAR(100)   NOT NULL,
        session_title VARCHAR(255)   NOT NULL,
        speaker_name  VARCHAR(150)   NOT NULL,
        start_time    TIME           NOT NULL,
        end_time      TIME           NOT NULL,
        location      VARCHAR(100)   DEFAULT 'Main Hall',
        created_at    TIMESTAMPTZ    DEFAULT NOW(),
        CONSTRAINT end_after_start CHECK (end_time > start_time)
      );

      CREATE INDEX IF NOT EXISTS idx_programs_event_day ON programs(event_id, day);

      -- Seed sample schedule if none exists
      INSERT INTO programs (event_id, day, track, session_title, speaker_name, start_time, end_time, location)
      SELECT * FROM (VALUES
        (1, 1, 'Cloud Infrastructure', 'Opening Keynote: The Future of Cloud', 'Dr. Sarah Chen', '09:00'::TIME, '10:00'::TIME, 'Main Hall'),
        (1, 1, 'Cloud Infrastructure', 'AWS EC2 & EKS Deep Dive', 'Dr. Sarah Chen', '10:15'::TIME, '11:15'::TIME, 'Hall A'),
        (1, 1, 'Kubernetes & Containers', 'Kubernetes at Scale — Real-World Patterns', 'James Patel', '11:30'::TIME, '12:30'::TIME, 'Hall B'),
        (1, 1, 'Microservices', 'Microservices vs Monolith: Making the Right Choice', 'Aisha Okonkwo', '14:00'::TIME, '15:00'::TIME, 'Hall A'),
        (1, 1, 'Analytics & Data', 'Real-Time Analytics with ClickHouse', 'Lars Bergman', '15:15'::TIME, '16:15'::TIME, 'Hall B'),
        (1, 1, 'Cloud Infrastructure', 'Networking Workshop', 'All Speakers', '16:30'::TIME, '17:30'::TIME, 'Main Hall'),
        (1, 2, 'Kubernetes & Containers', 'Service Mesh with Istio', 'James Patel', '09:00'::TIME, '10:00'::TIME, 'Hall A'),
        (1, 2, 'Cloud Infrastructure', 'Serverless Architectures with AWS Lambda', 'Dr. Sarah Chen', '10:15'::TIME, '11:15'::TIME, 'Hall B'),
        (1, 2, 'Microservices', 'API Gateway Patterns', 'Aisha Okonkwo', '11:30'::TIME, '12:30'::TIME, 'Hall A'),
        (1, 2, 'Analytics & Data', 'Streaming Data Pipelines', 'Lars Bergman', '14:00'::TIME, '15:00'::TIME, 'Hall B'),
        (1, 2, 'Kubernetes & Containers', 'CI/CD Blue-Green Deployments on Kubernetes', 'James Patel', '15:15'::TIME, '16:15'::TIME, 'Hall A'),
        (1, 2, 'Cloud Infrastructure', 'Cloud Cost Optimisation Strategies', 'Dr. Sarah Chen', '16:30'::TIME, '17:15'::TIME, 'Main Hall'),
        (1, 3, 'Microservices', 'Observability: Prometheus, Grafana & Distributed Tracing', 'Aisha Okonkwo', '09:00'::TIME, '10:00'::TIME, 'Hall A'),
        (1, 3, 'Analytics & Data', 'Metabase Dashboards for Business Intelligence', 'Lars Bergman', '10:15'::TIME, '11:15'::TIME, 'Hall B'),
        (1, 3, 'Cloud Infrastructure', 'Security & Compliance in the Cloud', 'Dr. Sarah Chen', '11:30'::TIME, '12:30'::TIME, 'Main Hall'),
        (1, 3, 'Kubernetes & Containers', 'Hands-On Lab: Deploying on EKS', 'James Patel', '14:00'::TIME, '15:30'::TIME, 'Lab Room'),
        (1, 3, 'Cloud Infrastructure', 'Closing Keynote & Awards', 'All Speakers', '16:00'::TIME, '17:00'::TIME, 'Main Hall')
      ) AS data(event_id, day, track, session_title, speaker_name, start_time, end_time, location)
      WHERE NOT EXISTS (SELECT 1 FROM programs);
    `);
    console.log('[program-service] DB initialised');
  } finally {
    client.release();
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  init
};
