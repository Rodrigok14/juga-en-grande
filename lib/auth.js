const crypto = require("crypto");

function parseCookies(header = "") {
  return Object.fromEntries(
    header.split(";").map(part => part.trim()).filter(Boolean).map(part => {
      const index = part.indexOf("=");
      return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
    })
  );
}

function sign(value) {
  return crypto
    .createHmac("sha256", process.env.SESSION_SECRET || "dev-secret")
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
  return username === (process.env.ADMIN_USER || "admin") &&
    password === (process.env.ADMIN_PASSWORD || "cambiar-esta-clave");
}

module.exports = { createSession, readSession, requireAdmin, verifyAdmin };
