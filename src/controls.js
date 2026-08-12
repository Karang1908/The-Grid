import * as pc from 'playcanvas';

export function setupControls(app, cameraEntity) {
    let pitch = -30;
    let yaw = 0;
    let distance = 150;
    let targetX = 0;
    let targetZ = 0;
    let isDragging = false;

    const canvas = app.graphicsDevice.canvas;

    canvas.addEventListener('mousedown', () => {
        isDragging = true;
    });

    canvas.addEventListener('mouseup', () => {
        isDragging = false;
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isDragging) {
            yaw += e.movementX * 0.3;
            pitch -= e.movementY * 0.3;
            pitch = Math.max(-89, Math.min(89, pitch));
        }
    });

    canvas.addEventListener('wheel', (e) => {
        distance -= e.deltaY * 0.1;
        distance = Math.max(10, Math.min(300, distance));
    });

    const keysPressed = new Set();

    window.addEventListener('keydown', (e) => {
        keysPressed.add(e.key);
    });

    window.addEventListener('keyup', (e) => {
        keysPressed.delete(e.key);
    });

    app.on('update', (dt) => {
        const panSpeed = 50 * dt;

        if (keysPressed.has('w') || keysPressed.has('ArrowUp')) {
            targetZ -= panSpeed * Math.cos(yaw * Math.PI / 180);
            targetX -= panSpeed * Math.sin(yaw * Math.PI / 180);
        }
        if (keysPressed.has('s') || keysPressed.has('ArrowDown')) {
            targetZ += panSpeed * Math.cos(yaw * Math.PI / 180);
            targetX += panSpeed * Math.sin(yaw * Math.PI / 180);
        }
        if (keysPressed.has('a') || keysPressed.has('ArrowLeft')) {
            targetX -= panSpeed * Math.cos(yaw * Math.PI / 180);
            targetZ += panSpeed * Math.sin(yaw * Math.PI / 180);
        }
        if (keysPressed.has('d') || keysPressed.has('ArrowRight')) {
            targetX += panSpeed * Math.cos(yaw * Math.PI / 180);
            targetZ -= panSpeed * Math.sin(yaw * Math.PI / 180);
        }

        const pitchRad = pitch * Math.PI / 180;
        const yawRad = yaw * Math.PI / 180;
        const camX = targetX + distance * Math.cos(pitchRad) * Math.sin(yawRad);
        const camY = distance * Math.sin(-pitchRad);
        const camZ = targetZ + distance * Math.cos(pitchRad) * Math.cos(yawRad);

        cameraEntity.setPosition(camX, Math.max(camY, 2), camZ);
        cameraEntity.lookAt(targetX, 0, targetZ);
    });
}
