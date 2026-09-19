'use strict';
/* quests.js : quests, dialogue, interactables, HUD, finale */

// ---------------- quest data ----------------
const Q = {
  diyas:  { title: 'Light the Five Diyas',   giver: 'Pujari Raghav',  total: 5, n: 0, state: 'available', icon: '🪔' },
  modaks: { title: 'The Lost Modaks',        giver: 'Little Meera',   total: 7, n: 0, state: 'available', icon: '🍡' },
  bells:  { title: 'Song of the Bells',      giver: 'Sage Vyasa',     total: 3, n: 0, state: 'available', icon: '🔔' },
  mice:   { title: "Mushika's Cousins",      giver: 'Gardener Bhima', total: 4, n: 0, state: 'available', icon: '🐭' },
  lotus:  { title: 'A Garland of Lotuses',   giver: 'Garland Maker Lata', total: 6, n: 0, state: 'available', icon: '🌸' },
  aarti:  { title: 'The Grand Aarti',        giver: 'Pujari Raghav',  total: 1, n: 0, state: 'locked',    icon: '🔥' }
};
const questOrder = ['diyas', 'modaks', 'bells', 'mice', 'lotus', 'aarti'];
const doneCount = () => questOrder.filter(k => k !== 'aarti' && Q[k].state === 'done').length;

function addBlessings(n) { blessings += n; ui.bless.textContent = blessings; }

function progressQuest(key, reward) {
  const q = Q[key];
  if (q.state === 'done') return;
  q.n = Math.min(q.total, q.n + 1);
  addBlessings(reward);
  checkQuest(key);
  renderQuests();
}
function checkQuest(key) {
  const q = Q[key];
  if (q.state === 'active' && q.n >= q.total) completeQuest(key);
}
function completeQuest(key) {
  const q = Q[key];
  q.state = 'done';
  addBlessings(100);
  Sfx.quest();
  toast('✓ ' + q.title, 'Task complete • +100 blessings');
  skyPhase = doneCount();
  if (doneCount() === 5 && Q.aarti.state === 'locked') {
    Q.aarti.state = 'available';
    setTimeout(() => toast('The temple is ready', 'Return to Pujari Raghav for the Grand Aarti'), 2600);
  }
  refreshMarkers();
  renderQuests();
}
function activateQuest(key) {
  const q = Q[key];
  if (q.state !== 'available') return;
  q.state = 'active';
  Sfx.chime();
  toast('New task: ' + q.title, 'Follow the golden markers');
  refreshMarkers();
  checkQuest(key);
  renderQuests();
}

function renderQuests() {
  let html = '';
  for (const k of questOrder) {
    const q = Q[k];
    if (q.state === 'locked' || q.state === 'available') continue;
    const done = q.state === 'done';
    html += `<div class="q ${done ? 'done' : ''}"><span class="ic">${done ? '✓' : q.icon}</span><span class="t">${q.title}</span><span class="p">${done ? '' : q.n + '/' + q.total}</span></div>`;
  }
  const avail = questOrder.filter(k => Q[k].state === 'available');
  if (avail.length) html += `<div class="q hint"><span class="ic">✦</span><span class="t">Talk to ${avail.map(k => Q[k].giver).filter((v, i, a) => a.indexOf(v) === i).join(', ')}</span></div>`;
  ui.questList.innerHTML = html || '<div class="q hint"><span class="t">All tasks complete — explore freely!</span></div>';
}

// ---------------- toast & dialogue ----------------
function toast(main, sub) {
  ui.toast.innerHTML = main + (sub ? '<small>' + sub + '</small>' : '');
  ui.toast.style.opacity = 1;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { ui.toast.style.opacity = 0; }, 2600);
}

