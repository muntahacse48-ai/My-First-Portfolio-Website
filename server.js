const express = require("express");
const path = require("path");
const apiRouter = require("./routes/api");
const { adminRouter } = require("./routes/admin");
const { isPasswordConfigured } = require("./lib/auth");

const app = express();
const PORT = process.env.PORT || 3000;

// Allow user-supplied secret to sign things; default is only for local dev.
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET || "portfolio-local-dev-secret";

// ---------- Body parsing ----------
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: true, limit: "200kb" }));

// ---------- Tiny cookie parser (so we never trust cookies blindly) ----------
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    let val = pair.slice(idx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}
app.use((req, res, next) => {
  req.cookies = parseCookies(req.headers.cookie);
  next();
});

// ---------- Security headers ----------
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Powered-By", "");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'"
  );
  // Prevent stored admin/private files from ever being read over HTTP
  res.setHeader("Cache-Control", "no-store");
  next();
});

// Never leak file/dir listing or data files
app.use((req, res, next) => {
  const forbidden = /^\/(data|lib|scripts|node_modules)\b/i;
  if (forbidden.test(req.path)) {
    return res.status(404).send("Not found");
  }
  next();
});

// ---------- Simple in-memory rate limiting (protects /api/contact & /admin/login) ----------
const hits = new Map();
let _limiterSeq = 0;
function rateLimit({ windowMs, max, message = "Too many requests. Try again later." }) {
  const id = ++_limiterSeq; // unique per limiter so endpoints don't share counters
  return (req, res, next) => {
    const key = id + ":" + (req.ip || req.socket.remoteAddress || "unknown");
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({ error: message });
    }
    next();
  };
}
// Periodically clear the rate-limit cache so memory doesn't grow forever
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
}, 60 * 1000);

// ---------- Public API ----------
// Stricter limits must be mounted BEFORE the general API router.
app.use("/api/contact", rateLimit({ windowMs: 10 * 60 * 1000, max: 5 }));
app.use("/api", rateLimit({ windowMs: 60 * 1000, max: 300 }), apiRouter);

// ---------- Admin API ----------
app.use(
  "/api/admin/login",
  rateLimit({ windowMs: 5 * 60 * 1000, max: 10, message: "Too many login attempts. Try again later." })
);
app.use("/api/admin", rateLimit({ windowMs: 60 * 1000, max: 120 }), adminRouter);

// ---------- Static frontend ----------
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: "1h",
    setHeaders(res, filePath) {
      // never cache the admin assets so edits show immediately
      if (filePath.includes(path.sep + "admin" + path.sep)) {
        res.setHeader("Cache-Control", "no-store");
      }
    },
  })
);

// ---------- Admin panel (served at /admin) ----------
app.get("/admin", (req, res) => {
  if (!isPasswordConfigured()) {
    return res.redirect("/admin/setup.html");
  }
  res.sendFile(path.join(__dirname, "admin", "admin.html"));
});
app.get("/admin/setup.html", (req, res) => {
  if (isPasswordConfigured()) {
    return res.redirect("/admin");
  }
  res.sendFile(path.join(__dirname, "admin", "setup.html"));
});
// Admin assets (js/css) are served from the admin folder
app.use("/admin", express.static(path.join(__dirname, "admin")));

// ---------- SPA fallback for the public site ----------
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/admin/")) {
    return res.status(404).json({ error: "Not found" });
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ---------- Error handler ----------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Portfolio running at http://localhost:${PORT}`);
  console.log(
    isPasswordConfigured()
      ? "Admin account configured. Edit at /admin"
      : "Run `npm run setup` to create the admin password."
  );
});