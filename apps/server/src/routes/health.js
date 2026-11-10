import { Router } from 'express';
import { query } from '../db/pool.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const { rows } = await query('SELECT current_database() AS db, now() AS time');
    res.json({ status: 'ok', database: rows[0].db, time: rows[0].time });
  } catch (err) {
    res.status(503).json({ status: 'error', database: null, message: err.message });
  }
});

export default router;
