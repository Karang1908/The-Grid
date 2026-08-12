import * as THREE from 'three';

/**
 * Unified Interaction Manager for World Objects:
 * - Cars (Drive / Exit)
 * - TVs (Toggle Screen ON / OFF & change channel)
 * - Drawers (Slide Open / Close with physics easing)
 * - Beds (Lie down to rest / Get up)
 * - Lamps (Toggle Light)
 */
export class InteractionManager {
  constructor() {
    this.interactables = []; // List of registered interactive objects
    this.currentNearby = null;
    this.holdTimer = 0;
    this.requiredHold = 0.45; // 0.45s hold for snappy, satisfying interaction
    this.restingBed = null; // Currently resting bed
  }

  register(item) {
    // item: { type: 'tv'|'drawer'|'bed'|'car'|'lamp', position: Vector3, radius: number, onInteract: function, getPrompt: function, update: function }
    this.interactables.push(item);
    return item;
  }

  unregister(item) {
    const idx = this.interactables.indexOf(item);
    if (idx !== -1) this.interactables.splice(idx, 1);
  }

  findClosest(playerPos, maxDist = 3.5) {
    let closest = null;
    let minDistSq = maxDist * maxDist;

    for (const item of this.interactables) {
      const dx = item.position.x - playerPos.x;
      const dy = item.position.y - playerPos.y;
      const dz = item.position.z - playerPos.z;
      
      // Vertical clearance check (must be on same floor within 2.2m)
      if (Math.abs(dy) > 2.2) continue;

      const distSq = dx * dx + dz * dz;
      const checkRadius = item.radius || 2.5;
      if (distSq < checkRadius * checkRadius && distSq < minDistSq) {
        minDistSq = distSq;
        closest = item;
      }
    }

    return closest;
  }

  update(dt, player, input, interactPrompt, interactProgress, promptTextEl) {
    // 1. Update all animated interactables (e.g. sliding drawers, pulsing screens)
    for (const item of this.interactables) {
      if (item.update) {
        item.update(dt);
      }
    }

    // 2. If player is currently resting in bed, handle get-up input
    if (this.restingBed) {
      interactPrompt.classList.add('visible');
      if (promptTextEl) promptTextEl.textContent = 'PRESS SPACE OR E TO GET UP';
      if (interactProgress) interactProgress.style.strokeDashoffset = 88;

      if (input.jump || (input.interact && !player.lastInteract)) {
        // Stand up from bed
        this.standUpFromBed(player);
      }
      return;
    }

    // 3. If driving car, car handles its own exit
    if (player.vehicle) {
      return;
    }

    // 4. Find nearest interactive object
    const nearby = this.findClosest(player.position);
    this.currentNearby = nearby;

    if (nearby) {
      interactPrompt.classList.add('visible');
      if (promptTextEl) {
        promptTextEl.textContent = nearby.getPrompt ? nearby.getPrompt() : 'HOLD E TO INTERACT';
      }

      if (input.interact) {
        this.holdTimer += dt;
        if (interactProgress) {
          const progress = Math.min(1.0, this.holdTimer / this.requiredHold);
          interactProgress.style.strokeDashoffset = 88 - progress * 88;
        }

        if (this.holdTimer >= this.requiredHold) {
          // Trigger interaction!
          if (nearby.onInteract) {
            nearby.onInteract(player, this);
          }
          this.holdTimer = 0;
          if (interactProgress) interactProgress.style.strokeDashoffset = 88;
        }
      } else {
        this.holdTimer = 0;
        if (interactProgress) interactProgress.style.strokeDashoffset = 88;
      }
    } else {
      this.holdTimer = 0;
      interactPrompt.classList.remove('visible');
      if (interactProgress) interactProgress.style.strokeDashoffset = 88;
    }
  }

  lieDownInBed(player, bedItem) {
    this.restingBed = bedItem;
    player.isResting = true;
    
    // Position player on the bed
    player.position.set(bedItem.position.x, bedItem.position.y + 0.5, bedItem.position.z);
    player.velocityY = 0;
    
    if (player.avatar && player.avatar.root) {
      player.avatar.root.rotation.x = -Math.PI / 2; // Lie down flat
      player.avatar.root.position.y = 0.2;
    }
  }

  standUpFromBed(player) {
    if (!this.restingBed) return;
    
    // Stand up beside bed
    player.position.x += 1.2;
    player.position.y = this.restingBed.position.y;
    player.isResting = false;
    
    if (player.avatar && player.avatar.root) {
      player.avatar.root.rotation.x = 0;
      player.avatar.root.position.y = 0;
    }
    
    this.restingBed = null;
  }
}
