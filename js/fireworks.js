/* Sharon 80 — July 4th fireworks celebration engine.
 * -------------------------------------------------------------
 * Canvas-based particle system. Score-tiered escalation from
 * humble firecrackers all the way to a full grand finale.
 *
 * Public API:
 *   fireworks.init(canvasEl)
 *   fireworks.celebrate(scoreCount)  -> returns tier { name, min, max }
 *   fireworks.tierFor(scoreCount)    -> peek the tier without firing
 * -------------------------------------------------------------
 */

let canvas = null;
let ctx = null;
let particles = [];
let rafId = null;
let running = false;

const TIERS = [
  { min: 1,   max: 9,   name: "FIRECRACKER",     fn: fireFirecracker },
  { min: 10,  max: 19,  name: "ROMAN CANDLE",    fn: fireRomanCandle },
  { min: 20,  max: 29,  name: "AERIAL BURST",    fn: fireAerialBurst },
  { min: 30,  max: 49,  name: "BIG SHELL",       fn: fireBigShell },
  { min: 50,  max: 99,  name: "CHRYSANTHEMUM",   fn: fireChrysanthemum },
  { min: 100, max: 149, name: "PEONY + WILLOW",  fn: firePeonyWillow },
  { min: 150, max: 199, name: "PALM FINALE",     fn: firePalmFinale },
  { min: 200, max: 9999, name: "GRAND FINALE",   fn: fireGrandFinale }
];

const FLAG_PALETTE = ["#D42F2F", "#FFFDF7", "#2FBFB6", "#E6B422", "#FF6BCB"];
const HOT_PALETTE  = ["#FF6BCB", "#FFDD5C", "#FF9E4E", "#D42F2F", "#FFB84A"];
const COOL_PALETTE = ["#6BE0FF", "#6DFF9E", "#8BB4FF", "#2FBFB6", "#B389FF"];
const ALL_PALETTE  = [...FLAG_PALETTE, ...HOT_PALETTE, ...COOL_PALETTE];

export function init(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext("2d");
  resize();
  window.addEventListener("resize", resize);
  if (!running) {
    running = true;
    loop();
  }
}

function resize() {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function tierFor(score) {
  return TIERS.find(t => score >= t.min && score <= t.max) || TIERS[0];
}

export function celebrate(score, scale = 1) {
  if (!canvas) return null;
  const tier = tierFor(score);
  tier.fn(score, scale);
  return tier;
}

/* Milestone-based celebration (every 10 correct answers).
 * milestone is 1..20 — each successive milestone maps to a bigger tier
 * AND applies an escalating scale multiplier so #20 dwarfs #1.
 * Public API: fireworks.celebrateMilestone(1..20).
 */
const MILESTONE_MAP = [
  { tierIndex: 0, scale: 1.0  }, // M1 (score 10)  — firecracker
  { tierIndex: 1, scale: 1.0  }, // M2 (20)        — roman candle
  { tierIndex: 2, scale: 1.0  }, // M3 (30)        — aerial burst
  { tierIndex: 3, scale: 1.0  }, // M4 (40)        — big shell
  { tierIndex: 3, scale: 1.4  }, // M5 (50)        — big shell +
  { tierIndex: 4, scale: 1.0  }, // M6 (60)        — chrysanthemum
  { tierIndex: 4, scale: 1.35 }, // M7 (70)        — chrysanthemum +
  { tierIndex: 5, scale: 1.0  }, // M8 (80)        — peony + willow
  { tierIndex: 5, scale: 1.3  }, // M9 (90)        — peony + willow +
  { tierIndex: 5, scale: 1.6  }, // M10 (100)      — peony + willow ++
  { tierIndex: 6, scale: 1.0  }, // M11 (110)      — palm finale
  { tierIndex: 6, scale: 1.2  }, // M12 (120)      — palm finale +
  { tierIndex: 6, scale: 1.4  }, // M13 (130)      — palm finale ++
  { tierIndex: 6, scale: 1.65 }, // M14 (140)      — palm finale +++
  { tierIndex: 7, scale: 0.45 }, // M15 (150)      — grand finale (small)
  { tierIndex: 7, scale: 0.65 }, // M16 (160)      — grand finale +
  { tierIndex: 7, scale: 0.85 }, // M17 (170)      — grand finale ++
  { tierIndex: 7, scale: 1.05 }, // M18 (180)      — grand finale +++
  { tierIndex: 7, scale: 1.3  }, // M19 (190)      — grand finale ++++
  { tierIndex: 7, scale: 1.6  }  // M20 (200)      — GRAND FINALE MAX
];

export function celebrateMilestone(milestone) {
  if (!canvas) return null;
  const idx = Math.max(0, Math.min(19, milestone - 1));
  const map = MILESTONE_MAP[idx];
  const tier = TIERS[map.tierIndex];
  tier.fn(milestone * 10, map.scale);
  return { ...tier, milestone, scale: map.scale };
}

/* ---------- Particle helpers ---------- */

function addBurst({ x, y, count, color, speed, life, gravity = 0.05, drag = 0.98, size = 2, trail = false }) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = speed * (0.45 + Math.random() * 0.9);
    particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life,
      maxLife: life,
      color: typeof color === "function" ? color() : color,
      gravity,
      drag,
      size,
      trail,
      trailPath: []
    });
  }
}

