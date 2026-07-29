const express    = require('express');
const Joi        = require('joi');
const db         = require('../db');

const router = express.Router();

const programSchema = Joi.object({
  event_id:      Joi.number().integer().required(),
  day:           Joi.number().integer().min(1).max(7).required(),
  track:         Joi.string().max(100).required(),
  session_title: Joi.string().max(255).required(),
  speaker_name:  Joi.string().max(150).required(),
  start_time:    Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  end_time:      Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  location:      Joi.string().max(100).optional()
});

/* ---- GET /api/programs ---- */
router.get('/', async (req, res, next) => {
  try {
    const limit    = Math.min(parseInt(req.query.limit || '100', 10), 500);
    const eventId  = req.query.event_id ? parseInt(req.query.event_id, 10) : null;
    const day      = req.query.day      ? parseInt(req.query.day, 10)      : null;

    let query  = 'SELECT * FROM programs';
    const params = [];
    const conditions = [];

    if (eventId) { conditions.push(`event_id = $${params.length + 1}`); params.push(eventId); }
    if (day)     { conditions.push(`day = $${params.length + 1}`);      params.push(day); }

    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ` ORDER BY day ASC, start_time ASC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await db.query(query, params);
    res.json({ programs: result.rows, total: result.rowCount });
  } catch (err) {
    next(err);
  }
});

/* ---- GET /api/programs/:id ---- */
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid program ID' });
    const result = await db.query('SELECT * FROM programs WHERE id = $1', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Program not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/* ---- POST /api/programs ---- */
router.post('/', async (req, res, next) => {
  try {
    const { error, value } = programSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const result = await db.query(
      `INSERT INTO programs (event_id, day, track, session_title, speaker_name, start_time, end_time, location)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [value.event_id, value.day, value.track, value.session_title,
       value.speaker_name, value.start_time, value.end_time, value.location || 'Main Hall']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/* ---- DELETE /api/programs/:id ---- */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid program ID' });
    const result = await db.query('DELETE FROM programs WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Program not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