const dlg = { lines: [], i: 0, onClose: null, prev: 'playing' };
function showDialog(name, lines, onClose) {
  dlg.lines = lines; dlg.i = 0; dlg.onClose = onClose || null;
  dlg.prev = gameState === 'dialog' ? dlg.prev : gameState;
  gameState = 'dialog';
  ui.dlgName.textContent = name;
  ui.dlgText.textContent = lines[0];
  ui.dialog.style.display = 'block';
  ui.prompt.style.opacity = 0;
  Sfx.talk();
}
function advanceDialog() {
  dlg.i++;
  if (dlg.i < dlg.lines.length) { ui.dlgText.textContent = dlg.lines[dlg.i]; Sfx.talk(); return; }
  ui.dialog.style.display = 'none';
  gameState = dlg.prev === 'dialog' ? 'playing' : dlg.prev;
  const cb = dlg.onClose; dlg.onClose = null;
  if (cb) cb();
}
ui.dialog.addEventListener('click', () => { if (gameState === 'dialog') advanceDialog(); });

// ---------------- markers ----------------
function makeGlowRing(r, colorHex) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(r * 0.72, r, 36),
    new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  return ring;
}
function makeMarker(g, y) {
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), M.marker);
  m.position.y = y; m.visible = false; m.userData.baseY = y;
  g.add(m);
  return m;
}
function refreshMarkers() {
  for (const it of interactables) if (it.marker) it.marker.visible = !!(it.quest && Q[it.quest].state === 'active' && !it.done);
  for (const n of npcs) n.marker.visible = questOrder.some(k => Q[k].giver === n.name && Q[k].state === 'available');
}
function animateMarkers(dt, t) {
  for (const it of interactables) if (it.marker && it.marker.visible) { it.marker.rotation.y += dt * 2.5; it.marker.position.y = it.marker.userData.baseY + Math.sin(t * 3 + it.x) * 0.15; }
}

// ---------------- interactables ----------------
function buildDiya(x, z) {
  const g = new THREE.Group();
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 1.3, 8), M.brass); stand.position.y = 0.65; g.add(stand);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.12, 12), M.brass); base.position.y = 0.06; g.add(base);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.2, 0.28, 12), M.brass); bowl.position.y = 1.4; g.add(bowl);
  const flame = makeFlame(1.4); flame.position.y = 1.85; flame.visible = false; g.add(flame);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), M.glow.clone()); glow.position.y = 1.8; glow.visible = false; g.add(glow);
  const light = new THREE.PointLight(0xffa64d, 0, 12); light.position.y = 2; g.add(light);
  const beacon = makeGlowRing(1.1, 0xffb347); beacon.position.y = 0.05; g.add(beacon);
  animated.push((dt, t) => { if (it_g_done()) { beacon.material.opacity = 0.18; light.intensity = 1.2 + Math.sin(t * 4) * 0.35; } else beacon.material.opacity = 0.35 + Math.sin(t * 3) * 0.15; });
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.position.set(x, groundHeight(x, z), z);
  scene.add(g);
  addCircle(x, z, 0.5);
  const it = { x, z, r: INTERACT_R, quest: 'diyas', done: false, g, marker: makeMarker(g, 3.2),
    label: () => it.done ? null : 'Light the diya',
    use() {
      it.done = true; flame.visible = true; glow.visible = true; light.intensity = 1.3;
      Sfx.light(); progressQuest('diyas', 25); refreshMarkers();
      toast('🪔 Diya lit', Q.diyas.state === 'active' ? Q.diyas.n + ' of 5 glow' : 'Pujari Raghav will be pleased');
    } };
  function it_g_done() { return it.done; }
  interactables.push(it);
  world.diyas.push({ glow, light });
}

