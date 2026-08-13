import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user || user.status !== 'active') {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
  });
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, role, phone, status FROM users WHERE id = $1',
    [req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
});

export default router;
