// Animated background that matches the current weather (rain, snow, storm, clouds, fog, clear)
const WeatherFX = (() => {
  const canvas = document.getElementById("fx");
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let scene = null;
  let particles = [];
  let flash = 0;
  let frame = null;
  let w = 0;
  let h = 0;

  const rand = (min, max) => Math.random() * (max - min) + min;

  function sceneFor(code, isDay) {
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
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  let rgb = "255,255,255";
  const color = (alpha) => `rgba(${rgb},${alpha})`;

  function spawn() {
    const make = {
      rain: () => ({ x: rand(0, w), y: rand(-h, h), len: rand(14, 24), speed: rand(14, 20) }),
      drizzle: () => ({ x: rand(0, w), y: rand(-h, h), len: rand(8, 12), speed: rand(8, 11) }),
      storm: () => ({ x: rand(0, w), y: rand(-h, h), len: rand(18, 28), speed: rand(18, 24) }),
      snow: () => ({ x: rand(0, w), y: rand(-h, h), r: rand(1.5, 4), speed: rand(0.6, 1.6), phase: rand(0, 6.28) }),
      clouds: () => ({ x: rand(-200, w), y: rand(0, h * 0.6), r: rand(90, 180), speed: rand(0.15, 0.4) }),
      fog: () => ({ x: rand(-w, w), y: rand(0, h), width: rand(w * 0.8, w * 1.6), speed: rand(0.2, 0.5) }),
      stars: () => ({ x: rand(0, w), y: rand(0, h * 0.7), r: rand(0.6, 1.8), phase: rand(0, 6.28) }),
      sun: () => ({}),
    }[scene];
    const count = { rain: 140, drizzle: 70, storm: 200, snow: 120, clouds: 7, fog: 6, stars: 90, sun: 1 }[scene];
    particles = Array.from({ length: count }, make);
  }

  function draw(t) {
    // Re-read each frame so particles follow theme changes
    rgb = getComputedStyle(document.documentElement).getPropertyValue("--fx-rgb").trim() || rgb;
    ctx.clearRect(0, 0, w, h);

    if (scene === "rain" || scene === "drizzle" || scene === "storm") {
      ctx.strokeStyle = color(scene === "drizzle" ? 0.35 : 0.5);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const p of particles) {
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.len * 0.2, p.y + p.len);
        p.y += p.speed;
        p.x -= p.speed * 0.2;
        if (p.y > h) { p.y = rand(-40, 0); p.x = rand(0, w + 100); }
      }
      ctx.stroke();

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
      for (const p of particles) {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, color(0.35));
        g.addColorStop(1, color(0));
        ctx.fillStyle = g;
        ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        p.x += p.speed;
        if (p.x - p.r > w) p.x = -p.r;
      }
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
