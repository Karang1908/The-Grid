import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';

// Helper: HSL to RGB since PlayCanvas Color uses RGB
function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) r = g = b = l;
    else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return new pc.Color(r, g, b);
}

export function createBuilding(app, physicsWorld, bx, bz, bWidth, bDepth, floors, groundY, group, rand, textures) {
    const floorHeight = 4.5;
    const wallThickness = 1.0;

    // Materials
    const hue = rand();
    const saturation = 0.2 + rand() * 0.3;
    const lightness = 0.3 + rand() * 0.5;
    
    const buildingMat = new pc.StandardMaterial();
    buildingMat.diffuse = hslToRgb(hue, saturation, lightness);
    buildingMat.roughness = 0.8;
    if (textures && textures.brick) {
        textures.brick.ready((asset) => {
            buildingMat.diffuseMap = asset.resource;
            buildingMat.diffuseMapTiling.set(bWidth/4, floorHeight/2);
            buildingMat.update();
        });
    }
    buildingMat.update();

    const floorMat = new pc.StandardMaterial();
    floorMat.diffuse = new pc.Color(0.8, 0.8, 0.8);
    floorMat.roughness = 0.9;
    floorMat.update();

    const glassMat = new pc.StandardMaterial();
    glassMat.diffuse = new pc.Color(0.5, 0.8, 1.0);
    glassMat.metalness = 0.8;
    glassMat.roughness = 0.1;
    glassMat.blendType = pc.BLEND_NORMAL;
    glassMat.opacity = 0.4;
    glassMat.update();

    const interiorWallMat = new pc.StandardMaterial();
    interiorWallMat.diffuse = new pc.Color(1, 1, 1);
    interiorWallMat.roughness = 0.9;
    interiorWallMat.update();

    const woodMat = new pc.StandardMaterial();
    woodMat.diffuse = new pc.Color(0.5, 0.3, 0.1);
    if (textures && textures.wood) {
        textures.wood.ready((asset) => {
            woodMat.diffuseMap = asset.resource;
            woodMat.update();
        });
    }
    woodMat.update();

    // Helper to create a box entity and physics collider
    const addBox = (x, y, z, w, h, d, mat, isSolid = true) => {
        const e = new pc.Entity();
        e.addComponent('render', { type: 'box', material: mat });
        e.setLocalScale(w, h, d);
        e.setPosition(x, y, z);
        group.addChild(e);

        if (isSolid) {
            const body = physicsWorld.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
            physicsWorld.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2), body);
        }
    };

    // Helper for walls with holes (windows/doors)
    const createWallWithHole = (x, y, z, w, h, d, holeW, holeH, holeOffsetY, isDoor) => {
        if (w > d) {
            // Horizontal wall (along X)
            const bottomH = holeOffsetY;
            if (bottomH > 0) addBox(x, y - h/2 + bottomH/2, z, w, bottomH, d, buildingMat);
            
            const topH = h - holeH - holeOffsetY;
            if (topH > 0) addBox(x, y + h/2 - topH/2, z, w, topH, d, buildingMat);
            
            const sideW = (w - holeW) / 2;
            if (sideW > 0) addBox(x - w/2 + sideW/2, y - h/2 + holeOffsetY + holeH/2, z, sideW, holeH, d, buildingMat);
            if (sideW > 0) addBox(x + w/2 - sideW/2, y - h/2 + holeOffsetY + holeH/2, z, sideW, holeH, d, buildingMat);

            if (!isDoor) {
                // Glass
                addBox(x, y - h/2 + holeOffsetY + holeH/2, z, holeW, holeH, d * 0.2, glassMat, false);
                // Window Mullions (Vertical and Horizontal frames)
                addBox(x, y - h/2 + holeOffsetY + holeH/2, z, 0.2, holeH, d * 0.4, darkMat, false);
                addBox(x, y - h/2 + holeOffsetY + holeH/2, z, holeW, 0.2, d * 0.4, darkMat, false);
            } else {
                // Door Frame
                addBox(x - holeW/2, y - h/2 + holeOffsetY + holeH/2, z, 0.3, holeH, d * 1.2, woodMat, false);
                addBox(x + holeW/2, y - h/2 + holeOffsetY + holeH/2, z, 0.3, holeH, d * 1.2, woodMat, false);
                addBox(x, y - h/2 + holeOffsetY + holeH, z, holeW, 0.3, d * 1.2, woodMat, false);
            }
        } else {
            // Vertical wall (along Z)
            const bottomH = holeOffsetY;
            if (bottomH > 0) addBox(x, y - h/2 + bottomH/2, z, w, bottomH, d, buildingMat);
            
            const topH = h - holeH - holeOffsetY;
            if (topH > 0) addBox(x, y + h/2 - topH/2, z, w, topH, d, buildingMat);
            
            const sideD = (d - holeW) / 2;
            if (sideD > 0) addBox(x, y - h/2 + holeOffsetY + holeH/2, z - d/2 + sideD/2, w, holeH, sideD, buildingMat);
            if (sideD > 0) addBox(x, y - h/2 + holeOffsetY + holeH/2, z + d/2 - sideD/2, w, holeH, sideD, buildingMat);

            if (!isDoor) {
                // Glass
                addBox(x, y - h/2 + holeOffsetY + holeH/2, z, w * 0.2, holeH, holeW, glassMat, false);
                // Window Mullions
                addBox(x, y - h/2 + holeOffsetY + holeH/2, z, w * 0.4, holeH, 0.2, darkMat, false);
                addBox(x, y - h/2 + holeOffsetY + holeH/2, z, w * 0.4, 0.2, holeW, darkMat, false);
            } else {
                // Door Frame
                addBox(x, y - h/2 + holeOffsetY + holeH/2, z - holeW/2, w * 1.2, holeH, 0.3, woodMat, false);
                addBox(x, y - h/2 + holeOffsetY + holeH/2, z + holeW/2, w * 1.2, holeH, 0.3, woodMat, false);
                addBox(x, y - h/2 + holeOffsetY + holeH, z, w * 1.2, 0.3, holeW, woodMat, false);
            }
        }
    };

    const darkMat = new pc.StandardMaterial();
    darkMat.diffuse = new pc.Color(0.1, 0.1, 0.1);
    darkMat.update();

    const createFurniture = (rx, ry, rz, hue) => {
        const type = Math.floor(rand() * 3);
        
        if (type === 0) {
            // Bedroom: Bed + Wardrobe
            addBox(rx, ry + 0.3, rz, 3.2, 0.6, 4.2, woodMat, true);
            addBox(rx + 2.5, ry + 2, rz, 1.5, 4, 2, woodMat, true); // Cupboard/Wardrobe
        } else if (type === 1) {
            // Living room: Sofa + TV
            addBox(rx, ry + 0.5, rz + 1, 4.5, 0.6, 1.8, buildingMat, true); // Sofa
            addBox(rx, ry + 0.4, rz - 2.5, 4, 0.8, 0.8, woodMat, true); // TV Stand
            addBox(rx, ry + 1.5, rz - 2.5, 3, 1.8, 0.1, darkMat, true); // TV Screen
        } else {
            // Kitchen: Counter + Fridge
            addBox(rx, ry + 0.7, rz, 3.8, 1.3, 1.8, woodMat, true);
            addBox(rx + 2.5, ry + 2.2, rz, 1.5, 4.4, 1.8, interiorWallMat, true); // Fridge
        }
    };

    for (let f = 0; f < floors; f++) {
        const y = groundY + f * floorHeight;

        // Floor
        addBox(bx, y, bz, bWidth, 0.4, bDepth, floorMat, true);

        const wallH = floorHeight;
        const wy = y + wallH / 2;
        const isGround = (f === 0);
        
        const windowW = Math.min(6, bWidth * 0.3);
        const windowH = floorHeight * 0.6;
        const windowOffsetY = 1;

        // Walls
        createWallWithHole(bx, wy, bz + bDepth/2 - wallThickness/2, bWidth, wallH, wallThickness, isGround ? 4 : windowW, isGround ? 3.5 : windowH, isGround ? 0 : windowOffsetY, isGround);
        createWallWithHole(bx, wy, bz - bDepth/2 + wallThickness/2, bWidth, wallH, wallThickness, windowW, windowH, windowOffsetY, false);
        createWallWithHole(bx - bWidth/2 + wallThickness/2, wy, bz, wallThickness, wallH, bDepth, windowW, windowH, windowOffsetY, false);
        createWallWithHole(bx + bWidth/2 - wallThickness/2, wy, bz, wallThickness, wallH, bDepth, windowW, windowH, windowOffsetY, false);

        // Interior Rooms
        if (bWidth >= 20 && bDepth >= 20) {
            const hallW = 4;
            const hwX1 = bx - hallW/2;
            const hwX2 = bx + hallW/2;
            const roomD = (bDepth - 2) / 2;

            for (let r = 0; r < 2; r++) {
                const rz = (bz + bDepth/2 - 1) - roomD/2 - r * roomD;
                createWallWithHole(hwX1, wy, rz, wallThickness, wallH, roomD, 2.5, 3.5, 0, true);
                createWallWithHole(hwX2, wy, rz, wallThickness, wallH, roomD, 2.5, 3.5, 0, true);

                if (r > 0) {
                    const divZ = (bz + bDepth/2 - 1) - r * roomD;
                    const leftW = (bWidth - hallW) / 2 - 1;
                    addBox(bx - hallW/2 - leftW/2, wy, divZ, leftW, wallH, 0.5, interiorWallMat, true);
                    addBox(bx + hallW/2 + leftW/2, wy, divZ, leftW, wallH, 0.5, interiorWallMat, true);
                }

                createFurniture(bx - hallW/2 - 4, y, rz, rand());
                createFurniture(bx + hallW/2 + 4, y, rz, rand());
            }
        }

        // Stairs
        if (f < floors - 1) {
            const stairW = 3, stairD = 6;
            const stairX = bx, stairZ = bz - bDepth/2 + stairD/2 + 2;
            const halfH = floorHeight / 2;
            const steps = 8;
            const stepD = stairD / steps;
            const stepH = halfH / steps;

            for (let s = 0; s < steps; s++) {
                // Flight 1 (visual only)
                addBox(stairX + stairW/4, y + s * stepH + stepH/2, stairZ + stairD/2 - (s * stepD + stepD/2), stairW/2, stepH, stepD, floorMat, false);
                // Flight 2 (visual only)
                addBox(stairX - stairW/4, y + halfH + s * stepH + stepH/2, stairZ - stairD/2 + (s * stepD + stepD/2), stairW/2, stepH, stepD, floorMat, false);
            }
            
            // Invisible physics ramps for smooth climbing
            const rampLength = Math.sqrt(stairD * stairD + halfH * halfH);
            const rampAngle = Math.atan2(halfH, stairD);
            const qX = Math.sin(rampAngle / 2);
            const qW = Math.cos(rampAngle / 2);

            // Ramp 1
            const r1 = physicsWorld.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(stairX + stairW/4, y + halfH/2, stairZ));
            r1.setRotation({ x: qX, y: 0, z: 0, w: qW }, true);
            physicsWorld.createCollider(RAPIER.ColliderDesc.cuboid(stairW/4, 0.1, rampLength/2), r1);

            // Ramp 2
            const r2 = physicsWorld.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(stairX - stairW/4, y + halfH + halfH/2, stairZ));
            r2.setRotation({ x: -qX, y: 0, z: 0, w: qW }, true);
            physicsWorld.createCollider(RAPIER.ColliderDesc.cuboid(stairW/4, 0.1, rampLength/2), r2);

            // Mid landing
            addBox(stairX, y + halfH, stairZ - stairD/2 - 1, stairW, 0.4, 2, floorMat, true);
        }

        // Roof
        if (f === floors - 1) {
            const roofY = y + floorHeight;
            addBox(bx, roofY, bz, bWidth, 0.4, bDepth, floorMat, true);

            // Parapet (small border wall around the roof)
            const pw = 0.5; // parapet thickness
            const ph = 1.2; // parapet height
            addBox(bx, roofY + ph/2, bz + bDepth/2 - pw/2, bWidth, ph, pw, buildingMat, true);
            addBox(bx, roofY + ph/2, bz - bDepth/2 + pw/2, bWidth, ph, pw, buildingMat, true);
            addBox(bx - bWidth/2 + pw/2, roofY + ph/2, bz, pw, ph, bDepth - pw*2, buildingMat, true);
            addBox(bx + bWidth/2 - pw/2, roofY + ph/2, bz, pw, ph, bDepth - pw*2, buildingMat, true);

            // AC Units / Vents
            const numVents = Math.floor(rand() * 4) + 1;
            for (let v = 0; v < numVents; v++) {
                const vx = bx + (rand() - 0.5) * (bWidth - 4);
                const vz = bz + (rand() - 0.5) * (bDepth - 4);
                addBox(vx, roofY + 0.8, vz, 1.6, 1.6, 1.6, floorMat, true); // AC block
                addBox(vx, roofY + 1.2, vz, 0.8, 1.0, 1.7, darkMat, false); // AC vent grille
            }
        }
    }
}

