import * as THREE from 'three';

// Shared geometries for performance
const boxGeom = new THREE.BoxGeometry(1, 1, 1);
const cylGeom = new THREE.CylinderGeometry(1, 1, 1, 16);

// Materials palette
const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3825, roughness: 0.8 });
const lightWoodMat = new THREE.MeshStandardMaterial({ color: 0xaa8255, roughness: 0.7 });
const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x2e1d13, roughness: 0.85 });
const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f7, roughness: 0.5 });
const blackMat = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.4 });
const metalChromeMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.1 });
const metalGoldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.2 });
const plantLeafMat = new THREE.MeshStandardMaterial({ color: 0x296933, roughness: 0.7, flatShading: true });
const plantPotMat = new THREE.MeshStandardMaterial({ color: 0xe0d6cc, roughness: 0.6 });

// Helper to create a positioned/scaled box
function makeBox(group, mat, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(boxGeom, mat);
  mesh.position.set(x, y, z);
  mesh.scale.set(w, h, d);
  if (rx || ry || rz) mesh.rotation.set(rx, ry, rz);
  group.add(mesh);
  return mesh;
}

// Helper to create cylinder
function makeCyl(group, mat, x, y, z, rt, rb, h, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(cylGeom, mat);
  mesh.position.set(x, y, z);
  mesh.scale.set(rt, h, rb);
  if (rx || ry || rz) mesh.rotation.set(rx, ry, rz);
  group.add(mesh);
  return mesh;
}

// Procedural Canvas TV Texture Generator
function createTVCanvasTexture(channel = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 288;
  const ctx = canvas.getContext('2d');

  const drawFrame = (time = 0) => {
    ctx.fillStyle = '#080c18';
    ctx.fillRect(0, 0, 512, 288);

    if (channel === 0) {
      // Channel 0: Cyberpunk Grid Network
      ctx.fillStyle = '#0a1628';
      ctx.fillRect(0, 0, 512, 288);

      // Neon grid lines
      ctx.strokeStyle = 'rgba(79, 134, 247, 0.6)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 512; i += 32) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 288);
        ctx.stroke();
      }
      for (let j = 0; j < 288; j += 24) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(512, j);
        ctx.stroke();
      }

      // Glowing Center Logo
      ctx.fillStyle = '#4f86f7';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#4f86f7';
      ctx.shadowBlur = 15;
      ctx.fillText('GDGoC · THE GRID', 256, 130);

      ctx.fillStyle = '#00ffcc';
      ctx.font = '18px monospace';
      ctx.shadowBlur = 8;
      ctx.fillText('LIVE NETWORK STREAM // CH 01', 256, 175);
    } else if (channel === 1) {
      // Channel 1: Retrowave Sunset
      const grad = ctx.createLinearGradient(0, 0, 0, 288);
      grad.addColorStop(0, '#110033');
      grad.addColorStop(0.5, '#770055');
      grad.addColorStop(1, '#ff5500');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 288);

      // Glowing Sun
      ctx.fillStyle = '#ffee00';
      ctx.shadowColor = '#ff3300';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(256, 150, 65, 0, Math.PI * 2);
      ctx.fill();

      // Horizon Text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('NEO TOKYO 2077', 256, 250);
    } else {
      // Channel 2: Arcade Game
      ctx.fillStyle = '#040810';
      ctx.fillRect(0, 0, 512, 288);
      ctx.fillStyle = '#39ff14';
      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('INSERT COIN TO PLAY', 256, 120);
      ctx.fillStyle = '#ff007f';
      ctx.font = '22px monospace';
      ctx.fillText('HIGH SCORE: 999,990', 256, 170);
    }
  };

  drawFrame(0);
  const texture = new THREE.CanvasTexture(canvas);
  return { texture, canvas, ctx, drawFrame };
}

