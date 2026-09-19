'use strict';
/* world.js : the temple courtyard */

// ---------------- colliders / ground ----------------
function addBox(x, z, hw, hd) { colliders.push({ type: 'box', x, z, hw, hd }); }
function addCircle(x, z, r) { colliders.push({ type: 'circle', x, z, r }); }

// height of walkable ground (temple plinth + steps)
function groundHeight(x, z) {
  const d = Math.max(Math.abs(x), Math.abs(z));
  if (d <= 9.6) return 1.4;
  if (d <= 10.3) return 1.05;
  if (d <= 11.0) return 0.7;
  if (d <= 11.7) return 0.35;
  return 0;
}

function resolveCollisions(p, r) {
  for (const c of colliders) {
    if (c.type === 'box') {
      const dx = p.x - c.x, dz = p.z - c.z;
      const ox = c.hw + r - Math.abs(dx), oz = c.hd + r - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) p.x += (dx >= 0 ? 1 : -1) * ox;
        else p.z += (dz >= 0 ? 1 : -1) * oz;
      }
    } else {
      const dx = p.x - c.x, dz = p.z - c.z;
      const d = Math.hypot(dx, dz), min = c.r + r;
      if (d < min && d > 1e-4) { p.x = c.x + dx / d * min; p.z = c.z + dz / d * min; }
    }
  }
  p.x = clamp(p.x, -WORLD_HALF, WORLD_HALF);
  p.z = clamp(p.z, -WORLD_HALF, WORLD_HALF);
}

// ---------------- ground ----------------
function makeTileTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  g.fillStyle = '#f0e0d0'; g.fillRect(0, 0, 512, 512);
  const n = 8, s = 512 / n;
  const tileCols = ['#f4a81c', '#f4603c', '#f44ca4', '#9c58e4', '#28a8e4', '#22cc74', '#f4cc38', '#f47c2c'];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = rand(-10, 10);
    const base = tileCols[(i * 3 + j * 5) % tileCols.length];   // stable rainbow checker, no purple grids
    const rgb = [parseInt(base.slice(1, 3), 16), parseInt(base.slice(3, 5), 16), parseInt(base.slice(5, 7), 16)];
    g.fillStyle = `rgb(${clamp(rgb[0] + v, 0, 255)},${clamp(rgb[1] + v, 0, 255)},${clamp(rgb[2] + v, 0, 255)})`;
    g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
  }
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 3;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, 512); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(512, i * s); g.stroke(); }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = 4;
  return tex;
}

function buildGround() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(130, 130), new THREE.MeshStandardMaterial({ map: makeTileTexture(), bumpMap: M.stoneD.bumpMap, bumpScale: 0.012, roughness: 0.94 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // far land beyond the walls
  const far = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ map: M.grass.map, color: 0x5ecf2a, roughness: 1 }));
  far.rotation.x = -Math.PI / 2; far.position.y = -0.05;
  scene.add(far);

  // garden lawns
  const lawns = [[-30, -30, 20], [30, -30, 18], [-30, 26, 16], [26, 26, 14]];
  for (const [x, z, r] of lawns) {
    const lawn = new THREE.Mesh(new THREE.CircleGeometry(r, 40), M.grass);
    lawn.rotation.x = -Math.PI / 2; lawn.position.set(x, 0.02, z);
    lawn.receiveShadow = true;
    scene.add(lawn);
  }
  // red carpet path from gate to temple
  const path = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 44), new THREE.MeshStandardMaterial({ color: 0xf04d98, roughness: 0.6 }));
  path.rotation.x = -Math.PI / 2; path.position.set(0, 0.03, 33.5);
  path.receiveShadow = true;
  scene.add(path);
  const trimL = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 44), M.gold);
  trimL.rotation.x = -Math.PI / 2; trimL.position.set(-2.4, 0.035, 33.5);
  scene.add(trimL);
  const trimR = trimL.clone(); trimR.position.x = 2.4; scene.add(trimR);

  // rangoli in front of temple steps
  const rangoli = new THREE.Group();
  const cols = [0xff6b6b, 0xffd166, 0x06d6a0, 0x9b5de5, 0xff9f1c];
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5 + i * 0.6, 0.95 + i * 0.6, 32), new THREE.MeshStandardMaterial({ color: cols[i], roughness: 0.9, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04 + i * 0.001;
    rangoli.add(ring);
  }
  rangoli.position.set(0, 0, 15.5);
  scene.add(rangoli);
}

