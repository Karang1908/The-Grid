import * as THREE from 'three';

// Deterministic layered-sine heightmap. Cheap, no library dependency.
// Keeps terrain gentle so movement across the open world feels like rolling hills,
// not a spike field. Amplitude ~1.5m over 400m.
export function heightAt(x, z) {
  const h = (
    Math.sin(x * 0.05) * Math.cos(z * 0.05) * 1.2 +
    Math.sin(x * 0.13 + 1.7) * Math.cos(z * 0.09 - 0.4) * 0.5
  );
  // 1. Flatten city center (70m radius)
  const distCenter = Math.sqrt(x * x + z * z);
  let cityBlend = Math.max(0, Math.min(1, (distCenter - 55) / 20));

  // 2. Flatten campsite area at (0, 450)
  const distCamp = Math.sqrt(x * x + (z - 450) * (z - 450));
  let campBlend = Math.max(0, Math.min(1, (distCamp - 20) / 15));

  // 3. Flatten outskirts road corridor along X=0, Z between 50 and 450
  let roadBlend = 1.0;
  if (z >= 40 && z <= 460) {
    const absX = Math.abs(x);
    roadBlend = Math.max(0, Math.min(1, (absX - 6) / 10));
  }

  const finalBlend = Math.min(cityBlend, campBlend, roadBlend);
  return h * finalBlend;
}

export function createWorld(scene, group, colliders, walkableSurfaces) {
  // Lighting
  const sky = 0x8ec9f0;
  scene.background = new THREE.Color(sky);
  scene.fog = new THREE.Fog(sky, 40, 220);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.5);
  dirLight.position.set(200, 300, 100);
  scene.add(dirLight);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  scene.add(hemiLight);

  // Ground: 1000m x 1000m plane
  const SIZE = 1000;
  const SEGMENTS = 200;
  const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
  geometry.rotateX(-Math.PI / 2); // lie flat
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
  }
  geometry.computeVertexNormals();

  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x3d7a3d,
    flatShading: true,
    roughness: 0.95,
    metalness: 0.0,
  });
  const ground = new THREE.Mesh(geometry, groundMaterial);
  scene.add(ground);

  return { ground, heightAt };
}