// -----------------------------------------------------------------------------
// 1. INTERACTIVE CUPBOARD WITH SLIDING DRAWERS
// -----------------------------------------------------------------------------
export function createCupboardWithDrawers(x, y, z, rotY = 0, parentGroup, colliders, rand, interactionManager = null) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const w = 2.4;
  const h = 2.2;
  const d = 1.0;
  const drawersCount = 3;

  // Main cabinet frame
  makeBox(group, darkWoodMat, 0, h / 2, 0, w, h, d);
  makeBox(group, lightWoodMat, 0, h + 0.05, 0, w + 0.1, 0.1, d + 0.1);
  makeBox(group, blackMat, 0, 0.08, 0, w - 0.1, 0.16, d - 0.1);

  // 3 Sliding Drawers Group
  const drawerGroups = [];
  const drawerH = (h - 0.3) / drawersCount;

  for (let i = 0; i < drawersCount; i++) {
    const dy = 0.25 + i * drawerH + drawerH / 2;
    const drawerGroup = new THREE.Group();
    drawerGroup.position.set(0, dy, 0);

    // Drawer box container
    makeBox(drawerGroup, woodMat, 0, 0, d / 2 + 0.02, w - 0.16, drawerH - 0.06, 0.06);
    makeBox(drawerGroup, lightWoodMat, 0, -drawerH / 2 + 0.04, 0, w - 0.22, 0.04, d - 0.2); // inside bottom
    makeBox(drawerGroup, metalGoldMat, 0, 0, d / 2 + 0.08, 0.6, 0.04, 0.04); // gold handle

    // Items inside drawer (only visible when opened)
    if (i === 0) {
      makeBox(drawerGroup, new THREE.MeshStandardMaterial({ color: 0x4f86f7 }), -0.4, 0.05, 0.1, 0.5, 0.06, 0.6); // tech pad
      makeBox(drawerGroup, new THREE.MeshStandardMaterial({ color: 0xd4af37 }), 0.4, 0.04, 0.1, 0.3, 0.03, 0.4); // gold keycard
    } else if (i === 1) {
      makeBox(drawerGroup, new THREE.MeshStandardMaterial({ color: 0x882233 }), 0, 0.05, 0.1, 1.2, 0.08, 0.6); // folded clothes
    }

    group.add(drawerGroup);
    drawerGroups.push({ group: drawerGroup, baseZ: 0, currentZ: 0, targetZ: 0 });
  }

  // Decorative plant & books on top
  makeCyl(group, plantPotMat, 0.6, h + 0.25, 0, 0.25, 0.2, 0.3);
  makeBox(group, plantLeafMat, 0.6, h + 0.5, 0, 0.4, 0.3, 0.4, 0.2, 0.4, 0.1);
  makeBox(group, new THREE.MeshStandardMaterial({ color: 0x882233 }), -0.5, h + 0.15, 0, 0.5, 0.08, 0.6, 0, 0.1, 0);

  parentGroup.add(group);

  let isOpen = false;
  const toggleDrawers = () => {
    isOpen = !isOpen;
    drawerGroups.forEach((d, idx) => {
      // Staggered opening distance
      d.targetZ = isOpen ? (0.55 - idx * 0.08) : 0;
    });
  };

  if (interactionManager) {
    interactionManager.register({
      type: 'drawer',
      position: new THREE.Vector3(x, y + h / 2, z),
      radius: 2.5,
      getPrompt: () => isOpen ? 'HOLD E: CLOSE DRAWERS' : 'HOLD E: OPEN DRAWERS',
      onInteract: () => toggleDrawers(),
      update: (dt) => {
        for (const d of drawerGroups) {
          d.currentZ += (d.targetZ - d.currentZ) * Math.min(1.0, 10 * dt);
          d.group.position.z = d.currentZ;
        }
      }
    });
  }

  if (colliders) {
    colliders.push({
      type: 'box',
      minX: x - w / 2, maxX: x + w / 2,
      minZ: z - d / 2, maxZ: z + d / 2,
      minY: y, maxY: y + h + 0.5
    });
  }
}