function buildBell(x, z, idx) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.6, 0.3), M.wood); post.position.set(s * 1.1, 1.8, 0); post.castShadow = true; g.add(post);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.3, 0.4), M.maroon); bar.position.y = 3.7; g.add(bar);
  for (const s of [-1.1, 1.1]) { const k = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 6), M.gold); k.position.set(s, 4.1, 0); g.add(k); }
  const pivot = new THREE.Group(); pivot.position.y = 3.55;
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 5), M.wood); rope.position.y = -0.35; pivot.add(rope);
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.6, 0.9, 14), M.brass); bell.position.y = -1.15; bell.castShadow = true; pivot.add(bell);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.07, 8, 18), M.gold); lip.position.y = -1.6; lip.rotation.x = Math.PI / 2; pivot.add(lip);
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), M.dark); clapper.position.y = -1.7; pivot.add(clapper);
  g.add(pivot);
  g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z) + Math.PI / 2;
  scene.add(g);
  addBox(x, z, 1.3, 0.5);
  let swing = 0;
  animated.push((dt, t) => { if (swing > 0.001) { pivot.rotation.z = Math.sin(t * 9) * swing; swing *= Math.pow(0.35, dt); } else pivot.rotation.z = 0; });
  const it = { x, z, r: INTERACT_R, quest: 'bells', done: false, g, marker: makeMarker(g, 5),
    label: () => it.done ? 'Ring the bell again' : 'Ring the temple bell',
    use() {
      swing = 0.55; Sfx.bell(idx);
      if (!it.done) { it.done = true; progressQuest('bells', 25); refreshMarkers(); toast('🔔 Bell rung', Q.bells.state === 'active' ? Q.bells.n + ' of 3' : 'Its song carries across the courtyard'); }
    } };
  interactables.push(it);
}

function buildModakPickup(x, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xb45309, emissiveIntensity: 0.6, roughness: 0.35 }));
  body.scale.set(1, 0.85, 1); body.position.y = 0.36; g.add(body);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 8), M.gold); tip.position.y = 0.76; g.add(tip);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), M.glow); glow.position.y = 0.4; g.add(glow);
  const mring = makeGlowRing(0.8, 0xffe08a); mring.position.y = -0.25; g.add(mring);
  animated.push((dt, t) => { if (!it2done()) mring.material.opacity = 0.4 + Math.sin(t * 4) * 0.2; });
  g.position.set(x, groundHeight(x, z) + 0.3, z);
  scene.add(g);
  const it = { x, z, r: 1.8, quest: 'modaks', done: false, g, marker: makeMarker(g, 2), auto: true,
    label: () => null,
    use() {
      it.done = true; scene.remove(g); modaksFound++;
      Sfx.chime(); progressQuest('modaks', 10); refreshMarkers();
      toast('🍡 Modak found', Q.modaks.state === 'active' ? Q.modaks.n + ' of 7' : 'Little Meera is looking for these');
    } };
  function it2done() { return it.done; }
  animated.push((dt, t) => { if (!it.done) { g.rotation.y += dt * 2; g.position.y = groundHeight(x, z) + 0.3 + Math.sin(t * 3 + x) * 0.12; } });
  interactables.push(it);
}

function buildHiddenMouse(x, z) {
  const m = buildMouse(0.45, 0xffa3c2);   // bright pink cousin — easy to spot
  m.g.position.set(x, groundHeight(x, z), z);
  m.g.rotation.y = rand(0, 6);
  scene.add(m.g);
  const mring = makeGlowRing(0.9, 0xff8fb8); mring.position.y = 0.04; scene.add(mring);
  mring.position.set(x, groundHeight(x, z) + 0.04, z);
  animated.push((dt, t) => { if (!it3done()) { mring.material.opacity = 0.4 + Math.sin(t * 4) * 0.2; mring.position.y = groundHeight(x, z) + 0.04; } else { mring.visible = false; } });
  const it = { x, z, r: INTERACT_R, quest: 'mice', done: false, g: m.g, marker: makeMarker(m.g, 3.2),
    label: () => it.done ? null : 'Call the little mouse',
    use() {
      it.done = true; scene.remove(m.g);
      const f = makeFollower(x, z);
      f.yaw = Math.atan2(player.x - x, player.z - z);
      Sfx.squeak(); progressQuest('mice', 30); refreshMarkers();
      toast('🐭 A cousin joins the parade!', Q.mice.state === 'active' ? Q.mice.n + ' of 4 found' : 'Gardener Bhima was looking for them');
    } };
  function it3done() { return it.done; }
  animated.push((dt, t) => { if (!it.done) { m.g.position.y = groundHeight(x, z) + Math.abs(Math.sin(t * 5 + x)) * 0.08; m.ears[0].rotation.z = -0.35 + Math.sin(t * 6) * 0.25; } });
  interactables.push(it);
}

