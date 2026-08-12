// Basic 2D collision resolution against circles and AABBs

export function resolveCollisions(x, y, z, radius, height, colliders) {
  let outX = x;
  let outZ = z;

  // Simple sequential push-out
  for (const c of colliders) {
    if (c.type === 'circle') {
      // 2D cylinder collision (trees, props)
      // We assume props are on the ground and tall enough.
      const dx = outX - c.x;
      const dz = outZ - c.z;
      const distSq = dx * dx + dz * dz;
      const minD = radius + c.r;
      if (distSq < minD * minD && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const overlap = minD - dist;
        outX += (dx / dist) * overlap;
        outZ += (dz / dist) * overlap;
      }
    } else if (c.type === 'box') {
      // 3D AABB collision
      // Check Y bounds if they exist
      if (c.minY !== undefined && c.maxY !== undefined) {
        if (y + height < c.minY || y > c.maxY) {
          continue; // No overlap in Y
        }
      }

      // Expand box by radius for XZ
      const minX = c.minX - radius;
      const maxX = c.maxX + radius;
      const minZ = c.minZ - radius;
      const maxZ = c.maxZ + radius;

      if (outX > minX && outX < maxX && outZ > minZ && outZ < maxZ) {
        // Find closest edge to push out to
        const dLeft = outX - minX;
        const dRight = maxX - outX;
        const dTop = outZ - minZ;
        const dBot = maxZ - outZ;

        const min = Math.min(dLeft, dRight, dTop, dBot);
        if (min === dLeft) outX = minX;
        else if (min === dRight) outX = maxX;
        else if (min === dTop) outZ = minZ;
        else outZ = maxZ;
      }
    }
  }

  return { x: outX, z: outZ };
}

export function getFloorY(x, z, currentY, terrainY, walkableSurfaces) {
  let bestY = terrainY;

  for (const s of walkableSurfaces) {
    if (x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ) {
      let surfY = s.y;
      
      if (s.type === 'ramp') {
        // Interpolate along Z
        const zFraction = (z - s.minZ) / (s.maxZ - s.minZ); // 0 at minZ, 1 at maxZ
        // dirZ == 1 means goes UP towards -Z (minZ). So at minZ it is endY, at maxZ it is startY
        if (s.dirZ === 1) {
          surfY = s.endY - zFraction * (s.endY - s.startY);
        } else {
          // dirZ == -1 means goes UP towards +Z (maxZ).
          surfY = s.startY + zFraction * (s.endY - s.startY);
        }
      }

      // If this surface is close to the player's feet (or below them), it's a valid floor
      // We allow stepping up to 1.5 units (for stairs/ramps) and falling any amount
      if (currentY + 1.5 >= surfY) {
        bestY = Math.max(bestY, surfY);
      }
    }
  }

  return bestY;
}
