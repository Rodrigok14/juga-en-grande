const { Pool } = require("pg");

function poolConfig() {
  const conn = process.env.DATABASE_URL || "";
  const isLocal =
    /localhost|127\.0\.0\.1/.test(conn) ||
    process.env.DATABASE_SSL === "false";

  let ssl;
  if (isLocal) {
    ssl = false;
  } else if (conn) {
    ssl = {
      rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== "false"
    };
  }

  return {
    connectionString: process.env.DATABASE_URL,
    ssl
  };
}

const pool = new Pool(poolConfig());

async function ensureSchema() {
  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0
  `);
  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS digital_file_url TEXT
  `);
  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS digital_file_name TEXT
  `);
  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS preview_file_url TEXT
  `);
  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS preview_file_name TEXT
  `);
  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS gallery_images TEXT
  `);
  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS digital_files_manifest TEXT
  `);
  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP
  `);
  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'product'
  `);
  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS source_ref_id INTEGER
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS combos (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      image TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      digital_file_url TEXT,
      digital_file_name TEXT,
      digital_files_manifest TEXT,
      linked_product_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS combo_items (
      combo_id INTEGER REFERENCES combos(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      qty INTEGER NOT NULL DEFAULT 1
    )
  `);
  await pool.query(`
    ALTER TABLE combos
    ADD COLUMN IF NOT EXISTS digital_file_url TEXT
  `);
  await pool.query(`
    ALTER TABLE combos
    ADD COLUMN IF NOT EXISTS digital_file_name TEXT
  `);
  await pool.query(`
    ALTER TABLE combos
    ADD COLUMN IF NOT EXISTS digital_files_manifest TEXT
  `);
  await pool.query(`
    ALTER TABLE combos
    ADD COLUMN IF NOT EXISTS linked_product_id INTEGER
  `);
  await pool.query(`
    ALTER TABLE combos
    ADD COLUMN IF NOT EXISTS pillar TEXT NOT NULL DEFAULT 'dinero'
  `);
  await pool.query(`
    ALTER TABLE combos
    ADD COLUMN IF NOT EXISTS featured INTEGER NOT NULL DEFAULT 1
  `);
  await pool.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS delivery_type TEXT NOT NULL DEFAULT 'physical'
  `);
  await pool.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS access_token TEXT
  `);
  await pool.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS shipping_address TEXT
  `);
  await pool.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS shipping_city TEXT
  `);
  await pool.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS shipping_zip TEXT
  `);
  await pool.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS shipping_country TEXT
  `);
  await pool.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'mercadopago'
  `);
  await pool.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_currency TEXT NOT NULL DEFAULT 'ARS'
  `);
  await pool.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC
  `);
  await pool.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS paypal_order_id TEXT
  `);
  await pool.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP
  `);
  await pool.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS email_error TEXT
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      phone TEXT,
      country TEXT,
      first_order_id INTEGER,
      last_order_id INTEGER,
      total_orders INTEGER NOT NULL DEFAULT 0,
      total_spent INTEGER NOT NULL DEFAULT 0,
      marketing_opt_in BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_purchases (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      order_id INTEGER,
      product_id INTEGER,
      product_title TEXT,
      product_format TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price INTEGER NOT NULL DEFAULT 0,
      payment_provider TEXT,
      purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS customer_purchases_order_product_idx
    ON customer_purchases(order_id, product_id)
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS book_requests (
      id SERIAL PRIMARY KEY,
      name TEXT,
      email TEXT,
      requested_title TEXT NOT NULL,
      requested_author TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

const seedProducts = [
  {
    slug: "padre-rico-padre-pobre",
    title: "Padre Rico, Padre Pobre",
    author: "Robert T. Kiyosaki",
    category: "negocios",
    price: 19990,
    old_price: 25990,
    format: "fisico",
    stock: 20,
    image: "/assets/images/book_placeholder.svg",
    description: "Lecciones para mirar activos, ingresos y libertad financiera de otra manera.",
    active: 1
  },
  {
    slug: "piense-y-hagase-rico",
    title: "Piense y Hagase Rico",
    author: "Napoleon Hill",
    category: "negocios",
    price: 16990,
    old_price: null,
    format: "fisico",
    stock: 15,
    image: "/assets/images/book_placeholder.svg",
    description: "Principios de ambicion, enfoque y riqueza para entrenar mentalidad de resultados.",
    active: 1
  },
  {
    slug: "atomic-habits",
    title: "Atomic Habits",
    author: "James Clear",
    category: "productividad",
    price: 21990,
    old_price: 29990,
    format: "fisico",
    stock: 12,
    image: "/assets/images/book_placeholder.svg",
    description: "Un sistema practico para construir habitos, eliminar friccion y sostener progreso.",
    active: 1
  },
  {
    slug: "deep-work",
    title: "Trabajo Profundo",
    author: "Cal Newport",
    category: "productividad",
    price: 20990,
    old_price: 26990,
    format: "digital",
    stock: 99,
    image: "/assets/images/book_placeholder.svg",
    description: "Reglas para concentrarte en tareas de alto valor en un mundo lleno de distracciones.",
    active: 1
  }
];

async function seed() {
  try {
    await ensureSchema();

    const { rows } = await pool.query("SELECT COUNT(*) AS total FROM products");
    if (parseInt(rows[0].total, 10) === 0) {
      for (const item of seedProducts) {
        await pool.query(`
          INSERT INTO products (slug, title, author, category, price, old_price, format, stock, image, description, active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [item.slug, item.title, item.author, item.category, item.price, item.old_price, item.format, item.stock, item.image, item.description, item.active]);
      }
    }

    const { rows: comboRows } = await pool.query("SELECT COUNT(*) AS total FROM combos");
    if (parseInt(comboRows[0].total, 10) === 0) {
      const { rows: insertedCombo } = await pool.query(`
        INSERT INTO combos (slug, title, price, description, image, active)
        VALUES ($1, $2, $3, $4, $5, 1) RETURNING id
      `, [
        "combo-mentalidad-dinero",
        "Combo Mentalidad + Dinero",
        32990,
        "Padre Rico, Padre Pobre + Piense y Hagase Rico para arrancar con mentalidad financiera.",
        "/assets/images/book_placeholder.svg"
      ]);

      const comboId = insertedCombo[0].id;

      const { rows: padre } = await pool.query("SELECT id FROM products WHERE slug = $1", ["padre-rico-padre-pobre"]);
      const { rows: piense } = await pool.query("SELECT id FROM products WHERE slug = $1", ["piense-y-hagase-rico"]);

      if (padre.length > 0 && piense.length > 0) {
        await pool.query("INSERT INTO combo_items (combo_id, product_id, qty) VALUES ($1, $2, 1)", [comboId, padre[0].id]);
        await pool.query("INSERT INTO combo_items (combo_id, product_id, qty) VALUES ($1, $2, 1)", [comboId, piense[0].id]);
      }
    }
  } catch (err) {
    console.error("Error seeding database:", err);
  }
}

seed();

function moneyToCents(value) {
  const normalized = String(value || "0").replace(",", ".").replace(/[^\d.]/g, "");
  return Math.round(Number(normalized || 0) * 100);
}

function centsToAmount(cents) {
  return Number((Number(cents || 0) / 100).toFixed(2));
}

module.exports = { pool, moneyToCents, centsToAmount };
