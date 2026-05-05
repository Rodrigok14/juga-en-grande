const crypto = require("crypto");

function isProduction() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header.split(";").map(part => part.trim()).filter(Boolean).map(part => {
      const index = part.indexOf("=");
      return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
    })
  );
}

function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  // In production we want a real secret, but we avoid crashing the whole serverless function
  // at import-time; routes can return a clear error instead.
  return isProduction() ? null : "dev-secret";
}

function sign(value) {
  const secret = sessionSecret();
  if (!secret) {
    throw new Error("SESSION_SECRET is required in production (set it in Vercel Environment Variables).");
  }
  return crypto
    .createHmac("sha256", secret)
    .update(value)
    .digest("hex");
}

function createSession(username) {
  const payload = JSON.stringify({ username, exp: Date.now() + 1000 * 60 * 60 * 12 });
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function readSession(req) {
  const token = parseCookies(req.headers.cookie || "").jg_session;
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || sign(encoded) !== signature) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function requireAdmin(req, res, next) {
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: "No autorizado" });
  req.admin = session;
  next();
}

function verifyAdmin(username, password) {
  const expectedUser = process.env.ADMIN_USER;
  const expectedPass = process.env.ADMIN_PASSWORD;
  if (!expectedUser || !expectedPass) return false;
  if (username !== expectedUser) return false;
  const a = Buffer.from(String(password ?? ""), "utf8");
  const b = Buffer.from(expectedPass, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { createSession, readSession, requireAdmin, verifyAdmin, isProduction };
