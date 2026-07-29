const express = require('express');
const Joi     = require('joi');
const db      = require('../db');
const { triggerSeatNotifier } = require('../notifier');

const router = express.Router();

const SEATS_LOW_THRESHOLD = parseInt(process.env.SEATS_LOW_THRESHOLD || '10', 10);

/* ---- Validation Schemas ---- */
const createSchema = Joi.object({
  title:          Joi.string().max(255).required(),
  venue:          Joi.string().max(255).required(),
  event_datetime: Joi.string().isoDate().required(),
  ticket_price:   Joi.number().min(0).required(),
  capacity:       Joi.number().integer().min(1).required(),
  seats_available: Joi.number().integer().min(0).optional()
});

const updateSchema = Joi.object({
  title:           Joi.string().max(255),
  venue:           Joi.string().max(255),
  event_datetime:  Joi.string().isoDate(),
  ticket_price:    Joi.number().min(0),
  seats_available: Joi.number().integer().min(0)
}).min(1);

/* ---- GET /api/events ---- */
router.get('/', async (req, res, next) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = parseInt(req.query.offset || '0', 10);
    const result = await db.query(
      'SELECT * FROM events ORDER BY event_datetime ASC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    res.json({ events: result.rows, total: result.rowCount });
  } catch (err) {
    next(err);
  }
});

/* ---- GET /api/events/:id ---- */
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid event ID' });

    const result = await db.query('SELECT * FROM events WHERE id = $1', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Event not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/* ---- POST /api/events ---- */
router.post('/', async (req, res, next) => {
  try {
    const { error, value } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const seats = value.seats_available !== undefined ? value.seats_available : value.capacity;
    const result = await db.query(
      `INSERT INTO events (title, venue, event_datetime, ticket_price, capacity, seats_available)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [value.title, value.venue, value.event_datetime, value.ticket_price, value.capacity, seats]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/* ---- PATCH /api/events/:id ---- */
router.patch('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid event ID' });

    const { error, value } = updateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Dynamic update builder
    const fields = Object.keys(value);
    const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = [id, ...fields.map(f => value[f])];

    const result = await db.query(
      `UPDATE events SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      values
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Event not found' });

    const updatedEvent = result.rows[0];

    // Trigger serverless notifier if seats drop below threshold
    if (
      value.seats_available !== undefined &&
      updatedEvent.seats_available < SEATS_LOW_THRESHOLD
    ) {
      triggerSeatNotifier(updatedEvent).catch(err =>
        console.warn('[event-service] Seat notifier error:', err.message)
      );
    }

    res.json(updatedEvent);
  } catch (err) {
    next(err);
  }
});

/* ---- DELETE /api/events/:id ---- */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid event ID' });

    const result = await db.query('DELETE FROM events WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Event not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