function randColor(palette) {
  return palette[Math.floor(Math.random() * palette.length)];
}

/* ---------- Tier implementations ---------- */

const sc = (v, scale) => Math.max(1, Math.round(v * scale));

function fireFirecracker(score, scale = 1) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const pops = sc(3, scale);
  for (let i = 0; i < pops; i++) {
    setTimeout(() => {
      const x = 60 + Math.random() * (w - 120);
      const y = h - 60 - Math.random() * 80;
      addBurst({
        x, y,
        count: sc(24, scale),
        color: () => randColor(FLAG_PALETTE),
        speed: 2.6 * (0.9 + 0.1 * scale),
        life: 40,
        gravity: 0.13,
        drag: 0.93,
        size: 2
      });
    }, i * 110);
  }
}

function fireRomanCandle(score, scale = 1) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const shots = sc(6 + Math.min(6, Math.floor((score - 10) / 2)), scale);
  for (let i = 0; i < shots; i++) {
    setTimeout(() => {
      const x = 80 + Math.random() * (w - 160);
      const color = randColor(HOT_PALETTE);
      for (let j = 0; j < sc(14, scale); j++) {
        particles.push({
          x, y: h - 20,
          vx: (Math.random() - 0.5) * 0.9,
          vy: -6.5 - Math.random() * 3.2,
          life: 60, maxLife: 60,
          color, gravity: 0.07, drag: 0.99,
          size: 3, trail: true, trailPath: []
        });
      }
    }, i * 110);
  }
}

function fireAerialBurst(score, scale = 1) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  launchShell({
    x: 80 + Math.random() * (w - 160),
    y: h,
    targetY: h * 0.45,
    count: sc(70, scale),
    palette: FLAG_PALETTE,
    speed: 4.5 * (0.9 + 0.1 * scale),
    life: sc(65, scale)
  });
}

function fireBigShell(score, scale = 1) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const count = sc(2 + Math.floor((score - 30) / 10), scale);
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      launchShell({
        x: 80 + Math.random() * (w - 160),
        y: h,
        targetY: h * (0.25 + Math.random() * 0.22),
        count: sc(110, scale),
        palette: FLAG_PALETTE,
        speed: 6.2 * (0.9 + 0.1 * scale),
        life: sc(85, scale)
      });
    }, i * 320);
  }
}

function fireChrysanthemum(score, scale = 1) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const shots = sc(3, scale);
  for (let i = 0; i < shots; i++) {
    setTimeout(() => {
      launchShell({
        x: 100 + Math.random() * (w - 200),
        y: h,
        targetY: h * (0.2 + Math.random() * 0.2),
        count: sc(150, scale),
        palette: ALL_PALETTE,
        speed: 7 * (0.9 + 0.1 * scale),
        life: sc(95, scale),
        trail: true
      });
    }, i * 260);
  }
}

