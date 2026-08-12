import * as THREE from 'three';

export function createCampsite(scene, heightAt, colliders) {
  const group = new THREE.Group();
  group.name = 'campsite';
  
  // The campsite is located at Z=450
  const campZ = 450;
  const campX = 0;
  
  // 1. Campfire
  const fireGroup = new THREE.Group();
  fireGroup.position.set(campX, 0, campZ);
  
  // Logs
  const logGeom = new THREE.CylinderGeometry(0.1, 0.1, 1, 6);
  const logMat = new THREE.MeshStandardMaterial({ color: 0x4a3219, roughness: 1.0 });
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(logGeom, logMat);
    log.rotation.x = Math.PI / 2;
    log.rotation.z = (i * Math.PI) / 3;
    log.position.y = 0.1;
    fireGroup.add(log);
  }
  
  // Fire mesh (simple glowing cone)
  const fireGeom = new THREE.ConeGeometry(0.3, 0.8, 6);
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
  const fire = new THREE.Mesh(fireGeom, fireMat);
  fire.position.y = 0.5;
  fireGroup.add(fire);
  
  // Fire light
  const light = new THREE.PointLight(0xffaa00, 2, 20);
  light.position.y = 1;
  fireGroup.add(light);
  
  fireGroup.position.y = heightAt(campX, campZ);
  group.add(fireGroup);
  if (colliders) colliders.push({ type: 'circle', x: campX, z: campZ, r: 1.0 });

  // 2. Tents
  const tentGeom = new THREE.CylinderGeometry(1, 1, 2, 3);
  const tentMat = new THREE.MeshStandardMaterial({ color: 0x3366cc, roughness: 0.9, flatShading: true });
  
  const tentPositions = [
    { x: -3, z: campZ + 2, rot: 0.5 },
    { x: 3, z: campZ + 3, rot: -0.5 },
    { x: -1, z: campZ + 5, rot: 0 }
  ];
  
  for (const t of tentPositions) {
    const tent = new THREE.Mesh(tentGeom, tentMat);
    // Cylinder is upright, we need it to look like a triangular tent
    tent.rotation.z = Math.PI / 2; // Lay it flat
    tent.rotation.y = t.rot;
    
    // Scale to make it look like a tent
    tent.scale.set(1.5, 1, 1.5);
    
    tent.position.set(t.x, 0, t.z);
    tent.position.y = heightAt(t.x, t.z) + 0.5; // Half of height
    group.add(tent);
    
    if (colliders) colliders.push({ type: 'circle', x: t.x, z: t.z, r: 1.5 });
  }

  scene.add(group);
  return group;
}