// lotus blossoms floating on the pond (Garland Maker Lata's quest)
function buildLotusFlower(x, z) {
  const g = buildLotus();
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), M.glow); glow.position.y = 0.5; g.add(glow);
  const lring = makeGlowRing(1.2, 0xff9ecb); lring.position.y = 0.1; g.add(lring);
  g.position.set(x, 0.18, z);
  scene.add(g);
  const it = { x, z, r: 5.5, quest: 'lotus', done: false, g, marker: makeMarker(g, 2.2),
    label: () => it.done ? null : 'Pluck the lotus',
    use() {
      it.done = true; scene.remove(g);
      Sfx.chime(); progressQuest('lotus', 15); refreshMarkers();
      toast('🌸 Lotus plucked', Q.lotus.state === 'active' ? Q.lotus.n + ' of 6' : 'Garland Maker Lata needs these');
    } };
  animated.push((dt, t) => { if (!it.done) g.position.y = 0.18 + Math.sin(t * 1.6 + x) * 0.05; });
  interactables.push(it);
}

function buildAltarInteract() {
  const a = world.altar;
  const it = { x: 0, z: 5.7, r: 3.4, quest: 'aarti', done: false, g: a.g, marker: makeMarker(a.g, 4.6),
    label: () => (Q.aarti.state === 'active' && !it.done) ? 'Begin the Grand Aarti' : null,
    use() { it.done = true; refreshMarkers(); startCelebration(); } };
  interactables.push(it);
}

