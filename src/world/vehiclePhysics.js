import * as THREE from 'three';
import { dampT, lerpAngle } from '../utils/math.js';

export class VehiclePhysics {
  constructor({
    wheelBase = 3.0,
    trackWidth = 2.2,
    wheelRadius = 0.45,
    maxSpeed = 35.0,
    reverseMaxSpeed = 12.0,
    accel = 18.0,
    brakeForce = 35.0,
    handbrakeForce = 60.0,
    friction = 4.0,
    steerSpeed = 6.0,
    maxSteerAngle = Math.PI / 5.5,
  } = {}) {
    this.wheelBase = wheelBase;
    this.trackWidth = trackWidth;
    this.wheelRadius = wheelRadius;
    this.maxSpeed = maxSpeed;
    this.reverseMaxSpeed = reverseMaxSpeed;
    this.accel = accel;
    this.brakeForce = brakeForce;
    this.handbrakeForce = handbrakeForce;
    this.friction = friction;
    this.steerSpeed = steerSpeed;
    this.maxSteerAngle = maxSteerAngle;

    this.speed = 0;
    this.steerAngle = 0;
    this.facing = 0;
    this.pitch = 0;
    this.roll = 0;
    this.bodyPitchLean = 0;
    this.bodyRollLean = 0;
    this.isDrifting = false;

    // Scratch vectors to avoid garbage collection
    this._fl = new THREE.Vector3();
    this._fr = new THREE.Vector3();
    this._rl = new THREE.Vector3();
    this._rr = new THREE.Vector3();
  }

  update(dt, input, carPos, heightAt) {
    const fIn = input ? (input.forward || 0) : 0;
    const rIn = input ? (input.right || 0) : 0;
    const brake = input ? (input.jump || 0) : 0; // Space for handbrake / brake

    // 1. Steering with speed sensitivity (tighter control at high speed)
    const speedFactor = 1.0 - Math.min(0.65, (Math.abs(this.speed) / this.maxSpeed) * 0.65);
    const targetSteer = -rIn * this.maxSteerAngle * speedFactor;
    this.steerAngle += (targetSteer - this.steerAngle) * dampT(this.steerSpeed, dt);

    // 2. Acceleration & Braking Dynamics
    if (fIn > 0) {
      if (this.speed < 0) {
        // Active braking to reverse
        this.speed += this.brakeForce * dt;
      } else {
        this.speed = Math.min(this.maxSpeed, this.speed + this.accel * dt);
      }
    } else if (fIn < 0) {
      if (this.speed > 0) {
        // Active braking forward
        this.speed -= this.brakeForce * dt;
      } else {
        this.speed = Math.max(-this.reverseMaxSpeed, this.speed - this.accel * 0.65 * dt);
      }
    } else {
      // Natural rolling friction
      if (this.speed > 0) this.speed = Math.max(0, this.speed - this.friction * dt);
      else if (this.speed < 0) this.speed = Math.min(0, this.speed + this.friction * dt);
    }

    // Handbrake
    if (brake) {
      this.isDrifting = Math.abs(this.speed) > 10 && Math.abs(this.steerAngle) > 0.1;
      if (this.speed > 0) this.speed = Math.max(0, this.speed - this.handbrakeForce * dt);
      else if (this.speed < 0) this.speed = Math.min(0, this.speed + this.handbrakeForce * dt);
    } else {
      this.isDrifting = false;
    }

    // 3. Turn yaw from Ackermann steering
    if (Math.abs(this.speed) > 0.05) {
      const turnRadius = this.wheelBase / Math.sin(Math.max(0.001, Math.abs(this.steerAngle)));
      const angularVel = (this.speed / turnRadius) * Math.sign(this.steerAngle);
      const driftMultiplier = this.isDrifting ? 1.4 : 1.0;
      this.facing += angularVel * driftMultiplier * dt;
    }

    // 4. Update Position in XZ plane
    const forwardX = -Math.sin(this.facing);
    const forwardZ = -Math.cos(this.facing);
    const dist = this.speed * dt;

    carPos.x += forwardX * dist;
    carPos.z += forwardZ * dist;

    // 5. 4-Wheel Ground Contact & Terrain Slope Alignment
    const halfBase = this.wheelBase / 2;
    const halfTrack = this.trackWidth / 2;
    const rightX = -forwardZ;
    const rightZ = forwardX;

    // Front-Left
    this._fl.set(carPos.x + forwardX * halfBase - rightX * halfTrack, 0, carPos.z + forwardZ * halfBase - rightZ * halfTrack);
    // Front-Right
    this._fr.set(carPos.x + forwardX * halfBase + rightX * halfTrack, 0, carPos.z + forwardZ * halfBase + rightZ * halfTrack);
    // Rear-Left
    this._rl.set(carPos.x - forwardX * halfBase - rightX * halfTrack, 0, carPos.z - forwardZ * halfBase - rightZ * halfTrack);
    // Rear-Right
    this._rr.set(carPos.x - forwardX * halfBase + rightX * halfTrack, 0, carPos.z - forwardZ * halfBase + rightZ * halfTrack);

    const flY = heightAt(this._fl.x, this._fl.z);
    const frY = heightAt(this._fr.x, this._fr.z);
    const rlY = heightAt(this._rl.x, this._rl.z);
    const rrY = heightAt(this._rr.x, this._rr.z);

    const frontY = (flY + frY) / 2;
    const rearY = (rlY + rrY) / 2;
    const leftY = (flY + rlY) / 2;
    const rightY = (frY + rrY) / 2;

    const targetPitch = Math.atan2(frontY - rearY, this.wheelBase);
    const targetRoll = Math.atan2(rightY - leftY, this.trackWidth);
    const targetGroundY = (frontY + rearY) / 2;

    // Smooth terrain slope alignment
    this.pitch += (targetPitch - this.pitch) * dampT(15, dt);
    this.roll += (targetRoll - this.roll) * dampT(15, dt);
    carPos.y += (targetGroundY - carPos.y) * dampT(20, dt);

    // 6. Weight transfer body dynamics (accel pitch squat, brake dive, cornering roll lean)
    const accelInput = fIn;
    const targetBodyPitch = (brake ? -0.06 : (accelInput > 0 ? 0.04 : (accelInput < 0 ? -0.05 : 0)));
    const targetBodyRoll = -this.steerAngle * (this.speed / this.maxSpeed) * 0.08;

    this.bodyPitchLean += (targetBodyPitch - this.bodyPitchLean) * dampT(10, dt);
    this.bodyRollLean += (targetBodyRoll - this.bodyRollLean) * dampT(10, dt);
  }
}