// ---------------- walls & gate ----------------
function buildWalls() {
  const H = 3.4, T = 1.2, L = 116;
  const mk = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), M.cream);
    m.position.set(x, H / 2, z); m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.35, d + 0.3), M.maroon);
    cap.position.set(x, H + 0.17, z);
    scene.add(cap);
    addBox(x, z, w / 2, d / 2);
  };
  mk(L, T, 0, -58);          // north
  mk(T, L, -58, 0);          // west
  mk(T, L, 58, 0);           // east
  mk(50, T, -31, 58);        // south left
  mk(50, T, 31, 58);         // south right

  // gate tower (gopuram-lite) over the south opening
  const gate = new THREE.Group();
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(2.2, 8, 2.2), M.maroon);
    post.position.set(s * 5.2, 4, 0); post.castShadow = true;
    gate.add(post);
    addBox(s * 5.2, 58, 1.1, 1.1);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(12.6, 1.6, 2.4), M.maroon);
  lintel.position.y = 8.6; gate.add(lintel);
  const tiers = [[11, 1.2, M.cream], [9, 1.1, M.maroon], [7, 1, M.cream], [5, 0.9, M.maroon]];
  let y = 9.4;
  for (const [w, h, mat] of tiers) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, 2.2), mat);
    t.position.y = y + h / 2; gate.add(t); y += h;
  }
  for (const x of [-4, -2, 0, 2, 4]) {
    const k = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.1, 8), M.gold);
    k.position.set(x, y + 0.55, 0); gate.add(k);
  }
  // hanging marigold garland (toran)
  const toranCols = [0xff9f1c, 0xffd166, 0xff6b6b, 0xf72585, 0x9b5de5, 0x4cc9f0, 0x06d6a0];
  for (let i = 0; i < 13; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshStandardMaterial({ color: toranCols[i % toranCols.length], roughness: 0.55, emissive: toranCols[i % toranCols.length], emissiveIntensity: 0.12 }));
    f.position.set(-4.8 + i * 0.8, 7.5 - Math.sin(i / 12 * Math.PI) * 0.7, 1.3);
    gate.add(f);
  }
  gate.position.set(0, 0, 58);
  scene.add(gate);
}

