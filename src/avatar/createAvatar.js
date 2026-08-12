import * as THREE from 'three';

// Build a procedural humanoid ~1.7m tall.
//
// Layout:
//   avatarRoot (feet at y=0, world position = player position)
//     hips (group; y=0.9 from feet)
//       torso (capsule)
//       head (group at top of torso; sphere inside)
//       left/right upper arm (group at shoulder, mesh hanging down)
//         left/right lower arm (group at elbow, mesh hanging down)
//       left/right upper leg (group at hip, mesh hanging down)
//         left/right lower leg (group at knee, mesh hanging down)
//
// Each joint is a Three.Group whose local origin is the pivot point. Mesh geometry is
// offset so the joint's local origin sits at the actual rotation pivot (e.g. an upper
// arm's origin is at the shoulder, mesh extends downward).

const SKIN_COLOR = 0xeac8a3;

export function createAvatar(tintColor = 0x4f86f7) {
  const tintMat = new THREE.MeshStandardMaterial({
    color: tintColor,
    roughness: 0.6,
    metalness: 0.05,
    flatShading: true,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: SKIN_COLOR,
    roughness: 0.7,
    metalness: 0.0,
    flatShading: true,
  });

  const avatarRoot = new THREE.Group();
  avatarRoot.name = 'avatar';

  // --- Hips -----------------------------------------------------------------
  const hips = new THREE.Group();
  hips.position.y = 0.9;
  avatarRoot.add(hips);

  // Torso: capsule (cylinder body + hemisphere caps). Sized so its center is ~0.45
  // above the hips, putting the shoulders around y=1.45.
  const torsoGeom = new THREE.CapsuleGeometry(0.22, 0.5, 4, 8);
  const torso = new THREE.Mesh(torsoGeom, tintMat);
  torso.position.y = 0.45;
  hips.add(torso);

  // --- Head -----------------------------------------------------------------
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.0; // relative to hips
  hips.add(headGroup);
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), skinMat);
  headMesh.position.y = 0.16; // head pivot at base of skull
  headGroup.add(headMesh);

  // --- Arms -----------------------------------------------------------------
  function makeArm(side) {
    // side: 'left' or 'right'
    const upper = new THREE.Group();
    const s = side === 'left' ? 1 : -1;
    upper.position.set(s * 0.28, 0.85, 0); // shoulder, relative to hips
    const upperMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.28, 4, 8), tintMat);
    upperMesh.position.y = -0.18; // mesh extends downward from shoulder pivot
    upper.add(upperMesh);

    const lower = new THREE.Group();
    lower.position.y = -0.36; // elbow, relative to upper
    const lowerMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.26, 4, 8), tintMat);
    lowerMesh.position.y = -0.17;
    lower.add(lowerMesh);

    upper.add(lower);
    hips.add(upper);
    return { upper, lower };
  }
  const leftArm = makeArm('left');
  const rightArm = makeArm('right');

  // --- Legs -----------------------------------------------------------------
  function makeLeg(side) {
    const s = side === 'left' ? 1 : -1;
    const upper = new THREE.Group();
    upper.position.set(s * 0.12, 0.0, 0); // hip, relative to hips (= at top of legs)
    const upperMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.36, 4, 8), tintMat);
    upperMesh.position.y = -0.21;
    upper.add(upperMesh);

    const lower = new THREE.Group();
    lower.position.y = -0.42; // knee
    const lowerMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.34, 4, 8), tintMat);
    lowerMesh.position.y = -0.2;
    lower.add(lowerMesh);

    upper.add(lower);
    hips.add(upper);
    return { upper, lower };
  }
  const leftLeg = makeLeg('left');
  const rightLeg = makeLeg('right');

  // Restore neutral pose (Group rotations are on the joints themselves).
  return {
    root: avatarRoot,
    parts: {
      hips,
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
    dispose() {
      // Drop geometry/material references so GC can reclaim them when a remote leaves.
      torso.geometry.dispose();
      headMesh.geometry.dispose();
      [leftArm, rightArm].forEach(({ upper, lower }) => {
        upper.children.forEach((m) => m.geometry && m.geometry.dispose());
        lower.children.forEach((m) => m.geometry && m.geometry.dispose());
      });
      [leftLeg, rightLeg].forEach(({ upper, lower }) => {
        upper.children.forEach((m) => m.geometry && m.geometry.dispose());
        lower.children.forEach((m) => m.geometry && m.geometry.dispose());
      });
      tintMat.dispose();
      skinMat.dispose();
    },
  };
}
