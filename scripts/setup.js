// One-time setup: create the admin account with a strong random password.
// Usage: npm run setup
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { setInitialPassword } = require("../lib/auth");
const { readAdmin } = require("../lib/storage");

const ADMIN_FILE = path.join(__dirname, "data", "admin.json");

if (fs.existsSync(ADMIN_FILE)) {
  const existing = JSON.parse(fs.readFileSync(ADMIN_FILE, "utf8"));
  if (existing.passwordHash && existing.salt) {
    console.log("Admin account already configured.");
    console.log("To reset it, delete data/admin.json and run `npm run setup` again.");
    process.exit(0);
  }
}

const username = process.argv[2] || "admin";
const password = crypto.randomBytes(12).toString("base64url");
setInitialPassword(username, password);

console.log("=====================================================");
console.log("  Portfolio admin account created.");
console.log("  Save these credentials somewhere safe:");
console.log("");
console.log(`  Username : ${username}`);
console.log(`  Password : ${password}`);
console.log("");
console.log("  Visit /admin to log in and edit your profile.");
console.log("  You can change the password from the admin panel.");
console.log("  NOTE: These are stored as a scrypt hash, never plaintext.");
console.log("=====================================================");