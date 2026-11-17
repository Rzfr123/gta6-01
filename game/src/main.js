// Harbor Lights — boot and the one loop: input every frame, the world in
// fixed 1/60 s steps, and the renderer paints what is there. Screens:
// title, play, paused, busted, dead, done. Autosaves on mission events
// and every 10 seconds. ?shot=title|driving|wanted|mission stages a
// screenshot scene instead of running the loop, paints twice and sets
// window.__shotReady. Debug state for play-tests: window.__solmar.
import { STEP, WORLD } from './config.js';
import { createRandom } from './random.js';
import { createGame, spawnParkedCars, spawnPeds, spawnPickup, updatePlayerOnFoot, updatePlayerCar, updateBullets, resetGame, addWanted, showToast } from './state.js';
import { createInput, ACT_ENTER, ACT_INTERACT, ACT_PAUSE, ACT_MUTE, ACT_CONFIRM, ACT_RESTART } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_BUSTED, SCREEN_DEAD, SCREEN_DONE } from './render.js';
import { createParticles, updateParticles, burst } from './particles.js';
import { spawnTraffic, updateTraffic, updatePeds } from './traffic.js';
import { updatePolice, payAndSpray } from './police.js';
import { startMission, updateMission, missionTarget } from './missions.js';
import { loadSave, saveGame } from './storage.js';
import { unlockAudio, setMuted, isMuted, startMusic, sfx } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261118;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const G = createGame(createRandom(seed));
G.particles = createParticles();
const renderer = createRenderer(canvas);
const save = loadSave();
if (save) {
  G.cash = save.cash ?? 150; G.missionIndex = save.mission ?? 0;
  G.completedMissions = save.completed ?? 0; G.storyDone = !!save.storyDone;
  G.stats.kills = save.kills ?? 0; G.stats.stolen = save.stolen ?? 0; G.stats.earned = save.earned ?? 0;
  G.player.x = save.x ?? 1400; G.player.y = save.y ?? 1000;
  G.player.hp = save.hp ?? 100; G.player.armor = save.armor ?? 0;
  G.timeOfDay = save.time ?? 9.5; G.best = save.best ?? 0;
}
spawnParkedCars(G);
spawnPeds(G, 20);
spawnTraffic(G, 12);
// Landmark pickups: health + armor near the safehouse, cash in the park.
spawnPickup(G, 640, 260, 'health', 50);
spawnPickup(G, 700, 260, 'armor', 50);
spawnPickup(G, 1560, 420, 'cash', 100);
spawnPickup(G, 2600, 1460, 'health', 50);

