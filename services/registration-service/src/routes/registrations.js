const express = require('express');
const Joi     = require('joi');
const db      = require('../db');
const axios   = require('axios') || require('http');

const router = express.Router();

const EVENT_SERVICE_URL = process.env.EVENT_SERVICE_URL || 'http://event-service:3001';

const registrationSchema = Joi.object({
  event_id:     Joi.number().integer().required(),
  name:         Joi.string().max(200).trim().required(),
  email:        Joi.string().email().max(254).lowercase().required(),
  ticket_count: Joi.number().integer().min(1).max(10).required()
});

/* ---- POST /api/registrations ---- */
router.post('/', async (req, res, next) => {
  try {
    const { error, value } = registrationSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Check for duplicate registration (same email + event)
    const existing = await db.query(
      `SELECT registration_id FROM registrations
       WHERE event_id = $1 AND email = $2 AND status = 'confirmed'`,
      [value.event_id, value.email]
    );
    if (existing.rows.length) {
      return res.status(409).json({
        error: 'This email is already registered for this event.',
        registration_id: existing.rows[0].registration_id
      });
    }

    // Decrement seats in Event Service via internal API call
    // (done as best-effort; registration still saved if event service is slow)
    let eventUpdateOk = false;
    try {
      const http = require('http');
      const updatePayload = JSON.stringify({ seats_available_decrement: value.ticket_count });

      await new Promise((resolve, reject) => {
        const url = new URL(`${EVENT_SERVICE_URL}/api/events/${value.event_id}/decrement-seats`);
        const options = {
          hostname: url.hostname,
          port:     url.port || 80,
          path:     url.pathname,
          method:   'POST',
          headers:  {
            'Content-Type':   'application/json',
            'Content-Length': Buffer.byteLength(updatePayload),
            'X-Internal':     'true'
          }
        };
        const req2 = http.request(options, (r) => {
          r.resume();
          r.on('end', () => resolve());
        });
        req2.on('error', reject);
        req2.setTimeout(3000, () => reject(new Error('timeout')));
        req2.write(updatePayload);
        req2.end();
      });
      eventUpdateOk = true;
    } catch (innerErr) {
      console.warn('[registration-service] Could not update seats in event-service:', innerErr.message);
    }

    // Save registration
    const result = await db.query(
      `INSERT INTO registrations (event_id, name, email, ticket_count)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [value.event_id, value.name, value.email, value.ticket_count]
    );

    const reg = result.rows[0];
    res.status(201).json({
      registration_id: reg.registration_id,
      event_id:        reg.event_id,
      name:            reg.name,
      email:           reg.email,
      ticket_count:    reg.ticket_count,
      status:          reg.status,
      created_at:      reg.created_at,
      seats_updated:   eventUpdateOk
    });
  } catch (err) {
    next(err);
  }
});

/* ---- GET /api/registrations ---- */
router.get('/', async (req, res, next) => {
  try {
    const limit   = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const offset  = parseInt(req.query.offset || '0', 10);
    const eventId = req.query.event_id ? parseInt(req.query.event_id, 10) : null;

    let query  = 'SELECT registration_id, event_id, name, email, ticket_count, status, created_at FROM registrations';
    const params = [];
    if (eventId) { query += ' WHERE event_id = $1'; params.push(eventId); }
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    res.json({ registrations: result.rows, total: result.rowCount });
  } catch (err) {
    next(err);
  }
});

/* ---- GET /api/registrations/:id ---- */
router.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    // Validate UUID format
    if (!/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({ error: 'Invalid registration ID' });

    const result = await db.query(
      'SELECT registration_id, event_id, name, email, ticket_count, status, created_at FROM registrations WHERE registration_id = $1',
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Registration not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/* ---- DELETE /api/registrations/:id (cancel) ---- */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({ error: 'Invalid registration ID' });

    const result = await db.query(
      `UPDATE registrations SET status = 'cancelled' WHERE registration_id = $1 AND status = 'confirmed' RETURNING *`,
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Registration not found or already cancelled' });
    res.json({ message: 'Registration cancelled', registration_id: id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
