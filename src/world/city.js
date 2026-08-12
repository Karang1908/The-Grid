import * as THREE from 'three';
import { createBuilding, createRoundSkyscraper } from './building.js';

// Procedural city generator
export function createCity(scene, heightAt, colliders, walkableSurfaces, { seed = 1234 } = {}) {
  const group = new THREE.Group();
  group.name = 'city';

  // Seeded RNG
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9, flatShading: true });

  const CITY_SIZE = 120;
  const BLOCK_SIZE = 40;
  const ROAD_WIDTH = 8;
  const BUILDING_MARGIN = 3;

  // Create Roads (a grid)
  const roadGeom = new THREE.PlaneGeometry(CITY_SIZE, ROAD_WIDTH);
  roadGeom.rotateX(-Math.PI / 2);
  
  // E-W roads
  for (let z = -CITY_SIZE / 2; z <= CITY_SIZE / 2; z += BLOCK_SIZE) {
    const road = new THREE.Mesh(roadGeom, roadMat);
    road.position.set(0, 0.05, z); // Slightly above ground to prevent Z-fighting
    group.add(road);
  }

  // N-S roads
  const roadGeomNS = new THREE.PlaneGeometry(ROAD_WIDTH, CITY_SIZE);
  roadGeomNS.rotateX(-Math.PI / 2);
  for (let x = -CITY_SIZE / 2; x <= CITY_SIZE / 2; x += BLOCK_SIZE) {
    const road = new THREE.Mesh(roadGeomNS, roadMat);
    road.position.set(x, 0.05, 0);
    group.add(road);
  }

  // Outskirts road connecting to campsite (at Z=450)
  // Connects from Z=60 to Z=450, on X=0 (length 390)
  const outskirtsRoadGeom = new THREE.PlaneGeometry(ROAD_WIDTH, 390);
  outskirtsRoadGeom.rotateX(-Math.PI / 2);
  const outRoad = new THREE.Mesh(outskirtsRoadGeom, roadMat);
  outRoad.position.set(0, 0.05, 255); // Center is 255
  group.add(outRoad);

  // Trees along the outskirts road
  const trunkGeom = new THREE.CylinderGeometry(0.15, 0.2, 0.9, 6);
  const leafGeom = new THREE.ConeGeometry(0.9, 2.2, 7);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, flatShading: true, roughness: 0.95 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6b2f, flatShading: true, roughness: 0.9 });
  
  for (let z = 80; z < 430; z += 15) {
    for (const x of [-6, 6]) {
      if (rand() > 0.8) continue; // Random skip
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
      
      tree.position.set(x + (rand() * 2 - 1), heightAt(x, z), z + (rand() * 4 - 2));
      group.add(tree);
      
      if (colliders) {
        colliders.push({ type: 'circle', x: tree.position.x, z: tree.position.z, r: 0.3 * s });
      }
    }
  }

  // Create Buildings in the blocks
  for (let bx = -CITY_SIZE / 2 + BLOCK_SIZE / 2; bx < CITY_SIZE / 2; bx += BLOCK_SIZE) {
    for (let bz = -CITY_SIZE / 2 + BLOCK_SIZE / 2; bz < CITY_SIZE / 2; bz += BLOCK_SIZE) {
      if (Math.abs(bx) < 10 && Math.abs(bz) < 10) {
        // Center of the city -> Huge round skyscraper
        createRoundSkyscraper(bx, bz, heightAt, group, colliders, walkableSurfaces);
        continue;
      }
      
      if (rand() > 0.8) continue; // Leave some empty lots
      
      const bWidth = BLOCK_SIZE - ROAD_WIDTH - BUILDING_MARGIN * 2;
      const bDepth = BLOCK_SIZE - ROAD_WIDTH - BUILDING_MARGIN * 2;
      const floors = 3 + Math.floor(rand() * 4); // 3 to 6 floors
      
      createBuilding(bx, bz, bWidth, bDepth, floors, heightAt, group, colliders, walkableSurfaces, rand);
    }
  }

  scene.add(group);
  return group;
}
