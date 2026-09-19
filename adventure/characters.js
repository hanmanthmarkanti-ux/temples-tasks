'use strict';
/* characters.js : Ganesha + Mushika, NPCs, follower mice */

const player = { g: null, x: 0, y: 0, z: 46, vy: 0, yaw: Math.PI, grounded: true, moving: false, speed: 0, parts: {} };
const followers = []; // little mice trailing behind Mushika
const npcs = [];

// ---------------- Mushika (mouse) ----------------
function buildMouse(scale, furHex) {
  const g = new THREE.Group();
  const fur   = new THREE.MeshStandardMaterial({ color: furHex || 0x8f7bd8, roughness: 0.5, emissive: furHex || 0x8f7bd8, emissiveIntensity: 0.12 });
  const belly = new THREE.MeshStandardMaterial({ color: 0xf3ecff, roughness: 0.65 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 16), fur);
  body.scale.set(1, 0.82, 1.35); body.position.y = 0.62; g.add(body);
  const bel = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), belly);
  bel.scale.set(0.85, 0.72, 1.15); bel.position.set(0, 0.56, 0.12); g.add(bel);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 18, 14), fur);
  head.position.set(0, 0.95, 0.58); g.add(head);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), belly);
  snout.scale.set(0.85, 0.7, 1.05); snout.position.set(0, 0.9, 0.88); g.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), M.pink);
  nose.position.set(0, 0.92, 1.06); g.add(nose);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), M.dark);
    eye.position.set(0.15 * s, 1.02, 0.84); g.add(eye);
    // whiskers
    for (const w of [-0.06, 0.06]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4), M.dark);
      wh.position.set(0.2 * s, 0.9 + w, 0.95); wh.rotation.z = Math.PI / 2; wh.rotation.y = s * 0.3; g.add(wh);
    }
  }
  const ears = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.3 * s, 1.08, 0.5);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), fur);
    ear.scale.set(0.55, 1, 0.16); ear.position.y = 0.22; pivot.add(ear);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), M.pink);
    inner.scale.set(0.5, 0.9, 0.1); inner.position.set(0, 0.22, 0.03); pivot.add(inner);
    pivot.rotation.z = s * -0.35; g.add(pivot); ears.push(pivot);
  }
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.62, -0.72);
  const tail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.35, -0.5), new THREE.Vector3(0, 0.15, -1.0)]), 10, 0.05, 6), M.pink);
  tailPivot.add(tail); g.add(tailPivot);
  const feet = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), M.pink);
    foot.position.set(0.3 * sx, 0.14, 0.45 * sz); foot.scale.set(1, 0.6, 1.4); g.add(foot); feet.push(foot);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.scale.setScalar(scale || 1);
  return { g, ears, tailPivot, feet, head };
}

