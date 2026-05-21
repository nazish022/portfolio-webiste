/* =================================================================
   bg.js — shared Three.js background
   Three layers:
     1. Dim particle field  — ambient drift, no cursor interaction
     2. Constellation lines — faint segments between nearby particles
                              fade in/out as particles drift
     3. Wireframe shapes    — 3 large slow-rotating geometries in depth
   FPS-capped to ~30 for perf. Renders pause when the tab is hidden.
================================================================= */

(() => {
  "use strict";

  const canvas = document.getElementById("bg-canvas");
  if (!canvas || typeof THREE === "undefined") return;

  const PRM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = matchMedia("(max-width: 760px)").matches;

  /* ---------- knobs ---------- */
  const PARTICLE_COUNT = isMobile ? 50 : 90;
  const LINK_DIST = 1.8;          // world-units: max distance to draw a link
  const LINK_DIST_SQ = LINK_DIST * LINK_DIST;
  const MAX_LINKS = isMobile ? 80 : 200;

  const COLOR = 0xc9a96e; // warm gold to match palette

  // particle field
  const D_SIZE = 0.045;
  const D_OPACITY = 0.55;
  const D_SPRING = 0.012;
  const D_DAMP = 0.94;

  // wireframe shapes
  const SHAPE_OPACITY = 0.05;

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

  /* ---------- particle field (drives both points + constellation) ---------- */
  const dPositions = new Float32Array(PARTICLE_COUNT * 3);
  const dOrigins = new Float32Array(PARTICLE_COUNT * 3);
  const dVel = new Float32Array(PARTICLE_COUNT * 3);
  const dDrift = new Float32Array(PARTICLE_COUNT * 2);

  function seedDots() {
    const { w, h } = viewportAt(0);
    const spread = 1.15;
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
      dDrift[i * 2 + 1] = 0.0005 + Math.random() * 0.0009;
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

  /* ---------- constellation lines ---------- */
  // Preallocate vertex + color buffers for MAX_LINKS segments.
  // Each segment uses 2 verts × 3 floats. We rewrite the slice
  // every frame; unused tail vertices get zeroed out.
  const linePositions = new Float32Array(MAX_LINKS * 2 * 3);
  const lineColors = new Float32Array(MAX_LINKS * 2 * 3);
  const lineGeom = new THREE.BufferGeometry();
  lineGeom.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
  lineGeom.setAttribute("color", new THREE.BufferAttribute(lineColors, 3));
  const lineMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const constellation = new THREE.LineSegments(lineGeom, lineMat);
  scene.add(constellation);

  // gold rgb (0..1) for line vertex colors
  const COLOR_R = 0xc9 / 255;
  const COLOR_G = 0xa9 / 255;
  const COLOR_B = 0x6e / 255;

  /* ---------- wireframe shapes (depth) ---------- */
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
    shapes.push({ mesh: ico, rot: { x: 0.0005, y: 0.0007 } });

    const knot = new THREE.Mesh(
      new THREE.TorusKnotGeometry(1.4, 0.32, 64, 8),
      new THREE.MeshBasicMaterial(shapeMat)
    );
    knot.position.set(3.8, -1.4, -5);
    scene.add(knot);
    shapes.push({ mesh: knot, rot: { x: 0.0006, y: 0.0004 } });

    const octa = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.2, 0),
      new THREE.MeshBasicMaterial(shapeMat)
    );
    octa.position.set(0.4, -2.6, -7);
    scene.add(octa);
    shapes.push({ mesh: octa, rot: { x: 0.0003, y: 0.0005 } });
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
      dGeom.attributes.position.needsUpdate = true;
    });
  });

  /* ---------- visibility — pause when hidden ---------- */
  let visible = !document.hidden;
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; });

  /* ---------- animation loop — capped to ~30fps ---------- */
  let frame = 0;
  let lastT = 0;
  const FRAME_MS = 1000 / 30;

  function tick(now) {
    if (!visible) {
      if (!PRM) requestAnimationFrame(tick);
      return;
    }
    const dt = now - lastT;
    if (dt < FRAME_MS) {
      if (!PRM) requestAnimationFrame(tick);
      return;
    }
    lastT = now - (dt % FRAME_MS);
    frame++;
    const t = frame;

    /* ---- particles: gentle ambient drift back to origin ---- */
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const phase = dDrift[i * 2];
      const speed = dDrift[i * 2 + 1];
      dVel[i3]     += Math.sin(t * speed + phase) * 0.0008;
      dVel[i3 + 1] += Math.cos(t * speed + phase) * 0.0008;

      dVel[i3]     += (dOrigins[i3]     - dPositions[i3])     * D_SPRING;
      dVel[i3 + 1] += (dOrigins[i3 + 1] - dPositions[i3 + 1]) * D_SPRING;

      dVel[i3]     *= D_DAMP;
      dVel[i3 + 1] *= D_DAMP;

      dPositions[i3]     += dVel[i3];
      dPositions[i3 + 1] += dVel[i3 + 1];
    }
    dGeom.attributes.position.needsUpdate = true;

    /* ---- constellation: link nearby particles, alpha by distance ---- */
    let lineCount = 0;
    for (let i = 0; i < PARTICLE_COUNT && lineCount < MAX_LINKS; i++) {
      const i3 = i * 3;
      const ix = dPositions[i3];
      const iy = dPositions[i3 + 1];
      const iz = dPositions[i3 + 2];
      for (let j = i + 1; j < PARTICLE_COUNT && lineCount < MAX_LINKS; j++) {
        const j3 = j * 3;
        const dx = ix - dPositions[j3];
        const dy = iy - dPositions[j3 + 1];
        const dSq = dx * dx + dy * dy;
        if (dSq > LINK_DIST_SQ) continue;

        const k = lineCount * 6; // 2 verts × 3 floats
        linePositions[k]     = ix;
        linePositions[k + 1] = iy;
        linePositions[k + 2] = iz;
        linePositions[k + 3] = dPositions[j3];
        linePositions[k + 4] = dPositions[j3 + 1];
        linePositions[k + 5] = dPositions[j3 + 2];

        // alpha fades quadratically with distance — looks soft
        const fade = 1 - dSq / LINK_DIST_SQ;
        const a = fade * fade;
        // bake alpha into the color (multiplied by opacity in material)
        const r = COLOR_R * a;
        const g = COLOR_G * a;
        const b = COLOR_B * a;
        lineColors[k]     = r;
        lineColors[k + 1] = g;
        lineColors[k + 2] = b;
        lineColors[k + 3] = r;
        lineColors[k + 4] = g;
        lineColors[k + 5] = b;

        lineCount++;
      }
    }
    // zero unused tail so leftover segments aren't drawn at origin
    for (let k = lineCount * 6; k < linePositions.length; k++) {
      linePositions[k] = 0;
      lineColors[k] = 0;
    }
    lineGeom.setDrawRange(0, lineCount * 2);
    lineGeom.attributes.position.needsUpdate = true;
    lineGeom.attributes.color.needsUpdate = true;

    /* ---- shapes ---- */
    for (const s of shapes) {
      s.mesh.rotation.x += s.rot.x;
      s.mesh.rotation.y += s.rot.y;
    }

    renderer.render(scene, camera);
    if (!PRM) requestAnimationFrame(tick);
  }

  renderer.render(scene, camera);
  if (!PRM) requestAnimationFrame(tick);
})();
