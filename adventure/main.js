'use strict';
/* ============================================================
   main.js : input, touch controls, camera, game loop, boot
   ============================================================ */

// ---------------- camera / input state ----------------
let camYaw = 0, camPitch = 0.34, camDist = 14;
let jumpQueued = false;
let touchRun = false;

// ---------------- keyboard ----------------
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'Space' && !e.repeat) jumpQueued = true;
  if (e.code === 'KeyE' && !e.repeat) tryInteract();
  Sfx.ensure();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

// ---------------- interaction ----------------
let curTarget = null;
function nearestInteractable() {
  let best = null, bd = 1e9;
  for (const it of interactables) {
    if (it.auto) continue;
    const l = it.label ? it.label() : null;
    if (!l) continue;
    const d = Math.hypot(player.x - it.x, player.z - it.z);
    if (d < it.r && d < bd) { best = it; bd = d; }
  }
  return best;
}
function updateInteract() {
  if (gameState !== 'playing') {
    if (curTarget) { curTarget = null; ui.prompt.style.opacity = 0; }
    return;
  }
  const it = nearestInteractable();
  curTarget = it;
  if (it) { ui.promptText.textContent = it.label(); ui.prompt.style.opacity = 1; }
  else ui.prompt.style.opacity = 0;
}
function tryInteract() {
  if (gameState === 'dialog') { advanceDialog(); return; }
  if (gameState !== 'playing') return;
  if (curTarget) curTarget.use();
}
function autoPickups() {
  if (gameState !== 'playing') return;
  for (const it of interactables) {
    if (!it.auto || it.done) continue;
    if (Math.hypot(player.x - it.x, player.z - it.z) < it.r) it.use();
  }
}

// ---------------- player movement ----------------
function updatePlayer(dt) {
  const canMove = gameState === 'playing';
  let ix = 0, fy = 0;
  if (canMove) {
    if (keys.KeyW || keys.ArrowUp) fy += 1;
    if (keys.KeyS || keys.ArrowDown) fy -= 1;
    if (keys.KeyA || keys.ArrowLeft) ix -= 1;
    if (keys.KeyD || keys.ArrowRight) ix += 1;
    if (joy.active) { ix = joy.dx; fy = -joy.dy; }
  }
  const len = Math.hypot(ix, fy);
  player.moving = len > 0.05;
  const run = !!(keys.ShiftLeft || keys.ShiftRight || touchRun);
  player.speed = player.moving ? (run ? RUN_SPEED : WALK_SPEED) : 0;
  if (player.moving) {
    const inv = 1 / len;
    ix *= inv; fy *= inv;
    // camera-relative movement
    const s = Math.sin(camYaw), c = Math.cos(camYaw);
    const mx = -s * fy + c * ix;
    const mz = -c * fy - s * ix;
    player.x += mx * player.speed * dt;
    player.z += mz * player.speed * dt;
    player.yaw = lerpAngle(player.yaw, Math.atan2(mx, mz), clamp(dt * 10, 0, 1));
  }
  resolveCollisions(player, PLAYER_R);

  if (jumpQueued && canMove && player.grounded) {
    player.vy = JUMP_V; player.grounded = false; Sfx.hop();
  }
  jumpQueued = false;

  if (!player.grounded) {
    player.vy -= GRAVITY * dt;
    player.y += player.vy * dt;
    const gh = groundHeight(player.x, player.z);
    if (player.y <= gh) { player.y = gh; player.vy = 0; player.grounded = true; }
  } else {
    const gh = groundHeight(player.x, player.z);
    if (player.y > gh + 0.05) { player.grounded = false; player.vy = 0; }  // stepped off an edge
    else player.y = gh;
  }
  player.g.position.set(player.x, player.y, player.z);
  player.g.rotation.y = player.yaw;
}

// ---------------- camera ----------------
function updateCamera(dt) {
  if (gameState === 'cutscene') return;   // celebration drives its own camera
  const k = clamp(dt * 8, 0, 1);
  const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
  const tx = player.x + Math.sin(camYaw) * cp * camDist;
  const tz = player.z + Math.cos(camYaw) * cp * camDist;
  const ty = player.y + 2.0 + sp * camDist;
  camera.position.x = lerp(camera.position.x, tx, k);
  camera.position.y = lerp(camera.position.y, Math.max(ty, 1.4), k);
  camera.position.z = lerp(camera.position.z, tz, k);
  camera.lookAt(player.x, player.y + 1.9, player.z);
}

