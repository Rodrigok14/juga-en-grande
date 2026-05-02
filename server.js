require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const { pool, moneyToCents, centsToAmount } = require("./lib/db");
const { createSession, readSession, requireAdmin, verifyAdmin } = require("./lib/auth");

const app = express();
const root = __dirname;
const isVercel = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
const uploadsDir = isVercel ? "/tmp" : path.join(root, "assets", "uploads");

try {
  fs.mkdirSync(uploadsDir, { recursive: true });
} catch (e) {}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => {
      const safe = file.originalname.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
      cb(null, `${Date.now()}-${safe}`);
    }
  }),
  limits: { fileSize: 4 * 1024 * 1024 }
});

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

function productRow(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    author: row.author,
    category: row.category,
    price: centsToAmount(row.price),
    oldPrice: row.old_price == null ? null : centsToAmount(row.old_price),
    format: row.format,
    stock: row.stock,
    cover: row.image,
    image: row.image,
    synopsis: row.description,
    description: row.description,
    active: Boolean(row.active)
  };
}

function comboRow(row, items = []) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    price: centsToAmount(row.price),
    description: row.description,
    image: row.image,
    active: Boolean(row.active),
    items
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, app: "juga-en-grande" });
});

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!verifyAdmin(username, password)) {
    return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
  }
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `jg_session=${encodeURIComponent(createSession(username))}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${secure}`);
  res.json({ ok: true, user: username });
});

app.post("/api/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", "jg_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  res.json({ ok: true });
});

app.get("/api/auth/me", (req, res) => {
  const session = readSession(req);
  res.json({ authenticated: Boolean(session), user: session?.username || null });
});

