'use strict';
/* ============================================================
   VINAYAKA & MUSHIKA — Temple of Modaks
   core.js : helpers, config, state, audio, renderer, sky
   ============================================================ */

// ---------------- helpers ----------------
const rand  = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp  = (a, b, t) => a + (b - a) * t;
const $ = id => document.getElementById(id);
function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
const fmtTime = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

// ---------------- config ----------------
const WORLD_HALF = 55;       // playable bounds
const WALK_SPEED = 9;
const RUN_SPEED = 15;
const JUMP_V = 11;
const GRAVITY = 32;
const PLAYER_R = 0.8;
const INTERACT_R = 3.2;

// ---------------- state ----------------
let renderer, scene, camera, sun, hemi, fillLight;
let gameState = 'loading';   // loading | menu | playing | dialog | cutscene | end
let lastT = 0;
let blessings = 0, playTime = 0, modaksFound = 0;

const colliders = [];      // {type:'box',x,z,hw,hd} | {type:'circle',x,z,r}
const interactables = [];  // {x,z,r,label():string|null,use(),marker?:Mesh,g?:Object3D}
const animated = [];       // fn(dt,t)
const flames = [];         // flickering flame meshes
const keys = {};

const ui = {
  hud: $('hud'), questList: $('quest-list'), bless: $('bless'), time: $('time'),
  prompt: $('prompt'), promptText: $('prompt-text'), toast: $('toast'),
  dialog: $('dialog'), dlgName: $('dlg-name'), dlgText: $('dlg-text'),
  loading: $('loading-screen'), menu: $('menu-screen'), end: $('end-screen')
};

// ---------------- audio (tiny synth) ----------------
const Sfx = {
  ctx: null,
  ensure() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone(freq, dur, type, vol, slideTo, delay) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + (delay || 0);
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },
  chime()  { this.tone(880, 0.14, 'sine', 0.1); this.tone(1320, 0.2, 'sine', 0.06, 0, 0.05); },
  hop()    { this.tone(320, 0.14, 'triangle', 0.08, 560); },
  talk()   { this.tone(520, 0.08, 'triangle', 0.06); this.tone(640, 0.1, 'triangle', 0.05, 0, 0.07); },
  light()  { this.tone(420, 0.35, 'sine', 0.12, 980); this.tone(1400, 0.4, 'sine', 0.04, 0, 0.1); },
  bell(n)  { const f = [1046, 1174, 1318][n || 0]; this.tone(f, 1.6, 'sine', 0.14); this.tone(f * 1.5, 1.1, 'sine', 0.06); this.tone(f * 2.4, 0.5, 'sine', 0.03); },
  squeak() { this.tone(1800, 0.09, 'square', 0.03, 2600); this.tone(2200, 0.1, 'square', 0.03, 1500, 0.1); },
  quest()  { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, 'sine', 0.1, 0, i * 0.11)); },
  boom()   { this.tone(140, 0.5, 'sine', 0.12, 40); this.tone(900, 0.25, 'sawtooth', 0.02, 200); },
  aarti()  { [392, 523, 659, 784, 1046, 1318].forEach((f, i) => { this.tone(f, 0.9, 'sine', 0.09, 0, i * 0.16); this.tone(f * 2, 0.5, 'sine', 0.03, 0, i * 0.16); }); }
};

// ---------------- renderer / camera / lights ----------------
function initThree() {
  renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
  if (THREE.ACESFilmicToneMapping) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02; }

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1e7ce8);
  scene.fog = new THREE.Fog(0x5fb0f0, 130, 460);

  camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 12, 60);

  hemi = new THREE.HemisphereLight(0xa8d8ff, 0x58c030, 0.45);
  scene.add(hemi);
  fillLight = new THREE.DirectionalLight(0xa8c8f0, 0.15);
  fillLight.position.set(-30, 20, -40);
  scene.add(fillLight);

  sun = new THREE.DirectionalLight(0xfff4dc, 1.0);
  sun.position.set(40, 60, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -34; sun.shadow.camera.right = 34;
  sun.shadow.camera.top = 34;   sun.shadow.camera.bottom = -34;
  sun.shadow.camera.near = 10;  sun.shadow.camera.far = 160;
  sun.shadow.bias = -0.0015;
  scene.add(sun); scene.add(sun.target);
}

