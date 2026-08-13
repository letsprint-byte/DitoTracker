import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// List agents (admin only) — used for agent management + assignment dropdowns
router.get('/', requireRole('admin'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, email, role, phone, status, created_at FROM users ORDER BY created_at DESC`
  );
  res.json(rows);
});

router.post('/', requireRole('admin'), async (req, res) => {
  const { name, email, password, role, phone } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password, role are required' });
  }
  if (!['admin', 'agent'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const password_hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, phone) VALUES ($1,$2,$3,$4,$5)
       RETURNING id, name, email, role, phone, status, created_at`,
      [name, email, password_hash, role, phone || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use' });
    throw err;
  }
});

router.patch('/:id', requireRole('admin'), async (req, res) => {
  const { name, phone, status, role, password } = req.body;
  const fields = [];
  const values = [];
  let i = 1;
  if (name !== undefined) { fields.push(`name = $${i++}`); values.push(name); }
  if (phone !== undefined) { fields.push(`phone = $${i++}`); values.push(phone); }
  if (status !== undefined) { fields.push(`status = $${i++}`); values.push(status); }
  if (role !== undefined) { fields.push(`role = $${i++}`); values.push(role); }
  if (password) {
    const password_hash = await bcrypt.hash(password, 10);
    fields.push(`password_hash = $${i++}`);
    values.push(password_hash);
  }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, name, email, role, phone, status, created_at`,
    values
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

export default router;
