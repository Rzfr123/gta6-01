// Harbor Lights — game state and core simulation: the player on foot and
// in a car, parked and traffic cars, bullets, enemies, pickups, cash,
// health, the wanted timer and the clock. No drawing here.
import { WORLD, CAR_TYPES, ROADS_X, ROADS_Y, STEP } from './config.js';
import { generateCity, collideBuildings, clampToWorld, onRoad } from './city.js';
import { burst, smoke, floatText } from './particles.js';
import { sfx } from './audio.js';

export const EVENT_NONE = 0;
export const EVENT_DIED = 1;
export const EVENT_BUSTED = 2;

const CAR_COLORS = ['#c94f4f', '#3f7fd0', '#e8e8e8', '#2b2b2b', '#d23f8e', '#f2c230', '#5e8a7d', '#8a7db0'];
const PED_COLORS = ['#e8b48a', '#7fb0d0', '#d07f7f', '#9ad07f', '#d0c07f', '#b08ad0'];
const PED_NAMES = ['Dockworker', 'Tourist', 'Jogger', 'Student', 'Fisherman', 'Shopkeeper', 'Sailor', 'Barista'];

export function createGame(random) {
  const city = generateCity(random);
  const G = {
    random, city,
    time: 0, timeOfDay: 9.5, weather: 'sunny', rainTimer: 40 + random() * 60,
    cash: 150, wanted: 0, wantedTimer: 0, heat: 0,
    missionIndex: 0, completedMissions: 0, storyDone: false,
    mission: null, dialogue: null, toast: '', toastTimer: 0,
    stats: { kills: 0, stolen: 0, earned: 0, missions: 0, busted: 0 },
    best: 0, camera: { x: 0, y: 0 }, shake: 0, slowmo: 0,
    player: {
      x: 1400, y: 1000, angle: -Math.PI / 2, hp: 100, armor: 0,
      speed: 0, inCar: null, fireCooldown: 0, invuln: 0, arrest: 0, sprint: 0,
    },
    cars: [], peds: [], cops: [], enemies: [], bullets: [], pickups: [],
    particles: null, // set by main (createParticles) to avoid a cycle
    paused: false,
  };
  return G;
}

export function makeCar(G, type, x, y, angle, opts = {}) {
  const t = CAR_TYPES[type] ?? CAR_TYPES.sedan;
  const car = {
    id: Math.floor(G.random() * 1e9), type, name: t.name, color: opts.color ?? t.color,
    x, y, angle, speed: 0, maxSpeed: t.speed, accel: t.accel, hp: t.hp, maxHp: t.hp,
    traffic: !!opts.traffic, police: type === 'police', dead: false, smokeT: 0,
    axis: opts.axis ?? 'h', dir: opts.dir ?? 1, targetSpeed: opts.targetSpeed ?? 0,
    driver: opts.driver ?? null, fleeing: false,
  };
  G.cars.push(car);
  return car;
}

export function spawnParkedCars(G) {
  const types = ['sedan', 'taxi', 'van', 'sports', 'truck', 'coupe'];
  for (let i = 0; i < 26; i += 1) {
    const horizontal = G.random() < 0.5;
    const rx = ROADS_X[Math.floor(G.random() * ROADS_X.length)];
    const ry = ROADS_Y[Math.floor(G.random() * ROADS_Y.length)];
    const x = horizontal ? 120 + G.random() * (WORLD.width - 240) : rx + (G.random() < 0.5 ? -34 : 34);
    const y = horizontal ? ry + (G.random() < 0.5 ? -34 : 34) : 120 + G.random() * (WORLD.height - 240);
    const type = types[Math.floor(G.random() * types.length)];
    makeCar(G, type, x, y, horizontal ? (G.random() < 0.5 ? 0 : Math.PI) : (G.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2), {
      color: CAR_COLORS[Math.floor(G.random() * CAR_COLORS.length)],
    });
  }
}

export function spawnPeds(G, n) {
  for (let i = 0; i < n; i += 1) {
    const rx = ROADS_X[Math.floor(G.random() * ROADS_X.length)];
    const ry = ROADS_Y[Math.floor(G.random() * ROADS_Y.length)];
    G.peds.push({
      x: rx + (G.random() - 0.5) * 80, y: ry + (G.random() - 0.5) * 80,
      angle: G.random() * Math.PI * 2, speed: 40 + G.random() * 30,
      color: PED_COLORS[Math.floor(G.random() * PED_COLORS.length)],
      name: PED_NAMES[Math.floor(G.random() * PED_NAMES.length)],
      hp: 30, panic: 0, walkT: 0, dead: false,
    });
  }
}

