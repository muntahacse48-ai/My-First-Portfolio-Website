(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  // ---------- Tiny helpers ----------
  function setNested(obj, path, value) {
    const keys = path.split(".");
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {};
      cur = cur[k];
    }
    cur[keys[keys.length - 1]] = value;
  }

  function getNested(obj, path) {
    return path.split(".").reduce((cur, k) => (cur == null ? cur : cur[k]), obj);
  }

  async function api(path, options = {}) {
    const res = await fetch("/api/admin" + path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    let body = {};
    try { body = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error(body.error || res.statusText);
    return body;
  }

  function setStatus(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = "save-status " + (type || "");
  }

  // ---------- Setup page ----------
  if ($("#setup-form")) {
    $("#setup-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api("/setup", {
          method: "POST",
          body: JSON.stringify({
            username: fd.get("username"),
            password: fd.get("password"),
          }),
        });
        window.location.href = "/admin";
      } catch (err) {
        $("#setup-error").textContent = err.message;
        $("#setup-error").hidden = false;
      }
    });
    return;
  }

  // ---------- Admin app ----------
  const viewLogin = $("#view-login");
  const viewApp = $("#view-app");

  let profile = null;

  function showLogin() {
    viewLogin.hidden = false;
    viewApp.hidden = true;
  }
  function showApp() {
    viewLogin.hidden = true;
    viewApp.hidden = false;
  }

  // ---- Login ----
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api("/login", {
        method: "POST",
        body: JSON.stringify({
          username: fd.get("username"),
          password: fd.get("password"),
        }),
      });
      $("#login-error").hidden = true;
      await boot();
    } catch (err) {
      $("#login-error").textContent = err.message;
      $("#login-error").hidden = false;
    }
  });

  $("#logout-btn").addEventListener("click", async () => {
    await api("/logout", { method: "POST" });
    showLogin();
  });

  // ---- Tabs ----
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = true));
      const panel = $("#tab-" + btn.dataset.tab);
      panel.hidden = false;
      panel.classList.add("active");
      if (btn.dataset.tab === "messages") loadMessages();
    });
  });

  // ---- Profile editor ----
  const ARRAYS = {
    skills: [
      { key: "name", label: "Skill" },
      { key: "level", label: "Level", type: "select", options: ["Beginner", "Intermediate", "Advanced"] },
      { key: "icon", label: "Icon (emoji)" },
    ],
    projects: [
      { key: "title", label: "Title" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "tech", label: "Tech (comma separated)" },
      { key: "github", label: "GitHub URL" },
      { key: "live", label: "Live URL" },
      { key: "image", label: "Image filename" },
    ],
    certificates: [
      { key: "title", label: "Title" },
      { key: "issuer", label: "Issuer" },
      { key: "year", label: "Year" },
      { key: "url", label: "URL" },
    ],
    creative: [
      { key: "type", label: "Type", type: "select", options: ["writing", "photography", "videography", "gaming"] },
      { key: "title", label: "Title" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "image", label: "Image filename" },
    ],
  };

  function renderArrayLists() {
    for (const [kind, fields] of Object.entries(ARRAYS)) {
      const listEl = $("#" + kind + "-list");
      listEl.innerHTML = "";
      profile[kind].forEach((item, idx) => {
        listEl.appendChild(buildArrayRow(kind, item, idx));
      });
    }
  }

  function buildArrayRow(kind, item, idx) {
    const row = document.createElement("div");
    row.className = "array-row";
    row.dataset.index = idx;

    const body = document.createElement("div");
    body.className = "array-row-body";

    for (const f of ARRAYS[kind]) {
      const label = document.createElement("label");
      label.textContent = f.label;
      label.dataset.field = f.key;

      let input;
      if (f.type === "select") {
        input = document.createElement("select");
        f.options.forEach((o) => {
          const opt = document.createElement("option");
          opt.value = o;
          opt.textContent = o;
          if (String(item[f.key]) === o) opt.selected = true;
          input.appendChild(opt);
        });
      } else if (f.type === "textarea") {
        input = document.createElement("textarea");
        input.rows = 2;
        input.value = item[f.key] || "";
      } else {
        input = document.createElement("input");
        if (f.key === "tech") input.placeholder = "HTML, CSS, JS";
        input.value = item[f.key] || "";
      }
      label.appendChild(input);
      body.appendChild(label);
    }

    // Private toggle (keeps personal info off the public API)
    const privateLabel = document.createElement("label");
    privateLabel.className = "check";
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = item.private === true;
    privateLabel.appendChild(check);
    privateLabel.appendChild(document.createTextNode("Private (hidden from public site)"));
    body.appendChild(privateLabel);
    row.appendChild(body);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn ghost small";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      profile[kind].splice(Number(row.dataset.index), 1);
      renderArrayLists();
    });
    row.appendChild(remove);

    return row;
  }

  document.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.add;
      profile[kind].push({});
      renderArrayLists();
    });
  });

  // Flatten the profile form into the profile object on save
  function readFormIntoProfile() {
    const form = $("#profile-form");
    form.querySelectorAll("input[name], textarea[name], select[name]").forEach((el) => {
      if (!el.name) return;
      if (el.type === "checkbox") {
        setNested(profile, el.name, el.checked);
      } else {
        setNested(profile, el.name, el.value);
      }
    });

    for (const [kind, fields] of Object.entries(ARRAYS)) {
      const rows = $("#" + kind + "-list").querySelectorAll(".array-row");
      const out = [];
      rows.forEach((row) => {
        const obj = {};
        const privCheck = row.querySelector('input[type="checkbox"]');
        row.querySelectorAll(".array-row-body label[data-field]").forEach((label) => {
          const key = label.dataset.field;
          const input = label.querySelector("input, textarea, select");
          let val = input.value.trim();
          if (key === "tech") {
            val = val
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          }
          obj[key] = val;
        });
        if (privCheck) obj.private = privCheck.checked;
        out.push(obj);
      });
      profile[kind] = out;
    }
  }

  $("#save-profile").addEventListener("click", async () => {
    readFormIntoProfile();
    const status = $("#save-status");
    setStatus(status, "Saving…");
    try {
      await api("/profile", { method: "PUT", body: JSON.stringify(profile) });
      setStatus(status, "Saved ✓", "ok");
      setTimeout(() => (status.textContent = ""), 3000);
    } catch (err) {
      setStatus(status, "Error: " + err.message, "err");
    }
  });

  // ---- Messages ----
  async function loadMessages() {
    const listEl = $("#messages-list");
    try {
      const msgs = await api("/messages");
      const unread = msgs.filter((m) => !m.read).length;
      const badge = $("#unread-badge");
      badge.hidden = unread === 0;
      badge.textContent = unread;

      listEl.innerHTML = "";
      $("#messages-empty").hidden = msgs.length > 0;

      msgs.forEach((m) => {
        const card = document.createElement("div");
        card.className = "msg" + (m.read ? "" : " unread");
        card.innerHTML = `
          <div class="msg-head">
            <strong>${esc(m.name)}</strong>
            <span class="muted">${m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}</span>
          </div>
          ${m.email ? `<div class="muted">${esc(m.email)}</div>` : ""}
          ${m.subject ? `<div class="muted">${esc(m.subject)}</div>` : ""}
          <p>${esc(m.message)}</p>
          <div class="msg-actions">
            <button class="btn ghost small" data-act="toggle">${m.read ? "Mark unread" : "Mark read"}</button>
            <button class="btn ghost small danger" data-act="delete">Delete</button>
          </div>`;
        card.querySelector('[data-act="toggle"]').addEventListener("click", async () => {
          await api("/messages/" + m.id, { method: "PATCH", body: JSON.stringify({ read: !m.read }) });
          loadMessages();
        });
        card.querySelector('[data-act="delete"]').addEventListener("click", async () => {
          if (!confirm("Delete this message?")) return;
          await api("/messages/" + m.id, { method: "DELETE" });
          loadMessages();
        });
        listEl.appendChild(card);
      });
    } catch (err) {
      listEl.innerHTML = `<p class="error">${esc(err.message)}</p>`;
    }
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---- Settings ----
  $("#password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const status = $("#password-status");
    setStatus(status, "Changing…");
    try {
      await api("/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: fd.get("currentPassword"),
          newPassword: fd.get("newPassword"),
        }),
      });
      e.target.reset();
      setStatus(status, "Password changed. Log in again with the new password.", "ok");
      setTimeout(showLogin, 1500);
    } catch (err) {
      setStatus(status, "Error: " + err.message, "err");
    }
  });

  // ---- Boot ----
  async function boot() {
    try {
      profile = await api("/profile");
      showApp();
      renderArrayLists();
      populateForm();
    } catch (err) {
      showLogin();
    }
  }

  function populateForm() {
    const form = $("#profile-form");
    form.querySelectorAll("input[name], textarea[name], select[name]").forEach((el) => {
      if (!el.name) return;
      const val = getNested(profile, el.name);
      if (el.type === "checkbox") el.checked = !!val;
      else el.value = val == null ? "" : val;
    });
  }

  boot();
})();