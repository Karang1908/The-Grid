import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';

export function setupPlayer(app, physicsWorld, cameraEntity, spawnPos, textures) {
    const radius = 0.5;
    const halfHeight = 0.7;

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
        .lockRotations();
    const body = physicsWorld.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.capsule(halfHeight, radius);
    colliderDesc.setFriction(0.0); // Zero friction for smooth stair climbing
    let currentCollider = physicsWorld.createCollider(colliderDesc, body);
    let isProne = false;

    // --- Player Avatar (Humanoid Mesh) ---
    const avatar = new pc.Entity('avatar');
    
    // Body container (rotates with yaw)
    const bodyRig = new pc.Entity('bodyRig');
    // Scale the rig instead of the mesh to preserve bone translation scales
    bodyRig.setLocalScale(0.015, 0.015, 0.015);
    avatar.addChild(bodyRig);

    // Load GLB model (Soldier)
    let animComponent = null;
    app.assets.loadFromUrl('models/soldier.glb', 'container', (err, asset) => {
        if (!err && asset.resource) {
            const entity = asset.resource.instantiateRenderEntity();
            entity.setLocalScale(1, 1, 1);
            entity.setLocalPosition(0, 0, 0);
            // Fix lying on back -> Stand upright (-90 on X)
            entity.setLocalEulerAngles(-90, 180, 0);
            bodyRig.addChild(entity);
            
            if (asset.resource.animations && asset.resource.animations.length > 0) {
                entity.addComponent('anim', { activate: true });
                const animStateGraph = {
                    layers: [
                        {
                            name: 'Base',
                            states: [
                                { name: 'START' },
                                { name: 'Idle', speed: 1.0, loop: true },
                                { name: 'Walk', speed: 1.0, loop: true }
                            ],
                            transitions: [
                                { from: 'START', to: 'Idle' },
                                { from: 'Idle', to: 'Walk', conditions: [{ parameterName: 'speed', predicate: 'GREATER_THAN', value: 0.1 }] },
                                { from: 'Walk', to: 'Idle', conditions: [{ parameterName: 'speed', predicate: 'LESS_THAN_EQUAL', value: 0.1 }] }
                            ]
                        }
                    ],
                    parameters: {
                        speed: { type: 'FLOAT', value: 0 }
                    }
                };
                entity.anim.loadStateGraph(animStateGraph);
                const walkAnim = asset.resource.animations.length > 1 ? asset.resource.animations[1].resource : asset.resource.animations[0].resource;
                const idleAnim = asset.resource.animations[0].resource;
                entity.anim.assignAnimation('Base', 'Walk', walkAnim);
                entity.anim.assignAnimation('Base', 'Idle', idleAnim);
                animComponent = entity.anim;
                animComponent.playing = true;
            }
        } else {
            console.error('Failed to load soldier.glb', err);
        }
    });

    // Add avatar to scene and offset downward to align with physics capsule
    avatar.setLocalPosition(0, -halfHeight - radius, 0);
    app.root.addChild(avatar);

    let pitch = 0;
    let yaw = 0;
    let isDragging = false;
    let pov = 'third'; // 'first' or 'third'

    // Interaction UI
    const uiDiv = document.createElement('div');
    uiDiv.style.position = 'absolute';
    uiDiv.style.top = '50%';
    uiDiv.style.left = '50%';
    uiDiv.style.transform = 'translate(-50%, -50%)';
    uiDiv.style.color = 'white';
    uiDiv.style.fontFamily = 'sans-serif';
    uiDiv.style.fontSize = '20px';
    uiDiv.style.textShadow = '2px 2px 0 #000';
    uiDiv.style.pointerEvents = 'none';
    uiDiv.style.display = 'none';
    uiDiv.style.marginTop = '40px'; // Push down below circle
    document.body.appendChild(uiDiv);

    // Radial Progress SVG
    const svgDiv = document.createElement('div');
    svgDiv.style.position = 'absolute';
    svgDiv.style.top = '50%';
    svgDiv.style.left = '50%';
    svgDiv.style.transform = 'translate(-50%, -50%)';
    svgDiv.style.pointerEvents = 'none';
    svgDiv.style.display = 'none';
    svgDiv.innerHTML = `
        <svg width="60" height="60">
            <circle cx="30" cy="30" r="25" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="5" />
            <circle id="progress-circle" cx="30" cy="30" r="25" fill="none" stroke="white" stroke-width="5" 
                    stroke-dasharray="157" stroke-dashoffset="157" 
                    style="transform: rotate(-90deg); transform-origin: 50% 50%;" />
        </svg>
    `;
    document.body.appendChild(svgDiv);
    const progressCircle = svgDiv.querySelector('#progress-circle');

    let currentCar = null;
    let nearbyCar = null;
    
    // For decoupled car driving
    let carYaw = 0;
    
    // Hold E state
    let isHoldingE = false;
    let holdEProgress = 0;
    const HOLD_TIME = 1.0;

    const canvas = app.graphicsDevice.canvas;
    
    canvas.addEventListener('mousedown', () => {
        canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
        isDragging = document.pointerLockElement === canvas;
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            yaw -= e.movementX * 0.2;
            pitch -= e.movementY * 0.2;
            pitch = Math.max(-89, Math.min(89, pitch));
        }
    });

    const keys = new Set();
    window.addEventListener('keydown', (e) => {
        keys.add(e.code);
        
        // POV Toggle
        if (e.code === 'KeyV') {
            pov = pov === 'first' ? 'third' : 'first';
        }

        // Prone Toggle
        if (e.code === 'KeyZ' && !currentCar) {
            isProne = !isProne;
            physicsWorld.removeCollider(currentCollider, false);
            
            const p = body.translation();
            if (isProne) {
                const proneDesc = RAPIER.ColliderDesc.capsule(0.1, radius);
                proneDesc.setFriction(0.0);
                currentCollider = physicsWorld.createCollider(proneDesc, body);
                body.setTranslation({ x: p.x, y: p.y - (halfHeight - 0.1), z: p.z }, true);
            } else {
                const standDesc = RAPIER.ColliderDesc.capsule(halfHeight, radius);
                standDesc.setFriction(0.0);
                currentCollider = physicsWorld.createCollider(standDesc, body);
                body.setTranslation({ x: p.x, y: p.y + (halfHeight - 0.1), z: p.z }, true);
            }
        }

        if (e.code === 'KeyE') {
            isHoldingE = true;
        }
    });
    window.addEventListener('keyup', (e) => {
        keys.delete(e.code);
        if (e.code === 'KeyE') {
            isHoldingE = false;
            holdEProgress = 0;
        }
    });

    // Time tracker for walk cycle
    let walkTime = 0;

    app.on('update', (dt) => {
        const pos = body.translation();
        const vel = body.linvel();
        
        // Find nearby cars
        if (!currentCar) {
            const cars = app.root.findByTag('car');
            let found = null;
            for (const car of cars) {
                const cPos = car.getPosition();
                const dist = Math.sqrt((pos.x - cPos.x)**2 + (pos.y - cPos.y)**2 + (pos.z - cPos.z)**2);
                if (dist < 5) {
                    found = car;
                    break;
                }
            }
            nearbyCar = found;
            if (nearbyCar) {
                uiDiv.textContent = 'Hold E to Enter Vehicle';
                uiDiv.style.display = 'block';
            } else {
                uiDiv.style.display = 'none';
            }
        } else {
            uiDiv.textContent = 'Hold E to Exit Vehicle';
            uiDiv.style.display = 'block';
        }

        // Handle Hold E Mechanic
        if (isHoldingE && (currentCar || nearbyCar)) {
            svgDiv.style.display = 'block';
            holdEProgress += dt;
            const percentage = Math.min(holdEProgress / HOLD_TIME, 1.0);
            progressCircle.style.strokeDashoffset = 157 * (1 - percentage);
            
            if (holdEProgress >= HOLD_TIME) {
                isHoldingE = false;
                holdEProgress = 0;
                
                if (currentCar) {
                    // Exit car
                    currentCar.setPosition(pos.x + 3, pos.y, pos.z);
                    currentCar = null;
                    pov = 'third';
                } else if (nearbyCar) {
                    // Enter car
                    currentCar = nearbyCar;
                    carYaw = currentCar.getEulerAngles().y;
                    const carPos = currentCar.getPosition();
                    body.setTranslation({ x: carPos.x, y: carPos.y + 1, z: carPos.z }, true);
                    pov = 'third';
                }
            }
        } else {
            svgDiv.style.display = 'none';
            holdEProgress = 0;
        }

        // Movement logic
        let moveX = 0;
        let moveZ = 0;

        if (keys.has('KeyW') || keys.has('ArrowUp')) moveZ -= 1;
        if (keys.has('KeyS') || keys.has('ArrowDown')) moveZ += 1;
        if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX -= 1;
        if (keys.has('KeyD') || keys.has('ArrowRight')) moveX += 1;

        let worldX = 0;
        let worldZ = 0;
        
        const yawRad = yaw * Math.PI / 180;

        if (currentCar) {
            // Car Driving Logic
            if (moveX !== 0) {
                carYaw -= moveX * 90 * dt; // Steer speed
            }
            
            // Fixed inverted controls!
            if (moveZ !== 0) {
                const cy = carYaw * Math.PI / 180;
                worldX = Math.sin(cy) * moveZ;
                worldZ = Math.cos(cy) * moveZ;
            }
        } else {
            // Avatar Walking Logic
            const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
            if (length > 0) {
                moveX /= length;
                moveZ /= length;
            }

            worldX = moveX * Math.cos(yawRad) + moveZ * Math.sin(yawRad);
            worldZ = -moveX * Math.sin(yawRad) + moveZ * Math.cos(yawRad);
        }

        let newVelY = vel.y;
        if (keys.has('Space') && Math.abs(vel.y) < 0.1 && !currentCar) {
            newVelY = 6;
        }

        // Adjust speed if driving or prone
        const speed = currentCar ? 25 : (isProne ? 3 : 10);
        
        body.setLinvel({ x: worldX * speed, y: newVelY, z: worldZ * speed }, true);

        // Update graphics
        if (currentCar) {
            currentCar.setPosition(pos.x, pos.y - halfHeight - radius + 0.5, pos.z);
            currentCar.setEulerAngles(0, carYaw, 0);
        }

        // Update avatar position and orientation
        const renderHalfHeight = isProne ? 0.1 : halfHeight;
        avatar.setPosition(pos.x, pos.y - renderHalfHeight - radius, pos.z);
        
        if (!currentCar) {
            if (animComponent) {
                animComponent.setFloat('speed', length);
                if (length > 0.1) {
                    // Face the direction of actual movement
                    const moveAngle = Math.atan2(worldX, worldZ) * 180 / Math.PI;
                    avatar.setEulerAngles(isProne ? -90 : 0, moveAngle, 0);
                } else {
                    avatar.setEulerAngles(isProne ? -90 : 0, avatar.getEulerAngles().y, 0);
                }
            } else {
                // No anim component yet, just rotate
                const moveAngle = length > 0.1 ? Math.atan2(worldX, worldZ) * 180 / Math.PI : avatar.getEulerAngles().y;
                avatar.setEulerAngles(isProne ? -90 : 0, moveAngle, 0);
            }
        }

        // Only show avatar in third person and not in a car
        avatar.enabled = (pov === 'third' && !currentCar);

        // Update camera
        if (pov === 'first') {
            const eyeLevel = isProne ? 0.2 : (halfHeight + radius - 0.2);
            cameraEntity.setPosition(pos.x, pos.y + eyeLevel, pos.z);
            cameraEntity.setEulerAngles(pitch, yaw, 0);
        } else {
            // Third person
            const dist = currentCar ? 12 : 5;
            const camY = pos.y + (currentCar ? 4 : (isProne ? 1 : 2));
            const pitchRad = pitch * Math.PI / 180;
            const camX = pos.x + dist * Math.sin(yawRad) * Math.cos(pitchRad);
            const camZ = pos.z + dist * Math.cos(yawRad) * Math.cos(pitchRad);
            
            cameraEntity.setPosition(camX, camY - dist * Math.sin(pitchRad), camZ);
            cameraEntity.lookAt(pos.x, pos.y, pos.z);
        }
    });

    return body;
}