export function spawnPickup(G, x, y, kind, value) {
  G.pickups.push({ x, y, kind, value, bob: G.random() * Math.PI * 2 });
}

export function addWanted(G, amount) {
  G.wanted = Math.max(0, Math.min(5, G.wanted + amount));
  G.wantedTimer = 0;
  if (G.wanted > 0) sfx.siren();
}

export function showToast(G, text, seconds = 3) {
  G.toast = text; G.toastTimer = seconds;
}

export function addCash(G, amount, x, y) {
  G.cash += amount;
  G.stats.earned += amount;
  if (x !== undefined) floatText(G.particles, x, y, `+$${amount}`, '#7dff8a');
  sfx.cash();
}

/** Player fires toward the mouse (on foot) or drive-by from the car window. */
export function fireBullet(G, fromX, fromY, angle, friendly) {
  G.bullets.push({
    x: fromX + Math.cos(angle) * 22, y: fromY + Math.sin(angle) * 22,
    vx: Math.cos(angle) * 720, vy: Math.sin(angle) * 720,
    life: 0.9, friendly, damage: friendly ? 34 : 12,
  });
  burst(G.particles, fromX + Math.cos(angle) * 26, fromY + Math.sin(angle) * 26, { count: 3, color: '#ffd166', speed: 90, life: 0.15, size: 2 });
  if (friendly) sfx.shoot(); else sfx.enemyShoot();
}

export function damagePlayer(G, amount) {
  const p = G.player;
  if (p.invuln > 0) return false;
  let left = amount;
  if (p.armor > 0) { const absorbed = Math.min(p.armor, left); p.armor -= absorbed; left -= absorbed; }
  p.hp -= left;
  p.invuln = 0.35;
  G.shake = Math.max(G.shake, 6);
  sfx.hit();
  if (p.hp <= 0) { p.hp = 0; return true; }
  return false;
}

export function explodeCar(G, car) {
  if (car.dead) return;
  car.dead = true;
  burst(G.particles, car.x, car.y, { count: 30, color: '#ff7b2f', speed: 320, life: 0.9, size: 5 });
  burst(G.particles, car.x, car.y, { count: 16, color: '#ffd166', speed: 200, life: 0.7, size: 4 });
  smoke(G.particles, car.x, car.y, 12);
  G.shake = Math.max(G.shake, 12);
  sfx.explosion();
  const p = G.player;
  if (p.inCar === car) { p.inCar = null; p.x = car.x + 40; p.y = car.y; damagePlayer(G, 25); }
  if (Math.hypot(p.x - car.x, p.y - car.y) < 120) damagePlayer(G, 15);
}

/** Move the player on foot: WASD, sprint, aim at the mouse, fire. */
export function updatePlayerOnFoot(G, input, dt, mouseWorld) {
  const p = G.player;
  const mx = input.moveX();
  const my = input.moveY();
  const len = Math.hypot(mx, my) || 1;
  const sprinting = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  const speed = sprinting ? 260 : 175;
  p.x += (mx / len) * speed * dt;
  p.y += (my / len) * speed * dt;
  p.angle = Math.atan2(mouseWorld.y - p.y, mouseWorld.x - p.x);
  if (p.fireCooldown > 0) p.fireCooldown -= dt;
  if (p.invuln > 0) p.invuln -= dt;
  if (input.mouse.down && p.fireCooldown <= 0) {
    fireBullet(G, p.x, p.y, p.angle, true);
    p.fireCooldown = 0.22;
    if (G.wanted < 1) addWanted(G, 1);
  }
  collideBuildings(G.city, p, 14);
  clampToWorld(p);
}

