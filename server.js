require("dotenv").config();

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const { put } = require("@vercel/blob");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const { pool, moneyToCents, centsToAmount } = require("./lib/db");
const { createSession, readSession, requireAdmin, verifyAdmin, isProduction } = require("./lib/auth");

const app = express();
const root = __dirname;
const isVercel = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
const publicUploadsDir = isVercel ? "/tmp" : path.join(root, "assets", "uploads");
const privateDigitalDir = isVercel ? "/tmp" : path.join(root, "storage", "digital");
const DEFAULT_IMAGE = "/assets/images/book_placeholder.svg";

try {
  fs.mkdirSync(publicUploadsDir, { recursive: true });
  fs.mkdirSync(privateDigitalDir, { recursive: true });
} catch (e) {}

function safeUploadFilename(originalname = "image") {
  const safe = String(originalname).toLowerCase().replace(/[^a-z0-9.]+/g, "-");
  return `${Date.now()}-${safe || "image"}`;
}

const upload = multer({
  storage: isVercel ? multer.memoryStorage() : multer.diskStorage({
    destination: (_req, file, cb) => {
      cb(null, file.fieldname === "digitalFile" ? privateDigitalDir : publicUploadsDir);
    },
    filename: (_req, file, cb) => cb(null, safeUploadFilename(file.originalname))
  }),
  limits: { fileSize: 25 * 1024 * 1024 }
});

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

function normalizeImageUrl(value) {
  const v = String(value || "").trim();
  if (!v) return DEFAULT_IMAGE;
  if (/^https?:\/\//i.test(v) || v.startsWith("data:")) return v;
  return v.startsWith("/") ? v : `/${v}`;
}

function uploadedFile(req, fieldname) {
  if (Array.isArray(req.files?.[fieldname])) return req.files[fieldname][0] || null;
  return null;
}

function normalizeFormat(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "físico" || raw === "fisico" || raw === "physical") return "fisico";
  if (raw === "digital") return "digital";
  return raw || "fisico";
}

function makeAccessToken() {
  return crypto.randomBytes(24).toString("hex");
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeSearchText(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isTucumanShipping(city, country) {
  const normalizedCity = normalizeSearchText(city);
  const normalizedCountry = normalizeSearchText(country);
  if (normalizedCountry && normalizedCountry !== "ar" && normalizedCountry !== "argentina") {
    return false;
  }
  return normalizedCity.includes("tucuman");
}

function requestBaseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/+$/, "");
  const host = req.get("x-forwarded-host") || req.get("host");
  const forwardedProto = req.get("x-forwarded-proto");
  const proto = forwardedProto || (process.env.VERCEL ? "https" : req.protocol);
  return `${proto}://${host}`.replace(/\/+$/, "");
}

async function persistUploadedImage(file) {
  if (!file) return null;
  const contentType = file.mimetype || "application/octet-stream";
  if (!/^image\//i.test(contentType)) {
    throw new Error("El archivo subido debe ser una imagen");
  }

  // Vercel: persist to Blob and store public URL
  if (isVercel) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error("Falta configurar BLOB_READ_WRITE_TOKEN para guardar imágenes en Vercel Blob");
    }
    const filename = safeUploadFilename(file.originalname);
    const blob = await put(`covers/${filename}`, file.buffer, {
      access: "public",
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });
    return blob.url;
  }

  // Local: multer already wrote to disk
  return `/assets/uploads/${file.filename}`;
}

async function persistUploadedDigitalFile(file) {
  if (!file) return null;
  const contentType = file.mimetype || "application/octet-stream";
  const extension = path.extname(file.originalname || "").toLowerCase();
  const allowedExtensions = new Set([".pdf", ".zip"]);
  const looksLikePdf = contentType === "application/pdf";
  const looksLikeZip = contentType === "application/zip" || contentType === "application/x-zip-compressed";

  if (!allowedExtensions.has(extension) && !looksLikePdf && !looksLikeZip) {
    throw new Error("El archivo digital debe ser PDF o ZIP");
  }

  if (isVercel) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error("Falta configurar BLOB_READ_WRITE_TOKEN para guardar archivos digitales");
    }
    const filename = safeUploadFilename(file.originalname);
    const blob = await put(`digital-products/${filename}`, file.buffer, {
      access: "public",
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });
    return { url: blob.url, name: file.originalname || filename };
  }

  return {
    url: path.join(privateDigitalDir, file.filename),
    name: file.originalname || file.filename
  };
}

