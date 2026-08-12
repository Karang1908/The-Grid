import * as THREE from 'three';

export function createBuilding(bx, bz, bWidth, bDepth, floors, heightAt, group, colliders, walkableSurfaces, rand) {
  const groundY = heightAt(bx, bz);
  const floorHeight = 4.5;
  const wallThickness = 1.0;
  
  // Random colorful material
  const hue = rand();
  const saturation = 0.2 + rand() * 0.3; // more muted, realistic colors
  const lightness = 0.3 + rand() * 0.5;
  const color = new THREE.Color().setHSL(hue, saturation, lightness);
  
  const buildingMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.9 });
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 1.0 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.5 });
  const interiorWallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  
  const boxGeom = new THREE.BoxGeometry(1, 1, 1);
  
  // Sidewalk
  const sidewalkW = bWidth + 4;
  const sidewalkD = bDepth + 4;
  const sMesh = new THREE.Mesh(boxGeom, floorMat);
  sMesh.position.set(bx, groundY + 0.1, bz);
  sMesh.scale.set(sidewalkW, 0.2, sidewalkD);
  group.add(sMesh);
  
  // Helper to add a box mesh and collider
  const addBox = (x, y, z, w, h, d, mat, isSolid = true) => {
    const mesh = new THREE.Mesh(boxGeom, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    group.add(mesh);
    
    if (isSolid && colliders) {
      colliders.push({
        type: 'box',
        minX: x - w / 2, maxX: x + w / 2,
        minZ: z - d / 2, maxZ: z + d / 2,
        minY: y - h / 2, maxY: y + h / 2
      });
    }
  };

  // Helper to create a wall with a hole and fill it with glass (unless it's a door)
  const createWallWithHole = (x, y, z, w, h, d, holeW, holeH, holeOffsetY, isDoor) => {
    if (w > d) {
      // Horizontal wall
      const bottomH = holeOffsetY;
      if (bottomH > 0) addBox(x, y - h/2 + bottomH/2, z, w, bottomH, d, buildingMat);
      const topH = h - holeH - holeOffsetY;
      if (topH > 0) addBox(x, y + h/2 - topH/2, z, w, topH, d, buildingMat);
      const sideW = (w - holeW) / 2;
      if (sideW > 0) addBox(x - w/2 + sideW/2, y - h/2 + holeOffsetY + holeH/2, z, sideW, holeH, d, buildingMat);
      if (sideW > 0) addBox(x + w/2 - sideW/2, y - h/2 + holeOffsetY + holeH/2, z, sideW, holeH, d, buildingMat);
      
      // Glass
      if (!isDoor) {
        const glass = new THREE.Mesh(boxGeom, glassMat);
        glass.position.set(x, y - h/2 + holeOffsetY + holeH/2, z);
        glass.scale.set(holeW, holeH, d * 0.2); // thinner glass
        group.add(glass);
      }
    } else {
      // Vertical wall
      const bottomH = holeOffsetY;
      if (bottomH > 0) addBox(x, y - h/2 + bottomH/2, z, w, bottomH, d, buildingMat);
      const topH = h - holeH - holeOffsetY;
      if (topH > 0) addBox(x, y + h/2 - topH/2, z, w, topH, d, buildingMat);
      const sideD = (d - holeW) / 2;
      if (sideD > 0) addBox(x, y - h/2 + holeOffsetY + holeH/2, z - d/2 + sideD/2, w, holeH, sideD, buildingMat);
      if (sideD > 0) addBox(x, y - h/2 + holeOffsetY + holeH/2, z + d/2 - sideD/2, w, holeH, sideD, buildingMat);
      
      if (!isDoor) {
        const glass = new THREE.Mesh(boxGeom, glassMat);
        glass.position.set(x, y - h/2 + holeOffsetY + holeH/2, z);
        glass.scale.set(w * 0.2, holeH, holeW);
        group.add(glass);
      }
    }
  };

  // Helper to create detailed furniture
  const createFurniture = (rx, ry, rz, rw, rd, hue) => {
    const fType = Math.floor(rand() * 4);
    const fMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(hue, 0.6, 0.5) });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.8 });

    if (fType === 0) {
      // Detailed Bedroom
      // Bed frame
      addBox(rx, ry + 0.3, rz, 3.2, 0.6, 4.2, woodMat);
      // Mattress
      addBox(rx, ry + 0.7, rz, 3, 0.4, 4, whiteMat);
      // Pillows
      addBox(rx - 0.8, ry + 0.95, rz - 1.5, 1.2, 0.2, 0.8, whiteMat);
      addBox(rx + 0.8, ry + 0.95, rz - 1.5, 1.2, 0.2, 0.8, whiteMat);
      // Blanket
      addBox(rx, ry + 0.92, rz + 0.5, 3.1, 0.1, 2.5, fMat);
      // Wardrobe / Cupboard
      addBox(rx + 2.5, ry + 2, rz, 1.5, 4, 2, woodMat);
    } else if (fType === 1) {
      // Detailed Office
      // Desk
      addBox(rx, ry + 1.2, rz, 3.5, 0.1, 2, woodMat);
      addBox(rx - 1.6, ry + 0.6, rz, 0.2, 1.2, 1.8, darkMat);
      addBox(rx + 1.6, ry + 0.6, rz, 0.2, 1.2, 1.8, darkMat);
      // Monitor
      addBox(rx, ry + 1.6, rz - 0.5, 1.2, 0.8, 0.1, darkMat);
      addBox(rx, ry + 1.3, rz - 0.5, 0.2, 0.3, 0.2, darkMat);
      // Office Chair
      addBox(rx, ry + 0.8, rz + 0.8, 1, 0.1, 1, darkMat);
      addBox(rx, ry + 0.4, rz + 0.8, 0.2, 0.8, 0.2, darkMat);
      addBox(rx, ry + 1.4, rz + 1.2, 1, 1, 0.1, darkMat);
      // Bookshelf
      addBox(rx - 2.5, ry + 2, rz, 1.2, 4, 1.5, woodMat);
    } else if (fType === 2) {
      // Living Room
      // Sofa
      addBox(rx, ry + 0.5, rz + 1, 4.5, 0.6, 1.8, fMat);
      addBox(rx, ry + 1.0, rz + 1.7, 4.5, 1.0, 0.4, fMat); // backrest
      addBox(rx - 2.0, ry + 0.8, rz + 1, 0.5, 0.6, 1.8, fMat); // armrests
      addBox(rx + 2.0, ry + 0.8, rz + 1, 0.5, 0.6, 1.8, fMat);
      // Coffee Table
      addBox(rx, ry + 0.6, rz - 0.5, 2.5, 0.1, 1.5, woodMat);
      addBox(rx, ry + 0.3, rz - 0.5, 1.5, 0.5, 0.8, darkMat);
      // TV Stand & TV
      addBox(rx, ry + 0.4, rz - 2.5, 4, 0.8, 0.8, woodMat);
      addBox(rx, ry + 1.5, rz - 2.5, 3, 1.8, 0.1, darkMat);
    } else {
      // Kitchenette
      // Counter
      addBox(rx, ry + 1.4, rz, 4, 0.1, 2, whiteMat);
      // Base cabinets
      addBox(rx, ry + 0.7, rz, 3.8, 1.3, 1.8, woodMat);
      // Fridge
      addBox(rx + 2.5, ry + 2.2, rz, 1.5, 4.4, 1.8, whiteMat);
      // Stove
      addBox(rx - 1, ry + 1.45, rz, 1, 0.1, 1, darkMat);
    }
  };

  for (let f = 0; f < floors; f++) {
    const y = groundY + f * floorHeight;
    
    // Floor
    addBox(bx, y, bz, bWidth, 0.4, bDepth, floorMat, false);
    if (walkableSurfaces) {
      walkableSurfaces.push({
        type: 'flat',
        y: y + 0.2,
        minX: bx - bWidth/2, maxX: bx + bWidth/2,
        minZ: bz - bDepth/2, maxZ: bz + bDepth/2
      });
    }

    // Walls
    const wallH = floorHeight;
    const wy = y + wallH / 2;
    
    const isGround = (f === 0);
    const windowW = Math.min(6, bWidth * 0.3); 
    const windowH = floorHeight * 0.6;
    const windowOffsetY = 1;
    
    // Front (Z+)
    createWallWithHole(bx, wy, bz + bDepth/2 - wallThickness/2, bWidth, wallH, wallThickness, 
      isGround ? 4 : windowW, isGround ? 3.5 : windowH, isGround ? 0 : windowOffsetY, isGround);
    
    // Back (Z-)
    createWallWithHole(bx, wy, bz - bDepth/2 + wallThickness/2, bWidth, wallH, wallThickness, windowW, windowH, windowOffsetY, false);
    
    // Left (X-)
    createWallWithHole(bx - bWidth/2 + wallThickness/2, wy, bz, wallThickness, wallH, bDepth, windowW, windowH, windowOffsetY, false);
    
    // Right (X+)
    createWallWithHole(bx + bWidth/2 - wallThickness/2, wy, bz, wallThickness, wallH, bDepth, windowW, windowH, windowOffsetY, false);
    
    // Interior partitions (4 rooms, central hallway)
    if (bWidth >= 20 && bDepth >= 20) {
      const hallW = 4;
      // Hallway walls
      const hwX1 = bx - hallW/2;
      const hwX2 = bx + hallW/2;
      
      const roomD = (bDepth - 2) / 2; // 2 rooms deep
      
      for (let r = 0; r < 2; r++) {
        // Shift rooms to the front part of the building (Z+)
        const rz = (bz + bDepth/2 - 1) - roomD/2 - r * roomD;
        
        // Left hallway wall with door
        createWallWithHole(hwX1, wy, rz, wallThickness, wallH, roomD, 2.5, 3.5, 0, true);
        // Right hallway wall with door
        createWallWithHole(hwX2, wy, rz, wallThickness, wallH, roomD, 2.5, 3.5, 0, true);
        
        // Horizontal dividers between rooms
        if (r > 0) {
          const divZ = (bz + bDepth/2 - 1) - r * roomD;
          // left divider
          const leftW = (bWidth - hallW) / 2 - 1;
          addBox(bx - hallW/2 - leftW/2, wy, divZ, leftW, wallH, 0.5, interiorWallMat, true);
          // right divider
          addBox(bx + hallW/2 + leftW/2, wy, divZ, leftW, wallH, 0.5, interiorWallMat, true);
        }
        
        // Generate furniture in rooms
        const rhue = rand();
        createFurniture(bx - hallW/2 - 4, y, rz, 4, 4, rhue);
        createFurniture(bx + hallW/2 + 4, y, rz, 4, 4, rand());
      }
    }
    
    // Realistic U-Shaped Switchback Stairs in the back of the hallway
    if (f < floors - 1) {
      const stairW = 3; // total width of the stairwell
      const halfW = stairW / 2;
      const stairD = 6;
      const stairX = bx; // Center of the hallway
      const stairZ = bz - bDepth/2 + stairD/2 + 2; // Back of the building
      const halfH = floorHeight / 2;
      
      const steps = 8; // steps per flight
      const stepD = stairD / steps;
      const stepH = halfH / steps;

      // Flight 1 (Bottom to Mid Landing) - Right side
      for (let s = 0; s < steps; s++) {
        const sx = stairX + halfW/2;
        const sz = stairZ + stairD/2 - (s * stepD + stepD/2);
        const sy = y + s * stepH + stepH/2;
        addBox(sx, sy, sz, halfW, stepH, stepD, floorMat, false);
      }
      
      // Mid Landing
      addBox(stairX, y + halfH, stairZ - stairD/2 - 1, stairW, 0.4, 2, floorMat, false);
      
      // Flight 2 (Mid Landing to Top) - Left side
      for (let s = 0; s < steps; s++) {
        const sx = stairX - halfW/2;
        const sz = stairZ - stairD/2 + (s * stepD + stepD/2);
        const sy = y + halfH + s * stepH + stepH/2;
        addBox(sx, sy, sz, halfW, stepH, stepD, floorMat, false);
      }

      // Colliders for the U-Shape Stairs
      if (walkableSurfaces) {
        // Flight 1 Collider (goes UP towards minZ, so dirZ: 1)
        walkableSurfaces.push({
          type: 'ramp',
          minX: stairX, maxX: stairX + stairW/2,
          minZ: stairZ - stairD/2, maxZ: stairZ + stairD/2,
          startY: y,
          endY: y + halfH,
          dirZ: 1
        });
        
        // Mid Landing Collider
        walkableSurfaces.push({
          type: 'flat',
          y: y + halfH + 0.2,
          minX: stairX - stairW/2, maxX: stairX + stairW/2,
          minZ: stairZ - stairD/2 - 2, maxZ: stairZ - stairD/2
        });

        // Flight 2 Collider (goes UP towards maxZ, so dirZ: -1)
        walkableSurfaces.push({
          type: 'ramp',
          minX: stairX - stairW/2, maxX: stairX,
          minZ: stairZ - stairD/2, maxZ: stairZ + stairD/2,
          startY: y + halfH,
          endY: y + floorHeight,
          dirZ: -1
        });
      }
    }
    
    // Roof (Top ceiling)
    if (f === floors - 1) {
      addBox(bx, y + floorHeight, bz, bWidth, 0.4, bDepth, ceilingMat, true);
    }
  }
}

