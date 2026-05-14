/* =================================================================
   Nazish Sheikh — home page
   - GSAP timeline for hero entrance
   - Typed.js for cycling designation
   - ScrollTrigger reveals (IO fallback)
   - Project work-list with cursor-follow preview (lerp 0.1)
   - Copy-to-clipboard email + toast
   - Frosted-glass nav + active-section indicator
   - Formspree-compatible contact form
================================================================= */

(() => {
  "use strict";

  /* ----------------------- helpers ----------------------- */
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
  const POINTER_FINE = matchMedia("(pointer: fine)").matches;

  async function loadJSON(path) {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.json();
  }

  /* =================================================================
     NAV — frosted on scroll, mobile slide-in, active section
  ================================================================= */
  function initNav() {
    const nav = $("#nav");
    const toggle = $("#navToggle");
    const links = $$("#navLinks a");

    const onScroll = () => nav.classList.toggle("is-scrolled", scrollY > 12);
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });

    toggle?.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      document.body.style.overflow = open ? "hidden" : "";
    });

    links.forEach((a) =>
      a.addEventListener("click", () => {
        if (nav.classList.contains("is-open")) {
          nav.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
          document.body.style.overflow = "";
        }
      })
    );

    const map = new Map();
    links.forEach((a) => {
      const id = a.getAttribute("href")?.replace("#", "");
      const sec = id && document.getElementById(id);
      if (sec) map.set(sec, a);
    });
    if (typeof IntersectionObserver !== "undefined") {
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            const link = map.get(e.target);
            if (link && e.isIntersecting) {
              links.forEach((l) => l.classList.remove("is-active"));
              link.classList.add("is-active");
            }
          });
        },
        { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
      );
      map.forEach((_, sec) => obs.observe(sec));
    }
  }

  /* =================================================================
     HERO entrance — GSAP timeline + Typed.js typewriter
  ================================================================= */
  function initHero() {
    const designation = $("#typed");
    const phrases = [
      "Product Engineer",
      "Functional Programmer",
      "iOS Developer",
      "ML Enthusiast",
    ];

    if (designation && window.Typed && !PRM) {
      new window.Typed("#typed", {
        strings: phrases,
        typeSpeed: 60,
        backSpeed: 30,
        backDelay: 2000,
        startDelay: 1100, // line up with the GSAP entrance
        loop: true,
        showCursor: false, // CSS handles the caret
      });
    } else if (designation) {
      designation.textContent = phrases[0];
    }

    if (window.gsap && !PRM) {
      // staggered hero entrance — name → eyebrow → designation → summary → CTA → scroll
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.to(".hero__name-line > span", {
        y: 0,
        duration: 1.2,
        delay: 0.15,
      })
        .from(".hero__eyebrow", { opacity: 0, y: 14, duration: 0.7 }, "-=0.95")
        .from(".hero__designation", { opacity: 0, y: 14, duration: 0.7 }, "-=0.55")
        .from(".hero__summary", { opacity: 0, y: 14, duration: 0.7 }, "-=0.4")
        .from(".hero__cta .btn", {
          opacity: 0,
          scale: 0.92,
          y: 6,
          duration: 0.6,
          stagger: 0.12,
        }, "-=0.35")
        .from(".hero__scroll", { opacity: 0, y: 8, duration: 0.6 }, "-=0.2");
    } else {
      document.documentElement.classList.add("no-gsap");
    }
  }

  /* =================================================================
     SCROLL REVEALS
  ================================================================= */
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

  /* =================================================================
     EXPERIENCE — slide-in from left with stagger
  ================================================================= */
  function renderExperience(items) {
    const root = $("#timeline");
    if (!root) return;
    root.innerHTML = items
      .map(
        (it) => `
        <li class="tl-item" data-reveal-left>
          <div class="tl-body">
            <h3>${escape(it.company)}</h3>
            <p class="tl-role">${escape(it.role)} <span>${escape(it.location)}</span></p>
            <ul>
              ${it.points.map((p) => `<li>${escape(p)}</li>`).join("")}
            </ul>
          </div>
          <div class="tl-period">
            <span>${escape(it.period)}</span>
            ${it.current ? '<span class="tl-current">Current</span>' : ""}
          </div>
        </li>`
      )
      .join("");

    // stagger slide-in from left for timeline items
    const items_dom = $$(".tl-item", root);
    if (window.gsap && window.ScrollTrigger && !PRM) {
      gsap.registerPlugin(window.ScrollTrigger);
      gsap.from(items_dom, {
        x: -40,
        opacity: 0,
        duration: 0.9,
        stagger: 0.15,
        ease: "power3.out",
        scrollTrigger: { trigger: root, start: "top 80%", once: true },
      });
    } else if (typeof IntersectionObserver !== "undefined") {
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e, i) => {
            if (e.isIntersecting) {
              const idx = items_dom.indexOf(e.target);
              setTimeout(() => {
                e.target.style.opacity = "1";
                e.target.style.transform = "none";
              }, idx * 120);
              obs.unobserve(e.target);
            }
          });
        },
        { threshold: 0.1 }
      );
      items_dom.forEach((el) => {
        el.style.opacity = "0";
        el.style.transform = "translateX(-40px)";
        el.style.transition = "opacity 700ms ease, transform 700ms ease";
        obs.observe(el);
      });
    }
  }

  /* =================================================================
     WORK — full-width project cards (always visible)
     Each row has a permanent gradient thumbnail with monogram + label,
     plus title, tagline, stack, and a CTA that slides in on hover.
  ================================================================= */
  function projectMonogram(title) {
    return title
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  function renderWorkList(projects) {
    const list = $("#workList");
    if (!list) return;

    list.innerHTML = projects
      .map(
        (p, i) => {
          const num = String(i + 1).padStart(2, "0");
          const stack = (p.stack || []).join(" · ");
          return `
        <a class="work-card" href="project.html?id=${encodeURIComponent(p.id)}" data-id="${escape(p.id)}">
          <figure class="work-card__thumb" aria-hidden="true">
            <div class="work-card__thumb-bg" style="background: ${escape(p.gradient || "linear-gradient(135deg, #1a1a1a, #2a2a2a)")}"></div>
            <div class="work-card__thumb-grid"></div>
            <div class="work-card__thumb-overlay"></div>
            <span class="work-card__thumb-label mono">${num} · Case Study</span>
            <span class="work-card__thumb-mark">${escape(projectMonogram(p.title))}</span>
            ${p.featured ? '<span class="work-card__thumb-badge mono">Featured</span>' : ""}
          </figure>

          <div class="work-card__body">
            <p class="work-card__num mono">— ${num} / ${escape(p.year || "")}</p>
            <h3 class="work-card__title">${escape(p.title)}</h3>
            ${p.tagline ? `<p class="work-card__tagline">${escape(p.tagline)}</p>` : ""}
            <p class="work-card__stack mono">${escape(stack)}</p>
            <span class="work-card__cta mono">
              <span>Read case study</span>
              <span class="work-card__cta-arrow" aria-hidden="true">→</span>
            </span>
          </div>

          <div class="work-card__year mono" aria-hidden="true">
            <span>${escape(p.year || "")}</span>
          </div>
        </a>`;
        }
      )
      .join("");

    // stagger reveal — each card eases up slightly later than the previous
    const cards = $$(".work-card", list);
    if (window.gsap && window.ScrollTrigger && !PRM) {
      gsap.registerPlugin(window.ScrollTrigger);
      gsap.from(cards, {
        y: 36,
        opacity: 0,
        duration: 0.9,
        stagger: 0.12,
        ease: "power3.out",
        scrollTrigger: { trigger: list, start: "top 85%", once: true },
      });
    } else if (typeof IntersectionObserver !== "undefined") {
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              const idx = cards.indexOf(e.target);
              setTimeout(() => {
                e.target.style.opacity = "1";
                e.target.style.transform = "none";
              }, idx * 120);
              obs.unobserve(e.target);
            }
          });
        },
        { threshold: 0.1 }
      );
      cards.forEach((el) => {
        el.style.opacity = "0";
        el.style.transform = "translateY(30px)";
        el.style.transition = "opacity 800ms ease, transform 800ms ease";
        obs.observe(el);
      });
    }
  }

  /* (kept for backward compat — no-op now that cards are always visible) */
  function attachPreviewFollow(list) {
    const preview = $("#preview");
    if (!preview) return;
    const $num = $(".preview__num", preview);
    const $title = $(".preview__title", preview);
    const $copy = $(".preview__copy", preview);
    const $stack = $(".preview__stack", preview);

    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let visible = false;

    list.addEventListener("pointermove", (e) => {
      target.x = e.clientX + 28;
      target.y = e.clientY + 28;
    });

    list.addEventListener("pointerenter", () => list.classList.add("is-hovering"));
    list.addEventListener("pointerleave", () => {
      list.classList.remove("is-hovering");
      preview.classList.remove("is-visible");
      visible = false;
    });

    $$(".work-row", list).forEach((row, i) => {
      row.addEventListener("pointerenter", () => {
        $num.textContent = String(i + 1).padStart(2, "0") + " · case study";
        $title.textContent = row.dataset.title;
        $copy.textContent = row.dataset.tagline;
        $stack.textContent = row.dataset.stack;
        preview.classList.add("is-visible");
        visible = true;
      });
    });

    // smooth follow loop, edge-clamped
    function loop() {
      if (visible) {
        const w = innerWidth, h = innerHeight;
        const tw = preview.offsetWidth || 340;
        const th = preview.offsetHeight || 220;
        const tx = Math.min(Math.max(target.x, 12), w - tw - 12);
        const ty = Math.min(Math.max(target.y, 12), h - th - 12);
        current.x += (tx - current.x) * 0.1;
        current.y += (ty - current.y) * 0.1;
        preview.style.transform = `translate3d(${current.x}px, ${current.y}px, 0)`;
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  /* =================================================================
     SKILLS — 5 groups per spec, no bars
  ================================================================= */
  const SKILL_GROUPS = [
    {
      title: "Languages",
      items: ["PureScript", "Haskell", "Swift", "Python", "JavaScript", "C/C++", "Java", "SQL"],
    },
    {
      title: "Mobile",
      items: ["SwiftUI", "Xcode", "iOS SDK"],
    },
    {
      title: "Backend",
      items: ["Node.js", "REST APIs", "PostgreSQL", "MySQL"],
    },
    {
      title: "Concepts",
      items: ["Functional Programming", "Data Structures & Algorithms", "Operating Systems", "DBMS", "Computer Networks", "System Design"],
    },
    {
      title: "Tools",
      items: ["Git", "Figma", "Postman", "Airflow", "VS Code"],
    },
  ];

  function renderSkills() {
    const root = $("#skillsRoot");
    if (!root) return;
    root.innerHTML = SKILL_GROUPS.map(
      (g) => `
        <div class="skill-group" data-reveal>
          <div class="skill-group__head">
            <h3>${escape(g.title)}</h3>
            <span class="skill-group__count">${String(g.items.length).padStart(2, "0")} entries</span>
          </div>
          <div class="skill-tags">
            ${g.items.map((s) => `<span class="skill-tag">${escape(s)}</span>`).join("")}
          </div>
        </div>`
    ).join("");

    // stagger fade-in for tags
    if (window.gsap && window.ScrollTrigger && !PRM) {
      gsap.registerPlugin(window.ScrollTrigger);
      $$(".skill-group", root).forEach((group) => {
        const tags = $$(".skill-tag", group);
        gsap.from(tags, {
          y: 14,
          opacity: 0,
          duration: 0.5,
          stagger: 0.04,
          ease: "power2.out",
          scrollTrigger: { trigger: group, start: "top 85%", once: true },
        });
      });
    }
  }

  /* =================================================================
     TICKER — duplicated for seamless loop
  ================================================================= */
  function renderTicker() {
    const a = $("#tickerA");
    const b = $("#tickerB");
    if (!a || !b) return;
    const items = [
      "PureScript", "Haskell", "Swift", "SwiftUI", "JavaScript",
      "Python", "Node.js", "PostgreSQL", "Git", "Figma",
      "Functional Programming", "Type Safety", "Payments at Scale",
    ];
    const html = items.map((s) => `<span class="ticker__item">${escape(s)}</span>`).join("");
    a.innerHTML = html;
    b.innerHTML = html;
  }

  /* =================================================================
     COPY EMAIL + TOAST
  ================================================================= */
  function showToast(msg) {
    const t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("is-visible");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => t.classList.remove("is-visible"), 1800);
  }

  function initCopyEmail() {
    const btn = $("#copyEmail");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const email = btn.dataset.email || "nazishsheikh86@gmail.com";
      try {
        await navigator.clipboard.writeText(email);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = email;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      showToast("Copied to clipboard");
    });
  }

  /* =================================================================
     CONTACT FORM
  ================================================================= */
  function initContactForm() {
    const form = $("#contactForm");
    if (!form) return;
    const status = $("#formStatus");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      status.textContent = "";
      status.className = "cf-status mono";

      if (!form.checkValidity()) {
        status.textContent = "Please fill in all fields.";
        status.classList.add("is-err");
        return;
      }

      const action = form.getAttribute("action") || "";
      if (action.includes("YOUR_FORM_ID")) {
        status.textContent =
          "Form is wired but missing a Formspree ID — see comment in index.html.";
        status.classList.add("is-err");
        return;
      }

      try {
        const res = await fetch(action, {
          method: "POST",
          headers: { Accept: "application/json" },
          body: new FormData(form),
        });
        if (res.ok) {
          form.reset();
          status.textContent = "Sent — I'll get back to you soon.";
          status.classList.add("is-ok");
        } else {
          const json = await res.json().catch(() => ({}));
          status.textContent =
            json?.errors?.[0]?.message ||
            "Something went wrong. Try emailing me directly.";
          status.classList.add("is-err");
        }
      } catch (err) {
        console.error(err);
        status.textContent = "Network error — try emailing me directly.";
        status.classList.add("is-err");
      }
    });
  }

  /* =================================================================
     PROGRESS BAR — sweeps on internal nav
  ================================================================= */
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

  /* =================================================================
     boot
  ================================================================= */
  async function boot() {
    $("#year").textContent = new Date().getFullYear();

    initNav();
    initProgressBar();
    initCopyEmail();
    initContactForm();
    renderTicker();
    renderSkills();

    // wait for vendor scripts to settle, then animate
    requestAnimationFrame(() => {
      initHero();
      initReveals();
    });

    try {
      const [experience, projects] = await Promise.all([
        loadJSON("data/experience.json"),
        loadJSON("data/projects.json"),
      ]);
      renderExperience(experience);
      renderWorkList(projects);
      initReveals();
    } catch (err) {
      console.error(err);
      const list = $("#workList");
      if (list) {
        list.innerHTML = `
          <li style="padding:32px 0; color:var(--text-muted); font-family:var(--mono); font-size:0.82rem;">
            Couldn't load project data. If you opened <code>index.html</code> via
            <code>file://</code>, run a local server: <code>python3 -m http.server</code>
            in this folder.
          </li>`;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
