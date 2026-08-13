import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notifyAdmins } from '../utils/notify.js';

const router = Router();
router.use(requireAuth);

router.get('/main', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT im.*, p.name AS product_name, p.sku, p.type, p.low_stock_threshold
     FROM inventory_main im JOIN products p ON p.id = im.product_id
     ORDER BY p.name`
  );
  res.json(rows);
});

router.get('/agent/:agentId', async (req, res) => {
  if (req.user.role === 'agent' && Number(req.params.agentId) !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { rows } = await pool.query(
    `SELECT ia.*, p.name AS product_name, p.sku, p.type
     FROM inventory_agent ia JOIN products p ON p.id = ia.product_id
     WHERE ia.agent_id = $1 ORDER BY p.name`,
    [req.params.agentId]
  );
  res.json(rows);
});

router.get('/transfers', async (req, res) => {
  const values = [];
  let where = 'WHERE 1=1';
  if (req.user.role === 'agent') {
    where += ` AND (st.from_id = $1 AND st.from_type = 'agent' OR st.to_id = $1 AND st.to_type = 'agent')`;
    values.push(req.user.id);
  }
  const { rows } = await pool.query(
    `SELECT st.*, p.name AS product_name
     FROM stock_transfers st JOIN products p ON p.id = st.product_id
     ${where}
     ORDER BY st.transferred_at DESC`,
    values
  );
  res.json(rows);
});

// Manual transfer: main -> agent, or agent -> retailer (sales use a separate deduction path)
router.post('/transfer', async (req, res) => {
  const { product_id, from_type, from_id, to_type, to_id, quantity, related_load_request_id } = req.body;
  if (!product_id || !from_type || !to_type || !to_id || !quantity || quantity <= 0) {
    return res.status(400).json({ error: 'product_id, from_type, to_type, to_id, quantity are required' });
  }
  if (from_type === 'main' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admin can transfer from main inventory' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (from_type === 'main') {
      const { rows } = await client.query(
        'SELECT quantity_on_hand FROM inventory_main WHERE product_id = $1 FOR UPDATE',
        [product_id]
      );
      if (!rows[0] || rows[0].quantity_on_hand < quantity) {
        throw new Error('Insufficient main inventory');
      }
      await client.query(
        'UPDATE inventory_main SET quantity_on_hand = quantity_on_hand - $1, updated_at = now() WHERE product_id = $2',
        [quantity, product_id]
      );
    } else {
      const { rows } = await client.query(
        'SELECT quantity_on_hand FROM inventory_agent WHERE agent_id = $1 AND product_id = $2 FOR UPDATE',
        [from_id, product_id]
      );
      if (!rows[0] || rows[0].quantity_on_hand < quantity) {
        throw new Error('Insufficient agent inventory');
      }
      await client.query(
        'UPDATE inventory_agent SET quantity_on_hand = quantity_on_hand - $1, updated_at = now() WHERE agent_id = $2 AND product_id = $3',
        [quantity, from_id, product_id]
      );
    }

    if (to_type === 'agent') {
      await client.query(
        `INSERT INTO inventory_agent (agent_id, product_id, quantity_on_hand)
         VALUES ($1, $2, $3)
         ON CONFLICT (agent_id, product_id) DO UPDATE SET quantity_on_hand = inventory_agent.quantity_on_hand + $3, updated_at = now()`,
        [to_id, product_id, quantity]
      );
    }
    // to_type === 'retailer' is handled by the sales flow; here we just log if used directly

    const { rows: transferRows } = await client.query(
      `INSERT INTO stock_transfers (product_id, from_type, from_id, to_type, to_id, quantity, related_load_request_id, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [product_id, from_type, from_id, to_type, to_id, quantity, related_load_request_id || null, req.user.id]
    );

    await client.query('COMMIT');

    // low stock check
    if (from_type === 'main') {
      const { rows: mainRows } = await pool.query(
        `SELECT im.quantity_on_hand, p.name, p.low_stock_threshold FROM inventory_main im
         JOIN products p ON p.id = im.product_id WHERE im.product_id = $1`,
        [product_id]
      );
      if (mainRows[0] && mainRows[0].quantity_on_hand <= mainRows[0].low_stock_threshold) {
        await notifyAdmins('inventory_low', `Low main stock: ${mainRows[0].name} (${mainRows[0].quantity_on_hand} left)`, 'product', product_id);
      }
    }

    res.status(201).json(transferRows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