// -----------------------------------------------------------------------------
// 2. INTERACTIVE TV UNIT WITH MULTI-CHANNEL EMISSIVE SCREENS
// -----------------------------------------------------------------------------
export function createTVUnit(x, y, z, rotY = 0, parentGroup, colliders, rand, interactionManager = null) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const consoleW = 3.6;
  const consoleH = 0.8;
  const consoleD = 0.9;

  // Media console base cabinet
  makeBox(group, darkWoodMat, 0, consoleH / 2, 0, consoleW, consoleH, consoleD);
  const legOffsetW = consoleW / 2 - 0.2;
  const legOffsetD = consoleD / 2 - 0.2;
  makeBox(group, metalChromeMat, -legOffsetW, 0.1, -legOffsetD, 0.08, 0.2, 0.08);
  makeBox(group, metalChromeMat, legOffsetW, 0.1, -legOffsetD, 0.08, 0.2, 0.08);
  makeBox(group, metalChromeMat, -legOffsetW, 0.1, legOffsetD, 0.08, 0.2, 0.08);
  makeBox(group, metalChromeMat, legOffsetW, 0.1, legOffsetD, 0.08, 0.2, 0.08);

  // Soundbar with glowing LED strip
  makeBox(group, blackMat, 0, consoleH + 0.08, 0.2, 2.0, 0.14, 0.2);
  const soundbarLED = makeBox(group, new THREE.MeshBasicMaterial({ color: 0x112233 }), 0, consoleH + 0.08, 0.31, 1.8, 0.02, 0.02);

  // Standby Power LED
  const powerLEDMat = new THREE.MeshBasicMaterial({ color: 0xff1111 }); // Red standby
  const powerLED = makeCyl(group, powerLEDMat, 1.5, consoleH + 0.38, 0.05, 0.03, 0.03, 0.03, Math.PI / 2, 0, 0);

  // Ultra-thin OLED TV
  const tvW = 3.2;
  const tvH = 1.9;
  const tvStandH = 0.35;
  makeBox(group, metalChromeMat, 0, consoleH + 0.02, 0, 0.9, 0.04, 0.5);
  makeBox(group, metalChromeMat, 0, consoleH + tvStandH / 2, 0, 0.2, tvStandH, 0.1);

  const tvCenterY = consoleH + tvStandH + tvH / 2;
  makeBox(group, blackMat, 0, tvCenterY, 0, tvW + 0.06, tvH + 0.06, 0.08);

  // TV Screen Material with procedural canvas channels
  let currentChannel = 0;
  let isTVOn = false;

  const tvChannelData = [
    createTVCanvasTexture(0),
    createTVCanvasTexture(1),
    createTVCanvasTexture(2)
  ];

  const offScreenMat = new THREE.MeshStandardMaterial({ color: 0x06080d, roughness: 0.1 });
  const onScreenMat = new THREE.MeshBasicMaterial({ map: tvChannelData[0].texture });

  const tvScreenMesh = makeBox(group, offScreenMat, 0, tvCenterY, 0.045, tvW, tvH, 0.01);

  parentGroup.add(group);

  const toggleTV = () => {
    if (!isTVOn) {
      isTVOn = true;
      currentChannel = 0;
      tvScreenMesh.material = onScreenMat;
      onScreenMat.map = tvChannelData[currentChannel].texture;
      powerLEDMat.color.setHex(0x00ff66); // Green active
      soundbarLED.material = new THREE.MeshBasicMaterial({ color: 0x4f86f7 });
    } else {
      currentChannel++;
      if (currentChannel < tvChannelData.length) {
        onScreenMat.map = tvChannelData[currentChannel].texture;
      } else {
        isTVOn = false;
        tvScreenMesh.material = offScreenMat;
        powerLEDMat.color.setHex(0xff1111); // Red standby
        soundbarLED.material = new THREE.MeshBasicMaterial({ color: 0x112233 });
      }
    }
  };

  if (interactionManager) {
    interactionManager.register({
      type: 'tv',
      position: new THREE.Vector3(x, y + tvCenterY, z),
      radius: 3.2,
      getPrompt: () => isTVOn ? `HOLD E: TV CHANNEL [CH 0${currentChannel + 1}]` : 'HOLD E: TURN TV [ON]',
      onInteract: () => toggleTV()
    });
  }

  if (colliders) {
    colliders.push({
      type: 'box',
      minX: x - consoleW / 2, maxX: x + consoleW / 2,
      minZ: z - consoleD / 2, maxZ: z + consoleD / 2,
      minY: y, maxY: y + tvCenterY + tvH / 2
    });
  }
}

