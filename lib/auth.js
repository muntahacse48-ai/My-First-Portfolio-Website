const crypto = require("crypto");
const { readAdmin, writeAdmin } = require("./storage");

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const KEY_LEN = 64;

// Hash a password using scrypt (safe against brute force)
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, KEY_LEN).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, hash, salt) {
  if (!hash || !salt) return false;
  const candidate = crypto.scryptSync(password, salt, KEY_LEN).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(hash, "hex"));
}

function isPasswordConfigured() {
  const admin = readAdmin();
  return !!(admin.passwordHash && admin.salt);
}

function signIn(username, password) {
  const admin = readAdmin();
  if (admin.username !== username) return null;
  if (!verifyPassword(password, admin.passwordHash, admin.salt)) return null;

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = Date.now() + SESSION_TTL_MS;
  admin.sessions = admin.sessions || {};
  // keep only the most recent 20 sessions
  const sessions = Object.entries(admin.sessions).sort(
    (a, b) => b[1].expiresAt - a[1].expiresAt
  );
  admin.sessions = {};
  sessions.slice(0, 19).forEach(([t, s]) => (admin.sessions[t] = s));
  admin.sessions[token] = { createdAt: Date.now(), expiresAt };
  writeAdmin(admin);
  return token;
}

function getSession(token) {
  if (!token) return null;
  const admin = readAdmin();
  const session = admin.sessions && admin.sessions[token];
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    delete admin.sessions[token];
    writeAdmin(admin);
    return null;
  }
  return session;
}

function signOut(token) {
  const admin = readAdmin();
  if (admin.sessions && admin.sessions[token]) {
    delete admin.sessions[token];
    writeAdmin(admin);
  }
}

// Auth middleware for admin routes
function requireAuth(req, res, next) {
  const token = req.sessionToken;
  const session = getSession(token);
  if (!session) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  req.session = session;
  next();
}

function changePassword(currentPassword, newPassword) {
  const admin = readAdmin();
  if (!verifyPassword(currentPassword, admin.passwordHash, admin.salt)) {
    return { ok: false, message: "Current password is incorrect" };
  }
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, message: "New password must be at least 8 characters" };
  }
  const { salt, hash } = hashPassword(newPassword);
  admin.salt = salt;
  admin.passwordHash = hash;
  // invalidate other sessions when password changes
  admin.sessions = {};
  writeAdmin(admin);
  return { ok: true };
}

function setInitialPassword(username, password) {
  const { salt, hash } = hashPassword(password);
  writeAdmin({
    username: username || "admin",
    salt,
    passwordHash: hash,
    sessions: {},
  });
}

module.exports = {
  hashPassword,
  verifyPassword,
  isPasswordConfigured,
  signIn,
  getSession,
  signOut,
  requireAuth,
  changePassword,
  setInitialPassword,
};