// ---------------- NPC dialogue ----------------
function npcInteract(npc) {
  const name = npc.name;
  const rag = () => {
    if (Q.aarti.state === 'available') return showDialog(name, [
      'Vinayaka! The diyas glow, the bells have sung, the modaks are home, Mushika\'s cousins parade behind you, and Lata\'s garland is woven.',
      'Everything is ready. When you are, step up to the sacred lamp in the mandapa and begin the Grand Aarti!'
    ], () => { activateQuest('aarti'); });
    if (Q.aarti.state === 'active') return showDialog(name, ['The sacred lamp awaits you in the mandapa, Lord. We are all gathered!']);
    if (Q.aarti.state === 'done') return showDialog(name, ['What a night! Every devotee will remember this aarti forever. Ganapati Bappa Morya!']);
    if (Q.diyas.state === 'available') return showDialog(name, [
      'Vinayaka! You honour our little temple. Tonight is the grand aarti — but the five brass diyas around the courtyard lie dark.',
      'One stands by each corner shrine, and one beside the lotus pond. Would you carry your flame to them, Lord?'
    ], () => activateQuest('diyas'));
    if (Q.diyas.state === 'active') return showDialog(name, [Q.diyas.n + ' of the five diyas glow. Look for the golden markers by the shrines and the pond.']);
    return showDialog(name, ['The courtyard shines because of you. Help the others, and the Grand Aarti can begin!']);
  };
  const meera = () => {
    if (Q.modaks.state === 'available') return showDialog(name, [
      'Ganesha-ji! I made seven modaks for you all by myself… but my basket tipped over and they rolled all over the temple garden!',
      'Could you find them? Mushika can sniff them out, I\'m sure. They\'re a little dusty but still sweet!'
    ], () => activateQuest('modaks'));
    if (Q.modaks.state === 'active') return showDialog(name, ['You\'ve found ' + Q.modaks.n + ' of 7 modaks! Keep looking near the lawns, the walls and behind the shrines.']);
    return showDialog(name, ['You found every single one! You can keep them all — you\'re Ganesha, after all. Hehe!']);
  };
  const vyasa = () => {
    if (Q.bells.state === 'available') return showDialog(name, [
      'Ah, Ekadanta. Long ago you wrote down my Mahabharata without pausing, even breaking your tusk to keep the pen moving.',
      'Tonight I ask something smaller: ring the three great temple bells, so all the worlds know that we gather here.'
    ], () => activateQuest('bells'));
    if (Q.bells.state === 'active') return showDialog(name, [Q.bells.n + ' of three bells have sung. The bell frames stand north of the temple.']);
    return showDialog(name, ['The bells still hum in the air. The gods have surely heard us tonight.']);
  };
  const bhima = () => {
    if (Q.mice.state === 'available') return showDialog(name, [
      'Lord, forgive me — four of Mushika\'s little cousins came to visit and scattered across the grounds when I started watering!',
      'They hide behind shrines, under the banyan, inside the mandapa… Could you call them home? They only listen to Mushika.'
    ], () => activateQuest('mice'));
    if (Q.mice.state === 'active') return showDialog(name, [Q.mice.n + ' of four found. Check behind the far shrines, under the great banyan and up in the mandapa.']);
    return showDialog(name, ['Look at them all trailing behind Mushika! A whole parade of mice. Bless you, Lord.']);
  };
  const lata = () => {
    if (Q.lotus.state === 'available') return showDialog(name, [
      'Namaste, Vinayaka! For tonight\'s aarti I must weave a garland fit for you — but the pond\'s lotuses close at dusk and my old knees are slow.',
      'Six blossoms is what I need. Would you pluck them from the pond? The water gives gladly to its lord — just reach from the bank.'
    ], () => activateQuest('lotus'));
    if (Q.lotus.state === 'active') return showDialog(name, [Q.lotus.n + ' of 6 lotuses gathered. They gleam pink out on the water — follow the golden markers.']);
    return showDialog(name, ['Feel how the garland breathes! Six lotuses, woven with love. It will crown the aarti beautifully.']);
  };
  ({ 'Pujari Raghav': rag, 'Little Meera': meera, 'Sage Vyasa': vyasa, 'Gardener Bhima': bhima, 'Garland Maker Lata': lata })[name]();
}

function buildQuestWorld() {
  // NPCs
  const defs = [
    { name: 'Pujari Raghav',  x: 3.2, z: 12.6, yaw: Math.PI, cloth: 0xfff3d6, dhoti: true, shawl: 0xffb020, prop: 'thali', skin: 0xd99a62 },
    { name: 'Little Meera',   x: 22,  z: 36,   yaw: -0.6, cloth: 0xff6b9d, shirt: 0xffd166, scale: 0.7, braid: true, prop: 'basket', skin: 0xc98a5a },
    { name: 'Sage Vyasa',     x: -29, z: 8,    yaw: 1.4, cloth: 0xffb347, dhoti: true, beard: true, hair: 0xf5f5f5, prop: 'staff', skin: 0xbd8a5e },
    { name: 'Gardener Bhima', x: -24, z: -32,  yaw: 0.8, cloth: 0x2a9d8f, shirt: 0x8bd450, turban: 0xff4d4d, prop: 'watering', skin: 0x9c6a44 },
    { name: 'Garland Maker Lata', x: 36, z: 20, yaw: -0.8, cloth: 0xc084fc, shirt: 0xffe066, braid: true, prop: 'basket', skin: 0xc98a5a }
  ];
  for (const d of defs) {
    const npc = buildNPC(d);
    interactables.push({ x: d.x, z: d.z, r: INTERACT_R + 0.4, npc, label: () => 'Talk to ' + d.name, use: () => npcInteract(npc) });
  }
  // diyas: one in front of each shrine, one by the pond
  for (const [x, z] of [[-38, -38], [38, -38], [-38, 38], [38, 38], [21, 20]]) buildDiya(x, z);
  // bells north of the temple
  [[16, -15], [-16, -15], [0, -26]].forEach(([x, z], i) => buildBell(x, z, i));
  // modaks scattered around
  for (const [x, z] of [[9, 40], [-15, 44], [36, -10], [-40, -20], [41, 33], [-8, -46], [46, 8]]) buildModakPickup(x, z);
  // lotuses floating on the pond
  for (const [x, z] of [[26, 22], [34, 23], [29, 31], [33, 29], [25, 28], [31, 20]]) buildLotusFlower(x, z);
  // hidden mice
  for (const [x, z] of [[42, 46.5], [-34.5, 14.5], [2.4, 7], [-46.5, -46.5]]) buildHiddenMouse(x, z);
  buildAltarInteract();
  refreshMarkers();
  renderQuests();
}

