// Harbor Lights — particles: sparks, smoke, blood-free impact puffs,
// muzzle flashes, rain streaks and floating score text. Pure data, no DOM.
export function createParticles() {
  return { list: [], texts: [] };
}

export function burst(p, x, y, opts = {}) {
  const count = opts.count ?? 12;
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = (opts.speed ?? 160) * (0.4 + Math.random() * 0.8);
    p.list.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: opts.life ?? 0.6, maxLife: opts.life ?? 0.6,
      size: opts.size ?? 3, color: opts.color ?? '#ffb347', grav: opts.grav ?? 0,
    });
  }
  if (p.list.length > 400) p.list.splice(0, p.list.length - 400);
}

export function smoke(p, x, y, count = 6) {
  for (let i = 0; i < count; i += 1) {
    p.list.push({
      x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 30, vy: -30 - Math.random() * 30,
      life: 1.1, maxLife: 1.1, size: 7 + Math.random() * 6, color: '#555c66', grav: -20,
    });
  }
}

export function floatText(p, x, y, text, color = '#ffd166') {
  p.texts.push({ x, y, text, color, life: 1.2 });
  if (p.texts.length > 24) p.texts.shift();
}

export function updateParticles(p, dt) {
  for (let i = p.list.length - 1; i >= 0; i -= 1) {
    const q = p.list[i];
    q.life -= dt;
    if (q.life <= 0) { p.list.splice(i, 1); continue; }
    q.vy += q.grav * dt;
    q.x += q.vx * dt; q.y += q.vy * dt;
    q.vx *= 0.98; q.vy *= 0.98;
  }
  for (let i = p.texts.length - 1; i >= 0; i -= 1) {
    const t = p.texts[i];
    t.life -= dt; t.y -= 30 * dt;
    if (t.life <= 0) p.texts.splice(i, 1);
  }
}
