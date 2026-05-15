require("dotenv").config();

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const nodemailer = require("nodemailer");
const AdmZip = require("adm-zip");
const { PDFDocument } = require("pdf-lib");
const { put } = require("@vercel/blob");
const { handleUpload } = require("@vercel/blob/client");
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

function sendNoStoreFile(res, filePath, contentType) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (contentType) res.setHeader("Content-Type", contentType);
  return res.sendFile(path.join(root, filePath));
}

const upload = multer({
  storage: isVercel ? multer.memoryStorage() : multer.diskStorage({
    destination: (_req, file, cb) => {
      cb(null, file.fieldname === "digitalFile" || file.fieldname === "digitalFiles" ? privateDigitalDir : publicUploadsDir);
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

function uploadedFiles(req, fieldname) {
  if (Array.isArray(req.files?.[fieldname])) return req.files[fieldname];
  return [];
}

function normalizeDigitalUploadFiles(singleFile, multipleFiles = []) {
  const files = [...multipleFiles];
  if (singleFile) files.unshift(singleFile);
  return files.filter(Boolean);
}

function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function parseJsonObject(value) {
  if (!value) return null;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch (_error) {
    return null;
  }
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

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeText(value));
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

const exchangeRateCache = { value: 0, fetchedAt: 0 };

async function getUsdArsRate() {
  const fallback = Number(process.env.USD_ARS_RATE || 0);
  const now = Date.now();
  if (exchangeRateCache.value && now - exchangeRateCache.fetchedAt < 60 * 60 * 1000) {
    return exchangeRateCache.value;
  }

  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!response.ok) throw new Error("No se pudo obtener la cotizacion USD/ARS");
    const data = await response.json();
    const rate = Number(data?.rates?.ARS || 0);
    if (!rate) throw new Error("Cotizacion USD/ARS invalida");
    exchangeRateCache.value = rate;
    exchangeRateCache.fetchedAt = now;
    return rate;
  } catch (error) {
    if (fallback > 0) return fallback;
    throw error;
  }
}

function paypalBaseUrl() {
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function paypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

async function paypalAccessToken() {
  if (!paypalConfigured()) {
    throw new Error("Faltan PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET");
  }

  const credentials = Buffer
    .from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`)
    .toString("base64");

  const response = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error_description || data?.message || "No se pudo autenticar con PayPal");
  }
  return data.access_token;
}

async function paypalRequest(pathname, options = {}) {
  const token = await paypalAccessToken();
  const response = await fetch(`${paypalBaseUrl()}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || data?.details?.[0]?.description || "PayPal rechazo la operacion");
  }
  return data;
}

async function fetchMercadoPagoPayment(paymentId) {
  if (!paymentId || !process.env.MP_ACCESS_TOKEN) return null;
  const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
  const payment = new Payment(client);
  return payment.get({ id: paymentId });
}

async function searchMercadoPagoPaymentByOrder(orderId) {
  if (!orderId || !process.env.MP_ACCESS_TOKEN) return null;
  const response = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(orderId)}&sort=date_created&criteria=desc`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.error || "No se pudo consultar Mercado Pago");
  }
  return (data.results || [])[0] || null;
}

async function applyMercadoPagoPayment(data, baseUrl) {
  if (!data?.external_reference) return null;
  const orderId = data.external_reference;
  await pool.query(`
    UPDATE orders
    SET status = $1, mp_payment_id = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
  `, [data.status || "unknown", String(data.id || ""), orderId]);
  if (data.status === "approved") {
    await fulfillApprovedOrder(orderId, baseUrl);
  }
  return orderId;
}

async function reconcileMercadoPagoOrder(order, baseUrl) {
  if (!order || order.status === "approved" || order.payment_provider !== "mercadopago") return order;
  const payment = await searchMercadoPagoPaymentByOrder(order.id);
  if (!payment) return order;
  await applyMercadoPagoPayment(payment, baseUrl);
  const { rows } = await pool.query("SELECT * FROM orders WHERE id = $1", [order.id]);
  return rows[0] || order;
}

function amountToUsd(arsCents, usdArsRate) {
  return (Number(arsCents || 0) / 100 / usdArsRate).toFixed(2);
}

function emailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function mailTransporter() {
  if (!emailConfigured()) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || "true") !== "false",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function emailFrom() {
  return process.env.EMAIL_FROM || `"Juga en Grande" <${process.env.SMTP_USER || "no-reply@juga-en-grande.vercel.app"}>`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

async function recordApprovedCustomer(order) {
  const email = normalizeEmail(order.buyer_email);
  if (!isValidEmail(email)) return null;

  const { rows: existingPurchases } = await pool.query(
    "SELECT id FROM customer_purchases WHERE order_id = $1 LIMIT 1",
    [order.id]
  );
  if (existingPurchases.length > 0) return null;

  const items = JSON.parse(order.items_json || "[]");
  const country = normalizeText(order.shipping_country || "");
  const { rows } = await pool.query(`
    INSERT INTO customers (
      email, name, phone, country, first_order_id, last_order_id, total_orders, total_spent
    )
    VALUES ($1, $2, $3, $4, $5, $5, 1, $6)
    ON CONFLICT (email) DO UPDATE SET
      name = COALESCE(NULLIF(EXCLUDED.name, ''), customers.name),
      phone = COALESCE(NULLIF(EXCLUDED.phone, ''), customers.phone),
      country = COALESCE(NULLIF(EXCLUDED.country, ''), customers.country),
      last_order_id = EXCLUDED.last_order_id,
      total_orders = customers.total_orders + 1,
      total_spent = customers.total_spent + EXCLUDED.total_spent,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id
  `, [
    email,
    normalizeText(order.buyer_name),
    normalizeText(order.buyer_phone),
    country,
    order.id,
    Number(order.total || 0)
  ]);

  const customerId = rows[0]?.id;
  if (!customerId) return null;

  for (const item of items) {
    await pool.query(`
      INSERT INTO customer_purchases (
        customer_id, order_id, product_id, product_title, product_format, quantity, unit_price, payment_provider
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (order_id, product_id) DO NOTHING
    `, [
      customerId,
      order.id,
      Number(item.id || 0) || null,
      normalizeText(item.title),
      normalizeFormat(item.format),
      Math.max(1, Number(item.qty || 1)),
      moneyToCents(item.unitPrice || 0),
      normalizeText(order.payment_provider || "")
    ]);
  }

  return customerId;
}

async function sendOrderEmail(order, baseUrl) {
  if (!emailConfigured()) {
    await pool.query(
      "UPDATE orders SET email_error = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      ["Email SMTP no configurado", order.id]
    );
    return false;
  }

  const email = normalizeEmail(order.buyer_email);
  if (!isValidEmail(email)) return false;

  const downloads = order.delivery_type === "digital" ? await listDigitalOrderItems(order) : [];
  const attachments = order.delivery_type === "digital" ? await loadDigitalEmailAttachments(order) : [];
  const downloadHtml = downloads.length
    ? downloads.map(item => {
        const href = `${baseUrl}/api/orders/access/${order.id}/download/${item.id}?token=${encodeURIComponent(order.access_token)}`;
        return `<p><a href="${href}" style="display:inline-block;padding:12px 16px;background:#00ff88;color:#06100b;text-decoration:none;font-weight:800;border-radius:8px">Descargar ${escapeHtml(item.title)}</a></p>`;
      }).join("")
    : "";

  const statusHref = `${baseUrl}/checkout.html?payment=success&order_id=${order.id}&token=${encodeURIComponent(order.access_token)}`;
  const isDigital = order.delivery_type === "digital";
  const subject = isDigital
    ? `Tus descargas de Juga en Grande - Pedido #${order.id}`
    : `Pedido confirmado Juga en Grande #${order.id}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;background:#0b0b0b;color:#f4fff9;padding:28px;border-radius:12px">
      <h1 style="margin:0 0 12px;color:#00ff88">Juga en Grande</h1>
      <p style="font-size:16px;line-height:1.6">Hola ${escapeHtml(order.buyer_name || "lector")}, tu pago fue aprobado.</p>
      ${isDigital
        ? `<p style="font-size:16px;line-height:1.6">Tus archivos digitales ya estan habilitados. Tambien podes volver a la pagina de confirmacion cuando quieras.</p>
           ${attachments.length ? `<p style="font-size:15px;line-height:1.6;color:#a7b8af">Adjuntamos el archivo en este email. Si tu correo bloquea el adjunto, usa los botones de descarga.</p>` : ""}
           ${downloadHtml}`
        : `<p style="font-size:16px;line-height:1.6">Coordinaremos la entrega fisica dentro de San Miguel de Tucuman con los datos del pedido.</p>`
      }
      <p><a href="${statusHref}" style="color:#00ff88">Ver estado del pedido</a></p>
      <hr style="border:0;border-top:1px solid rgba(255,255,255,.15);margin:24px 0" />
      <p style="color:#a7b8af;font-size:13px">Guarda este email. Si necesitas soporte, responde este mensaje.</p>
    </div>
  `;

  const transporter = mailTransporter();
  await transporter.sendMail({
    from: emailFrom(),
    to: email,
    replyTo: process.env.EMAIL_REPLY_TO || process.env.SMTP_USER,
    subject,
    html,
    attachments
  });

  await pool.query(
    "UPDATE orders SET email_sent_at = CURRENT_TIMESTAMP, email_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
    [order.id]
  );
  return true;
}

async function fulfillApprovedOrder(orderId, baseUrl) {
  const { rows } = await pool.query("SELECT * FROM orders WHERE id = $1", [orderId]);
  const order = rows[0];
  if (!order || order.status !== "approved") return;

  await recordApprovedCustomer(order);
  if (!order.email_sent_at) {
    try {
      await sendOrderEmail(order, baseUrl);
    } catch (error) {
      console.error("Order email error", error);
      await pool.query(
        "UPDATE orders SET email_error = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [String(error.message || error).slice(0, 500), order.id]
      );
    }
  }
}

async function backfillMissingPreviews() {
  try {
    const { rows } = await pool.query(`
      SELECT id, digital_file_url, digital_file_name, preview_file_url
      FROM products
      WHERE format = 'digital'
        AND digital_file_url IS NOT NULL
    `);

    for (const row of rows) {
      if (!previewNeedsRegeneration(row.preview_file_url)) continue;
      const preview = await buildPdfPreviewFromStoredFile(row.digital_file_url, row.digital_file_name);
      if (!preview) continue;
      await pool.query(
        `UPDATE products
         SET preview_file_url = $1, preview_file_name = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [preview.url, preview.name, row.id]
      );
    }
  } catch (error) {
    console.error("Preview backfill error", error);
  }
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

async function persistUploadedImages(files = []) {
  const uploaded = [];
  for (const file of files) {
    const imageUrl = await persistUploadedImage(file);
    if (imageUrl) uploaded.push(imageUrl);
  }
  return uploaded;
}

function normalizeClientBlob(blob) {
  if (!blob || typeof blob !== "object") return null;
  const url = String(blob.url || blob.downloadUrl || "").trim();
  if (!/^https?:\/\//i.test(url)) return null;
  return {
    url,
    name: String(blob.pathname || blob.name || url.split("/").pop() || "archivo").split("/").pop(),
    contentType: String(blob.contentType || blob.type || "")
  };
}

function clientBlobFromBody(body, fieldname) {
  return normalizeClientBlob(parseJsonObject(body?.[fieldname]));
}

function clientBlobsFromBody(body, fieldname) {
  return parseJsonArray(body?.[fieldname]).map(normalizeClientBlob).filter(Boolean);
}

function digitalManifestAssets(value) {
  return parseJsonArray(value)
    .map(item => {
      if (typeof item === "string") return { name: item };
      if (!item || typeof item !== "object") return null;
      const url = String(item.url || "").trim();
      const name = String(item.name || item.pathname || url.split("/").pop() || "archivo.pdf");
      return { name, url, contentType: String(item.contentType || "") };
    })
    .filter(Boolean);
}

function digitalManifestNames(value) {
  return digitalManifestAssets(value).map(item => item.name).filter(Boolean);
}

function digitalDownloadAssets(row) {
  const assets = digitalManifestAssets(row.digital_files_manifest).filter(item => /^https?:\/\//i.test(item.url || ""));
  if (assets.length) return assets;
  if (!row.digital_file_url) return [];
  return [{
    name: row.digital_file_name || `${row.title || "archivo"}.pdf`,
    url: row.digital_file_url
  }];
}

function digitalAssetId(productId, index) {
  return index == null ? String(productId) : `${productId}:${index}`;
}

async function persistBinaryFile({ folder, filename, buffer, contentType }) {
  const safeName = safeUploadFilename(filename);

  if (isVercel) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error("Falta configurar BLOB_READ_WRITE_TOKEN para guardar archivos");
    }
    const blob = await put(`${folder}/${safeName}`, buffer, {
      access: "public",
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });
    return blob.url;
  }

  const absolutePath = path.join(privateDigitalDir, safeName);
  await fs.promises.writeFile(absolutePath, buffer);
  return absolutePath;
}

function digitalFileType(file) {
  const contentType = file?.mimetype || "application/octet-stream";
  const extension = path.extname(file?.originalname || file?.filename || "").toLowerCase();
  const isPdf = contentType === "application/pdf" || extension === ".pdf";
  const isZip = contentType === "application/zip" || contentType === "application/x-zip-compressed" || extension === ".zip";
  return { extension, isPdf, isZip };
}

function uniqueZipEntryName(zip, entryName) {
  const normalizedName = String(entryName || "archivo.pdf").replace(/\\/g, "/").split("/").filter(Boolean).join("/");
  if (!zip.getEntry(normalizedName)) return normalizedName;

  const parsed = path.posix.parse(normalizedName);
  let counter = 2;
  while (true) {
    const candidate = `${parsed.dir ? `${parsed.dir}/` : ""}${parsed.name}-${counter}${parsed.ext}`;
    if (!zip.getEntry(candidate)) return candidate;
    counter += 1;
  }
}

function safeZipPart(value, fallback = "archivo") {
  const cleaned = String(value || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

async function loadStoredDigitalEntries(fileUrl, fileName) {
  if (!fileUrl) return [];

  const buffer = await digitalBufferFromStoredUrl(fileUrl);
  const extension = path.extname(fileName || fileUrl || "").toLowerCase();

  if (extension === ".zip") {
    const zip = new AdmZip(buffer);
    return zip
      .getEntries()
      .filter(entry => !entry.isDirectory)
      .map(entry => ({
        name: entry.entryName.split("/").pop() || entry.entryName,
        buffer: entry.getData()
      }));
  }

  if (extension === ".pdf") {
    return [{
      name: fileName || path.basename(fileUrl) || "archivo-digital.pdf",
      buffer
    }];
  }

  return [];
}

async function persistClientUploadedDigitalFiles(blobFiles = [], options = {}) {
  const normalizedFiles = blobFiles.map(normalizeClientBlob).filter(Boolean);
  if (normalizedFiles.length === 0) return null;

  const pdfFiles = [];
  let zipFile = null;

  for (const file of normalizedFiles) {
    const extension = path.extname(file.name || file.url || "").toLowerCase();
    const isPdf = file.contentType === "application/pdf" || extension === ".pdf";
    const isZip = file.contentType === "application/zip" || file.contentType === "application/x-zip-compressed" || extension === ".zip";

    if (isPdf) {
      pdfFiles.push(file);
      continue;
    }

    if (isZip) {
      if (normalizedFiles.length > 1) {
        throw new Error("Sube un ZIP o varios PDF, pero no mezcles ambos formatos");
      }
      zipFile = file;
      continue;
    }

    throw new Error("El archivo digital debe ser PDF o ZIP");
  }

  if (zipFile) {
    const manifest = await loadStoredDigitalEntries(zipFile.url, zipFile.name)
      .then(entries => entries.map(entry => entry.name))
      .catch(() => [zipFile.name || "archivo-digital.zip"]);
    return {
      url: zipFile.url,
      name: zipFile.name || "archivo-digital.zip",
      manifest,
      previewUrl: null,
      previewName: null
    };
  }

  const shouldMergeWithExisting = Boolean(options.existingUrl) && pdfFiles.length > 0;

  if (pdfFiles.length > 1 || shouldMergeWithExisting) {
    const existingAssets = digitalManifestAssets(options.existingManifest).filter(item => item.url);
    if (shouldMergeWithExisting && existingAssets.length === 0 && options.existingUrl) {
      existingAssets.push({
        name: options.existingName || "archivo-digital.pdf",
        url: options.existingUrl
      });
    }
    const assets = [
      ...existingAssets,
      ...pdfFiles.map(file => ({
        name: file.name || "archivo.pdf",
        url: file.url,
        contentType: file.contentType || "application/pdf"
      }))
    ];

    return {
      url: assets[0]?.url || null,
      name: assets.length === 1 ? assets[0].name : `${assets.length} archivos digitales`,
      manifest: assets,
      previewUrl: null,
      previewName: null
    };
  }

  if (pdfFiles.length === 1 && !shouldMergeWithExisting) {
    const pdfFile = pdfFiles[0];
    return {
      url: pdfFile.url,
      name: pdfFile.name || "archivo-digital.pdf",
      manifest: [{
        name: pdfFile.name || "archivo-digital.pdf",
        url: pdfFile.url,
        contentType: pdfFile.contentType || "application/pdf"
      }],
      previewUrl: null,
      previewName: null
    };
  }

  return null;
}

async function buildComboDigitalPack(combo, products) {
  const zip = new AdmZip();
  const manifest = [];

  for (const product of products) {
    if (normalizeFormat(product.format) !== "digital" || !product.digital_file_url) continue;

    const productFolder = safeZipPart(product.title, `libro-${product.id}`);
    const entries = await loadStoredDigitalEntries(product.digital_file_url, product.digital_file_name);
    for (const entry of entries) {
      const entryName = uniqueZipEntryName(zip, `${productFolder}/${safeZipPart(entry.name, "archivo.pdf")}`);
      zip.addFile(entryName, entry.buffer);
      manifest.push(entryName);
    }
  }

  if (manifest.length === 0) return null;

  const zipName = `${safeZipPart(combo.slug || combo.title, `combo-${combo.id}`)}.zip`;
  const storedUrl = await persistBinaryFile({
    folder: "digital-combos",
    filename: zipName,
    buffer: zip.toBuffer(),
    contentType: "application/zip"
  });

  return {
    url: storedUrl,
    name: zipName,
    manifest
  };
}

async function persistUploadedDigitalFile(singleFile, multipleFiles = [], options = {}) {
  const normalizedFiles = normalizeDigitalUploadFiles(singleFile, multipleFiles);
  if (normalizedFiles.length === 0) return null;

  const pdfFiles = [];
  let zipFile = null;

  for (const file of normalizedFiles) {
    const contentType = file.mimetype || "application/octet-stream";
    const extension = path.extname(file.originalname || "").toLowerCase();
    const isPdf = contentType === "application/pdf" || extension === ".pdf";
    const isZip = contentType === "application/zip" || contentType === "application/x-zip-compressed" || extension === ".zip";

    if (isPdf) {
      pdfFiles.push(file);
      continue;
    }

    if (isZip) {
      if (normalizedFiles.length > 1) {
        throw new Error("Sube un ZIP o varios PDF, pero no mezcles ambos formatos");
      }
      zipFile = file;
      continue;
    }

    throw new Error("El archivo digital debe ser PDF o ZIP");
  }

  if (zipFile) {
    const zipBuffer = await digitalFileBuffer(zipFile);
    const manifest = new AdmZip(zipBuffer)
      .getEntries()
      .filter(entry => !entry.isDirectory)
      .map(entry => entry.entryName.split("/").pop() || entry.entryName);
    const storedUrl = await persistBinaryFile({
      folder: "digital-products",
      filename: zipFile.originalname || "archivo-digital.zip",
      buffer: zipBuffer,
      contentType: zipFile.mimetype || "application/zip"
    });
    return {
      url: storedUrl,
      name: zipFile.originalname || "archivo-digital.zip",
      manifest,
      previewUrl: null,
      previewName: null
    };
  }

  const shouldMergeWithExisting = Boolean(options.existingUrl) && pdfFiles.length > 0;

  if (pdfFiles.length === 1 && !shouldMergeWithExisting) {
    const pdfFile = pdfFiles[0];
    const pdfBuffer = await digitalFileBuffer(pdfFile);
    const storedUrl = await persistBinaryFile({
      folder: "digital-products",
      filename: pdfFile.originalname || "archivo-digital.pdf",
      buffer: pdfBuffer,
      contentType: pdfFile.mimetype || "application/pdf"
    });
    const preview = await persistDigitalPreview(pdfFile, pdfFile.originalname || "archivo-digital.pdf");
    return {
      url: storedUrl,
      name: pdfFile.originalname || "archivo-digital.pdf",
      manifest: [pdfFile.originalname || "archivo-digital.pdf"],
      previewUrl: preview?.url || null,
      previewName: preview?.name || null
    };
  }

  if (pdfFiles.length > 1 || shouldMergeWithExisting) {
    const zip = new AdmZip();
    const manifest = [];

    if (shouldMergeWithExisting) {
      const existingEntries = await loadStoredDigitalEntries(options.existingUrl, options.existingName);
      for (const entry of existingEntries) {
        const entryName = uniqueZipEntryName(zip, entry.name);
        zip.addFile(entryName, entry.buffer);
        manifest.push(entryName);
      }
    }

    for (const file of pdfFiles) {
      const entryName = uniqueZipEntryName(zip, file.originalname || safeUploadFilename("archivo.pdf"));
      zip.addFile(entryName, await digitalFileBuffer(file));
      manifest.push(entryName);
    }

    const zipBuffer = zip.toBuffer();
    const existingName = String(options.existingName || "");
    const zipName = existingName.toLowerCase().endsWith(".zip")
      ? existingName
      : `pack-${Date.now()}.zip`;
    const storedUrl = await persistBinaryFile({
      folder: "digital-products",
      filename: zipName,
      buffer: zipBuffer,
      contentType: "application/zip"
    });
    const preview = await persistDigitalPreview(pdfFiles[0], pdfFiles[0].originalname || "archivo-digital.pdf");
    return {
      url: storedUrl,
      name: zipName,
      manifest,
      previewUrl: preview?.url || null,
      previewName: preview?.name || null
    };
  }

  return null;
}

async function digitalFileBuffer(file) {
  if (Buffer.isBuffer(file?.buffer)) return file.buffer;
  if (file?.path) return fs.promises.readFile(file.path);
  if (file?.filename) {
    const absolutePath = path.join(privateDigitalDir, file.filename);
    return fs.promises.readFile(absolutePath);
  }
  throw new Error("No se pudo leer el archivo digital");
}

async function buildPdfPreviewBuffer(file) {
  const extension = path.extname(file?.originalname || file?.filename || "").toLowerCase();
  const looksLikePdf = file?.mimetype === "application/pdf" || extension === ".pdf";
  if (!looksLikePdf) return null;

  const sourceBytes = await digitalFileBuffer(file);
  const source = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const pageCount = Math.min(3, source.getPageCount());
  if (pageCount <= 0) return null;

  const previewDoc = await PDFDocument.create();
  const pages = await previewDoc.copyPages(source, Array.from({ length: pageCount }, (_item, index) => index));
  pages.forEach(page => previewDoc.addPage(page));
  const previewBytes = await previewDoc.save();
  return Buffer.from(previewBytes);
}

async function persistPreviewBytes(previewBuffer, previewName) {
  if (isVercel) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error("Falta configurar BLOB_READ_WRITE_TOKEN para guardar vistas previas");
    }
    const blob = await put(`digital-previews/${safeUploadFilename(previewName)}`, previewBuffer, {
      access: "public",
      contentType: "application/pdf",
      token: process.env.BLOB_READ_WRITE_TOKEN
    });
    return { url: blob.url, name: previewName };
  }

  const previewFilename = `preview-${safeUploadFilename(previewName)}`;
  const previewPath = path.join(privateDigitalDir, previewFilename);
  await fs.promises.writeFile(previewPath, previewBuffer);
  return { url: previewPath, name: previewName };
}

async function persistDigitalPreview(file, persistedFilename) {
  try {
    const previewBuffer = await buildPdfPreviewBuffer(file);
    if (!previewBuffer) return null;

    const previewName = `muestra-${path.basename(file.originalname || persistedFilename || "preview.pdf", path.extname(file.originalname || persistedFilename || ".pdf"))}.pdf`;
    return persistPreviewBytes(previewBuffer, previewName);
  } catch (error) {
    console.error("Preview generation error", error);
    return null;
  }
}

async function digitalBufferFromStoredUrl(fileUrl) {
  if (/^https?:\/\//i.test(fileUrl)) {
    const remote = await fetch(fileUrl);
    if (!remote.ok) throw new Error("No se pudo leer el PDF original");
    return Buffer.from(await remote.arrayBuffer());
  }

  const absolutePath = path.resolve(fileUrl);
  if (!absolutePath.startsWith(path.resolve(privateDigitalDir))) {
    throw new Error("Ruta de archivo invalida");
  }
  return fs.promises.readFile(absolutePath);
}

async function buildPdfPreviewFromStoredFile(fileUrl, fileName) {
  const extension = path.extname(fileName || fileUrl || "").toLowerCase();
  if (extension !== ".pdf") return null;

  const sourceBytes = await digitalBufferFromStoredUrl(fileUrl);
  const source = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const pageCount = Math.min(3, source.getPageCount());
  if (pageCount <= 0) return null;

  const previewDoc = await PDFDocument.create();
  const pages = await previewDoc.copyPages(source, Array.from({ length: pageCount }, (_item, index) => index));
  pages.forEach(page => previewDoc.addPage(page));
  const previewBytes = Buffer.from(await previewDoc.save());
  const previewName = `muestra-${path.basename(fileName || "preview.pdf", path.extname(fileName || ".pdf"))}.pdf`;
  return persistPreviewBytes(previewBytes, previewName);
}

function previewNeedsRegeneration(previewUrl) {
  const current = String(previewUrl || "").trim();
  if (!current) return true;
  if (isVercel && !/^https?:\/\//i.test(current)) return true;
  return false;
}

function productRow(row, options = {}) {
  const galleryImages = parseJsonArray(row.gallery_images).map(normalizeImageUrl).filter(Boolean);
  const normalizedGallery = [normalizeImageUrl(row.image), ...galleryImages]
    .filter(Boolean)
    .filter((value, index, items) => items.indexOf(value) === index);
  const digitalFilesManifest = digitalManifestNames(row.digital_files_manifest);

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
    galleryImages: normalizedGallery,
    synopsis: row.description,
    description: row.description,
    hasDigitalFile: Boolean(row.digital_file_url),
    digitalFilesManifest,
    hasPreview: Boolean(row.preview_file_url),
    previewUrl: row.preview_file_url ? `/api/products/${row.id}/preview` : "",
    active: Boolean(row.active),
    sourceType: row.source_type || "product",
    sourceRefId: row.source_ref_id || null
  };

  if (options.includePrivate) {
    item.digitalFileName = row.digital_file_name || "";
    item.digitalFileUrl = row.digital_file_url || "";
    item.galleryImages = normalizedGallery;
    item.galleryImageCount = normalizedGallery.length;
    item.digitalFilesManifest = digitalFilesManifest;
    item.previewFileName = row.preview_file_name || "";
    item.previewFileUrl = row.preview_file_url || "";
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
    pillar: row.pillar || "dinero",
    featured: row.featured !== 0,
    linkedProductId: row.linked_product_id || null,
    digitalFileName: row.digital_file_name || "",
    digitalFilesManifest: digitalManifestNames(row.digital_files_manifest),
    hasDigitalPack: Boolean(row.digital_file_url),
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
    `SELECT id, title, digital_file_url, digital_file_name, digital_files_manifest
     FROM products
     WHERE id = ANY($1::int[])`,
    [digitalIds]
  );

  return rows.flatMap(row => {
    const assets = digitalDownloadAssets(row);
    if (assets.length === 0) return [];
    return assets.map((asset, index) => ({
      id: digitalAssetId(row.id, assets.length > 1 ? index : null),
      title: assets.length > 1 ? `${row.title} - ${asset.name}` : row.title,
      fileName: asset.name || row.digital_file_name || `${row.title}.pdf`,
      hasFile: true
    }));
  });
}

async function loadDigitalEmailAttachments(order) {
  if (order.delivery_type !== "digital") return [];

  const items = JSON.parse(order.items_json || "[]");
  const digitalIds = items
    .filter(item => normalizeFormat(item.format) === "digital")
    .map(item => Number(item.id))
    .filter(Boolean);

  if (digitalIds.length === 0) return [];

  const { rows } = await pool.query(
    `SELECT id, title, digital_file_url, digital_file_name, digital_files_manifest
     FROM products
     WHERE id = ANY($1::int[])`,
    [digitalIds]
  );

  const attachments = [];
  let totalBytes = 0;
  const maxTotalBytes = 18 * 1024 * 1024;

  for (const row of rows) {
    const manifestAssets = digitalManifestAssets(row.digital_files_manifest).filter(item => item.url);
    if (manifestAssets.length > 1) continue;
    if (!row.digital_file_url) continue;

    let buffer;
    let contentType = "application/octet-stream";
    if (/^https?:\/\//i.test(row.digital_file_url)) {
      const head = await fetch(row.digital_file_url, { method: "HEAD" }).catch(() => null);
      const contentLength = Number(head?.headers?.get("content-length") || 0);
      if (contentLength && totalBytes + contentLength > maxTotalBytes) continue;
      const remote = await fetch(row.digital_file_url);
      if (!remote.ok) continue;
      contentType = remote.headers.get("content-type") || contentType;
      buffer = Buffer.from(await remote.arrayBuffer());
    } else {
      const absolutePath = path.resolve(row.digital_file_url);
      if (!absolutePath.startsWith(path.resolve(privateDigitalDir))) continue;
      buffer = fs.readFileSync(absolutePath);
      const ext = path.extname(absolutePath).toLowerCase();
      if (ext === ".pdf") contentType = "application/pdf";
      if (ext === ".zip") contentType = "application/zip";
    }

    if (!buffer?.length) continue;
    if (totalBytes + buffer.length > maxTotalBytes) continue;

    totalBytes += buffer.length;
    attachments.push({
      filename: row.digital_file_name || `${row.title}.pdf`,
      content: buffer,
      contentType
    });
  }

  return attachments;
}

async function streamStoredFile(res, fileUrl, downloadName, disposition = "attachment") {
  if (/^https?:\/\//i.test(fileUrl)) {
    if (disposition === "attachment") {
      return res.redirect(fileUrl);
    }
    const remote = await fetch(fileUrl);
    if (!remote.ok) throw new Error("No se pudo obtener el archivo");
    const bytes = Buffer.from(await remote.arrayBuffer());
    res.setHeader("Content-Type", remote.headers.get("content-type") || "application/octet-stream");
    res.setHeader("Content-Disposition", `${disposition}; filename="${encodeURIComponent(downloadName)}"`);
    return res.end(bytes);
  }

  const absolutePath = path.resolve(fileUrl);
  if (!absolutePath.startsWith(path.resolve(privateDigitalDir))) {
    throw new Error("Ruta de archivo invalida");
  }

  return disposition === "inline"
    ? res.sendFile(absolutePath, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${encodeURIComponent(downloadName)}"`
        }
      })
    : res.download(absolutePath, downloadName);
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

app.post("/api/blob/upload", async (req, res) => {
  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const session = readSession(req);
        if (!session) throw new Error("No autorizado");
        const payload = parseJsonObject(clientPayload) || {};
        const type = String(payload.type || "");
        const allowedContentTypes = type === "image"
          ? ["image/jpeg", "image/png", "image/webp", "image/gif"]
          : ["application/pdf", "application/zip", "application/x-zip-compressed"];
        return {
          allowedContentTypes,
          maximumSizeInBytes: 100 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: clientPayload || null
        };
      },
      onUploadCompleted: async () => {}
    });

    res.json(jsonResponse);
  } catch (err) {
    console.error("Blob client upload error", err);
    res.status(400).json({ error: err.message || "No se pudo preparar la subida" });
  }
});

