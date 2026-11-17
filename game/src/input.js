// Keyboard and mouse input for Harbor Lights. Held keys steer and drive;
// one-shot presses (enter car, interact, pause, mute, dialogue) are queued
// as flags and taken once by the loop, so a press between frames is never
// lost and never counted twice.
export const ACT_ENTER = 1;
export const ACT_INTERACT = 2;
export const ACT_PAUSE = 4;
export const ACT_MUTE = 8;
export const ACT_CONFIRM = 16;
export const ACT_RESTART = 32;

export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 640, y: 360, down: false, clicked: false };
  let actions = 0;

  function press(code) {
    if (code === 'KeyE') actions |= ACT_ENTER;
    else if (code === 'KeyF') actions |= ACT_INTERACT;
    else if (code === 'KeyP' || code === 'Escape') actions |= ACT_PAUSE;
    else if (code === 'KeyM') actions |= ACT_MUTE;
    else if (code === 'Enter' || code === 'Space') actions |= ACT_CONFIRM;
    else if (code === 'KeyR') actions |= ACT_RESTART;
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    keys.add(event.code);
    if (!event.repeat) press(event.code);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });
  canvas.addEventListener('pointermove', (event) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = event.clientX - r.left;
    mouse.y = event.clientY - r.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = event.clientX - r.left;
    mouse.y = event.clientY - r.top;
    mouse.down = true;
    mouse.clicked = true;
  });
  window.addEventListener('pointerup', () => { mouse.down = false; });

  return {
    keys, mouse,
    /** -1/0/1 for left-right and up-down movement keys. */
    moveX() { return (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0); },
    moveY() { return (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0); },
    takeActions() { const t = actions; actions = 0; return t; },
    takeClick() { const c = mouse.clicked; mouse.clicked = false; return c; },
  };
}