// ---------------- shared materials ----------------
const M = {};
let envMats = [];   // standard materials whose env reflection scales with daylight

// ---- procedural texture helpers (canvas-painted, code-only) ----
function canvasTex(size, painter, repeat, linear) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  painter(cv.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (repeat) tex.repeat.set(repeat, repeat);
  if (THREE.sRGBEncoding && !linear) tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = 8;
  return tex;
}
function paintMottle(g, s, base, tones, n, rMax, aMin, aMax) {
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  for (let i = 0; i < n; i++) {
    g.fillStyle = tones[(Math.random() * tones.length) | 0];
    g.globalAlpha = rand(aMin, aMax);
    g.beginPath();
    g.arc(rand(0, s), rand(0, s), rand(1.5, rMax), 0, 6.29);
    g.fill();
  }
  g.globalAlpha = 1;
}
function paintSpeckle(g, s, n, dark, light, a) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = Math.random() < 0.5 ? dark : light;
    g.globalAlpha = rand(a * 0.5, a);
    g.fillRect(rand(0, s), rand(0, s), 1.5, 1.5);
  }
  g.globalAlpha = 1;
}
const paintStone = (g, s) => {
  paintMottle(g, s, '#cfc0a8', ['#bcaa8e', '#e0d2b8', '#b8a488', '#d2c2a2'], 700, s / 40, 0.05, 0.14);
  paintSpeckle(g, s, 1600, '#8a7a62', '#f2e8d2', 0.15);
  g.strokeStyle = 'rgba(90,70,52,.20)'; g.lineWidth = 1.2;
  for (let i = 0; i < 10; i++) {           // hairline veins
    let x = rand(0, s), y = rand(0, s);
    g.beginPath(); g.moveTo(x, y);
    for (let j = 0; j < 5; j++) { x += rand(-s / 8, s / 8); y += rand(-s / 8, s / 8); g.lineTo(x, y); }
    g.stroke();
  }
};
const paintStoneBump = (g, s) => {
  paintMottle(g, s, '#808080', ['#6a6a6a', '#9a9a9a', '#757575', '#8e8e8e'], 700, s / 40, 0.08, 0.2);
  paintSpeckle(g, s, 1400, '#555555', '#aaaaaa', 0.2);
};
const paintCream = (g, s) => {
  paintMottle(g, s, '#f5ead0', ['#e8dab6', '#fdf4dc', '#e0d0aa'], 500, s / 30, 0.04, 0.1);
  g.globalAlpha = 0.06; g.fillStyle = '#c2ae8a';
  for (let i = 0; i < 14; i++) g.fillRect(0, rand(0, s), s, rand(2, 7));   // weathering streaks
  g.globalAlpha = 1;
  paintSpeckle(g, s, 1200, '#c2ae8a', '#fffbe8', 0.12);
};
const paintWood = (g, s) => {
  g.fillStyle = '#7a5636'; g.fillRect(0, 0, s, s);
  for (let x = 0; x < s; x += rand(2, 5)) {
    g.strokeStyle = Math.random() < 0.5 ? 'rgba(56,36,20,.35)' : 'rgba(160,118,74,.3)';
    g.lineWidth = rand(1, 3);
    g.beginPath(); g.moveTo(x, 0);
    g.bezierCurveTo(x + rand(-6, 6), s * 0.33, x + rand(-6, 6), s * 0.66, x + rand(-8, 8), s);
    g.stroke();
  }
  for (let i = 0; i < 4; i++) {            // knots
    const x = rand(0, s), y = rand(0, s);
    const rg = g.createRadialGradient(x, y, 1, x, y, rand(5, 10));
    rg.addColorStop(0, 'rgba(40,24,12,.8)'); rg.addColorStop(1, 'rgba(40,24,12,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, 10, 0, 6.29); g.fill();
  }
};
const paintWoodBump = (g, s) => {
  g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);
  for (let x = 0; x < s; x += rand(2, 5)) {
    g.strokeStyle = Math.random() < 0.5 ? 'rgba(60,60,60,.5)' : 'rgba(170,170,170,.5)';
    g.lineWidth = rand(1, 3);
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + rand(-4, 4), s); g.stroke();
  }
};
const paintGrass = (g, s) => {
  g.fillStyle = '#52c810'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) {
    const x = rand(0, s), y = rand(0, s), l = rand(3, 8), a = rand(-0.5, 0.5);
    g.strokeStyle = ['#48bc0c', '#5cd818', '#6ce424', '#3ea808', '#66dc1c'][(Math.random() * 5) | 0];
    g.globalAlpha = rand(0.25, 0.55); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * l, y - l); g.stroke();
  }
  g.globalAlpha = 1;
};
const paintWaterBump = (g, s) => {
  g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 60; i++) {           // ripple rings
    g.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.22)';
    g.lineWidth = rand(1, 2.5);
    g.beginPath(); g.arc(rand(0, s), rand(0, s), rand(6, 26), 0, 6.29); g.stroke();
  }
  paintSpeckle(g, s, 900, '#666666', '#9a9a9a', 0.2);
};

