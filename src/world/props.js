import * as THREE from 'three';

// Tiny seeded PRNG so prop placement is identical across clients.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CLEAR_RADIUS = 8; // keep spawn area clear
const SCATTER_RADIUS = 150;
const COUNT = 120;

const TREE_TRUNK_COLOR = 0x6b4a2b;
const TREE_LEAF_COLOR = 0x2f6b2f;
const ROCK_COLOR = 0x888888;
const BUSH_COLOR = 0x2a5a2a;
const PILLAR_COLOR = 0xcccac0;

export function scatterProps(scene, heightAt, colliders, { seed = 1337 } = {}) {
  const rand = mulberry32(seed);
  const group = new THREE.Group();
  group.name = 'props';

  const trunkGeom = new THREE.CylinderGeometry(0.15, 0.2, 0.9, 6);
  const leafGeom = new THREE.ConeGeometry(0.9, 2.2, 7);
  const rockGeom = new THREE.IcosahedronGeometry(0.6, 0);
  const bushGeom = new THREE.SphereGeometry(0.55, 8, 6);
  const pillarGeom = new THREE.CylinderGeometry(0.25, 0.3, 4.5, 8);

  const trunkMat = new THREE.MeshStandardMaterial({ color: TREE_TRUNK_COLOR, flatShading: true, roughness: 0.95 });
  const leafMat = new THREE.MeshStandardMaterial({ color: TREE_LEAF_COLOR, flatShading: true, roughness: 0.9 });
  const rockMat = new THREE.MeshStandardMaterial({ color: ROCK_COLOR, flatShading: true, roughness: 1.0 });
  const bushMat = new THREE.MeshStandardMaterial({ color: BUSH_COLOR, flatShading: true, roughness: 0.95 });
  const pillarMat = new THREE.MeshStandardMaterial({ color: PILLAR_COLOR, flatShading: true, roughness: 0.7 });

  for (let i = 0; i < COUNT; i++) {
    // Pick a point ring-randomly: angle in [0, 2pi), radius in [CLEAR, SCATTER].
    const angle = rand() * Math.PI * 2;
    const radius = CLEAR_RADIUS + rand() * (SCATTER_RADIUS - CLEAR_RADIUS);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = heightAt(x, z);

    const pick = rand();
    let mesh;
    if (pick < 0.5) {
      // Tree: trunk + cone.
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeom, trunkMat);
      trunk.position.y = 0.45;
      tree.add(trunk);
      const leaves = new THREE.Mesh(leafGeom, leafMat);
      leaves.position.y = 2.0;
      tree.add(leaves);
      const s = 0.8 + rand() * 0.6;
      tree.scale.setScalar(s);
      tree.rotation.y = rand() * Math.PI * 2;
      mesh = tree;
      if (colliders) colliders.push({ type: 'circle', x, z, r: 0.3 * s });
    } else if (pick < 0.75) {
      // Rock: icosahedron, random rotation.
      const rock = new THREE.Mesh(rockGeom, rockMat);
      const s = 0.5 + rand() * 1.1;
      rock.scale.set(s, s * 0.7, s);
      rock.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
      rock.position.y = 0.3;
      mesh = rock;
      if (colliders) colliders.push({ type: 'circle', x, z, r: 0.6 * s });
    } else if (pick < 0.95) {
      // Bush: squashed sphere.
      const bush = new THREE.Mesh(bushGeom, bushMat);
      bush.scale.set(0.9 + rand() * 0.5, 0.55, 0.9 + rand() * 0.5);
      bush.position.y = 0.3;
      mesh = bush;
    } else {
      const p = new THREE.Mesh(pillarGeom, pillarMat);
      p.position.y = 2.25;
      mesh = p;
      if (colliders) colliders.push({ type: 'circle', x, z, r: 0.3 });
    }

    mesh.position.set(x, y, z);
    group.add(mesh);
  }

  scene.add(group);
  return group;
}
