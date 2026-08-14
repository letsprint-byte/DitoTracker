import bcrypt from 'bcryptjs';
import { pool } from './pool.js';
async function seed() {
  const passwordHash = await bcrypt.hash('password123', 10);
  await pool.query(`UPDATE users SET status = 'active' WHERE email IN ('admin@dito.local','agent1@dito.local','agent2@dito.local')`);
  const { rows: existingAdmin } = await pool.query('SELECT id FROM users WHERE email = $1', ['admin@dito.local']);
  let adminId, agentId, agent2Id;
  if (existingAdmin.length === 0) {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, phone) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      ['Admin Owner', 'admin@dito.local', passwordHash, 'admin', '09170000000']
    );
    adminId = rows[0].id;
  } else {
    adminId = existingAdmin[0].id;
  }
  const { rows: existingAgent } = await pool.query('SELECT id FROM users WHERE email = $1', ['agent1@dito.local']);
  if (existingAgent.length === 0) {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, phone) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      ['Juan Agent', 'agent1@dito.local', passwordHash, 'agent', '09171111111']
    );
    agentId = rows[0].id;
  } else {
    agentId = existingAgent[0].id;
  }
  const { rows: existingAgent2 } = await pool.query('SELECT id FROM users WHERE email = $1', ['agent2@dito.local']);
  if (existingAgent2.length === 0) {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, phone) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      ['Maria Agent', 'agent2@dito.local', passwordHash, 'agent', '09172222222']
    );
    agent2Id = rows[0].id;
  } else {
    agent2Id = existingAgent2[0].id;
  }
  const products = [
    ['DITO SIM Card', 'sim', 'SIM-001', 50, 20],
    ['DITO WiFi Device', 'wifi_device', 'WIFI-001', 1500, 5],
    ['DITO Load 300', 'load', 'LOAD-300', 300, 50],
    ['DITO Load 500', 'load', 'LOAD-500', 500, 50],
  ];
  for (const [name, type, sku, price, threshold] of products) {
    const { rows } = await pool.query('SELECT id FROM products WHERE sku = $1', [sku]);
    let productId;
    if (rows.length === 0) {
      const { rows: inserted } = await pool.query(
        `INSERT INTO products (name, type, sku, unit_price, low_stock_threshold) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [name, type, sku, price, threshold]
      );
      productId = inserted[0].id;
    } else {
      productId = rows[0].id;
    }
    await pool.query(
      `INSERT INTO inventory_main (product_id, quantity_on_hand) VALUES ($1, $2)
       ON CONFLICT (product_id) DO NOTHING`,
      [productId, 100]
    );
  }
  console.log('Seed complete.');
  console.log('Login with: admin@dito.local / agent1@dito.local / agent2@dito.local, password: password123');
  await pool.end();
}
seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
