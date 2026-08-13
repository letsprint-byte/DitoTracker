import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [req.user.id]
  );
  res.json(rows);
});

router.get('/unread-count', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = false`,
    [req.user.id]
  );
  res.json(rows[0]);
});

router.patch('/:id/read', async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *`,
    [req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

router.patch('/read-all', async (req, res) => {
  await pool.query(`UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`, [req.user.id]);
  res.json({ ok: true });
});

export default router;