// -----------------------------------------------------------------------------
// 3. PLUSH SOFA & COFFEE TABLE
// -----------------------------------------------------------------------------
export function createSofa(x, y, z, rotY = 0, parentGroup, colliders, rand, fabricColor = null) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const color = fabricColor || new THREE.Color().setHSL(rand ? rand() : 0.6, 0.45, 0.45);
  const sofaMat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const cushionAccentMat = new THREE.MeshStandardMaterial({ 
    color: new THREE.Color().setHSL((color.getHSL({ h: 0, s: 0, l: 0 }).h + 0.3) % 1, 0.7, 0.6), 
    roughness: 0.85 
  });

  const sofaW = 3.8;
  const sofaD = 1.6;
  const backH = 1.3;

  makeBox(group, darkWoodMat, 0, 0.15, 0, sofaW, 0.2, sofaD - 0.1);

  const cWidth = (sofaW - 0.6) / 3;
  for (let i = 0; i < 3; i++) {
    const cx = -sofaW / 2 + 0.3 + cWidth / 2 + i * cWidth;
    makeBox(group, sofaMat, cx, 0.45, 0.1, cWidth - 0.05, 0.35, sofaD - 0.5);
  }

  makeBox(group, sofaMat, 0, backH / 2 + 0.2, -sofaD / 2 + 0.15, sofaW, backH, 0.3);
  makeBox(group, sofaMat, -sofaW / 2 + 0.15, 0.6, 0, 0.3, 0.65, sofaD);
  makeBox(group, sofaMat, sofaW / 2 - 0.15, 0.6, 0, 0.3, 0.65, sofaD);

  const tableGroup = new THREE.Group();
  tableGroup.position.set(0, 0, sofaD / 2 + 0.9);
  makeBox(tableGroup, whiteMat, 0, 0.45, 0, 2.2, 0.08, 1.1);
  makeBox(tableGroup, metalChromeMat, -0.9, 0.22, -0.45, 0.06, 0.45, 0.06);
  makeBox(tableGroup, metalChromeMat, 0.9, 0.22, -0.45, 0.06, 0.45, 0.06);
  makeBox(tableGroup, metalChromeMat, -0.9, 0.22, 0.45, 0.06, 0.45, 0.06);
  makeBox(tableGroup, metalChromeMat, 0.9, 0.22, 0.45, 0.06, 0.45, 0.06);
  group.add(tableGroup);

  makeBox(group, new THREE.MeshStandardMaterial({ color: 0xdfdad2, roughness: 0.95 }), 0, 0.02, 0.6, sofaW + 0.6, 0.02, sofaD + 1.8);

  parentGroup.add(group);

  if (colliders) {
    colliders.push({
      type: 'box',
      minX: x - sofaW / 2, maxX: x + sofaW / 2,
      minZ: z - sofaD / 2, maxZ: z + sofaD / 2,
      minY: y, maxY: y + backH + 0.2
    });
  }
}

// -----------------------------------------------------------------------------
// 4. EXECUTIVE OFFICE SUITE
// -----------------------------------------------------------------------------
export function createOfficeSuite(x, y, z, rotY = 0, parentGroup, colliders, rand) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const deskW = 3.2;
  const deskH = 1.2;
  const deskD = 1.5;

  makeBox(group, darkWoodMat, 0, deskH, 0, deskW, 0.12, deskD);
  makeBox(group, blackMat, -deskW / 2 + 0.1, deskH / 2, 0, 0.1, deskH, deskD - 0.1);
  makeBox(group, blackMat, deskW / 2 - 0.1, deskH / 2, 0, 0.1, deskH, deskD - 0.1);
  makeBox(group, blackMat, 0, deskH / 2, -deskD / 2 + 0.1, deskW - 0.4, deskH, 0.08);

  // Dual Monitors with glowing matrix code
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
  makeBox(group, metalChromeMat, 0, deskH + 0.2, -0.3, 0.8, 0.35, 0.2);
  makeBox(group, screenMat, -0.5, deskH + 0.6, -0.25, 1.2, 0.7, 0.05, 0, 0.15, 0);
  makeBox(group, screenMat, 0.5, deskH + 0.6, -0.25, 1.2, 0.7, 0.05, 0, -0.15, 0);

  const chairGroup = new THREE.Group();
  chairGroup.position.set(0, 0, 0.7);
  makeCyl(chairGroup, metalChromeMat, 0, 0.2, 0, 0.35, 0.35, 0.1);
  makeCyl(chairGroup, metalChromeMat, 0, 0.4, 0, 0.06, 0.06, 0.35);
  makeBox(chairGroup, blackMat, 0, 0.6, 0, 0.8, 0.12, 0.8);
  makeBox(chairGroup, blackMat, 0, 1.1, 0.35, 0.75, 0.8, 0.12, -0.1, 0, 0);
  group.add(chairGroup);

  const shelfW = 1.8;
  const shelfH = 3.6;
  const shelfD = 0.7;
  const shelfGroup = new THREE.Group();
  shelfGroup.position.set(-deskW / 2 - 1.0, 0, -0.2);
  makeBox(shelfGroup, darkWoodMat, 0, shelfH / 2, 0, shelfW, shelfH, shelfD);
  group.add(shelfGroup);

  parentGroup.add(group);

  if (colliders) {
    colliders.push({
      type: 'box',
      minX: x - deskW / 2, maxX: x + deskW / 2,
      minZ: z - deskD / 2, maxZ: z + deskD / 2,
      minY: y, maxY: y + deskH + 1.0
    });
  }
}