// ---------------- central temple ----------------
function buildTemple() {
  const g = new THREE.Group();
  // plinth + steps (walkable; heights match groundHeight)
  const steps = [[9.6, 1.4], [10.3, 1.05], [11.0, 0.7], [11.7, 0.35]];
  for (const [hw, h] of steps) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, h, hw * 2), M.stone);
    s.position.y = h / 2; s.receiveShadow = true; s.castShadow = true;
    g.add(s);
  }
  // sanctum (garbhagriha)
  const sanctum = new THREE.Mesh(new THREE.BoxGeometry(9, 7, 9), M.cream);
  sanctum.position.set(0, 1.4 + 3.5, -2); sanctum.castShadow = true; sanctum.receiveShadow = true;
  g.add(sanctum);
  addBox(0, -2, 4.5, 4.5);
  // maroon bands & door
  for (const yy of [2.2, 7.6]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(9.3, 0.5, 9.3), M.maroon);
    band.position.set(0, yy, -2); g.add(band);
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.6, 4, 0.3), M.dark);
  door.position.set(0, 1.4 + 2, 2.55); g.add(door);
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.5, 0.2), M.gold);
  doorFrame.position.set(0, 1.4 + 2.25, 2.45); g.add(doorFrame);
  // ॐ sign above the door
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const c2 = cv.getContext('2d');
  c2.fillStyle = '#8e2a2a'; c2.fillRect(0, 0, 256, 256);
  c2.fillStyle = '#ffd76e'; c2.font = 'bold 170px serif'; c2.textAlign = 'center'; c2.textBaseline = 'middle';
  c2.fillText('ॐ', 128, 140);
  const omTex = new THREE.CanvasTexture(cv);
  if (THREE.sRGBEncoding) omTex.encoding = THREE.sRGBEncoding;
  const om = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshStandardMaterial({ map: omTex, roughness: 0.8 }));
  om.position.set(0, 1.4 + 5.6, 2.56); g.add(om);

  // gopuram tiers
  let y = 1.4 + 7;
  const tiers = [[8.6, 1.3], [7.2, 1.2], [5.8, 1.1], [4.4, 1.0], [3.0, 0.9]];
  tiers.forEach(([w, h], i) => {
    const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), i % 2 ? M.maroon : M.cream);
    t.position.set(0, y + h / 2, -2); t.castShadow = true; g.add(t);
    // little kalasha finials on corners
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const k = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 6), M.gold);
      k.position.set(sx * (w / 2 - 0.25), y + h + 0.25, -2 + sz * (w / 2 - 0.25)); g.add(k);
    }
    y += h;
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.gold);
  dome.position.set(0, y, -2); g.add(dome);
  const kalasha = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.6, 10), M.gold);
  kalasha.position.set(0, y + 2.2, -2); g.add(kalasha);

  // mandapa (pillared hall) in front
  for (const sx of [-1, 1]) for (const zz of [3.8, 7.6]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 4.2, 10), M.stone);
    p.position.set(sx * 3.4, 1.4 + 2.1, zz); p.castShadow = true; g.add(p);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 1.2), M.maroon);
    cap.position.set(sx * 3.4, 1.4 + 4.3, zz); g.add(cap);
    addCircle(sx * 3.4, zz, 0.5);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.5, 6.2), M.cream);
  roof.position.set(0, 1.4 + 4.7, 5.7); roof.castShadow = true; g.add(roof);
  const roofTrim = new THREE.Mesh(new THREE.BoxGeometry(9, 0.3, 6.6), M.maroon);
  roofTrim.position.set(0, 1.4 + 5.05, 5.7); g.add(roofTrim);
  for (let i = 0; i < 9; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), M.brass);
    b.position.set(-4 + i, 1.4 + 4.35, 8.9); g.add(b);
  }

  // sacred lamp altar (aarti target)
  const altar = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.5, 12), M.gold);
  base.position.y = 0.25; altar.add(base);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 1.6, 8), M.brass);
  stem.position.y = 1.3; altar.add(stem);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.3, 0.35, 12), M.brass);
  bowl.position.y = 2.2; altar.add(bowl);
  const bigFlame = makeFlame(2.4); bigFlame.position.y = 3.0; bigFlame.visible = false; altar.add(bigFlame);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 10), M.glow.clone()); glow.position.y = 3; glow.visible = false; altar.add(glow);
  const altarLight = new THREE.PointLight(0xffb060, 0, 22); altarLight.position.y = 3.2; altar.add(altarLight);
  altar.position.set(0, 1.4, 5.7);
  g.add(altar);
  addCircle(0, 5.7, 1.2);
  world.altar = { g: altar, flame: bigFlame, glow, light: altarLight };

  scene.add(g);
}

// ---------------- corner shrines ----------------
function buildShrine(x, z) {
  const g = new THREE.Group();
  const shrineAccent = [0xff4d6d, 0x4cc9f0, 0xffb703, 0x06d6a0][(x > 0 ? 2 : 0) + (z > 0 ? 1 : 0)];
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(6, 0.8, 6), M.stone);
  plinth.position.y = 0.4; plinth.receiveShadow = true; g.add(plinth);
  // marigold rows framing the plinth
  for (let i = -2; i <= 2; i++) {
    const f1 = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xffb703 : 0xff5d8f, roughness: 0.6, emissive: i % 2 ? 0xffb703 : 0xff5d8f, emissiveIntensity: 0.1 }));
    f1.position.set(i * 1.2, 0.57, 3.15); g.add(f1);
    const f2 = f1.clone(); f2.position.z = -3.15; g.add(f2);
  }
  const room = new THREE.Mesh(new THREE.BoxGeometry(4, 3.6, 4), M.cream);
  room.position.y = 0.8 + 1.8; room.castShadow = true; g.add(room);
  const band = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.4, 4.2), new THREE.MeshStandardMaterial({ color: shrineAccent, roughness: 0.65 }));
  band.position.y = 4.4; g.add(band);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 2.6, 4), new THREE.MeshStandardMaterial({ color: shrineAccent, roughness: 0.65 }));
  roof.position.y = 5.9; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1, 8), M.gold);
  tip.position.y = 7.6; g.add(tip);
  // niche facing the courtyard center
  const niche = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2, 0.2), new THREE.MeshStandardMaterial({ color: shrineAccent, roughness: 0.6, emissive: shrineAccent, emissiveIntensity: 0.08 }));
  const ang = Math.atan2(-x, -z);
  niche.position.set(Math.sin(ang) * 2.05, 2.2, Math.cos(ang) * 2.05);
  niche.rotation.y = ang;
  g.add(niche);
  g.position.set(x, 0, z);
  scene.add(g);
  addBox(x, z, 3.1, 3.1);
}