function makeMats() {
  const stoneMap = canvasTex(256, paintStone), stoneBump = canvasTex(256, paintStoneBump, 0, true);
  const creamMap = canvasTex(256, paintCream), creamBump = canvasTex(256, paintStoneBump, 0, true);
  const woodMap  = canvasTex(256, paintWood),  woodBump  = canvasTex(256, paintWoodBump, 0, true);
  const grassMap = canvasTex(256, paintGrass, 24);
  M.stone   = new THREE.MeshStandardMaterial({ map: stoneMap, bumpMap: stoneBump, bumpScale: 0.015, roughness: 0.9 });
  M.stoneD  = new THREE.MeshStandardMaterial({ map: stoneMap, bumpMap: stoneBump, bumpScale: 0.02, color: 0xcbbca2, roughness: 0.93 });
  M.cream   = new THREE.MeshStandardMaterial({ map: creamMap, bumpMap: creamBump, bumpScale: 0.012, roughness: 0.82 });
  M.maroon  = new THREE.MeshStandardMaterial({ color: 0xff5fa8, roughness: 0.45 });
  M.red     = new THREE.MeshStandardMaterial({ color: 0xff4d6e, roughness: 0.5 });
  M.gold    = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.25, metalness: 0.75, emissive: 0x6b4a00, emissiveIntensity: 0.35 });
  M.brass   = new THREE.MeshStandardMaterial({ color: 0xf0b848, roughness: 0.35, metalness: 0.7, emissive: 0x5a3600, emissiveIntensity: 0.3 });
  M.wood    = new THREE.MeshStandardMaterial({ map: woodMap, bumpMap: woodBump, bumpScale: 0.02, roughness: 0.9 });
  M.leaf    = new THREE.MeshStandardMaterial({ color: 0x4eae3e, roughness: 0.78 });
  M.leafD   = new THREE.MeshStandardMaterial({ color: 0x35923e, roughness: 0.78 });
  M.grass   = new THREE.MeshStandardMaterial({ map: grassMap, roughness: 1 });
  M.flame   = new THREE.MeshBasicMaterial({ color: 0xffc94d });
  M.glow    = new THREE.MeshBasicMaterial({ color: 0xffa34d, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
  M.dark    = new THREE.MeshStandardMaterial({ color: 0x2a1038, roughness: 0.4 });
  M.pink    = new THREE.MeshStandardMaterial({ color: 0xffb0d8, roughness: 0.5 });
  M.marker  = new THREE.MeshStandardMaterial({ color: 0xffd76e, emissive: 0xffa020, emissiveIntensity: 1.4, roughness: 0.3, metalness: 0.4 });
  envMats = [M.stone, M.stoneD, M.cream, M.maroon, M.red, M.gold, M.brass, M.wood, M.leaf, M.leafD, M.grass, M.dark, M.pink, M.marker];
  for (const m of envMats) m.envMapIntensity = 1;
}

function makeFlame(scale) {
  const fm = new THREE.Mesh(new THREE.ConeGeometry(0.16 * scale, 0.5 * scale, 8), M.flame.clone());
  fm.userData.fid = Math.random() * 10;
  flames.push(fm);
  return fm;
}
function updateFlames(t) {
  for (const f of flames) {
    if (!f.visible) continue;
    const fid = f.userData.fid;
    const s = 0.85 + Math.sin(t * 12 + fid) * 0.15 + rand(-0.05, 0.05);
    f.scale.set(s, 0.9 + Math.sin(t * 16 + fid * 1.7) * 0.25, s);
  }
}

// ---------------- sky / day-night ----------------
// phases: 0 afternoon → 1 late afternoon → 2 golden hour → 3 dusk → 4 twilight → 5 festival night
const SKY_PHASES = [
  { sky: 0x1e7ce8, fog: 0x5fb0f0, sunC: 0xfff4dc, sunI: 1.0, hemiI: 0.5, sunPos: [40, 60, 20], stars: 0, torch: 0.4 },
  { sky: 0x2e8ce8, fog: 0x6fb8f4, sunC: 0xffe8c0, sunI: 0.92, hemiI: 0.47, sunPos: [55, 48, 15], stars: 0, torch: 0.5 },
  { sky: 0x7fb4ea, fog: 0xbcdcec, sunC: 0xffdc9c, sunI: 1.0, hemiI: 0.7, sunPos: [65, 30, 10], stars: 0.05, torch: 0.7 },
  { sky: 0xf09ab8, fog: 0xf4b0c4, sunC: 0xffb078, sunI: 0.8, hemiI: 0.55, sunPos: [70, 16, 5], stars: 0.3, torch: 0.9 },
  { sky: 0x6860c0, fog: 0x7870cc, sunC: 0xffa078, sunI: 0.5, hemiI: 0.48, sunPos: [60, 8, 0], stars: 0.7, torch: 1.1 },
  { sky: 0x1a1448, fog: 0x262060, sunC: 0x9aa8d8, sunI: 0.35, hemiI: 0.4, sunPos: [-30, 40, -40], stars: 1, torch: 1.4 }
];
let skyPhase = 0;
const skyCur = { sky: new THREE.Color(), fog: new THREE.Color(), sunC: new THREE.Color(), sunI: 1, hemiI: 0.6, sunPos: new THREE.Vector3(), stars: 0, torch: 0.4 };
let stars, moon, moonHalo, clouds = [];

function buildSky() {
  const geo = new THREE.BufferGeometry();
  const pos = [];
  for (let i = 0; i < 700; i++) {
    const a = rand(0, Math.PI * 2), e = rand(0.08, 1.4), r = 380;
    pos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfff2cc, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false }));
  stars.frustumCulled = false;
  scene.add(stars);

  moon = new THREE.Mesh(new THREE.SphereGeometry(10, 20, 16), new THREE.MeshBasicMaterial({ color: 0xfff0c9, transparent: true, opacity: 0 }));
  moon.position.set(-120, 110, -300);
  scene.add(moon);
  moonHalo = new THREE.Mesh(new THREE.SphereGeometry(14, 20, 16), new THREE.MeshBasicMaterial({ color: 0xfff0c9, transparent: true, opacity: 0 }));
  moonHalo.position.copy(moon.position);
  scene.add(moonHalo);

  // puffy white clouds (flat-shaded blob clusters, candy style)
  clouds = [];
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, fog: false });
  for (let i = 0; i < 20; i++) {
    const cl = new THREE.Group();
    const n = 4 + (Math.random() * 4 | 0);
    for (let j = 0; j < n; j++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(6, 13), 1), cloudMat);
      puff.position.set(rand(-14, 14), rand(-2, 3), rand(-6, 6));
      puff.scale.y = 0.55 + Math.random() * 0.2;
      cl.add(puff);
    }
    // bias 70% of clouds toward the temple (-z) so they fill the view
    let a = rand(0, Math.PI * 2);
    if (Math.random() < 0.7) a = rand(Math.PI, Math.PI * 2);   // sin(a) < 0 → -z hemisphere
    const rr = rand(100, 240), h = rand(24, 58);
    cl.position.set(Math.cos(a) * rr, h, Math.sin(a) * rr);
    cl.userData.drift = rand(0.4, 1.2);
    scene.add(cl);
    clouds.push(cl);
  }

  const p = SKY_PHASES[0];
  skyCur.sky.setHex(p.sky); skyCur.fog.setHex(p.fog); skyCur.sunC.setHex(p.sunC);
  skyCur.sunPos.set(...p.sunPos);
  buildSkyDome();
  buildEnvMap();
  applySky();
}
// gradient sky dome + environment map (real reflections on gold, brass & water)
let skyDome = null;
function buildSkyDome() {
  const tex = canvasTex(256, (g, s) => {
    const grad = g.createLinearGradient(0, 0, 0, s);
    grad.addColorStop(0, '#1e7ce8'); grad.addColorStop(0.45, '#3e96f0');
    grad.addColorStop(0.72, '#7cc0f8'); grad.addColorStop(1, '#b8e0fc');
    g.fillStyle = grad; g.fillRect(0, 0, s, s);
  }, 0, true);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  skyDome = new THREE.Mesh(new THREE.SphereGeometry(420, 24, 16),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }));
  skyDome.renderOrder = -1;
  scene.add(skyDome);
}
function buildEnvMap() {
  const tex = canvasTex(256, (g, s) => {
    const grad = g.createLinearGradient(0, 0, 0, s);
    grad.addColorStop(0, '#5a9ce0'); grad.addColorStop(0.62, '#d8d0b0');
    g.fillStyle = grad; g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(64,140,44,.7)'; g.fillRect(0, s * 0.74, s, s * 0.26);  // ground bounce
    g.fillStyle = 'rgba(255,250,222,.9)';                                     // the sun
    g.beginPath(); g.arc(s * 0.72, s * 0.2, s * 0.055, 0, 6.29); g.fill();
  }, 0, true);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  scene.environment = pmrem.fromEquirectangular(tex).texture;
  tex.dispose(); pmrem.dispose();
}

