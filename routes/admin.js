const express = require("express");
const {
  readProfile,
  writeProfile,
  readMessages,
  writeMessages,
} = require("../lib/storage");
const {
  isPasswordConfigured,
  signIn,
  signOut,
  requireAuth,
  changePassword,
  setInitialPassword,
} = require("../lib/auth");

const router = express.Router();

// ---------- Session helpers ----------
const COOKIE_NAME = "ptf_admin_token";

function readTokenFromCookie(req) {
  return req.cookies && req.cookies[COOKIE_NAME];
}

// Extract token from cookie before auth routes
router.use((req, res, next) => {
  req.sessionToken = readTokenFromCookie(req);
  next();
});

// Check configured status (no auth needed)
router.get("/status", (req, res) => {
  res.json({ configured: isPasswordConfigured() });
});

// Login: exchange username/password for a session cookie
router.post("/login", (req, res) => {
  if (!isPasswordConfigured()) {
    return res.status(409).json({ error: "Admin password has not been set. Run the setup script." });
  }
  const { username, password } = req.body || {};
  const token = signIn(username || "", password || "");
  if (!token) {
    return res.status(401).json({ error: "Invalid username or password" });
  }
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
    maxAge: 1000 * 60 * 60 * 24 * 7,
    path: "/",
  });
  res.json({ ok: true });
});

// One-time initial setup. Only available while NO admin password exists,
// so it cannot be hijacked after the account is created.
router.post("/setup", (req, res) => {
  if (isPasswordConfigured()) {
    return res.status(403).json({ error: "Setup has already been completed." });
  }
  const { username, password } = req.body || {};
  const name = (username || "admin").toString().trim().slice(0, 50);
  const pass = (password || "").toString();
  if (pass.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  setInitialPassword(name, pass);
  // sign them straight in
  const token = signIn(name, pass);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: req.protocol === "https",
    maxAge: 1000 * 60 * 60 * 24 * 7,
    path: "/",
  });
  res.json({ ok: true });
});

router.post("/logout", (req, res) => {
  signOut(req.sessionToken);
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

// ---------- Admin-only ----------
router.use(requireAuth);

// Get full profile INCLUDING private fields (admin view)
router.get("/profile", (req, res) => {
  res.json(readProfile());
});

// Save full profile (edit via the editor)
router.put("/profile", (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "Invalid profile payload." });
  }
  writeProfile(body);
  res.json({ ok: true });
});

// List contact messages (most recent first)
router.get("/messages", (req, res) => {
  res.json(readMessages());
});

// Mark a message as read/unread
router.patch("/messages/:id", (req, res) => {
  const list = readMessages();
  const msg = list.find((m) => m.id === req.params.id);
  if (!msg) return res.status(404).json({ error: "Message not found" });
  msg.read = req.body.read === true;
  writeMessages(list);
  res.json(msg);
});

// Delete a message
router.delete("/messages/:id", (req, res) => {
  const list = readMessages();
  const next = list.filter((m) => m.id !== req.params.id);
  if (next.length === list.length) return res.status(404).json({ error: "Message not found" });
  writeMessages(next);
  res.json({ ok: true });
});

// Change admin password
router.post("/change-password", (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const result = changePassword(currentPassword || "", newPassword || "");
  if (!result.ok) return res.status(400).json({ error: result.message });
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true, message: "Password changed. Please log in again." });
});

module.exports = { adminRouter: router, COOKIE_NAME };