// ---------------- pond ----------------
function buildPond(x, z, r) {
  const waterBumpTex = canvasTex(256, paintWaterBump, 3, true);   // grayscale → doubles as roughness variation
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.45, 8, 40), M.stoneD);
  rim.rotation.x = Math.PI / 2; rim.position.set(x, 0.15, z); rim.castShadow = true;
  scene.add(rim);
  const water = new THREE.Mesh(new THREE.CircleGeometry(r - 0.2, 40), new THREE.MeshStandardMaterial({ map: waterBumpTex, roughness: 0.06, metalness: 0.75, transparent: true, opacity: 0.88, envMapIntensity: 1 }));
  water.rotation.x = -Math.PI / 2; water.position.set(x, 0.12, z);
  scene.add(water);
  animated.push((dt, t) => { water.material.color.setHSL(0.5 + Math.sin(t * 0.35) * 0.09, 0.85, 0.4 + Math.sin(t * 1.3) * 0.04); });   // vivid teal ↔ sapphire shimmer
  for (let i = 0; i < 7; i++) {
    const a = rand(0, Math.PI * 2), d = rand(1.5, r - 1.6);
    const lotus = buildLotus();
    lotus.position.set(x + Math.cos(a) * d, 0.16, z + Math.sin(a) * d);
    lotus.rotation.y = rand(0, 6);
    scene.add(lotus);
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.7, 12), M.leafD);
    pad.rotation.x = -Math.PI / 2; pad.position.set(x + Math.cos(a) * d + 0.5, 0.14, z + Math.sin(a) * d - 0.3);
    scene.add(pad);
  }
  addCircle(x, z, r + 0.3);
}
function buildLotus() {
  const g = new THREE.Group();
  const petalCol = [0xff6bcb, 0xff8fb8, 0xc77dff, 0xff5d5d, 0xfff3b0, 0x9d8df1][(Math.random() * 6) | 0];
  const petalMat = new THREE.MeshStandardMaterial({ color: petalCol, roughness: 0.45, emissive: petalCol, emissiveIntensity: 0.3 });
  for (let i = 0; i < 8; i++) {
    const p = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 6), petalMat);
    const a = (i / 8) * Math.PI * 2;
    p.position.set(Math.cos(a) * 0.2, 0.3, Math.sin(a) * 0.2);
    p.rotation.x = Math.cos(a) * 0.75; p.rotation.z = -Math.sin(a) * 0.75;
    g.add(p);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), M.gold);
  core.position.y = 0.45; g.add(core);
  return g;
}

