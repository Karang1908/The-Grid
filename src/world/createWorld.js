import * as THREE from 'three';

// Deterministic layered-sine heightmap. Cheap, no library dependency.
// Keeps terrain gentle so movement across the open world feels like rolling hills,
// not a spike field. Amplitude ~1.5m over 400m.
export function heightAt(x, z) {
  return (
    Math.sin(x * 0.05) * Math.cos(z * 0.05) * 1.2 +
    Math.sin(x * 0.13 + 1.7) * Math.cos(z * 0.09 - 0.4) * 0.5
  );
}

export function createWorld(scene) {
  const sky = 0x8ec9f0;
  scene.background = new THREE.Color(sky);
  scene.fog = new THREE.Fog(sky, 40, 220);

  // Lighting: hemisphere fill + one directional sun. Shadows off for chapter one.
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3d7a3d, 0.8);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2d6, 1.2);
  sun.position.set(60, 100, 30);
  scene.add(sun);

  // Ground: 400m x 400m plane, 100x100 segments, vertices displaced by heightAt.
  const SIZE = 400;
  const SEGMENTS = 100;
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