function productRow(row, options = {}) {
  const item = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    author: row.author,
    category: row.category,
    price: centsToAmount(row.price),
    oldPrice: row.old_price == null ? null : centsToAmount(row.old_price),
    format: row.format,
    stock: row.stock,
    displayOrder: Number(row.display_order || 0),
    cover: normalizeImageUrl(row.image),
    image: normalizeImageUrl(row.image),
    synopsis: row.description,
    description: row.description,
    hasDigitalFile: Boolean(row.digital_file_url),
    active: Boolean(row.active)
  };

  if (options.includePrivate) {
    item.digitalFileName = row.digital_file_name || "";
    item.digitalFileUrl = row.digital_file_url || "";
  }

  return item;
}

function comboRow(row, items = []) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    price: centsToAmount(row.price),
    description: row.description,
    image: normalizeImageUrl(row.image),
    active: Boolean(row.active),
    items
  };
}

function orderRow(row) {
  return {
    ...row,
    total: centsToAmount(row.total),
    items: JSON.parse(row.items_json || "[]")
  };
}

async function loadOrderWithToken(orderId, accessToken) {
  const { rows } = await pool.query(
    "SELECT * FROM orders WHERE id = $1 AND access_token = $2",
    [orderId, accessToken]
  );
  return rows[0] || null;
}

async function listDigitalOrderItems(order) {
  const items = JSON.parse(order.items_json || "[]");
  const digitalIds = items
    .filter(item => normalizeFormat(item.format) === "digital")
    .map(item => Number(item.id))
    .filter(Boolean);

  if (digitalIds.length === 0) return [];

  const { rows } = await pool.query(
    `SELECT id, title, digital_file_url, digital_file_name
     FROM products
     WHERE id = ANY($1::int[]) AND active = 1`,
    [digitalIds]
  );

  return rows
    .filter(row => row.digital_file_url)
    .map(row => ({
      id: row.id,
      title: row.title,
      fileName: row.digital_file_name || `${row.title}.pdf`,
      hasFile: Boolean(row.digital_file_url)
    }));
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, app: "juga-en-grande" });
});

app.post("/api/auth/login", (req, res) => {
  if (isProduction() && !process.env.SESSION_SECRET) {
    return res.status(500).json({ error: "Falta configurar SESSION_SECRET en Vercel (Environment Variables)." });
  }
  if (!process.env.ADMIN_USER || !process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ error: "Falta configurar ADMIN_USER y ADMIN_PASSWORD en Vercel (Environment Variables)." });
  }
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
    const adminSession = readSession(req);
    const includeInactive = req.query.all === "1" && adminSession;
    const { rows } = await pool.query(`
      SELECT * FROM products
      ${includeInactive ? "" : "WHERE active = 1"}
      ORDER BY display_order ASC, CASE WHEN format = 'digital' THEN 0 ELSE 1 END, id DESC
    `);
    res.json({ products: rows.map(row => productRow(row, { includePrivate: Boolean(adminSession) })) });
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

const productUpload = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "digitalFile", maxCount: 1 }
]);

