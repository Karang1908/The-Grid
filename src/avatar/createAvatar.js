import * as THREE from 'three';

const SKIN_COLOR = 0xeac8a3;
const EYE_COLOR = 0x222222;

function createNametagSprite(name = 'Player', tintColor = 0x4f86f7) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  function render(text) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const padX = 24;
    const padY = 20;
    const width = canvas.width - padX * 2;
    const height = canvas.height - padY * 2;
    const radius = 24;

    // Draw pill background
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(padX + radius, padY);
    ctx.lineTo(padX + width - radius, padY);
    ctx.quadraticCurveTo(padX + width, padY, padX + width, padY + radius);
    ctx.lineTo(padX + width, padY + height - radius);
    ctx.quadraticCurveTo(padX + width, padY + height, padX + width - radius, padY + height);
    ctx.lineTo(padX + radius, padY + height);
    ctx.quadraticCurveTo(padX, padY + height, padX, padY + height - radius);
    ctx.lineTo(padX, padY + radius);
    ctx.quadraticCurveTo(padX, padY, padX + radius, padY);
    ctx.closePath();

    ctx.fillStyle = 'rgba(8, 14, 24, 0.78)';
    ctx.fill();

    const hexColor = '#' + tintColor.toString(16).padStart(6, '0');
    ctx.lineWidth = 4;
    ctx.strokeStyle = hexColor;
    ctx.stroke();

    // Draw player name
    ctx.font = 'bold 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text || 'Player', canvas.width / 2, canvas.height / 2);
    ctx.restore();
  }

  render(name);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.4, 0.35, 1.0);
  sprite.position.set(0, 2.15, 0);

  return {
    sprite,
    setName(newName) {
      render(newName);
      texture.needsUpdate = true;
    },
    dispose() {
      texture.dispose();
      mat.dispose();
    },
  };
}

export function createAvatar(tintColor = 0x4f86f7, initialName = 'Player') {
  const tintMat = new THREE.MeshStandardMaterial({
    color: tintColor,
    roughness: 0.6,
    metalness: 0.1,
    flatShading: true,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: SKIN_COLOR,
    roughness: 0.7,
    metalness: 0.0,
    flatShading: true,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: EYE_COLOR,
    roughness: 0.3,
    metalness: 0.8,
  });

  const avatarRoot = new THREE.Group();
  avatarRoot.name = 'avatar';

  // --- Nametag Sprite ---
  const nametag = createNametagSprite(initialName, tintColor);
  avatarRoot.add(nametag.sprite);

  // --- Hips ---
  const hips = new THREE.Group();
  hips.position.y = 0.95;
  avatarRoot.add(hips);

  // Pelvis (hips base)
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.2), tintMat);
  hips.add(pelvis);

  // Spine (allows torso twisting independently of hips)
  const spine = new THREE.Group();
  hips.add(spine);

  // Chest
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.35, 0.22), tintMat);
  chest.position.y = 0.35;
  spine.add(chest);

  // --- Head ---
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.55; // Base of neck relative to spine
  spine.add(headGroup);

  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), skinMat);
  headMesh.position.y = 0.15; // Shift mesh up from neck pivot
  headGroup.add(headMesh);

  // Eyes (facing -Z which is forward)
  const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), eyeMat);
  leftEye.position.set(-0.06, 0.18, -0.12);
  headGroup.add(leftEye);

  const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), eyeMat);
  rightEye.position.set(0.06, 0.18, -0.12);
  headGroup.add(rightEye);

  // Headband / Hair accent
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.06, 0.25), tintMat);
  band.position.y = 0.26;
  headGroup.add(band);

  // --- Arms ---
  function makeArm(side) {
    const s = side === 'left' ? 1 : -1;
    const upper = new THREE.Group();
    upper.position.set(s * 0.25, 0.45, 0); // Shoulder joint

    const shoulderPad = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.14), tintMat);
    upper.add(shoulderPad);

    const upperMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), skinMat);
    upperMesh.position.y = -0.15;
    upper.add(upperMesh);

    const lower = new THREE.Group();
    lower.position.y = -0.3; // Elbow joint

    const lowerMesh = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.28, 0.07), skinMat);
    lowerMesh.position.y = -0.14;
    lower.add(lowerMesh);

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.09), skinMat);
    hand.position.y = -0.32;
    lower.add(hand);

    upper.add(lower);
    spine.add(upper); // Attach to spine so arms follow torso twist
    return { upper, lower };
  }
  const leftArm = makeArm('left');
  const rightArm = makeArm('right');

  // --- Legs ---
  function makeLeg(side) {
    const s = side === 'left' ? 1 : -1;
    const upper = new THREE.Group();
    upper.position.set(s * 0.11, -0.05, 0); // Hip joint

    const upperMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), tintMat);
    upperMesh.position.y = -0.22;
    upper.add(upperMesh);

    const lower = new THREE.Group();
    lower.position.y = -0.45; // Knee joint

    const lowerMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.1), skinMat);
    lowerMesh.position.y = -0.22;
    lower.add(lowerMesh);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.2), tintMat);
    foot.position.set(0, -0.45, -0.04); // Toes point to -Z
    lower.add(foot);

    upper.add(lower);
    hips.add(upper);
    return { upper, lower };
  }
  const leftLeg = makeLeg('left');
  const rightLeg = makeLeg('right');

  return {
    root: avatarRoot,
    nametag,
    parts: {
      hips,
      spine,
      head: headGroup,
      leftUpperArm: leftArm.upper,
      leftLowerArm: leftArm.lower,
      rightUpperArm: rightArm.upper,
      rightLowerArm: rightArm.lower,
      leftUpperLeg: leftLeg.upper,
      leftLowerLeg: leftLeg.lower,
      rightUpperLeg: rightLeg.upper,
      rightLowerLeg: rightLeg.lower,
    },
    _baseHipY: hips.position.y,
    setName(name) {
      nametag.setName(name);
    },
    dispose() {
      avatarRoot.traverse((obj) => {
        if (obj.isMesh && obj.geometry) {
          obj.geometry.dispose();
        }
      });
      nametag.dispose();
      tintMat.dispose();
      skinMat.dispose();
      eyeMat.dispose();
    },
  };
}