// -----------------------------------------------------------------------------
// 5. INTERACTIVE MASTER BEDROOM SUITE (LIE DOWN & REST)
// -----------------------------------------------------------------------------
export function createBedroomSuite(x, y, z, rotY = 0, parentGroup, colliders, rand, interactionManager = null) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const bedW = 3.2;
  const bedL = 3.8;
  const headboardH = 2.0;

  makeBox(group, darkWoodMat, 0, 0.3, 0, bedW, 0.4, bedL);
  makeBox(group, woodMat, 0, headboardH / 2, -bedL / 2 + 0.15, bedW + 0.2, headboardH, 0.3);

  makeBox(group, whiteMat, 0, 0.65, 0.1, bedW - 0.2, 0.4, bedL - 0.4);
  const duvetColor = new THREE.Color().setHSL(rand ? rand() : 0.55, 0.5, 0.4);
  makeBox(group, new THREE.MeshStandardMaterial({ color: duvetColor }), 0, 0.72, 0.5, bedW - 0.15, 0.3, bedL - 1.4);

  makeBox(group, whiteMat, -bedW / 4, 0.9, -bedL / 2 + 0.7, 1.0, 0.2, 0.7, 0.15, 0, 0);
  makeBox(group, whiteMat, bedW / 4, 0.9, -bedL / 2 + 0.7, 1.0, 0.2, 0.7, 0.15, 0, 0);

  // Nightstands with glowing lamps
  const nsW = 0.8;
  const nsH = 0.7;
  const nsD = 0.8;
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffdd88 });

  for (const side of [-1, 1]) {
    const nsX = side * (bedW / 2 + nsW / 2 + 0.1);
    const nsZ = -bedL / 2 + nsD / 2 + 0.2;
    makeBox(group, darkWoodMat, nsX, nsH / 2, nsZ, nsW, nsH, nsD);
    makeCyl(group, lampGlowMat, nsX, nsH + 0.35, nsZ, 0.25, 0.35, 0.35);
  }

  parentGroup.add(group);

  if (interactionManager) {
    interactionManager.register({
      type: 'bed',
      position: new THREE.Vector3(x, y + 0.7, z),
      radius: 2.8,
      getPrompt: () => 'HOLD E: REST IN BED',
      onInteract: (player, mgr) => {
        mgr.lieDownInBed(player, { position: new THREE.Vector3(x, y + 0.7, z) });
      }
    });
  }

  if (colliders) {
    colliders.push({
      type: 'box',
      minX: x - bedW / 2, maxX: x + bedW / 2,
      minZ: z - bedL / 2, maxZ: z + bedL / 2,
      minY: y, maxY: y + headboardH
    });
  }
}

// -----------------------------------------------------------------------------
// 6. MODERN KITCHENETTE
// -----------------------------------------------------------------------------
export function createKitchenette(x, y, z, rotY = 0, parentGroup, colliders, rand) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const counterW = 3.8;
  const counterH = 1.3;
  const counterD = 1.1;

  makeBox(group, darkWoodMat, 0, counterH / 2, 0, counterW, counterH, counterD);
  makeBox(group, whiteMat, 0, counterH + 0.05, 0, counterW + 0.1, 0.1, counterD + 0.1);

  makeBox(group, metalChromeMat, -1.0, counterH + 0.07, 0, 1.0, 0.04, 0.7);
  makeBox(group, blackMat, 0.8, counterH + 0.09, 0, 1.0, 0.02, 0.8);

  const fridgeW = 1.4;
  const fridgeH = 3.4;
  const fridgeD = 1.2;
  const fridgeX = counterW / 2 + fridgeW / 2 + 0.05;
  makeBox(group, metalChromeMat, fridgeX, fridgeH / 2, 0, fridgeW, fridgeH, fridgeD);

  parentGroup.add(group);

  if (colliders) {
    colliders.push({
      type: 'box',
      minX: x - counterW / 2, maxX: x + counterW / 2 + fridgeW + 0.1,
      minZ: z - counterD / 2, maxZ: z + counterD / 2,
      minY: y, maxY: y + fridgeH
    });
  }
}

// -----------------------------------------------------------------------------
// 7. POTTED PLANTS & LIGHTS
// -----------------------------------------------------------------------------
export function createPottedPlant(x, y, z, parentGroup) {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  makeCyl(group, plantPotMat, 0, 0.5, 0, 0.45, 0.35, 1.0);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const px = Math.cos(angle) * 0.25;
    const pz = Math.sin(angle) * 0.25;
    makeBox(group, plantLeafMat, px, 1.3 + (i % 2) * 0.15, pz, 0.5, 0.6, 0.06, 0.3 * Math.cos(angle), angle, 0.3 * Math.sin(angle));
  }

  parentGroup.add(group);
}

export function createCeilingLight(x, y, z, parentGroup) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  makeCyl(group, blackMat, 0, 0, 0, 0.35, 0.35, 0.06);
  makeCyl(group, new THREE.MeshBasicMaterial({ color: 0xfff0d0 }), 0, -0.03, 0, 0.28, 0.28, 0.03);
  parentGroup.add(group);
}
