const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

function dataFile(name) {
  return path.join(DATA_DIR, name);
}

function ensureFile(name, initial) {
  const file = dataFile(name);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(initial, null, 2), "utf8");
  }
  return file;
}

function readJson(name, fallback) {
  const file = dataFile(name);
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    return fallback;
  }
}

function writeJson(name, data) {
  const file = dataFile(name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  return data;
}

function readProfile() {
  return readJson("profile.json", {});
}

function writeProfile(data) {
  return writeJson("profile.json", data);
}

function readMessages() {
  return readJson("messages.json", []);
}

function writeMessages(list) {
  return writeJson("messages.json", list);
}

function writeMessage(message) {
  const list = readMessages();
  message.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  message.createdAt = new Date().toISOString();
  message.read = false;
  list.unshift(message);
  writeMessages(list);
  return message;
}

function readAdmin() {
  return readJson("admin.json", {
    username: "admin",
    passwordHash: null,
    salt: null,
    sessions: {},
  });
}

function writeAdmin(data) {
  return writeJson("admin.json", data);
}

// Strip out the server-only files from being served accidentally
const FORBIDDEN = ["admin.json", "messages.json"];

module.exports = {
  ensureFile,
  readJson,
  writeJson,
  readProfile,
  writeProfile,
  readMessages,
  writeMessage,
  readAdmin,
  writeAdmin,
  DATA_DIR,
  FORBIDDEN,
};