function runShot(name) {
  const scene = stageShot(G, name);
  let painted = 0;
  function paint() {
    renderer.draw(G, scene.screen, save);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = 0;
  let sirenTimer = 0;

  function announce(msg) { status.textContent = msg; }
  function mouseWorld() {
    const scale = Math.min(canvas.width / 1280, canvas.height / 720);
    const ox = (canvas.width - 1280 * scale) / 2;
    const oy = (canvas.height - 720 * scale) / 2;
    const wx = (input.mouse.x * (window.devicePixelRatio || 1) - ox) / scale + G.camera.x;
    const wy = (input.mouse.y * (window.devicePixelRatio || 1) - oy) / scale + G.camera.y;
    return { x: wx, y: wy };
  }

  function startStory() {
    if (!G.mission && G.missionIndex < 6) startMission(G);
    screen = SCREEN_PLAY;
    unlockAudio(); startMusic();
    announce('Playing Harbor Lights. Follow the yellow marker.');
  }

  function enterOrExitCar() {
    const p = G.player;
    if (p.inCar) {
      const car = p.inCar;
      p.inCar = null;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
      p.angle = car.angle;
      return;
    }
    let best = null; let bestD = 70;
    for (const car of G.cars) {
      if (car.dead) continue;
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d < bestD) { best = car; bestD = d; }
    }
    if (best) {
      p.inCar = best;
      best.traffic = false;
      if (best.driver !== 'player') {
        G.stats.stolen += 1;
        if (best.type !== 'police') addWanted(G, 1);
        else addWanted(G, 2);
        showToast(G, `Stole the ${best.name}!`, 2);
        sfx.steal();
      }
      best.driver = 'player';
      p.x = best.x; p.y = best.y;
    }
  }

  function interact() {
    const p = G.player;
    // Pay-and-spray garage at (2600, 1400).
    if (Math.hypot(p.x - 2600, p.y - 1400) < 80 && G.wanted > 0) {
      if (payAndSpray(G)) sfx.cash();
      else showToast(G, 'Spray shop: $200 to clear the heat. You are short.', 3);
      return;
    }
    // Advance dialogue.
    if (G.dialogue) { advanceDialogue(); return; }
  }

  function advanceDialogue() {
    const d = G.dialogue;
    d.index += 1;
    if (d.index >= d.lines.length) G.dialogue = null;
  }

  function handleActions() {
    const a = input.takeActions();
    if (a & ACT_MUTE) setMuted(!isMuted());
    if (screen === SCREEN_TITLE) {
      if (a & ACT_CONFIRM || input.takeClick()) startStory();
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (a & (ACT_PAUSE | ACT_CONFIRM)) screen = SCREEN_PLAY;
      else if (a & ACT_RESTART) { resetGame(G, false); startMission(G); screen = SCREEN_PLAY; }
      return;
    }
    if (screen === SCREEN_BUSTED || screen === SCREEN_DEAD) {
      if (a & ACT_CONFIRM) { screen = SCREEN_PLAY; if (G.storyDone) screen = SCREEN_PLAY; }
      return;
    }
    if (screen === SCREEN_DONE) {
      if (a & ACT_CONFIRM) screen = SCREEN_PLAY;
      return;
    }
    if (a & ACT_PAUSE) { screen = SCREEN_PAUSED; announce('Paused.'); return; }
    if (a & ACT_ENTER) enterOrExitCar();
    if (a & ACT_INTERACT) interact();
    if (a & ACT_CONFIRM && G.dialogue) advanceDialogue();
    if (a & ACT_RESTART) { resetGame(G, false); startMission(G); }
  }

  function step() {
    const dt = STEP;
    G.time += dt;
    G.timeOfDay = (G.timeOfDay + dt / 240) % 24;
    // Weather: rain comes and goes.
    G.rainTimer -= dt;
    if (G.rainTimer <= 0) {
      G.weather = G.weather === 'rain' ? 'sunny' : 'rain';
      G.rainTimer = 30 + G.random() * 60;
    }
    if (G.toastTimer > 0) G.toastTimer -= dt;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
    // Autosave runs even while mission dialogue is up: otherwise a player
    // who quits during the intro of the next mission loses the reward they
    // just earned, because step() returns early below while dialogue shows.
    saveTimer += dt;
    if (saveTimer > 10) { saveTimer = 0; saveGame(G); }
    const mw = mouseWorld();
    G.aimAngle = Math.atan2(mw.y - G.player.y, mw.x - G.player.x);
    if (G.dialogue) {
      // World idles behind dialogue; traffic still moves.
      updateTraffic(G, dt);
      updateParticles(G.particles, dt);
      return;
    }
    if (G.player.inCar) updatePlayerCar(G, input, dt);
    else updatePlayerOnFoot(G, input, dt, mw);
    updateTraffic(G, dt);
    updatePeds(G, dt);
    updatePolice(G, dt);
    updateMission(G, dt, input);
    updateBullets(G, dt);
    updateParticles(G.particles, dt);
    // Pickups.
    const p = G.player;
    for (let i = G.pickups.length - 1; i >= 0; i -= 1) {
      const pk = G.pickups[i];
      if (Math.hypot(pk.x - p.x, pk.y - p.y) < 30) {
        if (pk.kind === 'health') { p.hp = Math.min(100, p.hp + 50); showToast(G, 'Health +50', 2); }
        else if (pk.kind === 'armor') { p.armor = Math.min(100, p.armor + 50); showToast(G, 'Armor +50', 2); }
        else { G.cash += pk.value; G.stats.earned += pk.value; showToast(G, `Found $${pk.value}`, 2); }
        sfx.pickup();
        G.pickups.splice(i, 1);
      }
    }
    // Car-vs-car collisions (player car vs others).
    if (p.inCar) {
      for (const car of G.cars) {
        if (car === p.inCar || car.dead) continue;
        const d = Math.hypot(car.x - p.inCar.x, car.y - p.inCar.y);
        if (d < 40) {
          const impact = Math.abs(p.inCar.speed) + Math.abs(car.speed);
          if (impact > 220) {
            car.hp -= 10; p.inCar.hp -= 8;
            p.inCar.speed *= 0.5; car.speed *= 0.5;
            burst(G.particles, car.x, car.y, { count: 6, color: '#ffb347', speed: 120, life: 0.4, size: 3 });
            sfx.crash();
            if (car.hp <= 0 && car.police) addWanted(G, 1);
          }
          // Push apart.
          const push = (40 - d) / 2 || 1;
          const nx = (car.x - p.inCar.x) / (d || 1);
          const ny = (car.y - p.inCar.y) / (d || 1);
          car.x += nx * push; car.y += ny * push;
          p.inCar.x -= nx * push; p.inCar.y -= ny * push;
        }
      }
      if (p.inCar.hp <= 0) { /* explodeCar handles exit */ }
    }
    // Death / busted / story done.
    if (p.hp <= 0) {
      screen = SCREEN_DEAD;
      p.hp = 100; p.x = 1400; p.y = 1400; p.inCar = null;
      G.cash = Math.max(0, G.cash - 100);
      announce('Wasted. Woke up at the hospital, $100 lighter.');
      return;
    }
    if (G.storyDone && screen === SCREEN_PLAY && !G._doneShown) {
      G._doneShown = true;
      screen = SCREEN_DONE;
    }
    // Camera follows the player, clamped to the world.
    G.camera.x = Math.max(0, Math.min(WORLD.width - 1280, p.x - 640));
    G.camera.y = Math.max(0, Math.min(WORLD.height - 720, p.y - 360));
    // Siren ambience while wanted.
    sirenTimer -= dt;
    if (G.wanted > 0 && sirenTimer <= 0) { sirenTimer = 2.2; sfx.siren(); }
    // Debug state is written by updateDebug() in frame(), the single source.
  }

  function updateDebug() {
    const p = G.player;
    window.__solmar = {
      mode: screen, x: Math.round(p.x), y: Math.round(p.y), hp: Math.round(p.hp),
      cash: G.cash, wanted: G.wanted, mission: G.missionIndex, missionStep: G.mission ? G.mission.step : -1,
      inCar: !!p.inCar, enemies: G.enemies.length, cops: G.cops.length,
      cars: G.cars.filter((c) => !c.dead).length, peds: G.peds.length,
      storyDone: G.storyDone, kills: G.stats.kills, stolen: G.stats.stolen,
      dialogue: !!G.dialogue,
      target: missionTarget(G),
    };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    updateDebug();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) { step(); accumulator -= STEP; }
    } else {
      accumulator = 0;
      // Title backdrop: slow camera drift over Downtown.
      if (screen === SCREEN_TITLE) {
        G.time += STEP;
        G.camera.x = 1200 + Math.sin(G.time * 0.05) * 300;
        G.camera.y = 800 + Math.cos(G.time * 0.04) * 200;
        updateTraffic(G, STEP);
        updateParticles(G.particles, STEP);
      }
    }
    renderer.draw(G, screen, save);
  }

  // Camera starts on the player for the title backdrop.
  G.camera.x = Math.max(0, Math.min(WORLD.width - 1280, G.player.x - 640));
  G.camera.y = Math.max(0, Math.min(WORLD.height - 720, G.player.y - 360));
  window.__solmar = { mode: 'title', x: G.player.x, y: G.player.y, hp: 100, cash: G.cash, wanted: 0, mission: G.missionIndex, missionStep: -1, inCar: false, enemies: 0, cops: 0, cars: G.cars.length, peds: G.peds.length, storyDone: false, kills: 0, stolen: 0 };
  announce('Harbor Lights. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

window.__G = G; // debug handle for headless play-tests
if (shot) runShot(shot);
else runGame();
