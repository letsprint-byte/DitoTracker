import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM products ORDER BY name');
  res.json(rows);
});

router.post('/', requireRole('admin'), async (req, res) => {
  const { name, type, sku, unit_price, low_stock_threshold, description } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'name and type are required' });
  const { rows } = await pool.query(
    `INSERT INTO products (name, type, sku, unit_price, low_stock_threshold, description)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [name, type, sku || null, unit_price || 0, low_stock_threshold || 10, description || null]
  );
  await pool.query(
    `INSERT INTO inventory_main (product_id, quantity_on_hand) VALUES ($1, 0) ON CONFLICT DO NOTHING`,
    [rows[0].id]
  );
  res.status(201).json(rows[0]);
});

router.patch('/:id', requireRole('admin'), async (req, res) => {
  const allowed = ['name', 'type', 'sku', 'unit_price', 'low_stock_threshold', 'description'];
  const fields = [];
  const values = [];
  let i = 1;
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      fields.push(`${key} = $${i++}`);
      values.push(req.body[key]);
    }
  }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.params.id);
  const { rows } = await pool.query(`UPDATE products SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, values);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

export default router;
