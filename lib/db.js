const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

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
    image: "assets/images/book_business.png",
    description: "Lecciones para mirar activos, ingresos y libertad financiera de otra manera.",
    active: 1
  },
  {
    slug: "piense-y-hagase-rico",
    title: "Piense y Hágase Rico",
    author: "Napoleon Hill",
    category: "negocios",
    price: 16990,
    old_price: null,
    format: "fisico",
    stock: 15,
    image: "assets/images/book_business.png",
    description: "Principios de ambición, enfoque y riqueza para entrenar mentalidad de resultados.",
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
    image: "assets/images/book_personal_dev.png",
    description: "Un sistema práctico para construir hábitos, eliminar fricción y sostener progreso.",
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
    image: "assets/images/book_personal_dev.png",
    description: "Reglas para concentrarte en tareas de alto valor en un mundo lleno de distracciones.",
    active: 1
  }
];

async function seed() {
  try {
    const { rows } = await pool.query("SELECT COUNT(*) AS total FROM products");
    if (parseInt(rows[0].total) === 0) {
      for (const item of seedProducts) {
        await pool.query(`
          INSERT INTO products (slug, title, author, category, price, old_price, format, stock, image, description, active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [item.slug, item.title, item.author, item.category, item.price, item.old_price, item.format, item.stock, item.image, item.description, item.active]);
      }
    }

    const { rows: comboRows } = await pool.query("SELECT COUNT(*) AS total FROM combos");
    if (parseInt(comboRows[0].total) === 0) {
      const { rows: insertedCombo } = await pool.query(`
        INSERT INTO combos (slug, title, price, description, image, active)
        VALUES ($1, $2, $3, $4, $5, 1) RETURNING id
      `, [
        "combo-mentalidad-dinero",
        "Combo Mentalidad + Dinero",
        32990,
        "Padre Rico, Padre Pobre + Piense y Hágase Rico para arrancar con mentalidad financiera.",
        "assets/images/book_business.png"
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

// Auto seed on startup
seed();

function moneyToCents(value) {
  const normalized = String(value || "0").replace(",", ".").replace(/[^\d.]/g, "");
  return Math.round(Number(normalized || 0) * 100);
}

function centsToAmount(cents) {
  return Number((Number(cents || 0) / 100).toFixed(2));
}

module.exports = { pool, moneyToCents, centsToAmount };