app.post("/api/products", requireAdmin, productUpload, async (req, res) => {
  try {
    const body = req.body;
    const format = body.format || "fisico";
    const imageFile = uploadedFile(req, "image");
    const digitalFile = uploadedFile(req, "digitalFile");
    const uploaded = await persistUploadedImage(imageFile);
    const uploadedDigital = await persistUploadedDigitalFile(digitalFile);
    const image = uploaded || normalizeImageUrl(body.image) || DEFAULT_IMAGE;
    if (format === "digital" && !uploadedDigital) {
      return res.status(400).json({ error: "Los productos digitales deben incluir un PDF o ZIP" });
    }
    const digitalFileUrl = format === "digital" ? uploadedDigital?.url || null : null;
    const digitalFileName = format === "digital" ? uploadedDigital?.name || null : null;
    const { rows } = await pool.query(`
      INSERT INTO products (
        slug, title, author, category, price, old_price, format, stock, image, description,
        active, display_order, digital_file_url, digital_file_name
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id
    `, [
      body.slug,
      body.title,
      body.author || "",
      body.category || "negocios",
      moneyToCents(body.price),
      body.oldPrice ? moneyToCents(body.oldPrice) : null,
      format,
      Number(body.stock || 0),
      image,
      body.description || "",
      body.active === "0" ? 0 : 1,
      Number(body.displayOrder || 0),
      digitalFileUrl,
      digitalFileName
    ]);
    res.status(201).json({ ok: true, id: rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/products/:id", requireAdmin, productUpload, async (req, res) => {
  try {
    const { rows: existingRows } = await pool.query("SELECT * FROM products WHERE id = $1", [req.params.id]);
    if (existingRows.length === 0) return res.status(404).json({ error: "Producto no encontrado" });
    
    const body = req.body;
    const format = body.format || "fisico";
    const imageFile = uploadedFile(req, "image");
    const digitalFile = uploadedFile(req, "digitalFile");
    const uploaded = await persistUploadedImage(imageFile);
    const uploadedDigital = await persistUploadedDigitalFile(digitalFile);
    const image = uploaded || normalizeImageUrl(body.image || existingRows[0].image);
    const digitalFileUrl = format === "digital"
      ? (uploadedDigital?.url || existingRows[0].digital_file_url || null)
      : null;
    const digitalFileName = format === "digital"
      ? (uploadedDigital?.name || existingRows[0].digital_file_name || null)
      : null;

    if (format === "digital" && !digitalFileUrl) {
      return res.status(400).json({ error: "Los productos digitales deben incluir un PDF o ZIP" });
    }
    
    await pool.query(`
      UPDATE products
      SET slug=$1, title=$2, author=$3, category=$4, price=$5, old_price=$6,
          format=$7, stock=$8, image=$9, description=$10, active=$11,
          display_order=$12, digital_file_url=$13, digital_file_name=$14,
          updated_at=CURRENT_TIMESTAMP
      WHERE id=$15
    `, [
      body.slug,
      body.title,
      body.author || "",
      body.category || "negocios",
      moneyToCents(body.price),
      body.oldPrice ? moneyToCents(body.oldPrice) : null,
      format,
      Number(body.stock || 0),
      image,
      body.description || "",
      body.active === "0" ? 0 : 1,
      Number(body.displayOrder || 0),
      digitalFileUrl,
      digitalFileName,
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
    const uploaded = await persistUploadedImage(req.file);
    const image = uploaded || normalizeImageUrl(body.image) || DEFAULT_IMAGE;
    
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
    const uploaded = await persistUploadedImage(req.file);
    const image = uploaded || normalizeImageUrl(body.image || existingRows[0].image);
    
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

app.get("/api/orders/access/:id", async (req, res) => {
  try {
    const accessToken = String(req.query.token || "");
    if (!accessToken) return res.status(400).json({ error: "Falta token de acceso" });

    const order = await loadOrderWithToken(req.params.id, accessToken);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });

    const response = {
      id: order.id,
      status: order.status,
      deliveryType: order.delivery_type,
      buyerName: order.buyer_name || "",
      buyerEmail: order.buyer_email || ""
    };

    if (order.status === "approved" && order.delivery_type === "digital") {
      response.downloads = await listDigitalOrderItems(order);
    }

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/orders/access/:id/download/:productId", async (req, res) => {
  try {
    const accessToken = String(req.query.token || "");
    if (!accessToken) return res.status(400).json({ error: "Falta token de acceso" });

    const order = await loadOrderWithToken(req.params.id, accessToken);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
    if (order.status !== "approved") return res.status(403).json({ error: "El pago aun no fue aprobado" });
    if (order.delivery_type !== "digital") return res.status(400).json({ error: "Este pedido no tiene descargas digitales" });

    const items = JSON.parse(order.items_json || "[]");
    const orderedProduct = items.find(item => Number(item.id) === Number(req.params.productId) && normalizeFormat(item.format) === "digital");
    if (!orderedProduct) return res.status(404).json({ error: "Archivo no encontrado para este pedido" });

    const { rows } = await pool.query(
      "SELECT title, digital_file_url, digital_file_name FROM products WHERE id = $1",
      [req.params.productId]
    );
    const product = rows[0];
    if (!product?.digital_file_url) return res.status(404).json({ error: "El archivo digital no esta disponible" });

    const downloadName = product.digital_file_name || `${product.title}.pdf`;
    if (/^https?:\/\//i.test(product.digital_file_url)) {
      const remote = await fetch(product.digital_file_url);
      if (!remote.ok) throw new Error("No se pudo obtener el archivo digital");
      const contentType = remote.headers.get("content-type") || "application/octet-stream";
      const buffer = Buffer.from(await remote.arrayBuffer());
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(downloadName)}"`);
      return res.send(buffer);
    }

    const absolutePath = path.resolve(product.digital_file_url);
    if (!absolutePath.startsWith(path.resolve(privateDigitalDir))) {
      return res.status(403).json({ error: "Ruta de descarga invalida" });
    }
    return res.download(absolutePath, downloadName);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/orders", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM orders ORDER BY id DESC LIMIT 100");
    res.json({ orders: rows.map(orderRow) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/js/data.js", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM products
      WHERE active = 1
      ORDER BY display_order ASC, CASE WHEN format = 'digital' THEN 0 ELSE 1 END, id DESC
    `);
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
      cover: normalizeImageUrl(row.image),
      synopsis: row.description,
      stock: row.stock,
      displayOrder: Number(row.display_order || 0),
      hasDigitalFile: Boolean(row.digital_file_url),
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
    const buyer = req.body.buyer || {};
    const shippingInfo = req.body.shipping || {};
    const { rows: products } = await pool.query("SELECT * FROM products WHERE active = 1");
    const productMap = new Map(products.map(product => [product.id, product]));
    const productSlugMap = new Map(products.map(product => [product.slug, product]));

    const items = cartItems.map(item => {
      const product = productSlugMap.get(String(item.slug || "")) || productMap.get(Number(item.id));
      if (!product) return null;
      const qty = Math.max(1, Number(item.qty || 1));
      const format = normalizeFormat(product.format);
      return {
        product,
        qty,
        format,
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

    const deliveryTypes = [...new Set(items.map(item => item.format))];
    if (deliveryTypes.length !== 1) {
      return res.status(400).json({ error: "No se pueden mezclar productos digitales y fisicos en la misma compra" });
    }

    const deliveryType = deliveryTypes[0] === "digital" ? "digital" : "physical";
    const subtotal = items.reduce((sum, item) => sum + item.product.price * item.qty, 0);
    const shipping = deliveryType === "digital" ? 0 : (subtotal >= 250000 ? 0 : 499000);
    const total = subtotal + shipping;
    const accessToken = makeAccessToken();

    if (deliveryType === "physical" && !isTucumanShipping(shippingInfo.city, shippingInfo.country)) {
      return res.status(400).json({ error: "Los libros fisicos solo se envian dentro de Tucuman, Argentina" });
    }

    const { rows: orderRows } = await pool.query(`
      INSERT INTO orders (
        status, buyer_name, buyer_email, buyer_phone, total, items_json,
        delivery_type, access_token, shipping_address, shipping_city, shipping_zip, shipping_country
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id
    `, [
      "pending",
      normalizeText(buyer.name),
      normalizeText(buyer.email),
      normalizeText(buyer.phone),
      total,
      JSON.stringify(items.map(item => ({
        id: item.product.id,
        title: item.product.title,
        qty: item.qty,
        unitPrice: centsToAmount(item.product.price),
        format: item.format
      }))),
      deliveryType,
      accessToken,
      deliveryType === "physical" ? normalizeText(shippingInfo.address) : "",
      deliveryType === "physical" ? normalizeText(shippingInfo.city) : "",
      deliveryType === "physical" ? normalizeText(shippingInfo.zip) : "",
      deliveryType === "physical" ? normalizeText(shippingInfo.country || "AR") : ""
    ]);

    const orderId = orderRows[0].id;

    const baseUrl = requestBaseUrl(req);
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
        success: `${baseUrl}/checkout.html?payment=success&order_id=${orderId}&token=${accessToken}`,
        pending: `${baseUrl}/checkout.html?payment=pending&order_id=${orderId}&token=${accessToken}`,
        failure: `${baseUrl}/checkout.html?payment=failure&order_id=${orderId}&token=${accessToken}`
      },
      notification_url: `${baseUrl}/api/webhooks/mercadopago`
    };

    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    const preference = new Preference(client);
    const response = await preference.create({ body: preferenceBody });

    await pool.query("UPDATE orders SET mp_preference_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [response.id, orderId]);

    res.json({
      ok: true,
      orderId: orderId,
      accessToken,
      deliveryType,
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

// Local only: serve disk uploads
if (!isVercel) {
  app.use("/assets/uploads", express.static(publicUploadsDir));
}
app.use(express.static(root));

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`Jugá en Grande escuchando en http://localhost:${port}`);
  });
}

module.exports = app;