export function createRoundSkyscraper(bx, bz, heightAt, group, colliders, walkableSurfaces) {
  const groundY = heightAt(bx, bz);
  const floors = 15;
  const floorHeight = 5;
  const radius = 16;
  const segments = 16;
  const wallThickness = 1;
  
  const buildingMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.8, flatShading: true });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x55aaff, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.4 });
  
  const boxGeom = new THREE.BoxGeometry(1, 1, 1);
  const wallW = (2 * Math.PI * radius) / segments + 0.5; // Slightly wider to overlap
  
  for (let f = 0; f < floors; f++) {
    const y = groundY + f * floorHeight;
    const wy = y + floorHeight / 2;
    
    // Floor
    const floorMesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.4, segments), floorMat);
    floorMesh.position.set(bx, y, bz);
    group.add(floorMesh);
    
    if (walkableSurfaces) {
      walkableSurfaces.push({
        type: 'flat', y: y + 0.2,
        minX: bx - radius, maxX: bx + radius,
        minZ: bz - radius, maxZ: bz + radius
      });
    }

    // Walls
    for (let i = 0; i < segments; i++) {
      // Leave segment 0 open on ground floor for entrance
      if (f === 0 && i === 0) continue;
      
      const angle = (i / segments) * Math.PI * 2;
      const wx = bx + Math.sin(angle) * radius;
      const wz = bz + Math.cos(angle) * radius;
      
      const isWindow = (f > 0 && i % 2 === 0);
      const mesh = new THREE.Mesh(boxGeom, isWindow ? glassMat : buildingMat);
      
      mesh.position.set(wx, wy, wz);
      mesh.rotation.y = angle;
      mesh.scale.set(wallW, floorHeight, wallThickness);
      group.add(mesh);
      
      // We only add AABBs for the non-glass solid walls, simplified as small boxes
      // A rotated box AABB is larger, we approximate it:
      if (!isWindow && colliders) {
        colliders.push({
          type: 'box',
          minX: wx - wallW/2, maxX: wx + wallW/2,
          minZ: wz - wallW/2, maxZ: wz + wallW/2,
          minY: wy - floorHeight/2, maxY: wy + floorHeight/2
        });
      }
    }
    
    // Visual Stairs (Replacing old smooth ramp)
    if (f < floors - 1) {
      const stairW = 4;
      const stairD = radius * 1.5;
      const stairX = bx;
      const stairZ = bz;
      
      const dir = (f % 2 === 0) ? 1 : -1;
      
      const steps = 15;
      const stepD = stairD / steps;
      const stepH = floorHeight / steps;
      
      for (let s = 0; s < steps; s++) {
        const sx = stairX;
        const sz = stairZ - dir * (stairD/2) + dir * (s * stepD + stepD/2);
        const sy = y + s * stepH + stepH/2;
        
        const mesh = new THREE.Mesh(boxGeom, floorMat);
        mesh.position.set(sx, sy, sz);
        mesh.scale.set(stairW, stepH, stepD);
        group.add(mesh);
      }
      
      if (walkableSurfaces) {
        walkableSurfaces.push({
          type: 'ramp',
          minX: stairX - stairW/2, maxX: stairX + stairW/2,
          minZ: stairZ - stairD/2, maxZ: stairZ + stairD/2,
          startY: y, endY: y + floorHeight,
          dirZ: -dir
        });
      }
    }
    
    // Roof
    if (f === floors - 1) {
      const roofMesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.4, segments), buildingMat);
      roofMesh.position.set(bx, y + floorHeight, bz);
      group.add(roofMesh);
    }
  }
}
