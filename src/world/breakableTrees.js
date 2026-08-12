import * as THREE from 'three';

export class BreakableTreeManager {
  constructor(scene) {
    this.scene = scene;
    this.trees = []; // { id, group, trunk, leaves, collider, isBroken, fallAngle, fallAxis, fallProgress, basePos }
    this.particles = []; // { mesh, velocity, life, maxLife }
    
    // Shared particle materials & geometries for performance
    this.splinterGeom = new THREE.BoxGeometry(0.08, 0.25, 0.08);
    this.splinterMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.9 });
    
    this.leafGeom = new THREE.PlaneGeometry(0.18, 0.18);
    this.leafMat = new THREE.MeshStandardMaterial({ 
      color: 0x388238, 
      side: THREE.DoubleSide,
      roughness: 0.8
    });
  }

  registerTree(treeGroup, trunkMesh, leavesMesh, collider, basePos) {
    const id = this.trees.length;
    this.trees.push({
      id,
      group: treeGroup,
      trunk: trunkMesh,
      leaves: leavesMesh,
      collider,
      isBroken: false,
      fallAngle: 0,
      fallAxis: new THREE.Vector3(1, 0, 0),
      fallProgress: 0,
      basePos: basePos.clone(),
      fallSpeed: 3.5,
    });
  }

  checkCarImpact(car, colliders) {
    if (!car || Math.abs(car.speed) < 2.0) return;

    const carPos = car.group.position;
    const carFwd = new THREE.Vector3(-Math.sin(car.facing), 0, -Math.cos(car.facing));
    const sign = car.speed >= 0 ? 1 : -1;
    const impactDir = carFwd.clone().multiplyScalar(sign).normalize();

    const carRadius = 2.2;

    for (const tree of this.trees) {
      if (tree.isBroken) continue;

      const dx = tree.basePos.x - carPos.x;
      const dz = tree.basePos.z - carPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      const treeRadius = (tree.collider ? tree.collider.r : 0.4) + carRadius;

      if (dist < treeRadius) {
        // BREAK THE TREE!
        this.breakTree(tree, impactDir, Math.abs(car.speed), colliders);
        // Slightly slow down the car on impact
        car.speed *= 0.88;
      }
    }
  }

  breakTree(tree, impactDir, impactSpeed, colliders) {
    tree.isBroken = true;

    // Remove collider
    if (tree.collider && colliders) {
      const idx = colliders.indexOf(tree.collider);
      if (idx !== -1) {
        colliders.splice(idx, 1);
      }
    }

    // Determine fall axis (perpendicular to impact direction in XZ plane)
    const right = new THREE.Vector3(-impactDir.z, 0, impactDir.x).normalize();
    tree.fallAxis = right;
    tree.fallProgress = 0;
    tree.fallSpeed = 2.0 + Math.min(impactSpeed * 0.15, 3.0);

    // Spawn splinter and leaf debris
    const count = 16 + Math.floor(Math.random() * 10);
    for (let i = 0; i < count; i++) {
      const isLeaf = Math.random() > 0.4;
      const mesh = new THREE.Mesh(
        isLeaf ? this.leafGeom : this.splinterGeom,
        isLeaf ? this.leafMat : this.splinterMat
      );

      mesh.position.set(
        tree.basePos.x + (Math.random() - 0.5) * 0.8,
        tree.basePos.y + 0.8 + Math.random() * 1.5,
        tree.basePos.z + (Math.random() - 0.5) * 0.8
      );

      // Random burst velocity in direction of impact
      const vel = impactDir.clone().multiplyScalar(2 + Math.random() * 5);
      vel.x += (Math.random() - 0.5) * 4;
      vel.y += 2 + Math.random() * 5;
      vel.z += (Math.random() - 0.5) * 4;

      mesh.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity: vel,
        rotVelocity: new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10
        ),
        life: 0,
        maxLife: 2.0 + Math.random() * 1.0,
      });
    }
  }

  update(dt) {
    // 1. Animate falling broken trees
    for (const tree of this.trees) {
      if (!tree.isBroken || tree.fallProgress >= 1.0) continue;

      tree.fallProgress = Math.min(1.0, tree.fallProgress + dt * tree.fallSpeed);

      // Smooth fall curve (eases into the fall, then settles)
      const targetAngle = (Math.PI / 2) * 0.95; // fall almost flat
      const currentAngle = targetAngle * Math.sin(tree.fallProgress * Math.PI * 0.5);

      // Pivot group rotation around the base
      tree.group.rotation.set(0, 0, 0);
      tree.group.rotateOnAxis(tree.fallAxis, currentAngle);

      // If finished falling, settle slightly into ground
      if (tree.fallProgress >= 1.0) {
        tree.group.position.y = tree.basePos.y - 0.1;
      }
    }

    // 2. Animate debris particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      // Physics
      p.velocity.y -= 15.0 * dt; // gravity
      p.mesh.position.addScaledVector(p.velocity, dt);

      p.mesh.rotation.x += p.rotVelocity.x * dt;
      p.mesh.rotation.y += p.rotVelocity.y * dt;
      p.mesh.rotation.z += p.rotVelocity.z * dt;

      // Fade or shrink near end of life
      if (p.life > p.maxLife * 0.7) {
        const scale = Math.max(0.01, 1 - (p.life - p.maxLife * 0.7) / (p.maxLife * 0.3));
        p.mesh.scale.setScalar(scale);
      }

      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }
}
