import * as THREE from 'three';
import { VehiclePhysics } from './vehiclePhysics.js';
import { resolveCollisions } from './collisions.js';

const boxGeom = new THREE.BoxGeometry(1, 1, 1);
const cylGeom = new THREE.CylinderGeometry(1, 1, 1, 24);

export class Car {
  constructor(id, position, color = 0xd42424) {
    this.id = id;
    this.physics = new VehiclePhysics({
      wheelBase: 2.8,
      trackWidth: 2.1,
      wheelRadius: 0.42,
      maxSpeed: 38.0,
      reverseMaxSpeed: 14.0,
      accel: 20.0,
      brakeForce: 40.0,
      handbrakeForce: 70.0,
      friction: 4.5,
    });

    this.group = new THREE.Group();
    this.group.position.copy(position);

    // Car Body Container (for pitching and suspension body lean)
    this.bodyGroup = new THREE.Group();
    this.group.add(this.bodyGroup);

    // -------------------------------------------------------------------------
    // MATERIALS PALETTE
    // -------------------------------------------------------------------------
    this.paintMat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.25,
      metalness: 0.7,
    });

    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x141416,
      roughness: 0.6,
      metalness: 0.3,
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x112233,
      metalness: 0.9,
      roughness: 0.05,
      transparent: true,
      opacity: 0.65,
    });

    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 2.5,
      roughness: 0.1,
    });

    const taillightMat = new THREE.MeshStandardMaterial({
      color: 0xff2222,
      emissive: 0xff0000,
      emissiveIntensity: 3.0,
      roughness: 0.1,
    });

    const interiorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.8 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.95, roughness: 0.1 });
    const caliperMat = new THREE.MeshStandardMaterial({ color: 0xdd1111, roughness: 0.4 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.9 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.85, roughness: 0.2 });

    const addBodyPart = (mat, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) => {
      const mesh = new THREE.Mesh(boxGeom, mat);
      mesh.position.set(x, y, z);
      mesh.scale.set(w, h, d);
      if (rx || ry || rz) mesh.rotation.set(rx, ry, rz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.bodyGroup.add(mesh);
      return mesh;
    };

    // -------------------------------------------------------------------------
    // AERODYNAMIC BODYWORK & CHASSIS
    // -------------------------------------------------------------------------
    // Main lower chassis
    addBodyPart(this.paintMat, 0, 0.48, 0, 2.05, 0.45, 4.4);

    // Front low contoured hood
    addBodyPart(this.paintMat, 0, 0.58, -1.3, 1.95, 0.28, 1.8, -0.06, 0, 0);
    // Hood scoop vent
    addBodyPart(carbonMat, 0, 0.72, -1.1, 0.7, 0.08, 0.6, -0.06, 0, 0);

    // Front Bumper & Aerodynamic Splitter
    addBodyPart(carbonMat, 0, 0.28, -2.18, 2.08, 0.14, 0.35);
    addBodyPart(this.paintMat, 0, 0.45, -2.15, 2.05, 0.32, 0.25);

    // Front Honeycomb Radiator Grille
    addBodyPart(carbonMat, 0, 0.46, -2.28, 1.3, 0.22, 0.05);

    // Side Skirts
    addBodyPart(carbonMat, -1.05, 0.3, 0, 0.12, 0.16, 2.8);
    addBodyPart(carbonMat, 1.05, 0.3, 0, 0.12, 0.16, 2.8);

    // Rear Bumper & Racing Diffuser
    addBodyPart(this.paintMat, 0, 0.52, 2.15, 2.05, 0.4, 0.25);
    addBodyPart(carbonMat, 0, 0.32, 2.22, 1.9, 0.2, 0.3);
    // Dual Chrome Exhaust Pipes
    const ex1 = new THREE.Mesh(cylGeom, chromeMat);
    ex1.position.set(-0.6, 0.32, 2.36);
    ex1.scale.set(0.12, 0.18, 0.12);
    ex1.rotation.x = Math.PI / 2;
    this.bodyGroup.add(ex1);

    const ex2 = new THREE.Mesh(cylGeom, chromeMat);
    ex2.position.set(0.6, 0.32, 2.36);
    ex2.scale.set(0.12, 0.18, 0.12);
    ex2.rotation.x = Math.PI / 2;
    this.bodyGroup.add(ex2);

    // Rear Sport Spoiler / Wing
    addBodyPart(carbonMat, -0.7, 0.95, 2.0, 0.06, 0.38, 0.18, -0.15, 0, 0);
    addBodyPart(carbonMat, 0.7, 0.95, 2.0, 0.06, 0.38, 0.18, -0.15, 0, 0);
    addBodyPart(this.paintMat, 0, 1.15, 2.05, 2.1, 0.08, 0.45, -0.1, 0, 0);

    // -------------------------------------------------------------------------
    // GLASS COCKPIT & CABIN
    // -------------------------------------------------------------------------
    // Roof slab
    addBodyPart(this.paintMat, 0, 1.18, 0.1, 1.6, 0.08, 1.7);
    // Tinted Sunroof
    addBodyPart(glassMat, 0, 1.2, 0.0, 1.2, 0.04, 1.1);

    // Front Windshield (raked)
    addBodyPart(glassMat, 0, 0.94, -0.85, 1.62, 0.52, 0.65, -0.55, 0, 0);
    // Rear Window (sloped)
    addBodyPart(glassMat, 0, 0.94, 1.05, 1.6, 0.52, 0.65, 0.52, 0, 0);
    // Side Windows (Left & Right)
    addBodyPart(glassMat, -0.82, 0.92, 0.1, 0.05, 0.48, 1.6);
    addBodyPart(glassMat, 0.82, 0.92, 0.1, 0.05, 0.48, 1.6);

    // A-Pillars & C-Pillars (Roof frame)
    addBodyPart(this.paintMat, -0.82, 0.94, -0.8, 0.1, 0.54, 0.6, -0.55, 0, 0);
    addBodyPart(this.paintMat, 0.82, 0.94, -0.8, 0.1, 0.54, 0.6, -0.55, 0, 0);
    addBodyPart(this.paintMat, -0.82, 0.94, 1.0, 0.1, 0.54, 0.6, 0.52, 0, 0);
    addBodyPart(this.paintMat, 0.82, 0.94, 1.0, 0.1, 0.54, 0.6, 0.52, 0, 0);

    // Side Wing Mirrors
    addBodyPart(this.paintMat, -1.02, 0.88, -0.55, 0.22, 0.12, 0.28, 0, 0.1, 0);
    addBodyPart(chromeMat, -1.03, 0.88, -0.55, 0.02, 0.1, 0.24);
    addBodyPart(this.paintMat, 1.02, 0.88, -0.55, 0.22, 0.12, 0.28, 0, -0.1, 0);
    addBodyPart(chromeMat, 1.03, 0.88, -0.55, 0.02, 0.1, 0.24);

    // -------------------------------------------------------------------------
    // HIGH INTENSITY LED HEADLIGHTS & TAILLIGHTS
    // -------------------------------------------------------------------------
    // Projector Headlights
    addBodyPart(headlightMat, -0.72, 0.62, -2.18, 0.42, 0.16, 0.15, -0.1, 0.15, 0);
    addBodyPart(headlightMat, 0.72, 0.62, -2.18, 0.42, 0.16, 0.15, -0.1, -0.15, 0);

    // Full-width continuous rear LED lightbar
    addBodyPart(taillightMat, 0, 0.68, 2.22, 1.95, 0.14, 0.12);

    // -------------------------------------------------------------------------
    // INTERIOR (Dashboard, Steering Wheel, Bucket Seats)
    // -------------------------------------------------------------------------
    // Dashboard
    addBodyPart(interiorMat, 0, 0.75, -0.45, 1.5, 0.28, 0.5);
    // Glowing cyan gauge cluster
    addBodyPart(new THREE.MeshBasicMaterial({ color: 0x00ffff }), -0.35, 0.82, -0.42, 0.4, 0.12, 0.02);

    // Steering Wheel (3-spoke)
    const steerGroup = new THREE.Group();
    steerGroup.position.set(-0.35, 0.8, -0.2);
    steerGroup.rotation.x = -0.35;
    const steerRim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 8, 20), interiorMat);
    steerGroup.add(steerRim);
    const steerHub = new THREE.Mesh(boxGeom, chromeMat);
    steerHub.scale.set(0.12, 0.12, 0.05);
    steerGroup.add(steerHub);
    this.bodyGroup.add(steerGroup);

    // Left & Right Sports Bucket Seats
    for (const sx of [-0.38, 0.38]) {
      // Seat cushion
      addBodyPart(interiorMat, sx, 0.46, 0.1, 0.58, 0.18, 0.65);
      // Seat backrest with bolsters
      addBodyPart(interiorMat, sx, 0.78, 0.38, 0.54, 0.6, 0.18, 0.2, 0, 0);
      // Headrest
      addBodyPart(interiorMat, sx, 1.08, 0.46, 0.35, 0.24, 0.15, 0.15, 0, 0);
    }

    // -------------------------------------------------------------------------
    // HIGH DETAIL WHEELS, BRAKE CALIPERS & 5-SPOKE RIMS
    // -------------------------------------------------------------------------
    this.wheels = [];
    const wheelPositions = [
      [-1.08, 0.42, -1.4, true],  // Front-Left (steers)
      [1.08, 0.42, -1.4, true],   // Front-Right (steers)
      [-1.08, 0.42, 1.4, false],  // Rear-Left
      [1.08, 0.42, 1.4, false],   // Rear-Right
    ];

    for (const [wx, wy, wz, isFront] of wheelPositions) {
      // Steer knuckle group (rotates around Y for front wheels)
      const steerKnuckle = new THREE.Group();
      steerKnuckle.position.set(wx, wy, wz);
      this.group.add(steerKnuckle);

      // Brake Caliper (stationary, mounted on knuckle)
      const caliper = new THREE.Mesh(boxGeom, caliperMat);
      caliper.position.set(wx < 0 ? 0.06 : -0.06, 0.12, -0.15);
      caliper.scale.set(0.1, 0.16, 0.22);
      steerKnuckle.add(caliper);

      // Spinning Wheel Hub (rotates around X when car moves)
      const spinHub = new THREE.Group();
      steerKnuckle.add(spinHub);

      // Rubber Tire
      const tire = new THREE.Mesh(cylGeom, tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.scale.set(0.42, 0.32, 0.42);
      spinHub.add(tire);

      // Alloy Rim Barrel
      const rim = new THREE.Mesh(cylGeom, rimMat);
      rim.rotation.z = Math.PI / 2;
      rim.scale.set(0.32, 0.33, 0.32);
      spinHub.add(rim);

      // 5-Spoke Alloy Star
      for (let s = 0; s < 5; s++) {
        const spokeAngle = (s / 5) * Math.PI * 2;
        const spoke = new THREE.Mesh(boxGeom, chromeMat);
        spoke.position.set(wx < 0 ? -0.16 : 0.16, Math.sin(spokeAngle) * 0.16, Math.cos(spokeAngle) * 0.16);
        spoke.scale.set(0.04, 0.06, 0.22);
        spoke.rotation.x = -spokeAngle;
        spinHub.add(spoke);
      }

      this.wheels.push({
        knuckle: steerKnuckle,
        spinHub: spinHub,
        isFront: isFront,
      });
    }
  }

  get speed() {
    return this.physics.speed;
  }

  set speed(val) {
    this.physics.speed = val;
  }

  get facing() {
    return this.physics.facing;
  }

  set facing(val) {
    this.physics.facing = val;
  }

  update(dt, input, heightAt, colliders, treeManager = null) {
    // 1. Run physics simulation
    this.physics.update(dt, input, this.group.position, heightAt);

    // 2. Process breakable trees impact BEFORE static solid collision
    if (treeManager) {
      treeManager.checkCarImpact(this, colliders);
    }

    // 3. Collision resolution with world & buildings
    if (colliders && colliders.length > 0) {
      const resolved = resolveCollisions(
        this.group.position.x,
        this.group.position.y,
        this.group.position.z,
        1.8, // car radius
        1.5, // car height
        colliders
      );

      // Check impact collision against solid obstacles
      const dx = resolved.x - this.group.position.x;
      const dz = resolved.z - this.group.position.z;
      if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
        // Bounce recoil
        this.physics.speed *= -0.3;
      }

      this.group.position.x = resolved.x;
      this.group.position.z = resolved.z;
    }

    // 3. Apply orientation to car group (yaw, pitch, roll from terrain slope)
    this.group.rotation.set(0, 0, 0);
    this.group.rotation.y = this.physics.facing;
    this.group.rotation.x = this.physics.pitch;
    this.group.rotation.z = this.physics.roll;

    // 4. Apply dynamic body suspension lean & weight transfer to car body
    this.bodyGroup.rotation.x = this.physics.bodyPitchLean;
    this.bodyGroup.rotation.z = this.physics.bodyRollLean;

    // 5. Update wheels (steering angle on front, spin on all)
    const spinDelta = (this.physics.speed * dt) / 0.42;
    for (const w of this.wheels) {
      if (w.isFront) {
        w.knuckle.rotation.y = this.physics.steerAngle;
      }
      w.spinHub.rotation.x -= spinDelta;
    }
  }
}