const _tmpC = new THREE.Color();
function updateSky(dt) {
  const p = SKY_PHASES[clamp(skyPhase, 0, SKY_PHASES.length - 1)];
  const k = clamp(dt * 0.6, 0, 1);
  skyCur.sky.lerp(_tmpC.setHex(p.sky), k);
  skyCur.fog.lerp(_tmpC.setHex(p.fog), k);
  skyCur.sunC.lerp(_tmpC.setHex(p.sunC), k);
  skyCur.sunI = lerp(skyCur.sunI, p.sunI, k);
  skyCur.hemiI = lerp(skyCur.hemiI, p.hemiI, k);
  skyCur.stars = lerp(skyCur.stars, p.stars, k);
  skyCur.torch = lerp(skyCur.torch, p.torch, k);
  skyCur.sunPos.lerp(_tmpC2.set(...p.sunPos), k);
  applySky();
}
const _tmpC2 = new THREE.Vector3();
function applySky() {
  scene.background.copy(skyCur.sky);
  scene.fog.color.copy(skyCur.fog);
  if (skyDome) skyDome.material.color.copy(skyCur.sky);
  // reflections fade as day turns to night
  const dayK = 1 - clamp(skyCur.stars, 0, 1);
  for (const m of envMats) m.envMapIntensity = 0.15 + 0.45 * dayK;
  sun.color.copy(skyCur.sunC);
  sun.intensity = skyCur.sunI;
  hemi.intensity = skyCur.hemiI;
  stars.material.opacity = skyCur.stars;
  moon.material.opacity = skyCur.stars;
  moonHalo.material.opacity = skyCur.stars * 0.15;
  for (const cl of clouds) cl.visible = skyCur.stars < 0.5;
  const sp = skyCur.sunPos;
  sun.position.set(sun.target.position.x + sp.x, sp.y, sun.target.position.z + sp.z);
}
