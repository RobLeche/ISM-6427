// Animated background that matches the current weather.
// Rain is drawn as droplets on a windshield: beads collect, grow, merge and run down the glass.
const WeatherFX = (() => {
  const canvas = document.getElementById("fx");
  const ctx = canvas.getContext("2d");
  const glass = document.getElementById("windshield");
  const gctx = glass.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SCENES = ["rain", "drizzle", "storm", "snow", "clouds", "fog", "sun", "stars"];
  // Add ?weather=rain (or any scene above) to the URL to preview a scene
  const forced = new URLSearchParams(location.search).get("weather");

  let scene = null;
  let particles = [];
  let drops = [];
  let flash = 0;
  let frame = null;
  let w = 0;
  let h = 0;
  let rgb = "255,255,255";
  let cloudAlpha = 0.5;

  const rand = (min, max) => Math.random() * (max - min) + min;
  const color = (alpha) => `rgba(${rgb},${alpha})`;

  // Pre-rendered water droplet: refracted body, dark lower rim, bright highlight
  const dropSprite = (() => {
    const s = document.createElement("canvas");
    s.width = s.height = 64;
    const c = s.getContext("2d");
    c.fillStyle = "rgba(0, 15, 40, 0.22)";
    c.beginPath();
    c.ellipse(32, 35, 27, 27, 0, 0, Math.PI * 2);
    c.fill();
    const body = c.createRadialGradient(26, 22, 2, 32, 32, 28);
    body.addColorStop(0, "rgba(255,255,255,0.65)");
    body.addColorStop(0.35, "rgba(255,255,255,0.1)");
    body.addColorStop(0.8, "rgba(255,255,255,0.18)");
    body.addColorStop(1, "rgba(255,255,255,0.55)");
    c.fillStyle = body;
    c.beginPath();
    c.arc(32, 32, 28, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(0, 20, 50, 0.3)";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(32, 32, 27, 0.15 * Math.PI, 0.85 * Math.PI);
    c.stroke();
    c.fillStyle = "rgba(255,255,255,0.85)";
    c.beginPath();
    c.ellipse(24, 19, 7, 4.5, -0.5, 0, Math.PI * 2);
    c.fill();
    return s;
  })();

  function drawDrop(d) {
    const stretch = d.moving ? 1 + Math.min(d.vy / 6, 0.6) : 1;
    const size = d.r * 2.3;
    gctx.drawImage(dropSprite, d.x - size / 2, d.y - (size * stretch) / 2, size, size * stretch);
  }

  // Pre-rendered cumulus cloud: billows piled into a dome with a flat base,
  // small billows on the upper edges for texture, lit from above and shaded underneath
  function makeCloud(scale) {
    const cw = Math.round(420 * scale);
    const ch = Math.round(260 * scale);
    const s = document.createElement("canvas");
    s.width = cw;
    s.height = ch;
    const c = s.getContext("2d");
    const base = ch * 0.8;

    const puffs = [];
    for (let i = 0; i < 55; i++) {
      const t = rand(0.1, 0.9);
      const dome = Math.pow(Math.sin(Math.PI * t), 1.2);
      const r = cw * rand(0.05, 0.1) * (0.6 + dome * 0.7);
      puffs.push({ x: t * cw, y: base - r * 0.5 - rand(0, dome * ch * 0.42), r });
    }
    for (const p of puffs.slice()) {
      for (let i = 0; i < 2; i++) {
        const a = rand(-Math.PI * 0.9, -Math.PI * 0.1);
        const r = p.r * rand(0.3, 0.5);
        puffs.push({ x: p.x + Math.cos(a) * p.r * 0.8, y: p.y + Math.sin(a) * p.r * 0.8, r });
      }
    }

    const softCircle = (x, y, r, rgb, inner, alpha = 1) => {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${rgb},${alpha})`);
      g.addColorStop(inner, `rgba(${rgb},${alpha})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    };

    // One smooth body: same-colored soft puffs blend without visible outlines
    for (const p of puffs) softCircle(p.x, p.y, p.r, "212,221,236", 0.6);

    // Sunlit tops of each billow, lowest first so upper billows stand out
    c.globalCompositeOperation = "source-atop";
    puffs.sort((a, b) => b.y - a.y);
    for (const p of puffs) softCircle(p.x - p.r * 0.2, p.y - p.r * 0.35, p.r * 0.95, "255,255,255", 0.25, 0.9);
    c.globalCompositeOperation = "source-over";

    // Flatten and soften the base
    c.globalCompositeOperation = "destination-out";
    const cut = c.createLinearGradient(0, base - ch * 0.04, 0, base + ch * 0.06);
    cut.addColorStop(0, "rgba(0,0,0,0)");
    cut.addColorStop(1, "rgba(0,0,0,1)");
    c.fillStyle = cut;
    c.fillRect(0, base - ch * 0.04, cw, ch);

    // Shadowed underside
    c.globalCompositeOperation = "source-atop";
    const under = c.createLinearGradient(0, base - ch * 0.5, 0, base);
    under.addColorStop(0, "rgba(120,135,165,0)");
    under.addColorStop(1, "rgba(120,135,165,0.55)");
    c.fillStyle = under;
    c.fillRect(0, 0, cw, ch);
    c.globalCompositeOperation = "source-over";
    return s;
  }

  function sceneFor(code, isDay) {
    if (SCENES.includes(forced)) return forced;
    if (code >= 95) return "storm";
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return code <= 55 ? "drizzle" : "rain";
    if (code === 45 || code === 48) return "fog";
    if (code === 2 || code === 3) return "clouds";
    return isDay ? "sun" : "stars";
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    w = window.innerWidth;
    h = window.innerHeight;
    for (const [c, context] of [[canvas, ctx], [glass, gctx]]) {
      c.width = w * dpr;
      c.height = h * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  const isWet = () => scene === "rain" || scene === "drizzle" || scene === "storm";

  function spawn() {
    drops = [];
    const make = {
      rain: () => ({ x: rand(0, w), y: rand(-h, h), len: rand(14, 24), speed: rand(14, 20) }),
      drizzle: () => ({ x: rand(0, w), y: rand(-h, h), len: rand(8, 12), speed: rand(8, 11) }),
      storm: () => ({ x: rand(0, w), y: rand(-h, h), len: rand(18, 28), speed: rand(18, 24) }),
      snow: () => ({ x: rand(0, w), y: rand(-h, h), r: rand(1.5, 4), speed: rand(0.6, 1.6), phase: rand(0, 6.28) }),
      clouds: () => {
        const depth = rand(0.5, 1.3);
        return { x: rand(-300, w), y: rand(-40, h * 0.75), depth, img: makeCloud(depth) };
      },
      fog: () => ({ x: rand(-w, w), y: rand(0, h), width: rand(w * 0.8, w * 1.6), speed: rand(0.2, 0.5) }),
      stars: () => ({ x: rand(0, w), y: rand(0, h * 0.7), r: rand(0.6, 1.8), phase: rand(0, 6.28) }),
      sun: () => ({}),
    }[scene];
    const count = { rain: 50, drizzle: 25, storm: 90, snow: 120, clouds: 9, fog: 6, stars: 90, sun: 1 }[scene];
    particles = Array.from({ length: count }, make);
    if (scene === "clouds") particles.sort((a, b) => a.depth - b.depth);

    // Start the windshield already partly wet
    if (isWet()) for (let i = 0; i < 160; i++) addDrop(rand(0.8, 3.5));
  }

  function addDrop(r, x = rand(0, w), y = rand(0, h)) {
    drops.push({ x, y, r, vy: 0, moving: false, travelled: 0 });
  }

  function updateWindshield() {
    const rate = { drizzle: 1, rain: 3, storm: 5 }[scene];
    for (let i = 0; i < rate; i++) addDrop(Math.random() < 0.85 ? rand(0.8, 3) : rand(4, 8));

    // Keep the glass from filling up forever: drop the oldest still beads
    if (drops.length > 450) drops.splice(0, drops.length - 450);

    for (const d of drops) {
      if (d.dead) continue;
      if (!d.moving) {
        if (d.r > 5.5 && Math.random() < 0.006) { d.moving = true; d.vy = 0.3; }
        continue;
      }
      d.vy = Math.min(d.vy + 0.04 * (d.r / 6), d.r * 0.7);
      d.y += d.vy;
      d.x += rand(-0.4, 0.4);
      d.travelled += d.vy;

      // Leave a trail of tiny beads behind the running drop
      if (d.travelled > 10) {
        d.travelled = 0;
        if (Math.random() < 0.6) addDrop(rand(0.6, d.r * 0.35), d.x + rand(-1, 1), d.y - d.r * 1.2);
        d.r = Math.max(3, d.r - 0.04);
      }

      // Absorb beads in its path
      for (const o of drops) {
        if (o === d || o.dead || o.moving) continue;
        const dx = o.x - d.x;
        const dy = o.y - d.y;
        if (dx * dx + dy * dy < (d.r + o.r) ** 2 && o.y > d.y - d.r) {
          o.dead = true;
          d.r = Math.min(11, Math.sqrt(d.r * d.r + o.r * o.r * 0.6));
        }
      }
      if (d.y - d.r > h) d.dead = true;
    }
    drops = drops.filter((d) => !d.dead);
  }

  function draw(t) {
    // Re-read each frame so effects follow theme changes
    const style = getComputedStyle(document.documentElement);
    rgb = style.getPropertyValue("--fx-rgb").trim() || rgb;
    cloudAlpha = parseFloat(style.getPropertyValue("--fx-cloud-alpha")) || cloudAlpha;
    ctx.clearRect(0, 0, w, h);
    gctx.clearRect(0, 0, w, h);

    if (isWet()) {
      // Faint rain falling in the distance
      ctx.strokeStyle = color(scene === "drizzle" ? 0.15 : 0.22);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const p of particles) {
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.len * 0.2, p.y + p.len);
        p.y += p.speed;
        p.x -= p.speed * 0.2;
        if (p.y > h) { p.y = rand(-40, 0); p.x = rand(0, w + 100); }
      }
      ctx.stroke();

      if (!reduceMotion) updateWindshield();
      for (const d of drops) drawDrop(d);

      if (scene === "storm") {
        if (flash <= 0 && Math.random() < 0.004) flash = 1;
        if (flash > 0) {
          ctx.fillStyle = `rgba(255,255,255,${flash * 0.5})`;
          ctx.fillRect(0, 0, w, h);
          flash -= 0.05;
        }
      }
    } else if (scene === "snow") {
      ctx.fillStyle = color(0.85);
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x + Math.sin(t / 1000 + p.phase) * 20, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        p.y += p.speed;
        if (p.y > h + 5) { p.y = -5; p.x = rand(0, w); }
      }
    } else if (scene === "clouds") {
      ctx.globalAlpha = cloudAlpha;
      for (const p of particles) {
        ctx.drawImage(p.img, p.x, p.y);
        p.x += 0.25 * p.depth;
        if (p.x > w) p.x = -p.img.width;
      }
      ctx.globalAlpha = 1;
    } else if (scene === "fog") {
      for (const p of particles) {
        const g = ctx.createLinearGradient(0, p.y - 60, 0, p.y + 60);
        g.addColorStop(0, color(0));
        g.addColorStop(0.5, color(0.25));
        g.addColorStop(1, color(0));
        ctx.fillStyle = g;
        ctx.fillRect(p.x, p.y - 60, p.width, 120);
        p.x += p.speed;
        if (p.x > w) p.x = -p.width;
      }
    } else if (scene === "stars") {
      for (const p of particles) {
        ctx.fillStyle = color(0.4 + 0.4 * Math.sin(t / 800 + p.phase));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (scene === "sun") {
      const r = Math.min(w, h) * 0.45 + Math.sin(t / 1500) * 12;
      const g = ctx.createRadialGradient(w * 0.85, h * 0.1, 0, w * 0.85, h * 0.1, r);
      g.addColorStop(0, "rgba(255, 220, 120, 0.55)");
      g.addColorStop(1, "rgba(255, 220, 120, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    if (!reduceMotion) frame = requestAnimationFrame(draw);
  }

  function set(code, isDay) {
    const next = sceneFor(code, isDay);
    if (next === scene) return;
    scene = next;
    cancelAnimationFrame(frame);
    spawn();
    draw(0);
  }

  resize();
  window.addEventListener("resize", () => {
    resize();
    if (scene) { spawn(); if (reduceMotion) draw(0); }
  });

  return { set };
})();
