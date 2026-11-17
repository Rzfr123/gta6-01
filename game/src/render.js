// Harbor Lights — drawing only: the city, cars, people, bullets, particles,
// HUD with minimap and wanted stars, mission dialogue, and the title,
// pause and busted screens. The camera follows the player across Solmar Bay.
import { WORLD, ROADS_X, ROADS_Y, ROAD_W, PALETTE, FONT, districtAt } from './config.js';
import { missionTarget } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_DEAD = 'dead';
export const SCREEN_DONE = 'done';

const VIEW_W = 1280;
const VIEW_H = 720;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const fonts = new Map();
  function font(size, bold) { const k = size + (bold ? 'b' : ''); if (!fonts.has(k)) fonts.set(k, `${bold ? '700 ' : ''}${size}px ${FONT}`); return fonts.get(k); }
  function text(value, x, y, size, color, align = 'left', bold = false) {
    ctx.font = font(size, bold); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }
  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  }
  resize();
  window.addEventListener('resize', resize);

  function drawCar(car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-22, -12, 44, 26);
    ctx.fillStyle = car.color;
    ctx.fillRect(-20, -11, 40, 22);
    ctx.fillStyle = 'rgba(180,220,255,0.85)';
    ctx.fillRect(-4, -10, 10, 20);
    ctx.fillStyle = '#222';
    ctx.fillRect(-18, -13, 7, 4); ctx.fillRect(-18, 9, 7, 4);
    ctx.fillRect(11, -13, 7, 4); ctx.fillRect(11, 9, 7, 4);
    if (car.police) {
      ctx.fillStyle = '#fff'; ctx.fillRect(-20, -11, 40, 6);
      ctx.fillStyle = '#e5534b'; ctx.fillRect(-8, -14, 7, 4);
      ctx.fillStyle = '#2f6fd0'; ctx.fillRect(2, -14, 7, 4);
      text('SBPD', 0, 4, 8, '#111', 'center', true);
    }
    if (car.type === 'taxi') text('TAXI', 0, 4, 8, '#111', 'center', true);
    ctx.restore();
    if (car.hp < car.maxHp * 0.35) {
      ctx.fillStyle = 'rgba(90,90,90,0.7)';
      ctx.beginPath(); ctx.arc(car.x - 10, car.y - 8, 6 + Math.random() * 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawPerson(x, y, angle, color, label) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath(); ctx.arc(5, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (label) text(label, x, y - 14, 10, '#fff', 'center');
  }

  function drawWorld(G) {
    const cam = G.camera;
    const ox = -cam.x + (Math.random() - 0.5) * G.shake;
    const oy = -cam.y + (Math.random() - 0.5) * G.shake;
    ctx.save();
    ctx.translate(ox, oy);
    // Ground.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    // Beach + sea along the south edge.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0, WORLD.height - 110, WORLD.width, 110);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(0, WORLD.height - 46, WORLD.width, 46);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let x = 0; x < WORLD.width; x += 90) {
      ctx.fillRect(x + ((G.time * 20) % 90), WORLD.height - 30, 40, 4);
    }
    // Parks.
    for (const park of G.city.parks) {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
    }
    for (const t of G.city.trees) {
      ctx.fillStyle = '#2f6b2a';
      ctx.beginPath(); ctx.arc(t.x, t.y, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7a5230'; ctx.fillRect(t.x - 2, t.y + 6, 4, 8);
    }
    // Roads + sidewalks + lane dashes.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2 - 8, 0, ROAD_W + 16, WORLD.height);
    for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_W / 2 - 8, WORLD.width, ROAD_W + 16);
    ctx.fillStyle = PALETTE.road;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD.height);
    for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_W / 2, WORLD.width, ROAD_W);
    ctx.fillStyle = PALETTE.roadLine;
    for (const rx of ROADS_X) for (let y = 0; y < WORLD.height; y += 64) ctx.fillRect(rx - 2, y, 4, 30);
    for (const ry of ROADS_Y) for (let x = 0; x < WORLD.width; x += 64) ctx.fillRect(x, ry - 2, 30, 4);
    // Buildings with roof detail.
    for (const b of G.city.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x, b.y, b.w, 8);
      ctx.fillStyle = '#2b2f36';
      for (let wx = b.x + 10; wx < b.x + b.w - 12; wx += 22) {
        for (let wy = b.y + 14; wy < b.y + b.h - 12; wy += 22) ctx.fillRect(wx, wy, 10, 12);
      }
      if (b.tall) { ctx.fillStyle = '#e8e8e8'; ctx.fillRect(b.x + b.w / 2 - 8, b.y - 10, 16, 10); }
    }
    // Safehouse, bank and spray shop markers (fixed landmarks).
    drawLandmark(600, 200, '#7dff8a', 'SAFEHOUSE');
    drawLandmark(1400, 1000, '#ffd166', 'BANK');
    drawLandmark(2600, 1400, '#ff9f43', 'SPRAY $200');
    // Pickups.
    for (const pk of G.pickups) {
      const bob = Math.sin(G.time * 3 + pk.bob) * 3;
      ctx.fillStyle = pk.kind === 'health' ? '#3ddc5f' : pk.kind === 'armor' ? '#4fa8ff' : '#ffd166';
      ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111';
      text(pk.kind === 'cash' ? '$' : pk.kind === 'health' ? '+' : 'A', pk.x, pk.y + bob + 4, 12, '#111', 'center', true);
    }
    // Mission target marker.
    const target = missionTarget(G);
    if (target) {
      const pulse = 1 + Math.sin(G.time * 5) * 0.15;
      ctx.save();
      ctx.translate(target.x, target.y);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(16, 0); ctx.lineTo(0, 26); ctx.lineTo(-16, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,209,102,0.6)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(target.x, target.y, 34 + Math.sin(G.time * 5) * 6, 0, Math.PI * 2); ctx.stroke();
    }
    // Cars, people, enemies, bullets, particles.
    for (const car of G.cars) if (!car.dead) drawCar(car);
    for (const ped of G.peds) if (!ped.dead) drawPerson(ped.x, ped.y, ped.angle, ped.color);
    for (const e of G.enemies) if (!e.dead) drawPerson(e.x, e.y, e.angle, e.color, 'HARLOW');
    const p = G.player;
    if (!p.inCar) drawPerson(p.x, p.y, p.angle, PALETTE.player);
    // Player direction tick.
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20); ctx.stroke();
    for (const b of G.bullets) {
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
    }
    for (const pt of G.particles.list) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const t of G.particles.texts) {
      ctx.globalAlpha = Math.max(0, t.life);
      text(t.text, t.x, t.y, 18, t.color, 'center', true);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // Day / night tint + rain.
    const hour = G.timeOfDay;
    const night = hour < 6 || hour > 19 ? 0.42 : hour < 8 || hour > 17 ? 0.18 : 0;
    if (night > 0) { ctx.fillStyle = `rgba(10,16,60,${night})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (G.weather === 'rain') {
      ctx.strokeStyle = 'rgba(180,200,255,0.5)'; ctx.lineWidth = 1;
      for (let i = 0; i < 90; i += 1) {
        const rx = (i * 137 + G.time * 900) % VIEW_W;
        const ry = (i * 211 + G.time * 1400) % VIEW_H;
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 14); ctx.stroke();
      }
    }
  }

  function drawLandmark(x, y, color, label) {
    ctx.fillStyle = color;
    ctx.fillRect(x - 18, y - 18, 36, 36);
    ctx.fillStyle = '#111';
    text(label.slice(0, 1), x, y + 5, 16, '#111', 'center', true);
    text(label, x, y - 26, 11, '#fff', 'center', true);
  }

  function drawMinimap(G) {
    const size = 190;
    const x0 = VIEW_W - size - 16;
    const y0 = VIEW_H - size - 16;
    ctx.fillStyle = PALETTE.hud;
    ctx.fillRect(x0 - 6, y0 - 6, size + 12, size + 12);
    ctx.fillStyle = '#2c4a2c';
    ctx.fillRect(x0, y0, size, size);
    const sx = size / WORLD.width;
    const sy = size / WORLD.height;
    ctx.fillStyle = '#3a3f46';
    for (const rx of ROADS_X) ctx.fillRect(x0 + rx * sx - 1, y0, 2, size);
    for (const ry of ROADS_Y) ctx.fillRect(x0, y0 + ry * sy, size, 2);
    ctx.fillStyle = '#2e7fa8';
    ctx.fillRect(x0, y0 + size - 4, size, 4);
    const target = missionTarget(G);
    if (target) {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(x0 + target.x * sx, y0 + target.y * sy, 5, 0, Math.PI * 2); ctx.fill();
    }
    for (const cop of G.cops) {
      ctx.fillStyle = '#4fa8ff';
      ctx.beginPath(); ctx.arc(x0 + cop.car.x * sx, y0 + cop.car.y * sy, 3, 0, Math.PI * 2); ctx.fill();
    }
    const p = G.player;
    ctx.fillStyle = '#ffcf3f';
    ctx.beginPath(); ctx.arc(x0 + p.x * sx, y0 + p.y * sy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x0 + p.x * sx, y0 + p.y * sy, 6, 0, Math.PI * 2); ctx.stroke();
    text('SOLMAR BAY', x0, y0 - 10, 11, '#fff', 'left', true);
  }

  function drawHud(G) {
    const p = G.player;
    ctx.fillStyle = PALETTE.hud;
    ctx.fillRect(12, 12, 300, 96);
    // Wanted stars.
    for (let i = 0; i < 5; i += 1) {
      text('★', 24 + i * 26, 40, 24, i < G.wanted ? (G.wanted >= 3 ? '#ff5b4d' : '#ffd166') : '#555', 'left', true);
    }
    text(`$${G.cash}`, 24, 66, 22, '#7dff8a', 'left', true);
    text(`${districtAt(p.x, p.y)}  •  ${Math.floor(G.timeOfDay)}:${String(Math.floor((G.timeOfDay % 1) * 60)).padStart(2, '0')}`, 24, 90, 14, '#fff');
    // Health / armor bars.
    ctx.fillStyle = '#333'; ctx.fillRect(12, 116, 200, 14);
    ctx.fillStyle = '#3ddc5f'; ctx.fillRect(12, 116, 200 * Math.max(0, p.hp) / 100, 14);
    ctx.fillStyle = '#333'; ctx.fillRect(12, 134, 200, 10);
    ctx.fillStyle = '#4fa8ff'; ctx.fillRect(12, 134, 200 * Math.max(0, p.armor) / 100, 10);
    text('HP', 218, 129, 12, '#fff', 'left', true);
    text('ARMOR', 218, 144, 12, '#fff', 'left', true);
    // Mission objective.
    const target = missionTarget(G);
    if (target) {
      const dist = Math.round(Math.hypot(p.x - target.x, p.y - target.y));
      ctx.fillStyle = PALETTE.hud;
      ctx.fillRect(12, 156, 430, 30);
      text(`◆ ${target.label}  —  ${dist}m`, 22, 177, 15, '#ffd166', 'left', true);
    } else if (G.storyDone) {
      ctx.fillStyle = PALETTE.hud;
      ctx.fillRect(12, 156, 430, 30);
      text('◆ Story complete — free roam Solmar Bay', 22, 177, 15, '#7dff8a', 'left', true);
    }
    // Car HUD.
    if (p.inCar) {
      const car = p.inCar;
      ctx.fillStyle = PALETTE.hud;
      ctx.fillRect(VIEW_W - 260, 12, 248, 64);
      text(car.name, VIEW_W - 248, 36, 16, '#fff', 'left', true);
      text(`${Math.round(Math.abs(car.speed) * 0.55)} km/h`, VIEW_W - 248, 60, 20, '#ffd166', 'left', true);
      ctx.fillStyle = '#333'; ctx.fillRect(VIEW_W - 248, 66, 120, 8);
      ctx.fillStyle = car.hp > 40 ? '#3ddc5f' : '#e5534b';
      ctx.fillRect(VIEW_W - 248, 66, 120 * Math.max(0, car.hp) / car.maxHp, 8);
    }
    // Toast.
    if (G.toastTimer > 0) {
      ctx.fillStyle = PALETTE.hud;
      const w = Math.min(760, 20 + G.toast.length * 8);
      ctx.fillRect((VIEW_W - w) / 2, VIEW_H - 120, w, 34);
      text(G.toast, VIEW_W / 2, VIEW_H - 97, 15, '#fff', 'center', true);
    }
    // Interaction hints.
    let hint = '';
    if (!p.inCar) {
      const nearCar = G.cars.find((c) => !c.dead && Math.hypot(c.x - p.x, c.y - p.y) < 60);
      if (nearCar) hint = 'E — steal / enter ' + nearCar.name;
      else if (missionTarget(G) && Math.hypot(p.x - missionTarget(G).x, p.y - missionTarget(G).y) < 90) hint = 'Follow the yellow marker';
      else hint = 'WASD move • Mouse aim • Click shoot • E enter car • P pause • M mute';
    } else {
      hint = 'W/S drive • A/D steer • Space handbrake • Click drive-by • E exit car';
    }
    text(hint, VIEW_W / 2, VIEW_H - 24, 14, '#fff', 'center');
    drawMinimap(G);
    // Dialogue panel.
    if (G.dialogue) {
      const d = G.dialogue;
      ctx.fillStyle = PALETTE.panel;
      ctx.fillRect(240, VIEW_H - 220, VIEW_W - 480, 120);
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2;
      ctx.strokeRect(240, VIEW_H - 220, VIEW_W - 480, 120);
      text(`${d.title} — ${d.giver}`, 260, VIEW_H - 190, 16, '#ffd166', 'left', true);
      wrapText(d.lines[d.index], 260, VIEW_H - 162, VIEW_W - 520, 16);
      text('Enter — continue', VIEW_W - 260, VIEW_H - 112, 13, '#b9c2cc', 'right');
    }
    // Bank hold progress.
    if (G.mission && G.mission.id === 4 && G.mission.step === 0 && G.mission.holdT > 0) {
      ctx.fillStyle = PALETTE.hud; ctx.fillRect(VIEW_W / 2 - 150, 200, 300, 22);
      ctx.fillStyle = '#ffd166'; ctx.fillRect(VIEW_W / 2 - 150, 200, 300 * G.mission.holdT / 5, 22);
      text('CRACKING THE VAULT… hold F', VIEW_W / 2, 192, 14, '#fff', 'center', true);
    }
  }

  function wrapText(s, x, y, maxW, size) {
    const words = s.split(' ');
    let line = '';
    let yy = y;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      ctx.font = font(size);
      if (ctx.measureText(test).width > maxW && line) { text(line, x, yy, size, '#fff'); line = w; yy += 20; }
      else line = test;
    }
    if (line) text(line, x, yy, size, '#fff');
  }

  function drawPanel(title, lines, prompt, accent = '#ffd166') {
    const w = 680;
    const h = 150 + lines.length * 30;
    const x = (VIEW_W - w) / 2;
    const y = (VIEW_H - h) / 2;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent; ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    text(title, VIEW_W / 2, y + 64, 44, accent, 'center', true);
    lines.forEach((ln, i) => text(ln, VIEW_W / 2, y + 110 + i * 30, 18, '#eef1f5', 'center'));
    text(prompt, VIEW_W / 2, y + h - 28, 17, '#ffd166', 'center', true);
  }

  function draw(G, screen, save) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    const ox = (canvas.width - VIEW_W * scale) / 2;
    const oy = (canvas.height - VIEW_H * scale) / 2;
    ctx.fillStyle = '#0b0e13';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
    if (screen === SCREEN_TITLE) {
      drawWorld(G);
      ctx.fillStyle = 'rgba(8,12,20,0.55)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      text('HARBOR LIGHTS', VIEW_W / 2, 118, 72, '#ffd166', 'center', true);
      text('An open-world crime story in Solmar Bay', VIEW_W / 2, 156, 22, '#fff', 'center');
      drawPanel('MARA VOSS', [
        'You are Mara Voss, getaway driver. Rook has work for you.',
        'Steal cars, outrun the SBPD, run six story missions, own the Bay.',
        `Missions: ${G.completedMissions}/6  •  Cash: $${G.cash}  •  Best score: ${save?.best ?? 0}`,
        'WASD move / drive  •  Mouse aim  •  Click shoot  •  E enter & steal cars',
        'F interact  •  P pause  •  M mute  •  Progress saves automatically',
      ], save ? 'Press Enter or click — Continue saved game' : 'Press Enter or click — Start the story', '#ffd166');
      return;
    }
    drawWorld(G);
    drawHud(G);
    if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(8,12,20,0.6)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      drawPanel('PAUSED', [
        'Solmar Bay waits for no one — except right now.',
        `Cash $${G.cash}  •  Missions ${G.completedMissions}/6  •  Kills ${G.stats.kills}  •  Cars stolen ${G.stats.stolen}`,
        'Progress is saved automatically.',
      ], 'P — resume   •   R — restart story   •   M — mute');
    } else if (screen === SCREEN_BUSTED) {
      ctx.fillStyle = 'rgba(8,12,20,0.6)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      drawPanel('BUSTED!', ['The SBPD caught you. You paid the fine and walked out.', `Cash $${G.cash} — the story goes on.`], 'Press Enter — back on the streets', '#4fa8ff');
    } else if (screen === SCREEN_DEAD) {
      ctx.fillStyle = 'rgba(8,12,20,0.6)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      drawPanel('WASTED', ['Mara went down in Solmar Bay.', 'The city does not forget — but it does forgive.'], 'Press Enter — wake up at the hospital', '#e5534b');
    } else if (screen === SCREEN_DONE) {
      ctx.fillStyle = 'rgba(8,12,20,0.55)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      drawPanel('KING OF THE BAY', ['Every mission complete. Solmar Bay is yours, Mara.', `Earned $${G.stats.earned}  •  Kills ${G.stats.kills}  •  Cars stolen ${G.stats.stolen}`], 'Enter — keep roaming free', '#7dff8a');
    }
  }

  return { draw, viewSize: { w: VIEW_W, h: VIEW_H } };
}