app.get("/api/products", async (req, res) => {
  try {
    const adminSession = readSession(req);
    const includeInactive = req.query.all === "1" && adminSession;
    const { rows } = await pool.query(`
      SELECT * FROM products
      ${includeInactive ? "WHERE deleted_at IS NULL" : "WHERE active = 1 AND deleted_at IS NULL"}
      ORDER BY display_order ASC, CASE WHEN format = 'digital' THEN 0 ELSE 1 END, id DESC
    `);
    res.json({ products: rows.map(row => productRow(row, { includePrivate: Boolean(adminSession) })) });
  } catch (err) {
    console.error("Product list error", err);
    res.status(500).json({ error: err.message || "No se pudieron cargar los productos" });
  }
});

app.get("/api/products/:id", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Producto no encontrado" });
    res.json({ product: productRow(rows[0]) });
  } catch (err) {
    console.error("Product read error", err);
    res.status(500).json({ error: err.message || "No se pudo cargar el producto" });
  }
});

app.get("/api/products/:id/preview", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, title, digital_file_url, digital_file_name, preview_file_url, preview_file_name, active, deleted_at FROM products WHERE id = $1",
      [req.params.id]
    );
    const product = rows[0];
    if (!product || !product.active || product.deleted_at) return res.status(404).json({ error: "Producto no encontrado" });
    let previewUrl = product.preview_file_url;
    let previewName = product.preview_file_name || `${product.title}-muestra.pdf`;

    if (previewNeedsRegeneration(previewUrl)) {
      const regenerated = await buildPdfPreviewFromStoredFile(product.digital_file_url, product.digital_file_name);
      if (regenerated) {
        previewUrl = regenerated.url;
        previewName = regenerated.name || previewName;
        await pool.query(
          `UPDATE products
           SET preview_file_url = $1, preview_file_name = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [previewUrl, previewName, product.id]
        );
      }
    }

    if (!previewUrl) return res.status(404).json({ error: "Este producto no tiene muestra disponible" });
    await streamStoredFile(res, previewUrl, previewName, "inline");
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const productUpload = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "galleryImages", maxCount: 3 },
  { name: "digitalFile", maxCount: 1 },
  { name: "digitalFiles", maxCount: 20 }
]);

function handleProductUpload(req, res, next) {
  productUpload(req, res, error => {
    if (!error) return next();
    console.error("Product upload middleware error", {
      message: error.message,
      code: error.code,
      field: error.field,
      stack: error.stack
    });
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "El archivo es demasiado grande para enviarlo directo. Recarga el admin con Ctrl + F5 y vuelve a intentar la subida."
      : error.message || "No se pudo recibir el archivo";
    res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: message });
  });
}

app.post("/api/products", requireAdmin, handleProductUpload, async (req, res) => {
  try {
    const body = req.body;
    const format = body.format || "fisico";
    const imageFile = uploadedFile(req, "image");
    const galleryImageFiles = uploadedFiles(req, "galleryImages");
    const digitalFile = uploadedFile(req, "digitalFile");
    const digitalFiles = uploadedFiles(req, "digitalFiles");
    const imageBlob = clientBlobFromBody(body, "imageBlob");
    const galleryImageBlobs = clientBlobsFromBody(body, "galleryImageBlobs");
    const digitalFileBlobs = clientBlobsFromBody(body, "digitalFileBlobs");
    const uploaded = await persistUploadedImage(imageFile);
    const uploadedGalleryImages = await persistUploadedImages(galleryImageFiles);
    const uploadedDigital = digitalFileBlobs.length
      ? await persistClientUploadedDigitalFiles(digitalFileBlobs)
      : await persistUploadedDigitalFile(digitalFile, digitalFiles);
    const image = uploaded || imageBlob?.url || normalizeImageUrl(body.image) || DEFAULT_IMAGE;
    if (format === "digital" && !uploadedDigital) {
      return res.status(400).json({ error: "Los productos digitales deben incluir un PDF o ZIP" });
    }
    const digitalFileUrl = format === "digital" ? uploadedDigital?.url || null : null;
    const digitalFileName = format === "digital" ? uploadedDigital?.name || null : null;
    const digitalFilesManifest = format === "digital" ? JSON.stringify(uploadedDigital?.manifest || []) : null;
    const previewFileUrl = format === "digital" ? uploadedDigital?.previewUrl || null : null;
    const previewFileName = format === "digital" ? uploadedDigital?.previewName || null : null;
    const galleryImages = JSON.stringify(uploadedGalleryImages.length ? uploadedGalleryImages : galleryImageBlobs.map(blob => blob.url));
    const { rows } = await pool.query(`
      INSERT INTO products (
        slug, title, author, category, price, old_price, format, stock, image, description,
        active, display_order, digital_file_url, digital_file_name, digital_files_manifest,
        preview_file_url, preview_file_name, gallery_images
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id
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
      digitalFilesManifest,
      previewFileUrl,
      previewFileName,
      galleryImages
    ]);
    await rebuildCombosForProduct(rows[0].id);
    res.status(201).json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error("Product create error", {
      message: err.message,
      code: err.code,
      constraint: err.constraint,
      detail: err.detail,
      stack: err.stack
    });
    res.status(500).json({ error: err.message || "No se pudo guardar el producto" });
  }
});