// ---------------- Ganesha rider ----------------
function buildGanesha() {
  const rider = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xffb066, roughness: 0.5, emissive: 0x662200, emissiveIntensity: 0.25 });
  const dhoti = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.58, 0.55, 14), new THREE.MeshStandardMaterial({ color: 0xffa62b, roughness: 0.55, emissive: 0x3a1e00, emissiveIntensity: 0.3 }));
  dhoti.position.y = 0.28; rider.add(dhoti);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.55, 8), skin);
    leg.rotation.z = s * 1.25; leg.position.set(0.22 * s, 0.12, 0.3); rider.add(leg);
  }
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 12), skin);
  torso.scale.set(0.95, 0.85, 0.75); torso.position.y = 0.85; rider.add(torso);
  const bellyG = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), skin);
  bellyG.position.set(0, 0.72, 0.16); rider.add(bellyG);
  const thread = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.025, 6, 20), M.gold);
  thread.position.y = 1.05; thread.rotation.x = 1.35; thread.rotation.z = 0.4; rider.add(thread);
  // shawl
  const shawl = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 6, 20, Math.PI), M.red);
  shawl.position.y = 1.1; shawl.rotation.x = 1.4; shawl.rotation.z = -0.5; rider.add(shawl);

  const headG = new THREE.Group(); headG.position.y = 1.55;
  const ehead = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), skin); headG.add(ehead);
  const gEars = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(0.36 * s, 0.05, -0.06);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), skin);
    ear.scale.set(0.18, 1.15, 0.95); ear.position.x = 0.12 * s; pivot.add(ear);
    pivot.rotation.y = s * 0.45; headG.add(pivot); gEars.push(pivot);
  }
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.1, 0.34), new THREE.Vector3(0.04, -0.38, 0.5), new THREE.Vector3(0.02, -0.58, 0.38), new THREE.Vector3(0.08, -0.68, 0.2)]), 14, 0.085, 8), skin);
  headG.add(trunk);
  for (const s of [-1, 1]) {
    const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.24, 8), new THREE.MeshStandardMaterial({ color: 0xfff6e0, roughness: 0.3 }));
    tusk.position.set(0.19 * s, -0.28, 0.36); tusk.rotation.x = Math.PI - 0.5;
    if (s === 1) tusk.scale.y = 0.55; // Ekadanta: one tusk is broken
    headG.add(tusk);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), M.dark);
    eye.position.set(0.17 * s, 0.08, 0.37); headG.add(eye);
  }
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.4, 10), M.gold); crown.position.y = 0.56; headG.add(crown);
  // glowing golden halo so Ganesha always stands out
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.045, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9 }));
  halo.position.y = 0.56; headG.add(halo);
  const glowOrb = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), M.glow.clone());
  glowOrb.position.y = 1.0; rider.add(glowOrb);
  const playerLight = new THREE.PointLight(0xffc35e, 0.9, 9); playerLight.position.y = 1.4; rider.add(playerLight);
  animated.push((dt, t) => { halo.rotation.z = t * 0.8; glowOrb.material.opacity = 0.16 + Math.sin(t * 2.4) * 0.05; playerLight.intensity = 0.8 + Math.sin(t * 3.1) * 0.18; });
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.045, 8, 20), M.gold); band.position.y = 0.28; band.rotation.x = Math.PI / 2 - 0.15; headG.add(band);
  const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff4d6d, emissive: 0xff2244, emissiveIntensity: 0.8 }));
  jewel.position.set(0, 0.4, 0.3); headG.add(jewel);
  // tilak
  const tilak = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.02), new THREE.MeshStandardMaterial({ color: 0xff3b3b }));
  tilak.position.set(0, 0.2, 0.42); headG.add(tilak);
  rider.add(headG);

  const mkArm = (side, rz, rx) => {
    const arm = new THREE.Group(); arm.position.set(0.4 * side, 1.05, 0.05);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.5, 8), skin); mesh.position.y = -0.22; arm.add(mesh);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), skin); hand.position.y = -0.48; arm.add(hand);
    const bangle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 6, 12), M.gold); bangle.position.y = -0.4; arm.add(bangle);
    arm.rotation.z = rz; arm.rotation.x = rx; rider.add(arm); return arm;
  };
  const armL = mkArm(1, -0.7, -0.5);
  const modak = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), M.gold); modak.position.y = -0.62; armL.add(modak);
  const armR = mkArm(-1, 2.4, -0.4);
  rider.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { g: rider, headG, gEars, armR };
}

function buildPlayer() {
  const root = new THREE.Group();
  const mouse = buildMouse(1);
  // saddle
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.1, 1.0), M.red); saddle.position.y = 1.02; mouse.g.add(saddle);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.06, 1.07), M.gold); trim.position.y = 1.0; mouse.g.add(trim);
  const gan = buildGanesha();
  gan.g.position.y = 1.05;
  root.add(mouse.g, gan.g);
  root.scale.setScalar(1.05);
  root.position.set(player.x, 0, player.z);
  root.rotation.y = player.yaw;
  scene.add(root);
  player.g = root;
  player.parts = { mouse, gan };
}

