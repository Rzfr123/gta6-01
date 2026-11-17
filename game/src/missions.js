// Harbor Lights — story missions. Six jobs for Mara Voss, from a first
// package run to taking the Bay back from the Harlow crew. Each mission is
// a small state machine: go somewhere, do something, get paid. Completing
// a mission pays cash, advances the story and autosaves.
import { makeCar, addCash, addWanted, showToast } from './state.js';
import { burst, floatText } from './particles.js';
import { sfx } from './audio.js';

export const MISSIONS = [
  {
    id: 0, title: 'First Job', giver: 'Rook, the fixer',
    intro: ['Rook: "Mara. A package waits at the Old Docks. Bring it to the Marina. No questions, no cops."', 'Drive to the yellow marker at the Old Docks.'],
    reward: 300,
  },
  {
    id: 1, title: 'Getaway Driver', giver: 'Rook, the fixer',
    intro: ['Rook: "The crew hit a warehouse. SBPD is already rolling. Grab a car and get them to the safehouse."', 'Steal any car, then reach the Palm Heights safehouse with the heat on.'],
    reward: 500,
  },
  {
    id: 2, title: 'The Park Deal', giver: 'Lena, the dealer',
    intro: ['Lena: "The Harlow crew is muscling into my park. Go to Central Park and remind them whose turf this is."', 'Fight the Harlow gangsters in Central Park.'],
    reward: 700,
  },
  {
    id: 3, title: 'Chase the Rat', giver: 'Rook, the fixer',
    intro: ['Rook: "Dario sold us out. He is running for the Sunset Strip in a red coupe. Stop that car."', 'Ram or shoot Dario\'s coupe until it stops.'],
    reward: 800,
  },
  {
    id: 4, title: 'Bank of Solmar', giver: 'Mara\'s plan',
    intro: ['Mara: "One big score and I am out. Hold the bank lobby, then lose a four-star heat."', 'Enter the Downtown bank, hold E for 5 seconds, then reach the safehouse.'],
    reward: 2000,
  },
  {
    id: 5, title: 'King of the Bay', giver: 'The Harlow crew',
    intro: ['Harlow: "You took everything, Voss. Come to the Strip and finish this, or run forever."', 'Survive the final shootout on the Sunset Strip.'],
    reward: 3000,
  },
];

const DOCKS = { x: 200, y: 2200 };
const MARINA = { x: 3000, y: 2200 };
const SAFEHOUSE = { x: 600, y: 200 };
const PARK = { x: 1600, y: 400 };
const BANK = { x: 1400, y: 1000 };
const STRIP = { x: 2600, y: 200 };

export function startMission(G) {
  const def = MISSIONS[G.missionIndex];
  if (!def) return;
  G.mission = { id: def.id, step: 0, timer: 0, holdT: 0, targetCar: null, spawned: false };
  G.dialogue = { title: def.title, giver: def.giver, lines: def.intro, index: 0 };
  sfx.mission();
  if (def.id === 1) addWanted(G, 2);
}

export function missionTarget(G) {
  const m = G.mission;
  if (!m) return null;
  if (m.id === 0) return m.step === 0 ? { ...DOCKS, label: 'Pick up the package — Old Docks' } : { ...MARINA, label: 'Deliver the package — Marina Bay' };
  if (m.id === 1) return { ...SAFEHOUSE, label: 'Reach the safehouse — Palm Heights' };
  if (m.id === 2) return { ...PARK, label: 'Clear Central Park of Harlow gangsters' };
  if (m.id === 3) return m.targetCar ? { x: m.targetCar.x, y: m.targetCar.y, label: 'Stop Dario\'s coupe' } : { ...STRIP, label: 'Find Dario — Sunset Strip' };
  if (m.id === 4) return m.step === 0 ? { ...BANK, label: 'Rob the Bank of Solmar — Downtown' } : { ...SAFEHOUSE, label: 'Escape to the safehouse' };
  if (m.id === 5) return { ...STRIP, label: 'Finish the Harlow crew — Sunset Strip' };
  return null;
}

function spawnGangsters(G, x, y, n) {
  for (let i = 0; i < n; i += 1) {
    G.enemies.push({
      x: x + (G.random() - 0.5) * 220, y: y + (G.random() - 0.5) * 220,
      angle: 0, hp: 60, shootT: 0.5 + G.random(), dead: false,
      color: '#5e2b8a', name: 'Harlow gangster', speed: 90,
    });
  }
}

