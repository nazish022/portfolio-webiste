/* =================================================================
   bg.js — shared Three.js background
   Three layers, composed in a single scene:
     1. Dim particle field   — 160 small gold dots, cursor-repelled, spring-back
     2. Watery bubble field  — ~60 soft sprite "bubbles" rising upward,
                               gently wobbling, cursor pushes them aside
     3. Wireframe shapes     — 3 large slow-rotating geometries deep in space
   Cursor world-position is smoothed (lerp) so the influence flows
   like a finger trailing through water rather than snapping to the mouse.
================================================================= */

(() => {
  "use strict";

  const canvas = document.getElementById("bg-canvas");
  if (!canvas || typeof THREE === "undefined") return;

  const PRM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = matchMedia("(max-width: 760px)").matches;

  /* ---------- knobs ---------- */
  const PARTICLE_COUNT = isMobile ? 90 : 160;
  const BUBBLE_COUNT = isMobile ? 28 : 60;

  const COLOR = 0xc9a96e;

  // dim dot field
  const D_SIZE = 0.055;
  const D_OPACITY = 0.26;
  const D_REPEL = 1.5;          // world units
  const D_REPEL_STRENGTH = 0.07;
  const D_SPRING = 0.02;        // per spec
  const D_DAMP = 0.93;

  // bubble layer
  const B_REPEL = 2.4;          // bigger reach for water feel
  const B_REPEL_STRENGTH = 0.085;
  const B_PUSH_DECAY = 0.93;
  const B_RISE_MIN = 0.0035;
  const B_RISE_MAX = 0.014;

  // wireframe shapes
  const SHAPE_OPACITY = 0.07;

  /* ---------- scene ---------- */
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 100);
  camera.position.z = 5;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.setClearColor(0x000000, 0);

  /* ---------- viewport math ---------- */
  function viewportAt(z = 0) {
    const dist = Math.abs(camera.position.z - z);
    const h = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist;
    const w = h * camera.aspect;
    return { w, h };
  }

  /* ---------- bubble sprite (canvas-generated) ----------
     a soft ring + faint inner fill + small upper-left highlight.
     looks like a glassy bubble at any size.
  -------------------------------------------------------- */
  function makeBubbleTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d");

    // soft ring (membrane)
    const ring = ctx.createRadialGradient(64, 64, 22, 64, 64, 60);
    ring.addColorStop(0.0, "rgba(201, 169, 110, 0)");
    ring.addColorStop(0.55, "rgba(201, 169, 110, 0.55)");
    ring.addColorStop(0.85, "rgba(229, 200, 140, 0.28)");
    ring.addColorStop(1.0, "rgba(201, 169, 110, 0)");
    ctx.fillStyle = ring;
    ctx.fillRect(0, 0, 128, 128);

    // very faint inner fill — gives the bubble a body
    const inner = ctx.createRadialGradient(64, 64, 0, 64, 64, 50);
    inner.addColorStop(0.0, "rgba(201, 169, 110, 0.10)");
    inner.addColorStop(1.0, "rgba(201, 169, 110, 0)");
    ctx.fillStyle = inner;
    ctx.fillRect(0, 0, 128, 128);

    // upper-left highlight — sells the "glassy" feel
    const hl = ctx.createRadialGradient(46, 42, 0, 46, 42, 22);
    hl.addColorStop(0.0, "rgba(255, 240, 210, 0.6)");
    hl.addColorStop(1.0, "rgba(255, 240, 210, 0)");
    ctx.fillStyle = hl;
    ctx.fillRect(0, 0, 128, 128);

    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }
  const bubbleTex = makeBubbleTexture();

  /* ---------- 1. dim particle field ---------- */
  const dPositions = new Float32Array(PARTICLE_COUNT * 3);
  const dOrigins = new Float32Array(PARTICLE_COUNT * 3);
  const dVel = new Float32Array(PARTICLE_COUNT * 3);
  const dDrift = new Float32Array(PARTICLE_COUNT * 2);

  function seedDots() {
    const { w, h } = viewportAt(0);
    const spread = 1.2;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const x = (Math.random() - 0.5) * w * spread;
      const y = (Math.random() - 0.5) * h * spread;
      const z = (Math.random() - 0.5) * 0.6;
      dOrigins[i3] = dPositions[i3] = x;
      dOrigins[i3 + 1] = dPositions[i3 + 1] = y;
      dOrigins[i3 + 2] = dPositions[i3 + 2] = z;
      dVel[i3] = dVel[i3 + 1] = dVel[i3 + 2] = 0;
      dDrift[i * 2] = Math.random() * Math.PI * 2;
      dDrift[i * 2 + 1] = 0.0006 + Math.random() * 0.0008;
    }
  }
  seedDots();

  const dGeom = new THREE.BufferGeometry();
  dGeom.setAttribute("position", new THREE.BufferAttribute(dPositions, 3));
  const dMat = new THREE.PointsMaterial({
    color: COLOR,
    size: D_SIZE,
    sizeAttenuation: true,
    transparent: true,
    opacity: D_OPACITY,
    depthWrite: false,
  });
  const dots = new THREE.Points(dGeom, dMat);
  scene.add(dots);

  /* ---------- 2. bubble field — rising + wobble + push ---------- */
  // we keep bubble metadata in a parallel array, then write final
  // x,y,z into the BufferAttribute every frame.
  const bPositions = new Float32Array(BUBBLE_COUNT * 3);
  const bubbles = []; // metadata

  function makeBubble(spawnAtBottom) {
    const { w, h } = viewportAt(0);
    return {
      baseX: (Math.random() - 0.5) * w * 1.2,
      // when spawning fresh, distribute throughout the column;
      // when recycling, start just below the visible bottom
      y: spawnAtBottom ? -h * 0.55 - Math.random() * 0.6 : (Math.random() - 0.5) * h,
      z: -0.4 + Math.random() * 1.4, // varied depth → varied apparent size
      rise: B_RISE_MIN + Math.random() * (B_RISE_MAX - B_RISE_MIN),
      // ambient horizontal wobble
      wobAmp: 0.08 + Math.random() * 0.22,
      wobFreq: 0.0007 + Math.random() * 0.0014,
      wobPhase: Math.random() * Math.PI * 2,
      // cursor-induced offset (decays back to 0)
      pushX: 0,
      pushY: 0,
    };
  }
  for (let i = 0; i < BUBBLE_COUNT; i++) {
    bubbles.push(makeBubble(false));
  }

  const bGeom = new THREE.BufferGeometry();
  bGeom.setAttribute("position", new THREE.BufferAttribute(bPositions, 3));
  const bMat = new THREE.PointsMaterial({
    map: bubbleTex,
    size: 0.55,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.62,
    alphaTest: 0.001,
    depthWrite: false,
    // additive: slight bloom where bubbles overlap — looks like light through water
    blending: THREE.AdditiveBlending,
  });
  const bubblePoints = new THREE.Points(bGeom, bMat);
  scene.add(bubblePoints);

  /* ---------- 3. wireframe shapes (depth) ---------- */
  const shapeMat = {
    color: COLOR,
    wireframe: true,
    transparent: true,
    opacity: SHAPE_OPACITY,
    depthWrite: false,
  };
  const shapes = [];
  if (!isMobile) {
    const ico = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.8, 1),
      new THREE.MeshBasicMaterial(shapeMat)
    );
    ico.position.set(-3.6, 1.6, -4);
    scene.add(ico);
    shapes.push({ mesh: ico, rot: { x: 0.0006, y: 0.0008 } });

    const knot = new THREE.Mesh(
      new THREE.TorusKnotGeometry(1.4, 0.32, 64, 8),
      new THREE.MeshBasicMaterial(shapeMat)
    );
    knot.position.set(3.8, -1.4, -5);
    scene.add(knot);
    shapes.push({ mesh: knot, rot: { x: 0.0008, y: 0.0005 } });

    const octa = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.2, 0),
      new THREE.MeshBasicMaterial(shapeMat)
    );
    octa.position.set(0.4, -2.6, -7);
    scene.add(octa);
    shapes.push({ mesh: octa, rot: { x: 0.0004, y: 0.0006 } });
  }

  /* ---------- pointer → smoothed world position ---------- */
  const ndc = new THREE.Vector2(-10, -10);
  const cursorTarget = new THREE.Vector3();
  const cursorWorld = new THREE.Vector3(0, 9999, 0);
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  let pointerActive = false;

  addEventListener("pointermove", (e) => {
    ndc.x = (e.clientX / innerWidth) * 2 - 1;
    ndc.y = -(e.clientY / innerHeight) * 2 + 1;
    pointerActive = true;
  }, { passive: true });
  addEventListener("pointerleave", () => { pointerActive = false; });
  addEventListener("blur", () => { pointerActive = false; });

  function updateCursor() {
    if (!pointerActive) {
      // smoothly retreat the influence point off-screen so particles unwind
      cursorWorld.lerp(new THREE.Vector3(9999, 9999, 0), 0.05);
      return;
    }
    ray.setFromCamera(ndc, camera);
    ray.ray.intersectPlane(plane, cursorTarget);
    // lerp the *influence point* toward the actual cursor — gives water-like trail
    cursorWorld.lerp(cursorTarget, 0.18);
  }

  /* ---------- resize ---------- */
  let resizeRaf = 0;
  addEventListener("resize", () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight, false);
      seedDots();
      // re-seed bubbles too so they fill the new column width
      for (let i = 0; i < BUBBLE_COUNT; i++) bubbles[i] = makeBubble(false);
      dGeom.attributes.position.needsUpdate = true;
    });
  });

  /* ---------- animation loop ---------- */
  let frame = 0;
  function tick() {
    frame++;
    updateCursor();
    const t = frame;

    /* ---- dim dots ---- */
    {
      const radSq = D_REPEL * D_REPEL;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const px = dPositions[i3];
        const py = dPositions[i3 + 1];

        if (pointerActive) {
          const dx = px - cursorWorld.x;
          const dy = py - cursorWorld.y;
          const dSq = dx * dx + dy * dy;
          if (dSq < radSq && dSq > 0.0001) {
            const d = Math.sqrt(dSq);
            const f = (1 - d / D_REPEL) * D_REPEL_STRENGTH;
            dVel[i3] += (dx / d) * f;
            dVel[i3 + 1] += (dy / d) * f;
          }
        }

        const phase = dDrift[i * 2];
        const speed = dDrift[i * 2 + 1];
        dVel[i3] += Math.sin(t * speed + phase) * 0.0009;
        dVel[i3 + 1] += Math.cos(t * speed + phase) * 0.0009;

        dVel[i3] += (dOrigins[i3] - px) * D_SPRING;
        dVel[i3 + 1] += (dOrigins[i3 + 1] - py) * D_SPRING;

        dVel[i3] *= D_DAMP;
        dVel[i3 + 1] *= D_DAMP;

        dPositions[i3] += dVel[i3];
        dPositions[i3 + 1] += dVel[i3 + 1];
      }
      dGeom.attributes.position.needsUpdate = true;
    }

    /* ---- bubbles: rise, wobble, push, recycle ---- */
    {
      const { h } = viewportAt(0);
      const topEdge = h * 0.55 + 0.4;
      const bottomEdge = -h * 0.55 - 0.6;
      const radSq = B_REPEL * B_REPEL;

      for (let i = 0; i < BUBBLE_COUNT; i++) {
        const b = bubbles[i];

        // rise
        b.y += b.rise;

        // ambient horizontal wobble — gives the floaty feel
        const wobble = Math.sin(t * b.wobFreq + b.wobPhase) * b.wobAmp;
        const baseX = b.baseX + wobble;
        const baseY = b.y;

        // cursor displacement (additive, decaying — like a brief shove)
        if (pointerActive) {
          const dx = baseX + b.pushX - cursorWorld.x;
          const dy = baseY + b.pushY - cursorWorld.y;
          const dSq = dx * dx + dy * dy;
          if (dSq < radSq && dSq > 0.0001) {
            const d = Math.sqrt(dSq);
            const f = (1 - d / B_REPEL) * B_REPEL_STRENGTH;
            b.pushX += (dx / d) * f;
            b.pushY += (dy / d) * f;
          }
        }
        b.pushX *= B_PUSH_DECAY;
        b.pushY *= B_PUSH_DECAY;

        const finalX = baseX + b.pushX;
        const finalY = baseY + b.pushY;

        const i3 = i * 3;
        bPositions[i3] = finalX;
        bPositions[i3 + 1] = finalY;
        bPositions[i3 + 2] = b.z;

        // recycle once it leaves the top
        if (b.y > topEdge) {
          const fresh = makeBubble(true);
          // keep z roughly stable for visual continuity
          fresh.z = b.z;
          bubbles[i] = fresh;
        }
      }
      bGeom.attributes.position.needsUpdate = true;
    }

    /* ---- shapes ---- */
    for (const s of shapes) {
      s.mesh.rotation.x += s.rot.x;
      s.mesh.rotation.y += s.rot.y;
    }

    renderer.render(scene, camera);
    if (!PRM) requestAnimationFrame(tick);
  }

  // initial render even under reduced-motion
  renderer.render(scene, camera);
  if (!PRM) requestAnimationFrame(tick);
})();