function animatePlayer(dt, t) {
  const { mouse, gan } = player.parts;
  const spd = player.moving ? player.speed : 0;
  const cyc = t * (6 + spd * 0.9);
  const hop = player.moving && player.grounded ? Math.abs(Math.sin(cyc)) * (0.08 + spd * 0.008) : 0;
  mouse.g.position.y = hop;
  mouse.g.rotation.x = player.moving ? Math.sin(cyc) * 0.05 : 0;
  gan.g.position.y = 1.05 + hop * 0.6;
  gan.g.rotation.x = player.moving ? -0.06 - spd * 0.006 : 0;
  const flap = Math.sin(cyc) * (player.moving ? 0.3 : 0.08);
  mouse.ears[0].rotation.z = -0.35 + flap; mouse.ears[1].rotation.z = 0.35 - flap;
  mouse.tailPivot.rotation.x = Math.sin(t * 6) * 0.3; mouse.tailPivot.rotation.y = Math.sin(t * 4) * 0.25;
  mouse.feet.forEach((f, i) => { f.position.y = 0.14 + (player.moving ? Math.max(0, Math.sin(cyc + i * 1.57)) * 0.12 : 0); });
  gan.gEars[0].rotation.y = 0.45 + Math.sin(t * 3) * 0.14; gan.gEars[1].rotation.y = -0.45 - Math.sin(t * 3) * 0.14;
  gan.headG.rotation.z = Math.sin(t * 2.2) * 0.05; gan.headG.rotation.y = Math.sin(t * 1.3) * 0.08;
  gan.armR.rotation.z = 2.4 + Math.sin(t * 2) * 0.1;
  if (!player.grounded) { mouse.g.rotation.x = -0.25; mouse.feet.forEach(f => f.position.y = 0.05); }
}

// ---------------- NPCs ----------------
function buildNPC(o) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: o.skin || 0xc98a5a, roughness: 0.55, emissive: o.skin || 0xc98a5a, emissiveIntensity: 0.06 });
  const cloth = new THREE.MeshStandardMaterial({ color: o.cloth, roughness: 0.55, emissive: o.cloth, emissiveIntensity: 0.18 });   // saturated, readable at dusk
  const s = o.scale || 1;
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.7, 8), o.dhoti ? cloth : skin);
    leg.position.set(0.16 * sx, 0.35, 0); g.add(leg);
  }
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.7, 12), cloth); lower.position.y = 0.95; g.add(lower);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.75, 12), o.shirt ? new THREE.MeshStandardMaterial({ color: o.shirt, roughness: 0.55, emissive: o.shirt, emissiveIntensity: 0.18 }) : skin);
  torso.position.y = 1.65; g.add(torso);
  if (o.shawl) {
    const shawl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.1, 0.5), new THREE.MeshStandardMaterial({ color: o.shawl, roughness: 0.6, emissive: o.shawl, emissiveIntensity: 0.2 }));
    shawl.position.set(0.15, 1.55, 0.02); shawl.rotation.z = 0.15; g.add(shawl);
  }
  const arms = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(0.36 * sx, 1.95, 0);
    const am = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.7, 8), skin); am.position.y = -0.35; arm.add(am);
    arm.rotation.z = sx * 0.25; g.add(arm); arms.push(arm);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), skin); head.position.y = 2.38; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.31, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: o.hair || 0x201010, roughness: 0.9 }));
  hair.position.y = 2.42; g.add(hair);
  if (o.beard) {
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.9 }));
    beard.position.set(0, 2.05, 0.18); beard.rotation.x = Math.PI; g.add(beard);
  }
  if (o.turban) {
    const tb = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.1, 8, 16), new THREE.MeshStandardMaterial({ color: o.turban, roughness: 0.6, emissive: o.turban, emissiveIntensity: 0.15 }));
    tb.position.y = 2.55; tb.rotation.x = Math.PI / 2; g.add(tb);
  }
  if (o.braid) {
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0x201010 }));
    br.position.set(0, 2.05, -0.3); g.add(br);
  }
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), M.dark); eye.position.set(0.1 * sx, 2.42, 0.27); g.add(eye);
  }
  const tilak = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), new THREE.MeshStandardMaterial({ color: 0xff3b3b })); tilak.position.set(0, 2.5, 0.29); g.add(tilak);
  if (o.prop === 'basket') {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.3, 10), M.wood); b.position.set(0.55, 1.1, 0.2); g.add(b);
  } else if (o.prop === 'staff') {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.6, 6), M.wood); st.position.set(-0.5, 1.3, 0.1); g.add(st);
  } else if (o.prop === 'thali') {
    const th = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 14), M.brass); th.position.set(0, 1.35, 0.5); g.add(th);
    const fl = makeFlame(0.7); fl.position.set(0, 1.55, 0.5); g.add(fl);
  } else if (o.prop === 'watering') {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.4, 10), M.brass); w.position.set(0.55, 1.15, 0.1); g.add(w);
  }
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  g.scale.setScalar(s);
  g.position.set(o.x, groundHeight(o.x, o.z), o.z);
  g.rotation.y = o.yaw || 0;
  scene.add(g);
  addCircle(o.x, o.z, 0.55);
  const npc = { g, arms, head, baseYaw: o.yaw || 0, name: o.name, x: o.x, z: o.z, phase: rand(0, 6) };
  // exclamation marker when a quest is available
  const mark = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), M.marker);
  mark.position.y = 3.2 * s; mark.visible = false; g.add(mark);
  npc.marker = mark;
  npcs.push(npc);
  return npc;
}
function animateNPCs(dt, t) {
  for (const n of npcs) {
    const bob = Math.sin(t * 2 + n.phase) * 0.02;
    n.g.position.y = groundHeight(n.x, n.z) + bob;
    n.arms[0].rotation.z = -0.25 + Math.sin(t * 1.7 + n.phase) * 0.08;
    n.arms[1].rotation.z = 0.25 - Math.sin(t * 1.7 + n.phase) * 0.08;
    // turn to face the player when nearby
    const dx = player.x - n.x, dz = player.z - n.z, d = Math.hypot(dx, dz);
    const want = d < 7 ? Math.atan2(dx, dz) : n.baseYaw;
    n.g.rotation.y = lerpAngle(n.g.rotation.y, want, clamp(dt * 4, 0, 1));
    if (n.marker.visible) { n.marker.rotation.y += dt * 2; n.marker.position.y = 3.2 * n.g.scale.x + Math.sin(t * 3) * 0.15; }
  }
}