function completeMission(G) {
  const def = MISSIONS[G.mission.id];
  addCash(G, def.reward, G.player.x, G.player.y - 30);
  G.completedMissions += 1;
  G.stats.missions += 1;
  G.mission = null;
  G.missionIndex += 1;
  showToast(G, `Mission complete: ${def.title} — $${def.reward} earned`, 4);
  sfx.mission();
  if (G.missionIndex >= MISSIONS.length) {
    G.storyDone = true;
    showToast(G, 'STORY COMPLETE — Mara Voss owns Solmar Bay. Free roam continues!', 6);
  } else {
    startMission(G);
  }
}

function near(G, t, r = 70) {
  return Math.hypot(G.player.x - t.x, G.player.y - t.y) < r;
}

export function updateMission(G, dt, input) {
  const m = G.mission;
  if (!m) return;
  const p = G.player;
  // Mission 2 & 5: gangsters shoot at the player.
  for (const e of G.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d > 520) continue;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    e.angle = a;
    // Strafe toward the player slowly.
    if (d > 160) { e.x += Math.cos(a) * e.speed * dt; e.y += Math.sin(a) * e.speed * dt; }
    e.shootT -= dt;
    if (e.shootT <= 0 && d < 420) {
      e.shootT = 1.1 + G.random() * 0.7;
      G.bullets.push({
        x: e.x, y: e.y, vx: Math.cos(a + (G.random() - 0.5) * 0.25) * 560,
        vy: Math.sin(a + (G.random() - 0.5) * 0.25) * 560,
        life: 0.8, friendly: false, damage: 10,
      });
      sfx.enemyShoot();
    }
  }
  if (m.id === 0) {
    if (m.step === 0 && near(G, DOCKS)) { m.step = 1; showToast(G, 'Package secured. Deliver it to Marina Bay.', 3); sfx.pickup(); }
    else if (m.step === 1 && near(G, MARINA)) completeMission(G);
  } else if (m.id === 1) {
    if (near(G, SAFEHOUSE, 80)) completeMission(G);
  } else if (m.id === 2) {
    if (!m.spawned && near(G, PARK, 320)) { m.spawned = true; spawnGangsters(G, PARK.x, PARK.y, 4); showToast(G, 'Harlow gangsters! Take them down.', 3); }
    if (m.spawned && G.enemies.length === 0) completeMission(G);
  } else if (m.id === 3) {
    if (!m.targetCar) {
      m.targetCar = makeCar(G, 'coupe', STRIP.x, STRIP.y, 0, { color: '#c92a2a' });
      m.targetCar.hp = 120; m.targetCar.maxHp = 120;
      showToast(G, 'There he is — stop that red coupe!', 3);
    } else {
      const c = m.targetCar;
      if (c.dead || c.hp <= 0) { completeMission(G); return; }
      // Flee: drive away from the player along the roads.
      const away = Math.atan2(c.y - p.y, c.x - p.x);
      let diff = away - c.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.angle += Math.max(-2 * dt, Math.min(2 * dt, diff));
      c.speed = Math.min(c.maxSpeed * 0.85, c.speed + 200 * dt);
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      // Ramming it damages it.
      if (p.inCar && Math.hypot(c.x - p.x, c.y - p.y) < 46 && Math.abs(p.inCar.speed) > 150) {
        c.hp -= 18; c.speed *= 0.6; p.inCar.speed *= 0.7;
        burst(G.particles, c.x, c.y, { count: 8, color: '#ffb347', speed: 140, life: 0.4, size: 3 });
        sfx.crash();
        if (c.hp <= 0) { c.dead = true; burst(G.particles, c.x, c.y, { count: 20, color: '#ff7b2f', speed: 250, life: 0.8, size: 4 }); }
      }
    }
  } else if (m.id === 4) {
    if (m.step === 0) {
      if (near(G, BANK, 80) && !p.inCar) {
        if (input.keys.has('KeyF')) {
          m.holdT += dt;
          if (m.holdT >= 5) {
            m.step = 1; addWanted(G, 4);
            showToast(G, 'Vault emptied! Lose the cops and reach the safehouse.', 4);
          }
        } else m.holdT = Math.max(0, m.holdT - dt * 2);
      }
    } else if (near(G, SAFEHOUSE, 80)) completeMission(G);
  } else if (m.id === 5) {
    if (!m.spawned && near(G, STRIP, 340)) {
      m.spawned = true;
      spawnGangsters(G, STRIP.x, STRIP.y, 6);
      addWanted(G, 2);
      showToast(G, 'The whole Harlow crew is here. End it.', 3);
    }
    if (m.spawned && G.enemies.length === 0 && G.wanted === 0) completeMission(G);
    else if (m.spawned && G.enemies.length === 0) showToast(G, 'Crew down — now lose the heat!', 2);
  }
  void floatText;
}
