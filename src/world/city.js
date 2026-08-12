import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';
import { createBuilding, createRoundSkyscraper } from './building.js';

/**
 * Creates a procedural GTA-like city with roads, buildings, parked cars, and trees.
 * Uses a seeded RNG (mulberry32) for deterministic generation.
 *
 * @param {pc.Application} app - The PlayCanvas application instance.
 * @param {RAPIER.World} physicsWorld - The Rapier physics world.
 */
export function createCity(app, physicsWorld, textures) {
  // ─── 1. SEEDED RNG (mulberry32, seed 1234) ──────────────────────────
  let a = 1234 >>> 0;
  const rand = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // ─── 2. MATERIALS ───────────────────────────────────────────────────
  const roadMat = new pc.StandardMaterial();
  roadMat.diffuse = new pc.Color(0.13, 0.13, 0.13);
  roadMat.roughness = 0.9;
  roadMat.update();

  const sidewalkMat = new pc.StandardMaterial();
  sidewalkMat.diffuse = new pc.Color(0.6, 0.6, 0.6);
  sidewalkMat.update();


  const trunkMat = new pc.StandardMaterial();
  trunkMat.diffuse = new pc.Color(0.4, 0.25, 0.1);
  trunkMat.update();

  const leavesMat = new pc.StandardMaterial();
  leavesMat.diffuse = new pc.Color(0.15, 0.5, 0.15);
  leavesMat.update();

  const wheelMat = new pc.StandardMaterial();
  wheelMat.diffuse = new pc.Color(0.1, 0.1, 0.1);
  wheelMat.update();

  const cabinMat = new pc.StandardMaterial();
  cabinMat.diffuse = new pc.Color(0.15, 0.15, 0.2);
  cabinMat.update();

  const headlightMat = new pc.StandardMaterial();
  headlightMat.diffuse = new pc.Color(1, 1, 0.9);
  headlightMat.emissive = new pc.Color(1, 1, 0.8);
  headlightMat.update();

  // ─── 3. CONSTANTS ──────────────────────────────────────────────────
  const CITY_SIZE = 120;
  const BLOCK_SIZE = 40;
  const ROAD_WIDTH = 8;
  const BUILDING_MARGIN = 3;
  
  // The campsite is far out on the Z axis
  const CAMPSITE_Z = 400;

  // ─── 4. ROADS (E-W and N-S grid) ──────────────────────────────────
  for (let i = -CITY_SIZE / 2; i <= CITY_SIZE / 2; i += BLOCK_SIZE) {
    // E-W road (runs along X axis at z = i)
    const ewRoad = new pc.Entity('road-ew-' + i);
    ewRoad.addComponent('render', { type: 'box', material: roadMat });
    ewRoad.setLocalScale(CITY_SIZE, 0.1, ROAD_WIDTH);
    ewRoad.setPosition(0, 0.05, i);
    app.root.addChild(ewRoad);

    // N-S road (runs along Z axis at x = i)
    const nsRoad = new pc.Entity('road-ns-' + i);
    nsRoad.addComponent('render', { type: 'box', material: roadMat });
    nsRoad.setLocalScale(ROAD_WIDTH, 0.1, CITY_SIZE);
    nsRoad.setPosition(i, 0.05, 0);
    app.root.addChild(nsRoad);
  }

  // --- Outskirts Road ---
  const outRoad = new pc.Entity('road-outskirts');
  outRoad.addComponent('render', { type: 'box', material: roadMat });
  outRoad.setLocalScale(ROAD_WIDTH, 0.1, CAMPSITE_Z - CITY_SIZE/2);
  outRoad.setPosition(0, 0.05, CITY_SIZE/2 + (CAMPSITE_Z - CITY_SIZE/2)/2);
  app.root.addChild(outRoad);

  // --- Campfire and Campsite Trees ---
  const campMat = new pc.StandardMaterial();
  campMat.diffuse = new pc.Color(0.8, 0.3, 0.1);
  campMat.emissive = new pc.Color(1.0, 0.5, 0.0);
  campMat.update();

  const campfire = new pc.Entity('campfire');
  campfire.addComponent('render', { type: 'cone', material: campMat });
  campfire.setLocalScale(1.5, 1.5, 1.5);
  campfire.setPosition(0, 0.75, CAMPSITE_Z + 10);
  app.root.addChild(campfire);

  const fireLight = new pc.Entity('fireLight');
  fireLight.addComponent('light', {
      type: 'point',
      color: new pc.Color(1.0, 0.6, 0.2),
      intensity: 3,
      range: 20,
      castShadows: true
  });
  fireLight.setPosition(0, 2, CAMPSITE_Z + 10);
  app.root.addChild(fireLight);

  const carColors = [new pc.Color(0.8,0.1,0.1), new pc.Color(0.1,0.3,0.8), new pc.Color(0.1,0.7,0.2), new pc.Color(0.8,0.7,0.1)];
  let carIdx = 0;
  
  const createCar = (cx, cz) => {
    const carMat = new pc.StandardMaterial();
    carMat.diffuse = carColors[carIdx % carColors.length];
    carMat.update();
    carIdx++;

    const wheelMat = new pc.StandardMaterial();
    wheelMat.diffuse = new pc.Color(0.1, 0.1, 0.1);
    wheelMat.update();

    // The single physics body (approximate hitbox)
    const carBody = physicsWorld.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(cx, 1, cz));
    const carCol = RAPIER.ColliderDesc.cuboid(1, 0.5, 2);
    physicsWorld.createCollider(carCol, carBody);

    // Parent group
    const carMesh = new pc.Entity();
    carMesh.tags.add('car');
    
    // Chassis
    const chassis = new pc.Entity();
    chassis.addComponent('render', { type: 'box', material: carMat });
    chassis.setLocalScale(2, 0.5, 4);
    chassis.setLocalPosition(0, -0.25, 0);
    carMesh.addChild(chassis);
    
    // Cabin
    const cabin = new pc.Entity();
    cabin.addComponent('render', { type: 'box', material: carMat });
    cabin.setLocalScale(1.8, 0.6, 2);
    cabin.setLocalPosition(0, 0.3, -0.2);
    carMesh.addChild(cabin);

    // Wheels
    const addWheel = (wx, wz) => {
      const w = new pc.Entity();
      w.addComponent('render', { type: 'cylinder', material: wheelMat });
      w.setLocalScale(0.5, 0.2, 0.5);
      w.setEulerAngles(0, 0, 90);
      w.setLocalPosition(wx, -0.4, wz);
      carMesh.addChild(w);
    };
    addWheel(-1.1, 1.2);
    addWheel(1.1, 1.2);
    addWheel(-1.1, -1.2);
    addWheel(1.1, -1.2);

    app.root.addChild(carMesh);
    carMesh.setPosition(cx, 1, cz);
    return carMesh;
  };

  // Simple Trees
  const createSimpleTree = (x, z) => {
    const tree = new pc.Entity();
    
    const trunkMat = new pc.StandardMaterial();
    trunkMat.diffuse = new pc.Color(0.4, 0.2, 0.1);
    trunkMat.update();
    
    const trunk = new pc.Entity();
    trunk.addComponent('render', { type: 'cylinder', material: trunkMat });
    trunk.setLocalScale(0.4, 2, 0.4);
    trunk.setLocalPosition(0, 1, 0);
    tree.addChild(trunk);

    const leavesMat = new pc.StandardMaterial();
    leavesMat.diffuse = new pc.Color(0.2, 0.6, 0.2);
    leavesMat.update();
    
    const leaves = new pc.Entity();
    leaves.addComponent('render', { type: 'box', material: leavesMat });
    leaves.setLocalScale(2, 2, 2);
    leaves.setLocalPosition(0, 2.5, 0);
    tree.addChild(leaves);

    tree.setPosition(x, 0, z);
    app.root.addChild(tree);
  };

  // Forest along the outskirts road
  const roadStartZ = CITY_SIZE/2;
  for (let z = roadStartZ; z < CAMPSITE_Z; z += 10) {
    if (rand() > 0.3) createSimpleTree(-10 - rand() * 20, z + rand() * 5);
    if (rand() > 0.3) createSimpleTree(10 + rand() * 20, z + rand() * 5);
  }

  // ─── 5. BUILDINGS & PARKS (in each block) ─────────────────────────────────
  for (let bx = -CITY_SIZE / 2 + BLOCK_SIZE / 2; bx < CITY_SIZE / 2; bx += BLOCK_SIZE) {
    for (let bz = -CITY_SIZE / 2 + BLOCK_SIZE / 2; bz < CITY_SIZE / 2; bz += BLOCK_SIZE) {
      if (Math.abs(bx) < 10 && Math.abs(bz) < 10) {
        createRoundSkyscraper(app, physicsWorld, bx, bz, 0, app.root);
        continue;
      }

      // --- Regular buildings (skip 20% of blocks) ---
      if (rand() > 0.8) continue;

      const bWidth = BLOCK_SIZE - ROAD_WIDTH - BUILDING_MARGIN * 2;
      const bDepth = BLOCK_SIZE - ROAD_WIDTH - BUILDING_MARGIN * 2;
      const floors = 3 + Math.floor(rand() * 4); // 3 to 6 floors

      createBuilding(app, physicsWorld, bx, bz, bWidth, bDepth, floors, 0, app.root, rand, textures);

    }
  }

  // ─── 6. CARS (4 parked cars at campsite) ───────────────────────────
  createCar( 8, CAMPSITE_Z);
  createCar(-8, CAMPSITE_Z);
  createCar( 8, CAMPSITE_Z + 8);
  createCar(-8, CAMPSITE_Z + 8);

  // ─── 7. TREES along roads ────────────────────────────────────────
  /**
   * Creates a simple tree entity (trunk cylinder + cone-shaped leaves).
   * @param {number} x - World X position.
   * @param {number} z - World Z position.
   */
  function createTree(x, z) {
    const tree = new pc.Entity('tree');
    tree.setPosition(x, 0, z);
    app.root.addChild(tree);

    // Trunk
    const trunk = new pc.Entity('trunk');
    trunk.addComponent('render', { type: 'cylinder', material: trunkMat });
    trunk.setLocalScale(0.5, 3, 0.5);
    trunk.setLocalPosition(0, 1.5, 0);
    tree.addChild(trunk);

    // Leaves (cone approximated by a narrow-top cylinder, or just use cone)
    const leaves = new pc.Entity('leaves');
    leaves.addComponent('render', { type: 'cone', material: leavesMat });
    leaves.setLocalScale(3, 4, 3);
    leaves.setLocalPosition(0, 5, 0);
    tree.addChild(leaves);
  }

  // Scatter trees near road edges along N-S and E-W roads
  for (let i = -CITY_SIZE / 2; i <= CITY_SIZE / 2; i += BLOCK_SIZE) {
    for (let t = -CITY_SIZE / 2 + 10; t < CITY_SIZE / 2; t += 15) {
      // Skip placement with some randomness for natural feel
      if (rand() < 0.4) continue;

      // Trees along E-W roads (offset in Z from road center)
      const ewOffset = (rand() > 0.5 ? 1 : -1) * (ROAD_WIDTH / 2 + 1.5);
      createTree(t + rand() * 4 - 2, i + ewOffset);

      // Trees along N-S roads (offset in X from road center)
      if (rand() < 0.4) continue;
      const nsOffset = (rand() > 0.5 ? 1 : -1) * (ROAD_WIDTH / 2 + 1.5);
      createTree(i + nsOffset, t + rand() * 4 - 2);
    }
  }
}