export function createRoundSkyscraper(app, physicsWorld, bx, bz, groundY, group) {
    const floors = 15;
    const floorHeight = 5;
    const radius = 12;
    const segments = 16;
    const wallThickness = 1;

    const skyMat = new pc.StandardMaterial();
    skyMat.diffuse = new pc.Color(0.15, 0.15, 0.18);
    skyMat.metalness = 0.7;
    skyMat.roughness = 0.3;
    skyMat.update();
    
    const floorMat = new pc.StandardMaterial();
    floorMat.diffuse = new pc.Color(0.2, 0.2, 0.2);
    floorMat.update();

    const glassMat = new pc.StandardMaterial();
    glassMat.diffuse = new pc.Color(0.5, 0.8, 1.0);
    glassMat.metalness = 0.9;
    glassMat.roughness = 0.1;
    glassMat.blendType = pc.BLEND_NORMAL;
    glassMat.opacity = 0.4;
    glassMat.update();

    const wallW = (2 * Math.PI * radius) / segments + 0.5;

    // Helper for adding boxes directly
    const addBox = (x, y, z, w, h, d, mat, angle = 0) => {
        const e = new pc.Entity();
        e.addComponent('render', { type: 'box', material: mat });
        e.setLocalScale(w, h, d);
        e.setPosition(x, y, z);
        if (angle !== 0) e.setEulerAngles(0, angle * 180 / Math.PI, 0);
        group.addChild(e);
        
        // Physics for rotated box
        const body = physicsWorld.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
        // Manual rotation for Rapier: Quat from Euler Y
        const q = new pc.Quat().setFromEulerAngles(0, angle * 180 / Math.PI, 0);
        body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
        physicsWorld.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2), body);
    };

    for (let f = 0; f < floors; f++) {
        const y = groundY + f * floorHeight;
        const wy = y + floorHeight / 2;
        
        // Floor (cylinder)
        const floorMesh = new pc.Entity();
        floorMesh.addComponent('render', { type: 'cylinder', material: floorMat });
        floorMesh.setLocalScale(radius * 2, 0.4, radius * 2);
        floorMesh.setPosition(bx, y, bz);
        group.addChild(floorMesh);
        
        const fBody = physicsWorld.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(bx, y, bz));
        physicsWorld.createCollider(RAPIER.ColliderDesc.cylinder(0.2, radius), fBody);

        // Walls
        for (let i = 0; i < segments; i++) {
            if (f === 0 && i === 0) continue; // Entrance

            const angle = (i / segments) * Math.PI * 2;
            const wx = bx + Math.sin(angle) * radius;
            const wz = bz + Math.cos(angle) * radius;
            
            const isWindow = (f > 0 && i % 2 === 0);
            const mat = isWindow ? glassMat : skyMat;

            if (isWindow) {
                // Glass doesn't need collision in our simple model
                const e = new pc.Entity();
                e.addComponent('render', { type: 'box', material: mat });
                e.setLocalScale(wallW, floorHeight, wallThickness);
                e.setPosition(wx, wy, wz);
                e.setEulerAngles(0, angle * 180 / Math.PI, 0);
                group.addChild(e);
            } else {
                addBox(wx, wy, wz, wallW, floorHeight, wallThickness, mat, angle);
            }
        }
        
        // Stairs
        if (f < floors - 1) {
            const stairW = 4, stairD = radius * 1.5;
            const steps = 15;
            const dir = (f % 2 === 0) ? 1 : -1;
            
            for (let s = 0; s < steps; s++) {
                const sz = bz - dir * (stairD/2) + dir * (s * (stairD/steps) + (stairD/steps)/2);
                const sy = y + s * (floorHeight/steps) + (floorHeight/steps)/2;
                // Visual steps
                const e = new pc.Entity();
                e.addComponent('render', { type: 'box', material: floorMat });
                e.setLocalScale(stairW, floorHeight/steps, stairD/steps);
                e.setPosition(bx, sy, sz);
                group.addChild(e);
            }

            // Invisible physics ramp
            const rampLength = Math.sqrt(stairD * stairD + floorHeight * floorHeight);
            const rampAngle = Math.atan2(floorHeight, stairD) * dir;
            const qX = Math.sin(rampAngle / 2);
            const qW = Math.cos(rampAngle / 2);

            const r1 = physicsWorld.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(bx, y + floorHeight/2, bz));
            r1.setRotation({ x: qX, y: 0, z: 0, w: qW }, true);
            physicsWorld.createCollider(RAPIER.ColliderDesc.cuboid(stairW/2, 0.1, rampLength/2), r1);
        }

        // Roof
        if (f === floors - 1) {
            const roof = new pc.Entity();
            roof.addComponent('render', { type: 'cylinder', material: skyMat });
            roof.setLocalScale(radius * 2, 0.4, radius * 2);
            roof.setPosition(bx, y + floorHeight, bz);
            group.addChild(roof);
        }
    }
}
