import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { toCsv } from '../utils/csv.js';

const router = Router();
router.use(requireAuth);

function agentScope(req, values, i, column = 'agent_id') {
  if (req.user.role === 'agent') {
    values.push(req.user.id);
    return { clause: ` AND ${column} = $${i}`, nextI: i + 1 };
  }
  if (req.query.agent_id) {
    values.push(req.query.agent_id);
    return { clause: ` AND ${column} = $${i}`, nextI: i + 1 };
  }
  return { clause: '', nextI: i };
}

async function salesReport(req) {
  const values = [];
  let i = 1;
  let where = 'WHERE 1=1';
  const scope = agentScope(req, values, i, 's.agent_id');
  where += scope.clause; i = scope.nextI;
  if (req.query.date_from) { where += ` AND s.sale_date >= $${i++}`; values.push(req.query.date_from); }
  if (req.query.date_to) { where += ` AND s.sale_date <= $${i++}`; values.push(req.query.date_to); }
  if (req.query.product_type) { where += ` AND p.type = $${i++}`; values.push(req.query.product_type); }
  const { rows } = await pool.query(
    `SELECT s.id, to_char(s.sale_date, 'YYYY-MM-DD') AS sale_date, u.name AS agent, r.business_name AS retailer, p.name AS product,
            s.quantity, s.unit_price, s.total_amount, s.payment_status
     FROM sales s JOIN users u ON u.id = s.agent_id JOIN retailers r ON r.id = s.retailer_id JOIN products p ON p.id = s.product_id
     ${where} ORDER BY s.sale_date DESC`,
    values
  );
  return rows;
}

async function collectionsReport(req) {
  const values = [];
  let i = 1;
  let where = 'WHERE 1=1';
  const scope = agentScope(req, values, i, 'p.agent_id');
  where += scope.clause; i = scope.nextI;
  if (req.query.date_from) { where += ` AND p.payment_date >= $${i++}`; values.push(req.query.date_from); }
  if (req.query.date_to) { where += ` AND p.payment_date <= $${i++}`; values.push(req.query.date_to); }
  if (req.query.method) { where += ` AND p.payment_method = $${i++}`; values.push(req.query.method); }
  const { rows } = await pool.query(
    `SELECT p.id, to_char(p.payment_date, 'YYYY-MM-DD') AS payment_date, u.name AS agent, r.business_name AS retailer, p.amount, p.payment_method, p.notes
     FROM payments p JOIN users u ON u.id = p.agent_id JOIN retailers r ON r.id = p.retailer_id
     ${where} ORDER BY p.payment_date DESC`,
    values
  );
  return rows;
}

async function retailersReport(req) {
  const values = [];
  let i = 1;
  let where = 'WHERE 1=1';
  const scope = agentScope(req, values, i, 'r.agent_id');
  where += scope.clause; i = scope.nextI;
  if (req.query.status) { where += ` AND r.status = $${i++}`; values.push(req.query.status); }
  const { rows } = await pool.query(
    `SELECT r.id, r.business_name, u.name AS agent, r.status, r.current_balance,
            to_char(r.last_purchase_date, 'YYYY-MM-DD') AS last_purchase_date,
            r.expected_monthly_load_amount, to_char(r.date_recruited, 'YYYY-MM-DD') AS date_recruited
     FROM retailers r JOIN users u ON u.id = r.agent_id
     ${where} ORDER BY r.business_name`,
    values
  );
  return rows;
}

async function inventoryReport(req) {
  const { rows: main } = await pool.query(
    `SELECT p.name AS product, im.quantity_on_hand, 'main' AS location
     FROM inventory_main im JOIN products p ON p.id = im.product_id`
  );
  const { rows: agent } = await pool.query(
    `SELECT p.name AS product, ia.quantity_on_hand, u.name AS location
     FROM inventory_agent ia JOIN products p ON p.id = ia.product_id JOIN users u ON u.id = ia.agent_id`
  );
  return [...main, ...agent];
}

async function agentPerformanceReport(req) {
  const values = [];
  let i = 1;
  let where = '';
  if (req.query.date_from) { where += ` AND s.sale_date >= $${i++}`; values.push(req.query.date_from); }
  if (req.query.date_to) { where += ` AND s.sale_date <= $${i++}`; values.push(req.query.date_to); }
  const { rows } = await pool.query(
    `SELECT u.name AS agent,
            COALESCE((SELECT SUM(total_amount) FROM sales s WHERE s.agent_id = u.id ${where.replace(/s\./g, 's.')}), 0) AS total_sales,
            COALESCE((SELECT SUM(amount) FROM payments p WHERE p.agent_id = u.id), 0) AS total_collections,
            COALESCE((SELECT SUM(current_balance) FROM retailers r WHERE r.agent_id = u.id), 0) AS outstanding,
            (SELECT COUNT(*) FROM retailers r WHERE r.agent_id = u.id)::int AS retailers_recruited
     FROM users u WHERE u.role = 'agent' ORDER BY u.name`,
    values
  );
  return rows;
}

const REPORTS = {
  sales: salesReport,
  collections: collectionsReport,
  retailers: retailersReport,
  inventory: inventoryReport,
  'agent-performance': agentPerformanceReport,
};

router.get('/:type', async (req, res) => {
  const fn = REPORTS[req.params.type];
  if (!fn) return res.status(404).json({ error: 'Unknown report type' });
  const rows = await fn(req);
  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.type}-report.csv"`);
    return res.send(toCsv(rows));
  }
  res.json(rows);
});

export default router;