/** Arcade car physics for the player's car: throttle, steering, drift. */
export function updatePlayerCar(G, input, dt) {
  const car = G.player.inCar;
  if (!car) return;
  const p = G.player;
  const throttle = input.keys.has('KeyW') || input.keys.has('ArrowUp') ? 1 : 0;
  const brake = input.keys.has('KeyS') || input.keys.has('ArrowDown') ? 1 : 0;
  const steer = input.moveX();
  if (throttle) car.speed += car.accel * dt;
  else if (brake) car.speed -= car.accel * 1.4 * dt;
  else car.speed *= Math.pow(0.4, dt);
  if (brake && car.speed < 0) car.speed = Math.max(car.speed, -car.maxSpeed * 0.45);
  car.speed = Math.max(-car.maxSpeed * 0.45, Math.min(car.maxSpeed, car.speed));
  // Steering keeps some authority at low speed, so a car pressed against a
  // wall can still turn its nose away instead of being stuck forever.
  const grip = input.keys.has('Space') ? 1.9 : 1;
  const driveDir = car.speed !== 0 ? Math.sign(car.speed) : (throttle ? 1 : -1);
  const authority = Math.max(Math.min(1, Math.abs(car.speed) / 120), (throttle || brake) ? 0.4 : 0);
  car.angle += steer * 2.4 * dt * driveDir * authority * grip;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  if (collideBuildings(G.city, car, 20)) {
    if (Math.abs(car.speed) > 200) { car.hp -= 12; sfx.crash(); burst(G.particles, car.x, car.y, { count: 8, color: '#ffb347', speed: 140, life: 0.4, size: 3 }); }
    car.speed *= -0.25;
    G.shake = Math.max(G.shake, 4);
  }
  clampToWorld(car, 30);
  if (car.hp <= 0) explodeCar(G, car);
  // Drive-by: click fires from the window toward the mouse.
  if (p.fireCooldown > 0) p.fireCooldown -= dt;
  if (input.mouse.down && p.fireCooldown <= 0) {
    const a = Math.atan2(input.mouse.y - 360, input.mouse.x - 640);
    // Aim in world space is approximated from the camera in main.js via G.aimAngle.
    fireBullet(G, car.x + Math.cos(car.angle) * 10, car.y + Math.sin(car.angle) * 10, G.aimAngle ?? car.angle, true);
    p.fireCooldown = 0.3;
    if (G.wanted < 1) addWanted(G, 1);
  }
}

/** Bullets fly, hit buildings, cars, enemies, peds and the player. */
export function updateBullets(G, dt) {
  for (let i = G.bullets.length - 1; i >= 0; i -= 1) {
    const b = G.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD.width || b.y > WORLD.height;
    if (!dead) {
      for (const bd of G.city.buildings) {
        if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) { dead = true; break; }
      }
    }
    if (!dead) {
      const targets = b.friendly ? [...G.enemies, ...G.cops.map((c) => c.car).filter(Boolean), ...G.cars.filter((c) => c !== G.player.inCar)] : [G.player];
      for (const t of targets) {
        if (!t || t.dead) continue;
        const r = t.hp !== undefined && t.maxHp ? 22 : 14;
        if (Math.hypot(b.x - t.x, b.y - t.y) < r) {
          dead = true;
          burst(G.particles, b.x, b.y, { count: 5, color: '#ff5b4d', speed: 100, life: 0.3, size: 2 });
          if (t === G.player) {
            if (damagePlayer(G, b.damage)) { /* death handled by main */ }
          } else if (t.maxHp) {
            t.hp -= b.damage;
            if (t.hp <= 0) {
              if (G.enemies.includes(t)) {
                t.dead = true; G.stats.kills += 1; addCash(G, 40, t.x, t.y);
                addWanted(G, 0); // killing gangsters in a mission is the job
              } else if (t.police) {
                addWanted(G, 1);
                explodeCar(G, t);
              } else {
                t.hp = t.maxHp * 0.4; // traffic cars stall, they do not explode from one clip
                t.speed = 0;
              }
            }
          } else {
            t.hp -= b.damage;
            if (t.hp <= 0) { t.dead = true; G.stats.kills += 1; addWanted(G, 1); }
          }
          break;
        }
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }
  G.enemies = G.enemies.filter((e) => !e.dead);
}

export function resetGame(G, keepSave) {
  const p = G.player;
  p.x = 1400; p.y = 1000; p.hp = 100; p.armor = 0; p.inCar = null; p.invuln = 0; p.arrest = 0;
  G.wanted = 0; G.heat = 0; G.cops = []; G.enemies = []; G.bullets = [];
  G.timeOfDay = 9.5;
  if (!keepSave) {
    G.cash = 150; G.missionIndex = 0; G.completedMissions = 0; G.storyDone = false;
    G.stats = { kills: 0, stolen: 0, earned: 0, missions: 0, busted: 0 };
  }
}
