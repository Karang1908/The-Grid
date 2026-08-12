// Robust 3D collision resolution against circles, AABBs, and multi-floor walkable surfaces

export function resolveCollisions(x, y, z, radius, height, colliders) {
  let outX = x;
  let outZ = z;

  if (!colliders || colliders.length === 0) return { x: outX, z: outZ };

  for (const c of colliders) {
    if (c.type === 'circle') {
      // Cylindrical collision
      if (c.minY !== undefined && c.maxY !== undefined) {
        if (y + height < c.minY || y > c.maxY) continue;
      }
      const dx = outX - c.x;
      const dz = outZ - c.z;
      const distSq = dx * dx + dz * dz;
      const minD = radius + c.r;
      if (distSq < minD * minD && distSq > 0.00001) {
        const dist = Math.sqrt(distSq);
        const overlap = minD - dist;
        outX += (dx / dist) * overlap;
        outZ += (dz / dist) * overlap;
      }
    } else if (c.type === 'box') {
      // 3D AABB collision
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
  const REACH_HEAD_ROOM = 1.2; // Allows stepping up stairs up to 1.2m and catching falling surfaces

  if (!walkableSurfaces || walkableSurfaces.length === 0) return bestY;

  for (const s of walkableSurfaces) {
    // Check bounding box
    if (x < s.minX || x > s.maxX || z < s.minZ || z > s.maxZ) continue;

    // If surface has an exclusion hole (e.g. stairwell opening), check if inside cutout
    if (s.holeMinX !== undefined && s.holeMaxX !== undefined && s.holeMinZ !== undefined && s.holeMaxZ !== undefined) {
      if (x > s.holeMinX && x < s.holeMaxX && z > s.holeMinZ && z < s.holeMaxZ) {
        continue; // Inside stair cutout hole -> fall through to floor/stairs below!
      }
    }

    // If surface has an inner circular hole (e.g. spiral staircase opening)
    if (s.holeCenterX !== undefined && s.holeCenterZ !== undefined && s.holeRadius !== undefined) {
      const hdx = x - s.holeCenterX;
      const hdz = z - s.holeCenterZ;
      if (hdx * hdx + hdz * hdz < s.holeRadius * s.holeRadius) {
        continue; // Inside spiral opening -> use stairs below!
      }
    }

    let surfY = s.y;

    if (s.type === 'ramp') {
      if (s.dirZ === 1) {
        const zFraction = Math.max(0, Math.min(1, (z - s.minZ) / (s.maxZ - s.minZ)));
        surfY = s.endY - zFraction * (s.endY - s.startY);
      } else if (s.dirZ === -1) {
        const zFraction = Math.max(0, Math.min(1, (z - s.minZ) / (s.maxZ - s.minZ)));
        surfY = s.startY + zFraction * (s.endY - s.startY);
      } else if (s.dirX === 1) {
        const xFraction = Math.max(0, Math.min(1, (x - s.minX) / (s.maxX - s.minX)));
        surfY = s.endY - xFraction * (s.endY - s.startY);
      } else if (s.dirX === -1) {
        const xFraction = Math.max(0, Math.min(1, (x - s.minX) / (s.maxX - s.minX)));
        surfY = s.startY + xFraction * (s.endY - s.startY);
      }
    } else if (s.type === 'spiral') {
      // Continuous helical mathematical spiral surface
      const dx = x - s.cx;
      const dz = z - s.cz;
      const distSq = dx * dx + dz * dz;
      if (distSq < s.rMin * s.rMin || distSq > s.rMax * s.rMax) continue;

      // Angle from 0 to 2PI
      let angle = Math.atan2(dx, dz); // -PI to PI
      if (angle < 0) angle += Math.PI * 2; // 0 to 2PI

      surfY = s.startY + (angle / (Math.PI * 2)) * s.floorH;
    }

    // A surface is valid if it is not higher than player's waist (currentY + REACH_HEAD_ROOM).
    // Among all reachable surfaces below/at the player, select the HIGHEST surface:
    if (surfY <= currentY + REACH_HEAD_ROOM) {
      if (surfY > bestY) {
        bestY = surfY;
      }
    }
  }

  return bestY;
}
