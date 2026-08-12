import * as THREE from 'three';
import { dampT } from '../utils/math.js';
import { resolveCollisions } from './collisions.js';

const ACCEL = 15;
const BRAKE = 30;
const FRICTION = 5;
const MAX_SPEED = 30;
const STEER_SPEED = 3;
const MAX_STEER = Math.PI / 6;

export class Car {
  constructor(id, position, color = 0xcc2222) {
    this.id = id;
    this.speed = 0;
    this.steering = 0;
    this.facing = 0; // yaw
    this.driver = null; // id of the player driving it

    this.group = new THREE.Group();
    this.group.position.copy(position);

    // Chassis
    const chassisGeom = new THREE.BoxGeometry(2, 0.8, 4);
    const chassisMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
    const chassis = new THREE.Mesh(chassisGeom, chassisMat);
    chassis.position.y = 0.8;
    this.group.add(chassis);

    // Cabin
    const cabinGeom = new THREE.BoxGeometry(1.9, 0.7, 2);
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 });
    const cabin = new THREE.Mesh(cabinGeom, cabinMat);
    cabin.position.set(0, 1.5, -0.2);
    this.group.add(cabin);
    
    // Headlights
    const lightGeom = new THREE.BoxGeometry(0.4, 0.2, 0.1);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hl = new THREE.Mesh(lightGeom, lightMat);
    hl.position.set(-0.7, 0.8, -2.01);
    this.group.add(hl);
    const hr = new THREE.Mesh(lightGeom, lightMat);
    hr.position.set(0.7, 0.8, -2.01);
    this.group.add(hr);

    // Wheels
    const wheelGeom = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
    wheelGeom.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    
    this.wheels = [];
    const positions = [
      [-1.1, 0.4, -1.2], [1.1, 0.4, -1.2], // front
      [-1.1, 0.4, 1.2],  [1.1, 0.4, 1.2]   // rear
    ];
    
    for (const pos of positions) {
      const wheel = new THREE.Mesh(wheelGeom, wheelMat);
      wheel.position.set(...pos);
      this.group.add(wheel);
      this.wheels.push(wheel);
    }
  }

  update(dt, input, heightAt, colliders) {
    // If not driven, just apply friction
    const fIn = input ? input.forward : 0;
    const rIn = input ? input.right : 0;
    const brake = input ? input.jump : 0; // Space to brake

    if (fIn !== 0) {
      this.speed += fIn * ACCEL * dt;
    } else {
      // Friction
      if (this.speed > 0) this.speed = Math.max(0, this.speed - FRICTION * dt);
      if (this.speed < 0) this.speed = Math.min(0, this.speed + FRICTION * dt);
    }

    if (brake) {
      if (this.speed > 0) this.speed = Math.max(0, this.speed - BRAKE * dt);
      if (this.speed < 0) this.speed = Math.min(0, this.speed + BRAKE * dt);
    }

    this.speed = Math.max(-MAX_SPEED / 2, Math.min(MAX_SPEED, this.speed));

    // Steering
    const targetSteer = -rIn * MAX_STEER;
    this.steering = targetSteer; // Instant steering for arcade feel, or lerp

    // Apply steering to front wheels visually
    this.wheels[0].rotation.y = this.steering;
    this.wheels[1].rotation.y = this.steering;

    // Spin wheels
    const dist = this.speed * dt;
    for (const w of this.wheels) {
      w.rotation.x -= dist / 0.4; // radius is 0.4
    }

    if (Math.abs(this.speed) > 0.1) {
      // Turn radius
      // simplified ackermann
      this.facing += (this.speed * Math.sin(this.steering) / 3.0) * dt;
    }

    // Move
    this.group.position.x -= Math.sin(this.facing) * dist;
    this.group.position.z -= Math.cos(this.facing) * dist;

    if (colliders) {
      // 2.0 radius, 2.0 height
      const resolved = resolveCollisions(this.group.position.x, this.group.position.y, this.group.position.z, 2.0, 2.0, colliders);
      
      // Stop the car if it hit something
      if (Math.abs(resolved.x - this.group.position.x) > 0.01 || Math.abs(resolved.z - this.group.position.z) > 0.01) {
        this.speed *= 0.5; // bounce/stop
      }
      
      this.group.position.x = resolved.x;
      this.group.position.z = resolved.z;
    }

    this.group.position.y = heightAt(this.group.position.x, this.group.position.z);
    
    this.group.rotation.y = this.facing;
  }
}
