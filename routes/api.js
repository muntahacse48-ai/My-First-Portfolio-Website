const express = require("express");
const { readProfile, writeMessage } = require("../lib/storage");
const { publicObject } = require("../lib/privacy");

const router = express.Router();

const publicProfile = () => publicObject(readProfile());

// Full public profile (everything not flagged private)
router.get("/profile", (req, res) => {
  res.json(publicProfile());
});

// Convenience sub-routes
router.get("/profile/:section", (req, res) => {
  const profile = publicProfile();
  const section = req.params.section;
  if (!(section in profile)) {
    return res.status(404).json({ error: "Section not found" });
  }
  res.json(profile[section]);
});

// Site health check
router.get("/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Contact form handler -> saved to data/messages.json (never exposed publicly)
router.post("/contact", (req, res) => {
  const { name, email, subject, message } = req.body || {};

  const cleanName = (name || "").toString().trim().slice(0, 120);
  const cleanEmail = (email || "").toString().trim().slice(0, 200);
  const cleanSubject = (subject || "").toString().trim().slice(0, 200);
  const cleanMessage = (message || "").toString().trim().slice(0, 5000);

  if (!cleanName || !cleanMessage) {
    return res
      .status(400)
      .json({ error: "Name and message are required." });
  }
  if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: "A valid email is required." });
  }

  writeMessage({
    name: cleanName,
    email: cleanEmail,
    subject: cleanSubject,
    message: cleanMessage,
  });

  res.status(201).json({ ok: true });
});

module.exports = router;