app.put("/api/products/:id", requireAdmin, handleProductUpload, async (req, res) => {
  try {
    const { rows: existingRows } = await pool.query("SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL", [req.params.id]);
    if (existingRows.length === 0) return res.status(404).json({ error: "Producto no encontrado" });
    
    const body = req.body;
    const format = body.format || "fisico";
    const imageFile = uploadedFile(req, "image");
    const galleryImageFiles = uploadedFiles(req, "galleryImages");
    const digitalFile = uploadedFile(req, "digitalFile");
    const digitalFiles = uploadedFiles(req, "digitalFiles");
    const imageBlob = clientBlobFromBody(body, "imageBlob");
    const galleryImageBlobs = clientBlobsFromBody(body, "galleryImageBlobs");
    const digitalFileBlobs = clientBlobsFromBody(body, "digitalFileBlobs");
    const uploaded = await persistUploadedImage(imageFile);
    const uploadedGalleryImages = await persistUploadedImages(galleryImageFiles);
    const digitalOptions = {
      existingUrl: existingRows[0].digital_file_url,
      existingName: existingRows[0].digital_file_name,
      existingManifest: existingRows[0].digital_files_manifest
    };
    const uploadedDigital = digitalFileBlobs.length
      ? await persistClientUploadedDigitalFiles(digitalFileBlobs, digitalOptions)
      : await persistUploadedDigitalFile(digitalFile, digitalFiles, digitalOptions);
    const image = uploaded || imageBlob?.url || normalizeImageUrl(body.image || existingRows[0].image);
    const currentGalleryImages = parseJsonArray(existingRows[0].gallery_images).map(normalizeImageUrl).filter(Boolean);
    const galleryImages = uploadedGalleryImages.length > 0
      ? uploadedGalleryImages
      : galleryImageBlobs.length > 0
        ? galleryImageBlobs.map(blob => blob.url)
        : currentGalleryImages;
    const digitalFileUrl = format === "digital"
      ? (uploadedDigital?.url || existingRows[0].digital_file_url || null)
      : null;
    const digitalFileName = format === "digital"
      ? (uploadedDigital?.name || existingRows[0].digital_file_name || null)
      : null;
    const digitalFilesManifest = format === "digital"
      ? JSON.stringify(uploadedDigital?.manifest || parseJsonArray(existingRows[0].digital_files_manifest))
      : null;
    const previewFileUrl = format === "digital"
      ? (uploadedDigital?.previewUrl || existingRows[0].preview_file_url || null)
      : null;
    const previewFileName = format === "digital"
      ? (uploadedDigital?.previewName || existingRows[0].preview_file_name || null)
      : null;

    if (format === "digital" && !digitalFileUrl) {
      return res.status(400).json({ error: "Los productos digitales deben incluir un PDF o ZIP" });
    }
    
    await pool.query(`
      UPDATE products
      SET slug=$1, title=$2, author=$3, category=$4, price=$5, old_price=$6,
          format=$7, stock=$8, image=$9, description=$10, active=$11,
          display_order=$12, digital_file_url=$13, digital_file_name=$14,
          digital_files_manifest=$15, preview_file_url=$16, preview_file_name=$17,
          gallery_images=$18, updated_at=CURRENT_TIMESTAMP
      WHERE id=$19
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
      digitalFilesManifest,
      previewFileUrl,
      previewFileName,
      JSON.stringify(galleryImages),
      req.params.id
    ]);
    await rebuildCombosForProduct(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("Product update error", {
      message: err.message,
      code: err.code,
      constraint: err.constraint,
      detail: err.detail,
      stack: err.stack
    });
    res.status(500).json({ error: err.message || "No se pudo actualizar el producto" });
  }
});

app.delete("/api/products/:id", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE products SET active = 0, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL",
      [req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Producto no encontrado" });
    await rebuildCombosForProduct(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("Product delete error", {
      message: err.message,
      code: err.code,
      constraint: err.constraint,
      detail: err.detail,
      stack: err.stack
    });
    res.status(500).json({ error: err.message || "No se pudo eliminar el producto" });
  }
});

app.get("/api/combos", async (req, res) => {
  try {
    const includeInactive = req.query.all === "1" && readSession(req);
    const { rows } = await pool.query(`SELECT * FROM combos ${includeInactive ? "" : "WHERE active = 1"} ORDER BY id DESC`);
    
    const combosWithItems = await Promise.all(rows.map(async (row) => {
      const { rows: items } = await pool.query(`
        SELECT p.id, p.title, p.format, p.digital_file_url, ci.qty
        FROM combo_items ci
        JOIN products p ON p.id = ci.product_id
        WHERE ci.combo_id = $1
          AND p.deleted_at IS NULL
          AND COALESCE(p.source_type, 'product') = 'product'
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
      INSERT INTO combos (slug, title, price, description, image, active, pillar, featured)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
    `, [body.slug, body.title, moneyToCents(body.price), body.description || "", image, body.active === "0" ? 0 : 1, body.pillar || "dinero", body.featured === "0" ? 0 : 1]);
    
    const comboId = rows[0].id;
    await saveComboItems(comboId, body.productIds);
    await rebuildComboDigitalPack(comboId, { required: true });
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
      SET slug=$1, title=$2, price=$3, description=$4, image=$5, active=$6, pillar=$7, featured=$8, updated_at=CURRENT_TIMESTAMP
      WHERE id=$9
    `, [body.slug, body.title, moneyToCents(body.price), body.description || "", image, body.active === "0" ? 0 : 1, body.pillar || "dinero", body.featured === "0" ? 0 : 1, req.params.id]);
    
    await saveComboItems(req.params.id, body.productIds);
    await rebuildComboDigitalPack(req.params.id, { required: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/combos/:id", requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM combos WHERE id = $1", [req.params.id]);
    const combo = rows[0];
    if (!combo) return res.status(404).json({ error: "Combo no encontrado" });

    await pool.query("UPDATE combos SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [req.params.id]);
    if (combo.linked_product_id) {
      await pool.query(`
        UPDATE products
        SET active = 0,
            deleted_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND COALESCE(source_type, 'product') = 'combo'
          AND deleted_at IS NULL
      `, [combo.linked_product_id]);
    }

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

async function loadComboProducts(comboId) {
  const { rows } = await pool.query(`
    SELECT p.*
    FROM combo_items ci
    JOIN products p ON p.id = ci.product_id
    WHERE ci.combo_id = $1
      AND p.deleted_at IS NULL
      AND COALESCE(p.source_type, 'product') = 'product'
    ORDER BY p.title
  `, [comboId]);
  return rows;
}

async function rebuildComboDigitalPack(comboId, options = {}) {
  const { rows: comboRows } = await pool.query("SELECT * FROM combos WHERE id = $1", [comboId]);
  const combo = comboRows[0];
  if (!combo) throw new Error("Combo no encontrado");

  const products = await loadComboProducts(comboId);
  const pack = await buildComboDigitalPack(combo, products);
  if (!pack) {
    if (options.required) {
      throw new Error("El combo necesita al menos un libro digital con PDF o ZIP cargado");
    }
    await pool.query(`
      UPDATE combos
      SET digital_file_url = NULL,
          digital_file_name = NULL,
          digital_files_manifest = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [comboId]);
    if (combo.linked_product_id) {
      await pool.query(`
        UPDATE products
        SET active = 0,
            digital_file_url = NULL,
            digital_file_name = NULL,
            digital_files_manifest = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND COALESCE(source_type, 'product') = 'combo'
      `, [combo.linked_product_id]);
    }
    return null;
  }

  await pool.query(`
    UPDATE combos
    SET digital_file_url = $1,
        digital_file_name = $2,
        digital_files_manifest = $3,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
  `, [pack.url, pack.name, JSON.stringify(pack.manifest), comboId]);

  await syncComboProduct(comboId, { ...combo, digital_file_url: pack.url, digital_file_name: pack.name, digital_files_manifest: JSON.stringify(pack.manifest) });
}

async function syncComboProduct(comboId, combo) {
  const existingProductId = combo.linked_product_id ? Number(combo.linked_product_id) : null;
  const { rows: linkedRows } = existingProductId
    ? await pool.query("SELECT id FROM products WHERE id = $1 AND COALESCE(source_type, 'product') = 'combo'", [existingProductId])
    : { rows: [] };

  const linkedProduct = linkedRows[0] || null;
  const slug = normalizeText(combo.slug);
  const title = normalizeText(combo.title);
  if (!slug || !title) throw new Error("El combo necesita titulo y slug");

  const conflict = await pool.query(`
    SELECT id
    FROM products
    WHERE slug = $1
      AND deleted_at IS NULL
      AND ($2::int IS NULL OR id <> $2)
    LIMIT 1
  `, [slug, linkedProduct?.id || null]);

  if (conflict.rows.length) {
    throw new Error("El slug del combo ya existe en productos. Usa otro slug para el pack.");
  }

  const values = [
    slug,
    title,
    "Pack digital",
    combo.pillar || "dinero",
    Number(combo.price || 0),
    normalizeText(combo.description),
    normalizeImageUrl(combo.image),
    combo.active === 0 || combo.active === false ? 0 : 1,
    combo.digital_file_url,
    combo.digital_file_name,
    combo.digital_files_manifest,
    comboId
  ];

  if (linkedProduct) {
    await pool.query(`
      UPDATE products
      SET slug=$1, title=$2, author=$3, category=$4, price=$5, old_price=NULL,
          format='digital', stock=999, description=$6, image=$7, active=$8,
          digital_file_url=$9, digital_file_name=$10, digital_files_manifest=$11,
          preview_file_url=NULL, preview_file_name=NULL,
          source_type='combo', source_ref_id=$12, updated_at=CURRENT_TIMESTAMP
      WHERE id=$13
    `, [...values, linkedProduct.id]);
    return linkedProduct.id;
  }

  const { rows } = await pool.query(`
    INSERT INTO products (
      slug, title, author, category, price, old_price, format, stock, description,
      image, active, digital_file_url, digital_file_name, digital_files_manifest,
      preview_file_url, preview_file_name, source_type, source_ref_id
    )
    VALUES ($1, $2, $3, $4, $5, NULL, 'digital', 999, $6, $7, $8, $9, $10, $11, NULL, NULL, 'combo', $12)
    RETURNING id
  `, values);

  const productId = rows[0].id;
  await pool.query("UPDATE combos SET linked_product_id = $1 WHERE id = $2", [productId, comboId]);
  return productId;
}

async function rebuildCombosForProduct(productId) {
  const { rows } = await pool.query("SELECT DISTINCT combo_id FROM combo_items WHERE product_id = $1", [productId]);
  for (const row of rows) {
    await rebuildComboDigitalPack(row.combo_id, { required: false });
  }
}

app.get("/api/orders/access/:id", async (req, res) => {
  try {
    const accessToken = String(req.query.token || "");
    if (!accessToken) return res.status(400).json({ error: "Falta token de acceso" });

    let order = await loadOrderWithToken(req.params.id, accessToken);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
    order = await reconcileMercadoPagoOrder(order, requestBaseUrl(req));

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
    const [rawProductId, rawAssetIndex] = String(req.params.productId || "").split(":");
    const productId = Number(rawProductId);
    const assetIndex = rawAssetIndex == null ? null : Number(rawAssetIndex);
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: "Producto invalido" });
    }
    if (assetIndex != null && (!Number.isInteger(assetIndex) || assetIndex < 0)) {
      return res.status(400).json({ error: "Archivo invalido" });
    }

    const orderedProduct = items.find(item => Number(item.id) === productId && normalizeFormat(item.format) === "digital");
    if (!orderedProduct) return res.status(404).json({ error: "Archivo no encontrado para este pedido" });

    const { rows } = await pool.query(
      "SELECT title, digital_file_url, digital_file_name, digital_files_manifest FROM products WHERE id = $1",
      [productId]
    );
    const product = rows[0];
    const assets = product ? digitalDownloadAssets(product) : [];
    if (assets.length === 0) return res.status(404).json({ error: "El archivo digital no esta disponible" });
    const asset = assets[assetIndex ?? 0];
    if (!asset?.url) return res.status(404).json({ error: "Archivo no encontrado" });

    const downloadName = asset.name || product.digital_file_name || `${product.title}.pdf`;
    await streamStoredFile(res, asset.url, downloadName, "attachment");
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

app.get("/api/customers", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, COALESCE(
        json_agg(
          json_build_object(
            'productTitle', cp.product_title,
            'productFormat', cp.product_format,
            'quantity', cp.quantity,
            'purchasedAt', cp.purchased_at
          )
          ORDER BY cp.purchased_at DESC
        ) FILTER (WHERE cp.id IS NOT NULL),
        '[]'
      ) AS purchases
      FROM customers c
      LEFT JOIN customer_purchases cp ON cp.customer_id = c.id
      GROUP BY c.id
      ORDER BY c.updated_at DESC
      LIMIT 200
    `);

    res.json({
      customers: rows.map(row => ({
        id: row.id,
        email: row.email,
        name: row.name || "",
        phone: row.phone || "",
        country: row.country || "",
        totalOrders: Number(row.total_orders || 0),
        totalSpent: centsToAmount(row.total_spent),
        marketingOptIn: Boolean(row.marketing_opt_in),
        updatedAt: row.updated_at,
        purchases: row.purchases || []
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/book-requests", async (req, res) => {
  try {
    const name = normalizeText(req.body.name);
    const email = normalizeEmail(req.body.email);
    const requestedTitle = normalizeText(req.body.requestedTitle || req.body.title);
    const requestedAuthor = normalizeText(req.body.requestedAuthor || req.body.author);
    const notes = normalizeText(req.body.notes);

    if (!requestedTitle) {
      return res.status(400).json({ error: "Indica al menos un libro, autor o tema que quieras ver en la tienda" });
    }
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ error: "El email no es valido" });
    }

    await pool.query(`
      INSERT INTO book_requests (name, email, requested_title, requested_author, notes)
      VALUES ($1, $2, $3, $4, $5)
    `, [name, email || null, requestedTitle, requestedAuthor || null, notes || null]);

    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/book-requests", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, email, requested_title, requested_author, notes, status, created_at
      FROM book_requests
      ORDER BY created_at DESC
      LIMIT 200
    `);

    res.json({
      requests: rows.map(row => ({
        id: row.id,
        name: row.name || "",
        email: row.email || "",
        requestedTitle: row.requested_title,
        requestedAuthor: row.requested_author || "",
        notes: row.notes || "",
        status: row.status || "new",
        createdAt: row.created_at
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/exchange-rate", async (_req, res) => {
  try {
    const usdArsRate = await getUsdArsRate();
    res.json({ ok: true, base: "USD", quote: "ARS", usdArsRate });
  } catch (err) {
    res.status(500).json({ error: "No se pudo obtener la cotizacion USD/ARS" });
  }
});

app.get("/js/data.js", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM products
      WHERE active = 1 AND deleted_at IS NULL
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
      galleryImages: [normalizeImageUrl(row.image), ...parseJsonArray(row.gallery_images).map(normalizeImageUrl)]
        .filter(Boolean)
        .filter((value, index, items) => items.indexOf(value) === index),
      synopsis: row.description,
      stock: row.stock,
      displayOrder: Number(row.display_order || 0),
      hasDigitalFile: Boolean(row.digital_file_url),
      digitalFilesManifest: digitalManifestNames(row.digital_files_manifest),
      hasPreview: Boolean(row.preview_file_url),
      previewUrl: row.preview_file_url ? `/api/products/${row.id}/preview` : "",
      sourceType: row.source_type || "product",
      sourceRefId: row.source_ref_id || null,
      pages: 240,
      language: "Español",
      featured: true,
      staffPick: row.id <= 3,
      staffNote: "Seleccionado para convertir lectura en acción.",
      tags: [row.category, row.title.toLowerCase()]
    }));

    const categories = [
      { id: "educacion-financiera", name: "Educación financiera", icon: "$", count: "Activos e inversión", color: "#00FF88" },
      { id: "crecimiento-personal", name: "Crecimiento personal", icon: "C", count: "Hábitos y mentalidad", color: "#D4AF37" },
      { id: "dinero", name: "Dinero", icon: "$", count: "Ingresos y negocio", color: "#58D7FF" },
      { id: "amor", name: "Amor", icon: "A", count: "Relaciones y autoestima", color: "#FF6FAE" },
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
    if (!isValidEmail(buyer.email)) {
      return res.status(400).json({ error: "El email es obligatorio para enviar el comprobante y la descarga" });
    }
    const { rows: products } = await pool.query("SELECT * FROM products WHERE active = 1 AND deleted_at IS NULL");
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
        delivery_type, access_token, shipping_address, shipping_city, shipping_zip, shipping_country,
        payment_provider, payment_currency
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id
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
      deliveryType === "physical" ? normalizeText(shippingInfo.country || "AR") : "",
      "mercadopago",
      "ARS"
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

app.post("/api/checkout/paypal", async (req, res) => {
  try {
    if (!paypalConfigured()) {
      return res.status(500).json({ error: "Falta configurar PayPal en Vercel" });
    }

    const cartItems = Array.isArray(req.body.items) ? req.body.items : [];
    const buyer = req.body.buyer || {};
    const billing = req.body.billing || {};
    if (!isValidEmail(buyer.email)) {
      return res.status(400).json({ error: "El email es obligatorio para enviar el comprobante y la descarga" });
    }
    const country = normalizeText(billing.country || "").toUpperCase();
    if (!country || country === "AR") {
      return res.status(400).json({ error: "PayPal queda reservado para clientes fuera de Argentina" });
    }

    const { rows: products } = await pool.query("SELECT * FROM products WHERE active = 1 AND deleted_at IS NULL");
    const productMap = new Map(products.map(product => [product.id, product]));
    const productSlugMap = new Map(products.map(product => [product.slug, product]));

    const items = cartItems.map(item => {
      const product = productSlugMap.get(String(item.slug || "")) || productMap.get(Number(item.id));
      if (!product) return null;
      const qty = Math.max(1, Number(item.qty || 1));
      return {
        product,
        qty,
        format: normalizeFormat(product.format)
      };
    }).filter(Boolean);

    if (items.length === 0) return res.status(400).json({ error: "El carrito esta vacio" });
    if (items.some(item => item.format !== "digital")) {
      return res.status(400).json({ error: "PayPal solo esta habilitado para productos digitales internacionales" });
    }

    const subtotal = items.reduce((sum, item) => sum + Number(item.product.price || 0) * item.qty, 0);
    const usdArsRate = await getUsdArsRate();
    const totalUsd = amountToUsd(subtotal, usdArsRate);
    if (Number(totalUsd) <= 0) return res.status(400).json({ error: "El total en USD es invalido" });

    const accessToken = makeAccessToken();
    const { rows: orderRows } = await pool.query(`
      INSERT INTO orders (
        status, buyer_name, buyer_email, buyer_phone, total, items_json,
        delivery_type, access_token, shipping_address, shipping_city, shipping_zip, shipping_country,
        payment_provider, payment_currency, exchange_rate
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id
    `, [
      "pending",
      normalizeText(buyer.name),
      normalizeText(buyer.email),
      normalizeText(buyer.phone),
      subtotal,
      JSON.stringify(items.map(item => ({
        id: item.product.id,
        title: item.product.title,
        qty: item.qty,
        unitPrice: centsToAmount(item.product.price),
        format: item.format
      }))),
      "digital",
      accessToken,
      "",
      "",
      "",
      country,
      "paypal",
      "USD",
      usdArsRate
    ]);

    const orderId = orderRows[0].id;
    const baseUrl = requestBaseUrl(req);
    const paypalOrder = await paypalRequest("/v2/checkout/orders", {
      method: "POST",
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          custom_id: String(orderId),
          description: `Pedido digital Juga en Grande #${orderId}`,
          amount: {
            currency_code: "USD",
            value: totalUsd
          }
        }],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "Juga en Grande",
              shipping_preference: "NO_SHIPPING",
              user_action: "PAY_NOW",
              return_url: `${baseUrl}/api/checkout/paypal/return?order_id=${orderId}&access_token=${accessToken}`,
              cancel_url: `${baseUrl}/checkout.html?payment=failure&order_id=${orderId}&token=${accessToken}`
            }
          }
        }
      })
    });

    const approveUrl = (paypalOrder.links || []).find(link => link.rel === "payer-action" || link.rel === "approve")?.href;
    if (!approveUrl) throw new Error("PayPal no devolvio URL de aprobacion");

    await pool.query(
      "UPDATE orders SET paypal_order_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [paypalOrder.id, orderId]
    );

    res.json({
      ok: true,
      orderId,
      accessToken,
      deliveryType: "digital",
      paymentProvider: "paypal",
      currency: "USD",
      exchangeRate: usdArsRate,
      totalUsd: Number(totalUsd),
      approveUrl
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No se pudo crear el pago en PayPal" });
  }
});

app.get("/api/checkout/paypal/return", async (req, res) => {
  const orderId = String(req.query.order_id || "");
  const accessToken = String(req.query.access_token || "");
  try {
    const paypalOrderId = String(req.query.token || "");
    if (!orderId || !accessToken || !paypalOrderId) throw new Error("Retorno PayPal invalido");

    const { rows } = await pool.query(
      "SELECT * FROM orders WHERE id = $1 AND access_token = $2 AND paypal_order_id = $3",
      [orderId, accessToken, paypalOrderId]
    );
    const order = rows[0];
    if (!order) throw new Error("Pedido PayPal no encontrado");

    const capture = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
      method: "POST",
      body: "{}"
    });
    const completed = capture.status === "COMPLETED";
    await pool.query(`
      UPDATE orders
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [completed ? "approved" : String(capture.status || "pending").toLowerCase(), orderId]);

    const payment = completed ? "success" : "pending";
    if (completed) {
      await fulfillApprovedOrder(orderId, requestBaseUrl(req));
    }
    res.redirect(`/checkout.html?payment=${payment}&order_id=${encodeURIComponent(orderId)}&token=${encodeURIComponent(accessToken)}`);
  } catch (error) {
    console.error("PayPal return error", error);
    const suffix = orderId && accessToken
      ? `&order_id=${encodeURIComponent(orderId)}&token=${encodeURIComponent(accessToken)}`
      : "";
    res.redirect(`/checkout.html?payment=failure${suffix}`);
  }
});

app.post("/api/webhooks/mercadopago", async (req, res) => {
  try {
    const paymentId = req.body?.data?.id || req.query["data.id"];
    if (!paymentId || !process.env.MP_ACCESS_TOKEN) return res.status(200).json({ received: true, skipped: true });
    const data = await fetchMercadoPagoPayment(paymentId);
    await applyMercadoPagoPayment(data, requestBaseUrl(req));
    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Mercado Pago webhook error", error);
    res.status(200).json({ received: true, error: "webhook_processing_failed" });
  }
});

// Local only: serve disk uploads
if (!isVercel) {
  app.use("/assets/uploads", express.static(publicUploadsDir));
}
app.get("/admin.html", (_req, res) => sendNoStoreFile(res, "admin.html", "text/html; charset=utf-8"));
app.get("/js/admin.js", (_req, res) => sendNoStoreFile(res, path.join("js", "admin.js"), "application/javascript; charset=utf-8"));
app.use(express.static(root));
backfillMissingPreviews();

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`Jugá en Grande escuchando en http://localhost:${port}`);
  });
}

app.locals.privateHelpers = {
  fulfillApprovedOrder,
  sendOrderEmail,
  loadDigitalEmailAttachments,
  backfillMissingPreviews
};

module.exports = app;
