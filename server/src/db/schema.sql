-- DITO Sales & Retailer Management System — schema

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'agent')),
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS retailers (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL REFERENCES users(id),
  business_name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  address TEXT,
  date_recruited DATE DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  expected_monthly_load_amount NUMERIC(12,2) DEFAULT 0,
  last_purchase_date DATE,
  current_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sim', 'wifi_device', 'load')),
  sku TEXT UNIQUE,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  description TEXT
);

CREATE TABLE IF NOT EXISTS inventory_main (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity_on_hand INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id)
);

CREATE TABLE IF NOT EXISTS inventory_agent (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL REFERENCES users(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity_on_hand INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_id, product_id)
);

CREATE TABLE IF NOT EXISTS load_requests (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL REFERENCES users(id),
  requested_amount NUMERIC(12,2) NOT NULL,
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'released', 'received', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by INTEGER REFERENCES users(id),
  released_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS stock_transfers (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  from_type TEXT NOT NULL CHECK (from_type IN ('main', 'agent')),
  from_id INTEGER NOT NULL,
  to_type TEXT NOT NULL CHECK (to_type IN ('agent', 'retailer')),
  to_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  related_load_request_id INTEGER REFERENCES load_requests(id),
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL REFERENCES users(id),
  retailer_id INTEGER NOT NULL REFERENCES retailers(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER REFERENCES sales(id),
  retailer_id INTEGER NOT NULL REFERENCES retailers(id),
  agent_id INTEGER NOT NULL REFERENCES users(id),
  amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'gcash', 'bank_transfer', 'other')),
  proof_image_url TEXT,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reminders (
  id SERIAL PRIMARY KEY,
  retailer_id INTEGER NOT NULL REFERENCES retailers(id),
  agent_id INTEGER NOT NULL REFERENCES users(id),
  due_date DATE NOT NULL,
  reminder_type TEXT NOT NULL DEFAULT 'monthly_load',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'snoozed', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('load_request', 'payment', 'overdue', 'inventory_low', 'reminder')),
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  related_entity_type TEXT,
  related_entity_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retailers_agent ON retailers(agent_id);
CREATE INDEX IF NOT EXISTS idx_sales_agent ON sales(agent_id);
CREATE INDEX IF NOT EXISTS idx_sales_retailer ON sales(retailer_id);
CREATE INDEX IF NOT EXISTS idx_payments_retailer ON payments(retailer_id);
CREATE INDEX IF NOT EXISTS idx_load_requests_agent ON load_requests(agent_id);
CREATE INDEX IF NOT EXISTS idx_reminders_agent ON reminders(agent_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