// ---------------- vegetation ----------------
function buildTree(x, z, big) {
  const g = new THREE.Group();
  const h = big ? 4.5 : rand(2.2, 3.2);
  const bark = Math.random() < 0.5 ? M.wood : new THREE.MeshStandardMaterial({ map: M.wood.map, bumpMap: M.wood.bumpMap, color: 0xc98d52, roughness: 0.85 });   // varied bark tones
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(big ? 0.45 : 0.18, big ? 0.7 : 0.28, h, 8), bark);
  trunk.position.y = h / 2; trunk.castShadow = true; g.add(trunk);
  // vivid per-tree foliage: lush random greens, or a flowering gulmohar-style tree
  const flowering = !big && Math.random() < 0.45;
  const fCol = [0xff5d8f, 0xff8c42, 0xffd23f, 0xc77dff][(Math.random() * 4) | 0];
  const leafA = new THREE.MeshStandardMaterial({ color: flowering ? fCol : new THREE.Color().setHSL(rand(0.26, 0.42), rand(0.65, 0.85), rand(0.38, 0.52)), roughness: 0.75 });
  const leafB = new THREE.MeshStandardMaterial({ color: leafA.color.clone().offsetHSL(rand(-0.05, 0.05), 0, rand(-0.07, 0.07)), roughness: 0.75 });
  const n = big ? 9 : 5;
  for (let i = 0; i < n; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(big ? rand(1.6, 2.4) : rand(0.8, 1.2), 9, 7), i % 2 ? leafA : leafB);
    const a = (i / n) * Math.PI * 2, rr = big ? 1.8 : 0.6;
    leaf.position.set(Math.cos(a) * rr, h + (big ? rand(0, 1.4) : rand(0, 0.6)), Math.sin(a) * rr);
    leaf.scale.y = 0.75; leaf.castShadow = true;
    g.add(leaf);
  }
  if (flowering) {   // bright blossom dots scattered on the canopy
    for (let i = 0; i < 8; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(rand(0.1, 0.16), 6, 5), new THREE.MeshStandardMaterial({ color: 0xfff3fa, emissive: fCol, emissiveIntensity: 0.35, roughness: 0.5 }));
      const a = rand(0, 6.28), rr = rand(0.3, 1.0);
      b.position.set(Math.cos(a) * rr, h + rand(0.2, 0.9), Math.sin(a) * rr);
      g.add(b);
    }
  }
  if (big) { // hanging banyan roots
    for (let i = 0; i < 6; i++) {
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, rand(1.5, 3), 5), M.wood);
      const a = rand(0, 6.28), d = rand(1.2, 2.6);
      root.position.set(Math.cos(a) * d, h - 0.5, Math.sin(a) * d);
      g.add(root);
    }
  }
  g.position.set(x, 0, z);
  g.rotation.y = rand(0, 6);
  scene.add(g);
  addCircle(x, z, big ? 0.9 : 0.4);
}
function buildBanana(x, z) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.6, 6), M.leaf);
  stem.position.y = 0.8; g.add(stem);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 1.9), M.leaf);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.8, 1.7, Math.sin(a) * 0.8);
    leaf.rotation.y = -a + Math.PI / 2; leaf.rotation.x = -0.5;
    leaf.castShadow = true; g.add(leaf);
  }
  g.position.set(x, 0, z); scene.add(g);
}
function buildBush(x, z) {
  const g = new THREE.Group();
  const bushLeaf = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(rand(0.25, 0.4), rand(0.6, 0.85), rand(0.35, 0.5)), roughness: 0.8 });
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(rand(0.45, 0.7), 8, 6), bushLeaf);
    b.position.set(rand(-0.4, 0.4), 0.4, rand(-0.4, 0.4)); b.scale.y = 0.7; b.castShadow = true; g.add(b);
  }
  for (let i = 0; i < 6; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), new THREE.MeshStandardMaterial({ color: [0xff9f1c, 0xff6b6b, 0xffd166, 0xf72585, 0x9b5de5, 0x4cc9f0][i % 6], emissive: [0xff9f1c, 0xff6b6b, 0xffd166, 0xf72585, 0x9b5de5, 0x4cc9f0][i % 6], emissiveIntensity: 0.15 }));
    f.position.set(rand(-0.55, 0.55), rand(0.6, 1.0), rand(-0.55, 0.55)); g.add(f);
  }
  g.position.set(x, 0, z); scene.add(g);
}

// ---------------- drifting flower-petal confetti ----------------
function buildPetalConfetti() {
  const cols = [0xff6b8f, 0xffd23f, 0xff9f1c, 0xf72585, 0x9b5de5, 0x4cc9f0, 0xffc8dd];
  const mats = cols.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, side: THREE.DoubleSide }));
  const petals = [];
  const spawnXZ = () => {
    let x, z;
    do { x = rand(-50, 50); z = rand(-50, 50); } while (Math.abs(x) < 13 && Math.abs(z) < 13);   // keep clear of the temple
    return [x, z];
  };
  for (let i = 0; i < 90; i++) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(rand(0.09, 0.17), 6), mats[i % mats.length]);
    p.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
    const [x, z] = spawnXZ();
    p.position.set(x, rand(1, 16), z);
    p.userData = { vy: rand(0.5, 1.2), sway: rand(0.6, 1.6), ph: rand(0, 6), spin: rand(0.5, 2) };
    scene.add(p);
    petals.push(p);
  }
  animated.push((dt, t) => {
    for (const p of petals) {
      p.position.y -= p.userData.vy * dt;
      p.position.x += Math.sin(t * p.userData.sway + p.userData.ph) * dt * 0.7;
      p.position.z += Math.cos(t * p.userData.sway * 0.8 + p.userData.ph) * dt * 0.7;
      p.rotation.x += p.userData.spin * dt;
      p.rotation.z += p.userData.spin * 0.6 * dt;
      if (p.position.y < 0.05) {
        const [x, z] = spawnXZ();
        p.position.set(x, rand(12, 17), z);
      }
    }
  });
}