app.get("/api/products", async (req, res) => {
  try {
    const includeInactive = req.query.all === "1" && readSession(req);
    const { rows } = await pool.query(`SELECT * FROM products ${includeInactive ? "" : "WHERE active = 1"} ORDER BY id DESC`);
    res.json({ products: rows.map(productRow) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/products/:id", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM products WHERE id = $1", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Producto no encontrado" });
    res.json({ product: productRow(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/products", requireAdmin, upload.single("image"), async (req, res) => {
  try {
    const body = req.body;
    const image = req.file ? `assets/uploads/${req.file.filename}` : (body.image || "assets/images/book_business.png");
    const { rows } = await pool.query(`
      INSERT INTO products (slug, title, author, category, price, old_price, format, stock, image, description, active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id
    `, [
      body.slug,
      body.title,
      body.author || "",
      body.category || "negocios",
      moneyToCents(body.price),
      body.oldPrice ? moneyToCents(body.oldPrice) : null,
      body.format || "fisico",
      Number(body.stock || 0),
      image,
      body.description || "",
      body.active === "0" ? 0 : 1
    ]);
    res.status(201).json({ ok: true, id: rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/products/:id", requireAdmin, upload.single("image"), async (req, res) => {
  try {
    const { rows: existingRows } = await pool.query("SELECT * FROM products WHERE id = $1", [req.params.id]);
    if (existingRows.length === 0) return res.status(404).json({ error: "Producto no encontrado" });
    
    const body = req.body;
    const image = req.file ? `assets/uploads/${req.file.filename}` : (body.image || existingRows[0].image);
    
    await pool.query(`
      UPDATE products
      SET slug=$1, title=$2, author=$3, category=$4, price=$5, old_price=$6,
          format=$7, stock=$8, image=$9, description=$10, active=$11,
          updated_at=CURRENT_TIMESTAMP
      WHERE id=$12
    `, [
      body.slug,
      body.title,
      body.author || "",
      body.category || "negocios",
      moneyToCents(body.price),
      body.oldPrice ? moneyToCents(body.oldPrice) : null,
      body.format || "fisico",
      Number(body.stock || 0),
      image,
      body.description || "",
      body.active === "0" ? 0 : 1,
      req.params.id
    ]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/products/:id", requireAdmin, async (req, res) => {
  try {
    await pool.query("UPDATE products SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/combos", async (req, res) => {
  try {
    const includeInactive = req.query.all === "1" && readSession(req);
    const { rows } = await pool.query(`SELECT * FROM combos ${includeInactive ? "" : "WHERE active = 1"} ORDER BY id DESC`);
    
    const combosWithItems = await Promise.all(rows.map(async (row) => {
      const { rows: items } = await pool.query(`
        SELECT p.id, p.title, ci.qty
        FROM combo_items ci
        JOIN products p ON p.id = ci.product_id
        WHERE ci.combo_id = $1
        ORDER BY p.title
      `, [row.id]);
      return comboRow(row, items);
    }));
    
    res.json({ combos: combosWithItems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/combos", requireAdmin, upload.single("image"), async (req, res) => {
  try {
    const body = req.body;
    const image = req.file ? `assets/uploads/${req.file.filename}` : (body.image || "assets/images/book_business.png");
    
    const { rows } = await pool.query(`
      INSERT INTO combos (slug, title, price, description, image, active)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
    `, [body.slug, body.title, moneyToCents(body.price), body.description || "", image, body.active === "0" ? 0 : 1]);
    
    const comboId = rows[0].id;
    await saveComboItems(comboId, body.productIds);
    res.status(201).json({ ok: true, id: comboId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/combos/:id", requireAdmin, upload.single("image"), async (req, res) => {
  try {
    const { rows: existingRows } = await pool.query("SELECT * FROM combos WHERE id = $1", [req.params.id]);
    if (existingRows.length === 0) return res.status(404).json({ error: "Combo no encontrado" });
    
    const body = req.body;
    const image = req.file ? `assets/uploads/${req.file.filename}` : (body.image || existingRows[0].image);
    
    await pool.query(`
      UPDATE combos
      SET slug=$1, title=$2, price=$3, description=$4, image=$5, active=$6, updated_at=CURRENT_TIMESTAMP
      WHERE id=$7
    `, [body.slug, body.title, moneyToCents(body.price), body.description || "", image, body.active === "0" ? 0 : 1, req.params.id]);
    
    await saveComboItems(req.params.id, body.productIds);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function saveComboItems(comboId, productIds) {
  const ids = String(productIds || "").split(",").map(x => Number(x.trim())).filter(Boolean);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM combo_items WHERE combo_id = $1", [comboId]);
    for (const id of ids) {
      await client.query("INSERT INTO combo_items (combo_id, product_id, qty) VALUES ($1, $2, 1)", [comboId, id]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

app.get("/api/orders", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM orders ORDER BY id DESC LIMIT 100");
    res.json({ orders: rows.map(row => ({ ...row, total: centsToAmount(row.total), items: JSON.parse(row.items_json || "[]") })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/js/data.js", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM products WHERE active = 1 ORDER BY id ASC");
    const products = rows.map(row => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      author: row.author,
      category: row.category,
      price: centsToAmount(row.price),
      oldPrice: row.old_price == null ? null : centsToAmount(row.old_price),
      rating: 4.8,
      reviews: 1000 + row.id * 137,
      format: row.format === "fisico" ? "físico" : "digital",
      badge: row.old_price ? "sale" : null,
      cover: row.image,
      synopsis: row.description,
      stock: row.stock,
      pages: 240,
      language: "Español",
      featured: true,
      staffPick: row.id <= 3,
      staffNote: "Seleccionado para convertir lectura en acción.",
      tags: [row.category, row.title.toLowerCase()]
    }));

    const categories = [
      { id: "negocios", name: "Dinero", icon: "$", count: 756, color: "#00FF88" },
      { id: "desarrollo", name: "Mentalidad", icon: "M", count: 1102, color: "#D4AF37" },
      { id: "ventas", name: "Ventas", icon: "V", count: 420, color: "#58D7FF" },
      { id: "productividad", name: "Productividad", icon: "P", count: 534, color: "#FFFFFF" },
      { id: "noficcion", name: "Conocimiento", icon: "C", count: 980, color: "#00C853" }
    ];
    const reviews = [
      { name: "María González", rating: 5, date: "hace 2 días", text: "Compré libros de finanzas y cambié la forma en que organizo mi sueldo. Ahora tengo un plan.", book: "Padre Rico, Padre Pobre" },
      { name: "Carlos Rodríguez", rating: 5, date: "hace 5 días", text: "La selección no se siente como una librería común. Te empuja a leer con un objetivo claro.", book: "Atomic Habits" },
      { name: "Laura Martínez", rating: 5, date: "hace 1 semana", text: "El diseño y la curaduría hacen que sea fácil elegir qué leer según lo que querés lograr.", book: "Trabajo Profundo" }
    ];
    const posts = [
      { id: 1, slug: "libros-para-ganar-mas", title: "5 libros para pensar mejor el dinero", excerpt: "Una ruta de lectura para pasar de inspiración a decisiones financieras concretas.", category: "Dinero", emoji: "$", date: "28 Abr 2026", readTime: "6 min" },
      { id: 2, slug: "mentalidad-de-exito", title: "Cómo leer para cambiar tu mentalidad", excerpt: "No se trata de leer más, sino de leer con intención y ejecutar lo aprendido.", category: "Mentalidad", emoji: "M", date: "24 Abr 2026", readTime: "8 min" },
      { id: 3, slug: "productividad-lectora", title: "Convertí un libro en un plan de acción", excerpt: "Un sistema simple para transformar ideas en hábitos, decisiones y resultados.", category: "Productividad", emoji: "P", date: "20 Abr 2026", readTime: "5 min" }
    ];

    res.type("text/javascript; charset=utf-8").send(`
const BOOKS = ${JSON.stringify(products, null, 2)};
const CATEGORIES = ${JSON.stringify(categories, null, 2)};
const REVIEWS = ${JSON.stringify(reviews, null, 2)};
const BLOG_POSTS = ${JSON.stringify(posts, null, 2)};
function getBookById(id) { return BOOKS.find(b => b.id === id); }
function getBookBySlug(slug) { return BOOKS.find(b => b.slug === slug); }
function getBestSellers() { return BOOKS.filter(b => b.badge === "bestseller" || b.staffPick); }
function getNewReleases() { return BOOKS.slice(-6).reverse(); }
function getStaffPicks() { return BOOKS.filter(b => b.staffPick); }
function getFeatured() { return BOOKS.filter(b => b.featured); }
function getByCategory(cat) { return BOOKS.filter(b => b.category === cat); }
function getRelated(book, n = 4) { return BOOKS.filter(b => b.id !== book.id && b.category === book.category).slice(0, n); }
function searchBooks(q) {
  const query = q.toLowerCase();
  return BOOKS.filter(b =>
    b.title.toLowerCase().includes(query) ||
    b.author.toLowerCase().includes(query) ||
    b.category.toLowerCase().includes(query) ||
    b.tags.some(t => t.toLowerCase().includes(query))
  );
}
function starsHTML(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  let s = "★".repeat(full);
  if (half) s += "½";
  return s;
}
function formatPrice(p) { return "$" + parseFloat(p).toFixed(2); }
`);
  } catch (err) {
    res.status(500).send("Error generating data.js");
  }
});

app.post("/api/checkout/mercadopago", async (req, res) => {
  try {
    if (!process.env.MP_ACCESS_TOKEN) {
      return res.status(500).json({ error: "Falta configurar MP_ACCESS_TOKEN en .env" });
    }

    const cartItems = Array.isArray(req.body.items) ? req.body.items : [];
    const { rows: products } = await pool.query("SELECT * FROM products WHERE active = 1");
    const productMap = new Map(products.map(product => [product.id, product]));
    const productSlugMap = new Map(products.map(product => [product.slug, product]));

    const items = cartItems.map(item => {
      const product = productSlugMap.get(String(item.slug || "")) || productMap.get(Number(item.id));
      if (!product) return null;
      const qty = Math.max(1, Number(item.qty || 1));
      return {
        product,
        qty,
        mp: {
          id: String(product.id),
          title: product.title,
          description: product.description || product.title,
          quantity: qty,
          currency_id: "ARS",
          unit_price: centsToAmount(product.price)
        }
      };
    }).filter(Boolean);

    if (items.length === 0) return res.status(400).json({ error: "El carrito está vacío" });

    const subtotal = items.reduce((sum, item) => sum + item.product.price * item.qty, 0);
    const shipping = subtotal >= 250000 ? 0 : 499000;
    const total = subtotal + shipping;
    const buyer = req.body.buyer || {};

    const { rows: orderRows } = await pool.query(`
      INSERT INTO orders (status, buyer_name, buyer_email, buyer_phone, total, items_json)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
    `, [
      "pending",
      buyer.name || "",
      buyer.email || "",
      buyer.phone || "",
      total,
      JSON.stringify(items.map(item => ({
        id: item.product.id,
        title: item.product.title,
        qty: item.qty,
        unitPrice: centsToAmount(item.product.price)
      })))
    ]);

    const orderId = orderRows[0].id;

    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
    const preferenceBody = {
      items: [
        ...items.map(item => item.mp),
        ...(shipping > 0 ? [{
          id: "shipping",
          title: "Envío",
          quantity: 1,
          currency_id: "ARS",
          unit_price: centsToAmount(shipping)
        }] : [])
      ],
      external_reference: String(orderId),
      payer: {
        name: buyer.name || undefined,
        email: buyer.email || undefined,
        phone: buyer.phone ? { number: buyer.phone } : undefined
      },
      back_urls: {
        success: `${baseUrl}/checkout.html?payment=success`,
        pending: `${baseUrl}/checkout.html?payment=pending`,
        failure: `${baseUrl}/checkout.html?payment=failure`
      },
      auto_return: "approved",
      notification_url: `${baseUrl}/api/webhooks/mercadopago`
    };

    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    const preference = new Preference(client);
    const response = await preference.create({ body: preferenceBody });

    await pool.query("UPDATE orders SET mp_preference_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [response.id, orderId]);

    res.json({
      ok: true,
      orderId: orderId,
      preferenceId: response.id,
      initPoint: response.init_point,
      sandboxInitPoint: response.sandbox_init_point
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No se pudo crear el pago en Mercado Pago" });
  }
});

app.post("/api/webhooks/mercadopago", async (req, res) => {
  res.status(200).json({ received: true });
  try {
    const paymentId = req.body?.data?.id || req.query["data.id"];
    if (!paymentId || !process.env.MP_ACCESS_TOKEN) return;
    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    const payment = new Payment(client);
    const data = await payment.get({ id: paymentId });
    const orderId = data.external_reference;
    if (!orderId) return;
    await pool.query(`
      UPDATE orders
      SET status = $1, mp_payment_id = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [data.status || "unknown", String(paymentId), orderId]);
  } catch (error) {
    console.error("Mercado Pago webhook error", error);
  }
});

app.use(express.static(root));

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`Jugá en Grande escuchando en http://localhost:${port}`);
  });
}

module.exports = app;
