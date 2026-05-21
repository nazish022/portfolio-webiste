/* =================================================================
   Project detail — magazine layout
   - ?id= → projects.json lookup → render
   - Sections: Overview / Problem / Approach / Tech Choices /
              Key Features / Challenges & Learnings / Outcome
   - Faded gold section numbers
   - Bottom nav: ← Back to Index | Next Project →
================================================================= */

(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const escape = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));

  const PRM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const HOVER_ABLE = matchMedia("(hover: hover)").matches;
  const POINTER_FINE = matchMedia("(pointer: fine)").matches;
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---- custom cursor ---- */
  function initCursor() {
    if (PRM || !HOVER_ABLE || !POINTER_FINE) return;
    const dot = document.createElement("div");
    dot.className = "cursor-dot";
    const ring = document.createElement("div");
    ring.className = "cursor-ring";
    document.body.append(dot, ring);
    document.documentElement.classList.add("has-cursor");

    const m = { x: innerWidth / 2, y: innerHeight / 2 };
    const r = { x: m.x, y: m.y };
    const d = { x: m.x, y: m.y };
    addEventListener("pointermove", (e) => { m.x = e.clientX; m.y = e.clientY; }, { passive: true });
    function tick() {
      d.x = lerp(d.x, m.x, 0.55); d.y = lerp(d.y, m.y, 0.55);
      r.x = lerp(r.x, m.x, 0.18); r.y = lerp(r.y, m.y, 0.18);
      dot.style.transform = `translate3d(${d.x}px, ${d.y}px, 0) translate(-50%, -50%)`;
      ring.style.transform = `translate3d(${r.x}px, ${r.y}px, 0) translate(-50%, -50%)`;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    const sel = 'a, button, input, textarea, .kf-card, .tech-list__item, .detail-stack__badge, .detail-cta';
    document.addEventListener("pointerover", (e) => {
      if (e.target.closest(sel)) document.documentElement.classList.add("cursor-hover");
    });
    document.addEventListener("pointerout", (e) => {
      if (e.target.closest(sel)) document.documentElement.classList.remove("cursor-hover");
    });
  }

  async function loadJSON(path) {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.json();
  }

  /* ---- nav ---- */
  function initNav() {
    const nav = $("#nav");
    const toggle = $("#navToggle");
    const onScroll = () => nav.classList.toggle("is-scrolled", scrollY > 12);
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    toggle?.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      document.body.style.overflow = open ? "hidden" : "";
    });
    $$("#navLinks a").forEach((a) =>
      a.addEventListener("click", () => {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      })
    );
  }

  /* ---- progress bar ---- */
  function initProgressBar() {
    const bar = $("#progressBar");
    if (!bar) return;
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]");
      if (!a) return;
      const href = a.getAttribute("href");
      if (
        !href ||
        a.target === "_blank" ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        (href.startsWith("http") && new URL(href, location.href).origin !== location.origin)
      ) return;
      bar.classList.remove("is-done");
      bar.classList.add("is-active");
    });
    addEventListener("pageshow", () => {
      bar.classList.remove("is-active");
      bar.classList.add("is-done");
      setTimeout(() => bar.classList.remove("is-done"), 600);
    });
  }

  /* ---- CTAs ---- */
  function ctaHTML(p) {
    const links = p.links || [];
    const demo = links.find((l) => /demo|live/i.test(l.label));
    const code = links.find((l) => /github|code|source/i.test(l.label));
    const out = [];
    if (demo) {
      out.push(`<a class="detail-cta" href="${escape(demo.url)}" target="_blank" rel="noopener">
        <span>Live demo</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 17L17 7M9 7h8v8"/></svg>
      </a>`);
    }
    if (code) {
      out.push(`<a class="detail-cta detail-cta--ghost" href="${escape(code.url)}" target="_blank" rel="noopener">
        <span>View code</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/></svg>
      </a>`);
    }
    if (!out.length && p.internal) {
      out.push(`<span class="detail-cta--internal">Internal — built at Juspay</span>`);
    }
    return out.join("");
  }

  function section(num, label, body) {
    return `
      <section class="detail-section" data-reveal>
        <div>
          <div class="detail-section__num">${escape(num)}</div>
          <p class="detail-section__label">${escape(label)}</p>
        </div>
        <div class="detail-section__body">${body}</div>
      </section>`;
  }

  function renderProject(project, allProjects) {
    document.title = `${project.title} — Nazish Sheikh`;

    // foot nav: prev for "back to index" tone, next cycles
    const idx = allProjects.findIndex((p) => p.id === project.id);
    const next = allProjects[(idx + 1) % allProjects.length];

    const root = $("#projectRoot");
    root.innerHTML = `
      <!-- HERO -->
      <section class="detail-hero">
        <div class="detail-hero__bg" style="background: ${escape(project.gradient || "linear-gradient(135deg, #1a1a1a, #2a2a2a)")}"></div>
        <div class="detail-hero__inner">
          <a class="detail-back" href="index.html#work">← Back to Index</a>
          <p class="detail-eyebrow">— Case Study · ${escape(project.year || "")}</p>
          <h1 class="detail-title" data-anim="title">${escape(project.title)}</h1>
          ${project.tagline ? `<p class="detail-tagline" data-reveal>${escape(project.tagline)}</p>` : ""}

          ${project.stack && project.stack.length ? `
            <div class="detail-stack" data-reveal>
              ${project.stack.map((s) => `<span class="detail-stack__badge">${escape(s)}</span>`).join("")}
            </div>` : ""}

          <div class="detail-meta" data-reveal>
            ${project.year ? `
              <span class="detail-meta__item">
                <span class="detail-meta__k">Year</span>
                <span class="detail-meta__v">${escape(project.year)}</span>
              </span>` : ""}
            ${project.role ? `
              <span class="detail-meta__item">
                <span class="detail-meta__k">Role</span>
                <span class="detail-meta__v">${escape(project.role)}</span>
              </span>` : ""}
            ${project.tags && project.tags.length ? `
              <span class="detail-meta__item">
                <span class="detail-meta__k">Tags</span>
                <span class="detail-meta__v">${project.tags.map(escape).join(" · ")}</span>
              </span>` : ""}
          </div>

          <div class="detail-cta-row" data-reveal>
            ${ctaHTML(project)}
          </div>
        </div>
      </section>

      <!-- BODY -->
      <article class="detail-body">
        ${project.overview ? section("01", "Overview", `
          <p>${escape(project.overview)}</p>
          ${project.overviewExtra ? `<p>${escape(project.overviewExtra)}</p>` : ""}
        `) : ""}

        ${project.problem ? section("02", "The Problem", `<p>${escape(project.problem)}</p>`) : ""}

        ${project.approach ? section("03", "Approach & Architecture", `<p>${escape(project.approach)}</p>`) : ""}

        ${project.techChoices && project.techChoices.length ? section("04", "Tech Choices", `
          <div class="tech-list">
            ${project.techChoices.map((t) => `
              <div class="tech-list__item">
                <span class="tech-list__name">${escape(t.tech)}</span>
                <span class="tech-list__why">${escape(t.reason)}</span>
              </div>
            `).join("")}
          </div>
        `) : ""}

        ${project.keyFeatures && project.keyFeatures.length ? section("05", "Key Features", `
          <div class="kf-grid">
            ${project.keyFeatures.map((f) => `
              <div class="kf-card">
                <h3 class="kf-card__title">${escape(f.title)}</h3>
                <p class="kf-card__desc">${escape(f.description)}</p>
              </div>
            `).join("")}
          </div>
        `) : ""}

        ${project.challenges && project.challenges.length ? section("06", "Challenges & Learnings", `
          ${project.challenges.map((c) => `
            <div class="challenge">
              <p class="challenge__k">The problem</p>
              <p class="challenge__problem">${escape(c.problem)}</p>
              <p class="challenge__solution-k">The fix</p>
              <p class="challenge__solution">${escape(c.solution)}</p>
              ${c.learning ? `
                <p class="challenge__learning-k">What I learned</p>
                <p class="challenge__learning">${escape(c.learning)}</p>
              ` : ""}
            </div>
          `).join("")}
        `) : ""}

        ${project.outcome ? section("07", "Outcome / Impact", `<p>${escape(project.outcome)}</p>`) : ""}
      </article>

      <!-- FOOT NAV -->
      <nav class="detail-foot-nav" aria-label="Project navigation">
        <div class="detail-foot-nav__inner">
          <a class="detail-foot-nav__back" href="index.html#work">
            <span class="detail-foot-nav__label">← Back to Index</span>
            <span class="detail-foot-nav__title">All projects</span>
          </a>
          ${next && next.id !== project.id ? `
            <a class="detail-foot-nav__next" href="project.html?id=${encodeURIComponent(next.id)}">
              <span class="detail-foot-nav__label">Next Project →</span>
              <span class="detail-foot-nav__title">${escape(next.title)}</span>
            </a>
          ` : ""}
        </div>
      </nav>
    `;

    // hero entrance — match home page feel
    if (window.gsap && !PRM) {
      gsap.from(".detail-back", { x: -20, opacity: 0, duration: 0.7, ease: "power3.out" });
      gsap.from(".detail-eyebrow", { y: 14, opacity: 0, duration: 0.7, ease: "power3.out", delay: 0.1 });
      gsap.from(".detail-title", { y: 60, opacity: 0, duration: 1.1, ease: "power3.out", delay: 0.18 });
      gsap.from(".detail-tagline", { y: 14, opacity: 0, duration: 0.7, ease: "power3.out", delay: 0.5 });
      gsap.from(".detail-stack__badge", {
        y: 8, opacity: 0, duration: 0.5, stagger: 0.05,
        ease: "power3.out", delay: 0.7,
      });
      gsap.from(".detail-meta__item", {
        y: 8, opacity: 0, duration: 0.5, stagger: 0.06,
        ease: "power3.out", delay: 0.85,
      });
      gsap.from(".detail-cta-row > *", {
        y: 12, opacity: 0, duration: 0.6, stagger: 0.08,
        ease: "power3.out", delay: 1.0,
      });
    }

    initReveals();
  }

  function renderError(msg) {
    $("#projectRoot").innerHTML = `
      <section class="detail-error">
        <p class="detail-eyebrow">— 404</p>
        <h1>Project not found.</h1>
        <p>${escape(msg || "We couldn't locate that project.")}</p>
        <a class="detail-cta" href="index.html#work">← Back to index</a>
      </section>`;
  }

  function initReveals() {
    const targets = $$("[data-reveal]:not(.is-revealed)");
    if (!targets.length) return;
    targets.forEach((el) => el.classList.add("is-revealed"));

    if (window.gsap && window.ScrollTrigger && !PRM) {
      gsap.registerPlugin(window.ScrollTrigger);
      targets.forEach((el) => {
        gsap.from(el, {
          y: 30,
          opacity: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      });
    } else if (typeof IntersectionObserver !== "undefined") {
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.style.opacity = "1";
              e.target.style.transform = "none";
              obs.unobserve(e.target);
            }
          });
        },
        { threshold: 0.1, rootMargin: "0px 0px -10% 0px" }
      );
      targets.forEach((el) => {
        el.style.opacity = "0";
        el.style.transform = "translateY(30px)";
        el.style.transition = "opacity 700ms ease, transform 700ms ease";
        obs.observe(el);
      });
    }
  }

  async function boot() {
    $("#year").textContent = new Date().getFullYear();
    initNav();
    initProgressBar();

    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    if (!id) {
      renderError("No project id was specified in the URL.");
      return;
    }
    try {
      const projects = await loadJSON("data/projects.json");
      const project = projects.find((p) => p.id === id);
      if (!project) {
        renderError(`No project with id "${id}".`);
        return;
      }
      renderProject(project, projects);
    } catch (err) {
      console.error(err);
      renderError("Couldn't load project data. If you opened the file via file://, run a local server.");
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
