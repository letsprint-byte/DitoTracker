import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { agent_id, retailer_id, product_type, payment_status, date_from, date_to } = req.query;
  const values = [];
  let i = 1;
  let where = 'WHERE 1=1';
  if (req.user.role === 'agent') {
    where += ` AND s.agent_id = $${i++}`;
    values.push(req.user.id);
  } else if (agent_id) {
    where += ` AND s.agent_id = $${i++}`;
    values.push(agent_id);
  }
  if (retailer_id) { where += ` AND s.retailer_id = $${i++}`; values.push(retailer_id); }
  if (product_type) { where += ` AND p.type = $${i++}`; values.push(product_type); }
  if (payment_status) { where += ` AND s.payment_status = $${i++}`; values.push(payment_status); }
  if (date_from) { where += ` AND s.sale_date >= $${i++}`; values.push(date_from); }
  if (date_to) { where += ` AND s.sale_date <= $${i++}`; values.push(date_to); }

  const { rows } = await pool.query(
    `SELECT s.*, r.business_name AS retailer_name, p.name AS product_name, p.type AS product_type, u.name AS agent_name
     FROM sales s
     JOIN retailers r ON r.id = s.retailer_id
     JOIN products p ON p.id = s.product_id
     JOIN users u ON u.id = s.agent_id
     ${where}
     ORDER BY s.sale_date DESC, s.created_at DESC`,
    values
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { retailer_id, product_id, quantity, unit_price, sale_date, payment_status } = req.body;
  if (!retailer_id || !product_id || !quantity) {
    return res.status(400).json({ error: 'retailer_id, product_id, quantity are required' });
  }

  const { rows: retailerRows } = await pool.query('SELECT * FROM retailers WHERE id = $1', [retailer_id]);
  const retailer = retailerRows[0];
  if (!retailer) return res.status(404).json({ error: 'Retailer not found' });
  if (req.user.role === 'agent' && retailer.agent_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { rows: productRows } = await pool.query('SELECT * FROM products WHERE id = $1', [product_id]);
  const product = productRows[0];
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const price = unit_price !== undefined ? unit_price : product.unit_price;
  const total = price * quantity;
  const status = payment_status || 'unpaid';
  const agentId = retailer.agent_id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Deduct from agent inventory for physical items (sim, wifi_device)
    if (product.type !== 'load') {
      const { rows: invRows } = await client.query(
        'SELECT quantity_on_hand FROM inventory_agent WHERE agent_id = $1 AND product_id = $2 FOR UPDATE',
        [agentId, product_id]
      );
      if (!invRows[0] || invRows[0].quantity_on_hand < quantity) {
        throw new Error('Insufficient agent inventory for this product');
      }
      await client.query(
        'UPDATE inventory_agent SET quantity_on_hand = quantity_on_hand - $1, updated_at = now() WHERE agent_id = $2 AND product_id = $3',
        [quantity, agentId, product_id]
      );
      await client.query(
        `INSERT INTO stock_transfers (product_id, from_type, from_id, to_type, to_id, quantity, recorded_by)
         VALUES ($1,'agent',$2,'retailer',$3,$4,$5)`,
        [product_id, agentId, retailer_id, quantity, req.user.id]
      );
    }

    const { rows: saleRows } = await client.query(
      `INSERT INTO sales (agent_id, retailer_id, product_id, quantity, unit_price, total_amount, sale_date, payment_status)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, CURRENT_DATE),$8) RETURNING *`,
      [agentId, retailer_id, product_id, quantity, price, total, sale_date || null, status]
    );

    const balanceDelta = status === 'paid' ? 0 : status === 'partial' ? total / 2 : total;
    await client.query(
      `UPDATE retailers SET last_purchase_date = COALESCE($1, CURRENT_DATE), current_balance = current_balance + $2 WHERE id = $3`,
      [sale_date || null, balanceDelta, retailer_id]
    );

    await client.query('COMMIT');
    res.status(201).json(saleRows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