// ---------------- festival bunting ----------------
function buildFlagLine(x1, z1, x2, z2, n) {
  const cols = [0xff4d6d, 0xffb703, 0x06d6a0, 0x4cc9f0, 0x9b5de5, 0xf72585];
  const dx = (x2 - x1) / (n - 1), dz = (z2 - z1) / (n - 1);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const sag = Math.sin(t * Math.PI) * 0.55;
    const flag = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.5, 4), new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.6, side: THREE.DoubleSide }));
    flag.rotation.x = Math.PI;
    flag.position.set(x1 + dx * i, 5.4 - sag, z1 + dz * i);
    scene.add(flag);
    animated.push((dt, tm) => { flag.rotation.y = Math.sin(tm * 2 + i) * 0.35; });
  }
}

// ---------------- torches along the path ----------------
function buildTorch(x, z) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 3.2, 6), M.stoneD);
  pole.position.y = 1.6; pole.castShadow = true; g.add(pole);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.14, 0.3, 8), M.brass);
  cup.position.y = 3.3; g.add(cup);
  const f = makeFlame(1.1); f.position.y = 3.65; g.add(f);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), M.glow); glow.position.y = 3.6; g.add(glow);
  g.position.set(x, 0, z); scene.add(g);
  addCircle(x, z, 0.3);
  world.torches.push(glow);
}

const world = { altar: null, torches: [], diyas: [], bells: [] };

function buildWorld() {
  buildGround();
  buildWalls();
  buildTemple();
  for (const [x, z] of [[-42, -42], [42, -42], [-42, 42], [42, 42]]) buildShrine(x, z);
  buildPond(30, 26, 8);

  // trees
  buildTree(-32, 12, true);                     // the great banyan
  const trees = [[-24, -40], [-38, -26], [-18, -22], [-46, 8], [-50, 30], [-24, 40], [-40, 48],
                 [20, -42], [36, -22], [48, -10], [26, -18], [46, 36], [18, 48], [50, 18], [-8, 50], [12, 52]];
  for (const [x, z] of trees) buildTree(x, z, false);
  for (const [x, z] of [[-14, -46], [-30, -22], [28, -34], [40, -30], [-46, 36], [14, 40], [42, 20], [-48, -12]]) buildBanana(x, z);
  for (let i = 0; i < 26; i++) {
    const a = rand(0, Math.PI * 2), d = rand(18, 50);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x - 30, z - 26) < 10 || (Math.abs(x) < 5 && z > 10)) continue;
    buildBush(x, z);
  }
  // torches lining the carpet path
  for (const z of [22, 32, 42, 52]) { buildTorch(-4.2, z); buildTorch(4.2, z); }

  // festival bunting across the courtyard
  buildFlagLine(-22, 24, -22, -22, 12);
  buildFlagLine(22, -22, 22, 24, 12);
  buildFlagLine(-16, -30, 16, -30, 10);
  buildFlagLine(-20, 44, 20, 44, 12);

  // drifting rainbow petals
  buildPetalConfetti();

  // flowering shrubs along the walls
  for (const [x, z] of [[-50, -16], [50, -16], [-50, 16], [50, 16], [-14, -52], [14, -52], [-50, 40], [50, 44]]) {
    const bush = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(rand(0.4, 0.65), 8, 6), M.leaf);
      b.position.set(rand(-0.4, 0.4), 0.35, rand(-0.4, 0.4)); b.scale.y = 0.75; bush.add(b);
    }
    const fc = [0xff4d6d, 0xffd166, 0xf72585, 0x4cc9f0][(Math.random() * 4) | 0];
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), new THREE.MeshStandardMaterial({ color: fc, emissive: fc, emissiveIntensity: 0.15 }));
      f.position.set(rand(-0.5, 0.5), rand(0.55, 0.9), rand(-0.5, 0.5)); bush.add(f);
    }
    bush.position.set(x, 0, z);
    scene.add(bush);
  }
}