// ---------------- celebration / fireworks ----------------
const fireworks = [];
let celebT = -1;
function spawnFirework() {
  const n = 90;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), vel = [];
  const hue = Math.random();
  const col = new THREE.Color().setHSL(hue, 0.9, 0.65);
  const cx = rand(-30, 30), cy = rand(22, 38), cz = rand(-40, 20);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = cx; pos[i * 3 + 1] = cy; pos[i * 3 + 2] = cz;
    const th = rand(0, Math.PI * 2), ph = Math.acos(rand(-1, 1)), s = rand(6, 12);
    vel.push(Math.sin(ph) * Math.cos(th) * s, Math.cos(ph) * s, Math.sin(ph) * Math.sin(th) * s);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: col, size: 0.45, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(pts);
  fireworks.push({ pts, vel, life: 0 });
  Sfx.boom();
}
function updateFireworks(dt) {
  for (let i = fireworks.length - 1; i >= 0; i--) {
    const f = fireworks[i];
    f.life += dt;
    const p = f.pts.geometry.attributes.position;
    for (let j = 0; j < p.count; j++) {
      f.vel[j * 3 + 1] -= 9 * dt;
      p.setXYZ(j, p.getX(j) + f.vel[j * 3] * dt, p.getY(j) + f.vel[j * 3 + 1] * dt, p.getZ(j) + f.vel[j * 3 + 2] * dt);
    }
    p.needsUpdate = true;
    f.pts.material.opacity = Math.max(0, 1 - f.life / 2);
    if (f.life > 2) { scene.remove(f.pts); f.pts.geometry.dispose(); f.pts.material.dispose(); fireworks.splice(i, 1); }
  }
}
function startCelebration() {
  gameState = 'cutscene';
  celebT = 0;
  Q.aarti.n = 1; Q.aarti.state = 'done';
  skyPhase = 5;
  addBlessings(500);
  const a = world.altar;
  a.flame.visible = true; a.glow.visible = true; a.light.intensity = 3;
  for (const d of world.diyas) { d.light.intensity = 2.2; }
  ui.prompt.style.opacity = 0;
  Sfx.aarti();
  toast('🔥 GANAPATI BAPPA MORYA! 🔥', 'The Grand Aarti begins');
  renderQuests();
}
function updateCelebration(dt, t) {
  if (celebT < 0) return;
  celebT += dt;
  if (Math.floor(celebT * 2.4) !== Math.floor((celebT - dt) * 2.4)) spawnFirework();
  // orbiting camera around the temple
  const ang = -0.4 + celebT * 0.35;
  camera.position.set(Math.sin(ang) * 30, 10 + Math.sin(celebT * 0.6) * 2, 5 + Math.cos(ang) * 30);
  camera.lookAt(0, 7, -1);
  if (celebT > 11) {
    celebT = -1;
    gameState = 'end';
    $('end-bless').textContent = blessings;
    $('end-time').textContent = fmtTime(playTime);
    $('end-modaks').textContent = modaksFound;
    ui.end.classList.remove('hidden');
  }
}
