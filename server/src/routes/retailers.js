import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

function scopeClause(req, startIdx) {
  if (req.user.role === 'admin') return { clause: '', values: [] };
  return { clause: `AND r.agent_id = $${startIdx}`, values: [req.user.id] };
}

router.get('/', async (req, res) => {
  const { status, agent_id, search } = req.query;
  const values = [];
  let i = 1;
  let where = 'WHERE 1=1';

  if (req.user.role === 'agent') {
    where += ` AND r.agent_id = $${i++}`;
    values.push(req.user.id);
  } else if (agent_id) {
    where += ` AND r.agent_id = $${i++}`;
    values.push(agent_id);
  }
  if (status) {
    where += ` AND r.status = $${i++}`;
    values.push(status);
  }
  if (search) {
    where += ` AND (r.business_name ILIKE $${i} OR r.contact_person ILIKE $${i} OR r.phone ILIKE $${i})`;
    values.push(`%${search}%`);
    i++;
  }

  const { rows } = await pool.query(
    `SELECT r.*, u.name AS agent_name
     FROM retailers r JOIN users u ON u.id = r.agent_id
     ${where}
     ORDER BY r.created_at DESC`,
    values
  );
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.*, u.name AS agent_name FROM retailers r JOIN users u ON u.id = r.agent_id WHERE r.id = $1`,
    [req.params.id]
  );
  const retailer = rows[0];
  if (!retailer) return res.status(404).json({ error: 'Retailer not found' });
  if (req.user.role === 'agent' && retailer.agent_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(retailer);
});

router.get('/:id/history', async (req, res) => {
  const { rows: retailerRows } = await pool.query('SELECT agent_id FROM retailers WHERE id = $1', [req.params.id]);
  if (!retailerRows[0]) return res.status(404).json({ error: 'Retailer not found' });
  if (req.user.role === 'agent' && retailerRows[0].agent_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { rows: sales } = await pool.query(
    `SELECT s.*, p.name AS product_name FROM sales s JOIN products p ON p.id = s.product_id
     WHERE s.retailer_id = $1 ORDER BY s.sale_date DESC, s.created_at DESC`,
    [req.params.id]
  );
  const { rows: payments } = await pool.query(
    `SELECT * FROM payments WHERE retailer_id = $1 ORDER BY payment_date DESC, created_at DESC`,
    [req.params.id]
  );
  res.json({ sales, payments });
});

router.post('/', async (req, res) => {
  const {
    business_name, contact_person, phone, address,
    expected_monthly_load_amount, notes, agent_id,
  } = req.body;
  if (!business_name) return res.status(400).json({ error: 'business_name is required' });

  const ownerAgentId = req.user.role === 'admin' && agent_id ? agent_id : req.user.id;

  const { rows } = await pool.query(
    `INSERT INTO retailers (agent_id, business_name, contact_person, phone, address, expected_monthly_load_amount, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [ownerAgentId, business_name, contact_person || null, phone || null, address || null, expected_monthly_load_amount || 0, notes || null]
  );
  res.status(201).json(rows[0]);
});

router.patch('/:id', async (req, res) => {
  const { rows: existing } = await pool.query('SELECT * FROM retailers WHERE id = $1', [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: 'Retailer not found' });
  if (req.user.role === 'agent' && existing[0].agent_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const allowed = ['business_name', 'contact_person', 'phone', 'address', 'status', 'expected_monthly_load_amount', 'notes', 'agent_id'];
  const fields = [];
  const values = [];
  let i = 1;
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      if (key === 'agent_id' && req.user.role !== 'admin') continue;
      fields.push(`${key} = $${i++}`);
      values.push(req.body[key]);
    }
  }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE retailers SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  res.json(rows[0]);
});

export default router;
