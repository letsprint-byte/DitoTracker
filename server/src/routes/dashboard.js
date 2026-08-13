import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/summary', async (req, res) => {
  const { date_from, date_to } = req.query;
  const from = date_from || new Date(new Date().setDate(1)).toISOString().slice(0, 10);
  const to = date_to || new Date().toISOString().slice(0, 10);

  if (req.user.role === 'admin') {
    const [salesRes, collectionsRes, outstandingRes, retailersRes, pendingLoadsRes, lowStockRes, perAgentRes] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(total_amount),0) AS total FROM sales WHERE sale_date BETWEEN $1 AND $2`, [from, to]),
      pool.query(`SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE payment_date BETWEEN $1 AND $2`, [from, to]),
      pool.query(`SELECT COALESCE(SUM(current_balance),0) AS total FROM retailers WHERE status = 'active'`),
      pool.query(`SELECT COUNT(*)::int AS count FROM retailers WHERE status = 'active'`),
      pool.query(`SELECT COUNT(*)::int AS count FROM load_requests WHERE status = 'pending'`),
      pool.query(`SELECT p.name, im.quantity_on_hand FROM inventory_main im JOIN products p ON p.id = im.product_id WHERE im.quantity_on_hand <= p.low_stock_threshold`),
      pool.query(
        `SELECT u.id, u.name,
                COALESCE((SELECT SUM(total_amount) FROM sales WHERE agent_id = u.id AND sale_date BETWEEN $1 AND $2), 0) AS sales_total,
                COALESCE((SELECT SUM(amount) FROM payments WHERE agent_id = u.id AND payment_date BETWEEN $1 AND $2), 0) AS collections_total,
                COALESCE((SELECT SUM(current_balance) FROM retailers WHERE agent_id = u.id), 0) AS outstanding,
                (SELECT COUNT(*) FROM retailers WHERE agent_id = u.id)::int AS retailer_count
         FROM users u WHERE u.role = 'agent' ORDER BY u.name`,
        [from, to]
      ),
    ]);
    return res.json({
      total_sales: Number(salesRes.rows[0].total),
      total_collections: Number(collectionsRes.rows[0].total),
      total_outstanding: Number(outstandingRes.rows[0].total),
      active_retailers: retailersRes.rows[0].count,
      pending_load_requests: pendingLoadsRes.rows[0].count,
      low_stock: lowStockRes.rows,
      per_agent: perAgentRes.rows,
      period: { from, to },
    });
  }

  const agentId = req.user.id;
  const [salesRes, collectionsRes, outstandingRes, retailersRes, remindersRes, loadStatusRes] = await Promise.all([
    pool.query(`SELECT COALESCE(SUM(total_amount),0) AS total FROM sales WHERE agent_id = $1 AND sale_date BETWEEN $2 AND $3`, [agentId, from, to]),
    pool.query(`SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE agent_id = $1 AND payment_date BETWEEN $2 AND $3`, [agentId, from, to]),
    pool.query(`SELECT COALESCE(SUM(current_balance),0) AS total FROM retailers WHERE agent_id = $1 AND status = 'active'`, [agentId]),
    pool.query(`SELECT COUNT(*)::int AS count FROM retailers WHERE agent_id = $1 AND status = 'active'`, [agentId]),
    pool.query(
      `SELECT rm.*, r.business_name AS retailer_name FROM reminders rm JOIN retailers r ON r.id = rm.retailer_id
       WHERE rm.agent_id = $1 AND rm.status = 'pending' ORDER BY rm.due_date ASC LIMIT 10`,
      [agentId]
    ),
    pool.query(
      `SELECT status, COUNT(*)::int AS count FROM load_requests WHERE agent_id = $1 GROUP BY status`,
      [agentId]
    ),
  ]);
  res.json({
    total_sales: Number(salesRes.rows[0].total),
    total_collections: Number(collectionsRes.rows[0].total),
    total_outstanding: Number(outstandingRes.rows[0].total),
    assigned_retailers: retailersRes.rows[0].count,
    upcoming_reminders: remindersRes.rows,
    load_request_status: loadStatusRes.rows,
    period: { from, to },
  });
});

export default router;