// ---------------- follower mice ----------------
function makeFollower(x, z) {
  const m = buildMouse(0.45, [0xff8fb8, 0x7dd3fc, 0x86efac, 0xfcd34d][followers.length % 4]);   // pastel rainbow cousins
  m.g.position.set(x, groundHeight(x, z), z);
  scene.add(m.g);
  const f = { m, x, z, y: groundHeight(x, z), yaw: 0, phase: rand(0, 6) };
  followers.push(f);
  return f;
}
function updateFollowers(dt, t) {
  let tx = player.x, tz = player.z, tyaw = player.yaw;
  for (let i = 0; i < followers.length; i++) {
    const f = followers[i];
    // target: a spot behind the previous one in the chain
    const gap = 1.6;
    const bx = tx - Math.sin(tyaw) * gap, bz = tz - Math.cos(tyaw) * gap;
    const dx = bx - f.x, dz = bz - f.z, d = Math.hypot(dx, dz);
    if (d > 0.15) {
      const sp = Math.min(d * 5, RUN_SPEED + 3) * dt;
      f.x += dx / d * Math.min(sp, d); f.z += dz / d * Math.min(sp, d);
      f.yaw = lerpAngle(f.yaw, Math.atan2(dx, dz), clamp(dt * 8, 0, 1));
    }
    const h = groundHeight(f.x, f.z);
    f.y = lerp(f.y, h, clamp(dt * 10, 0, 1));
    const hop = d > 0.4 ? Math.abs(Math.sin(t * 16 + f.phase)) * 0.18 : 0;
    f.m.g.position.set(f.x, f.y + hop, f.z);
    f.m.g.rotation.y = f.yaw;
    f.m.tailPivot.rotation.y = Math.sin(t * 7 + f.phase) * 0.4;
    f.m.ears[0].rotation.z = -0.35 + Math.sin(t * 9 + f.phase) * 0.2;
    f.m.ears[1].rotation.z = 0.35 - Math.sin(t * 9 + f.phase) * 0.2;
    tx = f.x; tz = f.z; tyaw = f.yaw;
  }
}
