import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notify, notifyAdmins } from '../utils/notify.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { status, agent_id } = req.query;
  const values = [];
  let i = 1;
  let where = 'WHERE 1=1';
  if (req.user.role === 'agent') {
    where += ` AND lr.agent_id = $${i++}`;
    values.push(req.user.id);
  } else if (agent_id) {
    where += ` AND lr.agent_id = $${i++}`;
    values.push(agent_id);
  }
  if (status) {
    where += ` AND lr.status = $${i++}`;
    values.push(status);
  }
  const { rows } = await pool.query(
    `SELECT lr.*, u.name AS agent_name, p.name AS product_name, au.name AS approved_by_name
     FROM load_requests lr
     JOIN users u ON u.id = lr.agent_id
     LEFT JOIN products p ON p.id = lr.product_id
     LEFT JOIN users au ON au.id = lr.approved_by
     ${where}
     ORDER BY lr.requested_at DESC`,
    values
  );
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT lr.*, u.name AS agent_name, p.name AS product_name, au.name AS approved_by_name
     FROM load_requests lr
     JOIN users u ON u.id = lr.agent_id
     LEFT JOIN products p ON p.id = lr.product_id
     LEFT JOIN users au ON au.id = lr.approved_by
     WHERE lr.id = $1`,
    [req.params.id]
  );
  const lr = rows[0];
  if (!lr) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'agent' && lr.agent_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const { rows: transfers } = await pool.query(
    'SELECT * FROM stock_transfers WHERE related_load_request_id = $1 ORDER BY transferred_at',
    [req.params.id]
  );
  res.json({ ...lr, transfers });
});

router.post('/', async (req, res) => {
  const { requested_amount, product_id, quantity, notes } = req.body;
  if (!requested_amount) return res.status(400).json({ error: 'requested_amount is required' });
  const { rows } = await pool.query(
    `INSERT INTO load_requests (agent_id, requested_amount, product_id, quantity, notes)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.user.id, requested_amount, product_id || null, quantity || 1, notes || null]
  );
  await notifyAdmins('load_request', `${req.user.name} requested a load of ${requested_amount}`, 'load_request', rows[0].id);
  res.status(201).json(rows[0]);
});

async function transitionStatus(req, res, expectedStatus, newStatus, extraFields = {}) {
  const { rows: existing } = await pool.query('SELECT * FROM load_requests WHERE id = $1', [req.params.id]);
  const lr = existing[0];
  if (!lr) return res.status(404).json({ error: 'Not found' });
  if (lr.status !== expectedStatus) {
    return res.status(400).json({ error: `Request must be '${expectedStatus}' to transition to '${newStatus}' (currently '${lr.status}')` });
  }
  return lr;
}

router.patch('/:id/approve', requireRole('admin'), async (req, res) => {
  const lr = await transitionStatus(req, res, 'pending', 'approved');
  if (!lr || res.headersSent) return;
  const { rows } = await pool.query(
    `UPDATE load_requests SET status = 'approved', approved_at = now(), approved_by = $1 WHERE id = $2 RETURNING *`,
    [req.user.id, req.params.id]
  );
  await notify(lr.agent_id, 'load_request', `Your load request #${lr.id} was approved`, 'load_request', lr.id);
  res.json(rows[0]);
});

router.patch('/:id/reject', requireRole('admin'), async (req, res) => {
  const { rows: existing } = await pool.query('SELECT * FROM load_requests WHERE id = $1', [req.params.id]);
  const lr = existing[0];
  if (!lr) return res.status(404).json({ error: 'Not found' });
  if (!['pending', 'approved'].includes(lr.status)) {
    return res.status(400).json({ error: `Cannot reject a request in status '${lr.status}'` });
  }
  const { rows } = await pool.query(
    `UPDATE load_requests SET status = 'rejected', notes = COALESCE($1, notes) WHERE id = $2 RETURNING *`,
    [req.body.notes || null, req.params.id]
  );
  await notify(lr.agent_id, 'load_request', `Your load request #${lr.id} was rejected`, 'load_request', lr.id);
  res.json(rows[0]);
});

router.patch('/:id/release', requireRole('admin'), async (req, res) => {
  const { rows: existing } = await pool.query('SELECT * FROM load_requests WHERE id = $1', [req.params.id]);
  const lr = existing[0];
  if (!lr) return res.status(404).json({ error: 'Not found' });
  if (lr.status !== 'approved') {
    return res.status(400).json({ error: `Request must be 'approved' to release (currently '${lr.status}')` });
  }
  if (!lr.product_id) {
    return res.status(400).json({ error: 'Cannot release stock: request has no product_id' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: mainRows } = await client.query(
      'SELECT quantity_on_hand FROM inventory_main WHERE product_id = $1 FOR UPDATE',
      [lr.product_id]
    );
    if (!mainRows[0] || mainRows[0].quantity_on_hand < lr.quantity) {
      throw new Error('Insufficient main inventory to release this request');
    }
    await client.query(
      'UPDATE inventory_main SET quantity_on_hand = quantity_on_hand - $1, updated_at = now() WHERE product_id = $2',
      [lr.quantity, lr.product_id]
    );
    await client.query(
      `INSERT INTO inventory_agent (agent_id, product_id, quantity_on_hand)
       VALUES ($1, $2, $3)
       ON CONFLICT (agent_id, product_id) DO UPDATE SET quantity_on_hand = inventory_agent.quantity_on_hand + $3, updated_at = now()`,
      [lr.agent_id, lr.product_id, lr.quantity]
    );
    await client.query(
      `INSERT INTO stock_transfers (product_id, from_type, from_id, to_type, to_id, quantity, related_load_request_id, recorded_by)
       VALUES ($1,'main',0,'agent',$2,$3,$4,$5)`,
      [lr.product_id, lr.agent_id, lr.quantity, lr.id, req.user.id]
    );
    const { rows: updated } = await client.query(
      `UPDATE load_requests SET status = 'released', released_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    await client.query('COMMIT');
    await notify(lr.agent_id, 'load_request', `Your load request #${lr.id} was released to your inventory`, 'load_request', lr.id);
    res.json(updated[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.patch('/:id/receive', async (req, res) => {
  const { rows: existing } = await pool.query('SELECT * FROM load_requests WHERE id = $1', [req.params.id]);
  const lr = existing[0];
  if (!lr) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'agent' && lr.agent_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  if (lr.status !== 'released') {
    return res.status(400).json({ error: `Request must be 'released' to confirm receipt (currently '${lr.status}')` });
  }
  const { rows } = await pool.query(
    `UPDATE load_requests SET status = 'received', received_at = now() WHERE id = $1 RETURNING *`,
    [req.params.id]
  );
  await notifyAdmins('load_request', `${req.user.name} confirmed receipt of load request #${lr.id}`, 'load_request', lr.id);
  res.json(rows[0]);
});

export default router;