// ---------------- mouse look & zoom ----------------
function initMouseLook() {
  const cv = $('c');
  let dragging = false, dragId = null, lastPX = 0, lastPY = 0;
  cv.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') return;
    dragging = true; dragId = e.pointerId;
    lastPX = e.clientX; lastPY = e.clientY;
    cv.classList.add('dragging');
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  });
  window.addEventListener('pointermove', e => {
    if (!dragging || e.pointerId !== dragId) return;
    camYaw -= (e.clientX - lastPX) * 0.005;
    camPitch = clamp(camPitch + (e.clientY - lastPY) * 0.004, 0.06, 1.05);
    lastPX = e.clientX; lastPY = e.clientY;
  });
  const stop = e => {
    if (e.pointerId !== dragId) return;
    dragging = false; dragId = null;
    cv.classList.remove('dragging');
  };
  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', stop);
  window.addEventListener('wheel', e => {
    camDist = clamp(camDist + Math.sign(e.deltaY) * 1.2, 8, 26);
  }, { passive: true });
}

// ---------------- touch controls ----------------
const joy = { active: false, dx: 0, dy: 0, id: null };
function initTouch() {
  const joyEl = $('joy');
  const knob = joyEl.querySelector('.knob');
  const R = 48;
  let cx = 0, cy = 0;
  const move = e => {
    if (!joy.active || e.pointerId !== joy.id) return;
    let dx = (e.clientX - cx) / R, dy = (e.clientY - cy) / R;
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    joy.dx = dx; joy.dy = dy;
    knob.style.transform = 'translate(' + dx * R + 'px,' + dy * R + 'px)';
  };
  const end = e => {
    if (e.pointerId !== joy.id) return;
    joy.active = false; joy.dx = joy.dy = 0; joy.id = null;
    knob.style.transform = '';
  };
  joyEl.addEventListener('pointerdown', e => {
    joy.active = true; joy.id = e.pointerId;
    const r = joyEl.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    try { joyEl.setPointerCapture(e.pointerId); } catch (err) {}
    move(e);
    e.preventDefault();
  });
  joyEl.addEventListener('pointermove', move);
  joyEl.addEventListener('pointerup', end);
  joyEl.addEventListener('pointercancel', end);

  $('tb-act').addEventListener('pointerdown', e => { e.preventDefault(); tryInteract(); });
  $('tb-jump').addEventListener('pointerdown', e => { e.preventDefault(); jumpQueued = true; });
  const runBtn = $('tb-run');
  runBtn.addEventListener('pointerdown', e => { e.preventDefault(); touchRun = true; });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) runBtn.addEventListener(ev, () => { touchRun = false; });

  // show touch controls the first time a touch pointer is used
  window.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') document.body.classList.add('touch');
  });
}

// ---------------- game flow ----------------
function startGame() {
  gameState = 'playing';
  ui.menu.classList.add('hidden');
  ui.hud.style.display = 'block';
  playTime = 0;
  Sfx.ensure();
  renderQuests();
}
$('play-btn').addEventListener('click', startGame);
$('continue-btn').addEventListener('click', () => {
  ui.end.classList.add('hidden');
  gameState = 'playing';
});

// ---------------- main loop ----------------
function update(dt, t) {
  if (gameState === 'playing') { playTime += dt; ui.time.textContent = fmtTime(playTime); }
  if (gameState === 'playing' || gameState === 'dialog') updatePlayer(dt);
  else jumpQueued = false;
  updateInteract();
  autoPickups();
  animatePlayer(dt, t);
  animateNPCs(dt, t);
  updateFollowers(dt, t);
  for (const fn of animated) fn(dt, t);
  updateFlames(t);
  animateMarkers(dt, t);
  updateFireworks(dt);
  if (gameState === 'cutscene') updateCelebration(dt, t);
  updateSky(dt);
  for (const cl of clouds) { cl.position.x += cl.userData.drift * dt; if (cl.position.x > 380) cl.position.x = -380; }
  if (gameState === 'menu') camYaw += dt * 0.1;   // gentle menu orbit
  updateCamera(dt);
  renderer.render(scene, camera);
}
function loop(tms) {
  requestAnimationFrame(loop);
  const t = tms / 1000;
  const dt = Math.min(t - lastT, 0.05);
  lastT = t;
  update(dt, t);
}

// ---------------- boot ----------------
function boot() {
  player.z = 38;              // spawn clear of the gate so the camera starts inside the walls
  initThree();
  makeMats();
  buildSky();
  buildWorld();
  buildPlayer();
  buildQuestWorld();
  // register every material in the scene so reflections dim at night
  scene.traverse(o => {
    if (o.isMesh && o.material && o.material.isMeshStandardMaterial && !envMats.includes(o.material)) envMats.push(o.material);
  });
  initMouseLook();
  initTouch();
  updateCamera(1000);         // snap to the initial framing
  ui.loading.classList.add('hidden');
  ui.menu.classList.remove('hidden');
  gameState = 'menu';
  requestAnimationFrame(loop);
}
boot();
