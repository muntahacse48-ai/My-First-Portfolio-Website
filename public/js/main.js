// Loads profile content from the backend API, with a fallback to the
// statically exported data/content.js (for static hosting deployments).
(function () {
  const page = window.location.pathname.split("/").pop() || "index.html";

  async function loadContent() {
    try {
      const res = await fetch("/api/profile", { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch (_) {
      // offline / static hosting -> fall through to bundled content
    }
    return window.SITE_CONTENT || null;
  }

  loadContent().then((C) => {
    if (!C) return;
    render(C);
  });

  function render(C) {
    // ---------- Header / Navigation ----------
    const header = document.getElementById("site-header");
    if (header) {
      const pages = [
        ["index.html", "Home"],
        ["about.html", "About"],
        ["projects.html", "Projects"],
        ["creative.html", "Creative"],
        ["contact.html", "Contact"],
      ];
      const links = pages
        .map(([href, label]) => {
          const active = page === href ? ' class="active"' : "";
          return `<a href="${href}"${active}>${label}</a>`;
        })
        .join("");
      header.innerHTML = `
        <nav class="nav">
          <a class="nav-brand" href="index.html">${C.name}</a>
          <div class="nav-links">${links}</div>
        </nav>`;
    }

    // ---------- Footer ----------
    const footer = document.getElementById("site-footer");
    if (footer) {
      const social = [];
      if (C.links.github) social.push(`<a href="${C.links.github}" target="_blank" rel="noopener">GitHub</a>`);
      if (C.links.linkedin) social.push(`<a href="${C.links.linkedin}" target="_blank" rel="noopener">LinkedIn</a>`);
      footer.innerHTML = `
        <p>${C.footerNote || ""}</p>
        <p>${social.join("")}</p>`;
    }

    // ---------- Home page ----------
    if (page === "index.html") {
      document.title = "Home | " + C.name;
      setText("hero-name", C.name);
      setText("hero-role", C.role);
      setText("hero-tagline", C.tagline);
      setText("home-bio", C.bio);
      if (C.images.avatar) {
        setAttr("hero-avatar-img", "src", "images/" + C.images.avatar);
        setAttr("hero-avatar-img", "alt", C.name);
      }
      const chips = document.getElementById("skill-chips");
      if (chips) {
        chips.innerHTML = C.skills
          .map(
            (s) =>
              `<span class="chip">${s.icon || ""} ${s.name}<span class="level">· ${s.level}</span></span>`
          )
          .join("");
      }
    }

    // ---------- About page ----------
    if (page === "about.html") {
      document.title = "About | " + C.name;
      setText("about-name", C.name);
      setText("about-role", C.role);
      setText("about-bio", C.bio);
      if (C.images.avatar) {
        setAttr("about-avatar-img", "src", "images/" + C.images.avatar);
        setAttr("about-avatar-img", "alt", C.name);
      }
      const certs = document.getElementById("certificates");
      if (certs) {
        certs.innerHTML = C.certificates
          .map(
            (c) => `
            <div class="cert-card">
              <h3>${c.title}</h3>
              <p>${c.issuer} · ${c.year}</p>
              ${c.url ? `<a href="${c.url}" target="_blank" rel="noopener">View certificate →</a>` : ""}
            </div>`
          )
          .join("");
      }
    }

    // ---------- Projects page ----------
    if (page === "projects.html") {
      document.title = "Projects | " + C.name;
      const grid = document.getElementById("projects");
      if (grid) {
        grid.innerHTML = C.projects
          .map(
            (p) => `
            <div class="card">
              ${p.image ? `<img src="images/${p.image}" alt="${p.title}" />` : ""}
              <div class="card-body">
                <h3>${p.title}</h3>
                <p>${p.description}</p>
                <div class="card-tech">${p.tech.map((t) => `<span>${t}</span>`).join("")}</div>
                <div class="card-links">
                  ${p.github ? `<a href="${p.github}" target="_blank" rel="noopener">GitHub ↗</a>` : ""}
                  ${p.live ? `<a href="${p.live}" target="_blank" rel="noopener">Live Demo ↗</a>` : ""}
                </div>
              </div>
            </div>`
          )
          .join("");
      }
    }

    // ---------- Creative page ----------
    if (page === "creative.html") {
      document.title = "Creative | " + C.name;
      const grid = document.getElementById("creative");
      const render = (filter) => {
        const items = filter === "all" ? C.creative : C.creative.filter((c) => c.type === filter);
        grid.innerHTML = items
          .map((c) => {
            const img = c.image
              ? `background-image: url('images/${c.image}');`
              : "background: linear-gradient(135deg, var(--accent), var(--accent-2));";
            return `
            <div class="card creative-card">
              <span class="type-badge">${c.type}</span>
              <div class="card-img-wrap" style="${img}"></div>
              <div class="card-overlay">
                <h3>${c.title}</h3>
                <p>${c.description}</p>
              </div>
            </div>`;
          })
          .join("");
      };
      render("all");
      document.querySelectorAll(".filter-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          render(btn.dataset.filter);
        });
      });
    }

    // ---------- Contact page ----------
    if (page === "contact.html") {
      document.title = "Contact | " + C.name;
      setAttr("contact-email", "href", "mailto:" + C.links.email);
      setText("contact-email-text", C.links.email);
      setAttr("contact-github", "href", C.links.github);
      if (C.links.linkedin) {
        setAttr("contact-linkedin", "href", C.links.linkedin);
      } else {
        const el = document.getElementById("contact-linkedin");
        if (el) el.style.display = "none";
      }

      const form = document.getElementById("contact-form");
      if (form) {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const status = document.getElementById("contact-form-status");
          const btn = form.querySelector("button[type=submit]");
          const fd = new FormData(form);
          btn.disabled = true;
          btn.textContent = "Sending…";
          status.hidden = false;
          status.className = "section-sub";
          try {
            const res = await fetch("/api/contact", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: fd.get("name"),
                email: fd.get("email"),
                subject: fd.get("subject"),
                message: fd.get("message"),
              }),
            });
            const body = await res.json().catch(() => ({}));
            if (res.ok) {
              status.textContent = "Thanks! Your message has been sent.";
              status.classList.add("success");
              form.reset();
            } else {
              throw new Error(body.error || "Could not send your message.");
            }
          } catch (err) {
            status.textContent = "Sorry — " + err.message;
            status.classList.add("error");
          } finally {
            btn.disabled = false;
            btn.textContent = "Send message";
          }
        });
      }
    }
  }

  // ---------- Helpers ----------
  function setText(id, value) {
    const el = document.getElementById(id);
    if (el && value) el.textContent = value;
  }
  function setAttr(id, attr, value) {
    const el = document.getElementById(id);
    if (el && value) el.setAttribute(attr, value);
  }
})();