function firePeonyWillow(score, scale = 1) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  launchShell({
    x: w * 0.3, y: h, targetY: h * 0.24,
    count: sc(190, scale), palette: HOT_PALETTE,
    speed: 8 * (0.9 + 0.1 * scale), life: sc(105, scale), trail: true
  });
  setTimeout(() => launchShell({
    x: w * 0.7, y: h, targetY: h * 0.3,
    count: sc(130, scale), palette: COOL_PALETTE,
    speed: 6 * (0.9 + 0.1 * scale), life: sc(135, scale),
    gravity: 0.1, trail: true
  }), 400);
}

function firePalmFinale(score, scale = 1) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const shots = sc(5, scale);
  for (let i = 0; i < shots; i++) {
    setTimeout(() => {
      launchShell({
        x: (i + 0.5) * (w / Math.max(1, shots)),
        y: h,
        targetY: h * (0.2 + Math.random() * 0.15),
        count: sc(110 + Math.floor(Math.random() * 70), scale),
        palette: ALL_PALETTE,
        speed: (7 + Math.random() * 2.2) * (0.9 + 0.1 * scale),
        life: sc(95 + Math.random() * 40, scale),
        trail: true
      });
    }, i * 220);
  }
}

function fireGrandFinale(score, scale = 1) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const shots = sc(14, scale);
  for (let i = 0; i < shots; i++) {
    setTimeout(() => {
      launchShell({
        x: 60 + Math.random() * (w - 120),
        y: h,
        targetY: h * (0.13 + Math.random() * 0.32),
        count: sc(160 + Math.floor(Math.random() * 100), scale),
        palette: ALL_PALETTE,
        speed: (8 + Math.random() * 2.5) * (0.9 + 0.1 * scale),
        life: sc(100 + Math.random() * 60, scale),
        trail: true
      });
    }, i * 180);
  }
}

/* Rocket that launches, then explodes into a burst */
function launchShell({ x, y, targetY, count, palette, speed, life, trail = false, gravity = 0.05 }) {
  const rocket = {
    x, y,
    vx: (Math.random() - 0.5) * 0.4,
    vy: -Math.sqrt(Math.max(1, (y - targetY)) * 1.1) * 0.85,
    life: 200, maxLife: 200,
    color: "#FFFDF7",
    gravity: 0.02, drag: 0.995,
    size: 2.4, trail: true, trailPath: [],
    rocket: true,
    targetY,
    burstCount: count,
    burstPalette: palette,
    burstSpeed: speed,
    burstLife: life,
    burstTrail: trail,
    burstGravity: gravity
  };
  particles.push(rocket);
}

function explode(rocket) {
  addBurst({
    x: rocket.x, y: rocket.y,
    count: rocket.burstCount,
    color: () => randColor(rocket.burstPalette),
    speed: rocket.burstSpeed,
    life: rocket.burstLife,
    gravity: rocket.burstGravity,
    size: rocket.burstTrail ? 2 : 2.6,
    trail: rocket.burstTrail
  });
  // white flash
  addBurst({
    x: rocket.x, y: rocket.y,
    count: 18,
    color: "#FFFDF7",
    speed: 1.6,
    life: 14,
    gravity: 0,
    drag: 0.88,
    size: 4
  });
}

/* ---------- Main render loop ---------- */

function loop() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.globalCompositeOperation = "lighter";

  const next = [];
  for (const p of particles) {
    if (p.rocket && p.y <= p.targetY) {
      explode(p);
      continue;
    }

    p.vx *= p.drag;
    p.vy *= p.drag;
    p.vy += p.gravity;
    p.x += p.vx;
    p.y += p.vy;
    p.life--;

    if (p.trail) {
      p.trailPath.push({ x: p.x, y: p.y });
      if (p.trailPath.length > 10) p.trailPath.shift();
    }

    if (p.life <= 0) continue;

    const alpha = Math.max(0, p.life / p.maxLife);

    if (p.trail && p.trailPath.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = alpha * 0.45;
      ctx.lineWidth = p.size * 0.7;
      ctx.moveTo(p.trailPath[0].x, p.trailPath[0].y);
      for (const pt of p.trailPath) ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.arc(p.x, p.y, p.size * (0.55 + alpha * 0.55), 0, Math.PI * 2);
    ctx.fill();

    next.push(p);
  }
  particles = next;

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  rafId = requestAnimationFrame(loop);
}
