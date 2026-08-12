import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';
import { createCity } from './world/city.js';
import { setupPlayer } from './player.js';

async function init() {
    // --- DOM elements ---
    const canvas = document.getElementById('application-canvas');
    const loadingScreen = document.getElementById('loading-screen');
    const status = document.getElementById('status');

    // --- Physics ---
    status.textContent = 'Initializing WASM Physics...';
    await RAPIER.init();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

    // --- Engine ---
    status.textContent = 'Creating Engine...';
    const app = new pc.Application(canvas);
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    window.addEventListener('resize', () => app.resizeCanvas());

    // --- Scene properties ---
    app.scene.ambientLight = new pc.Color(0.3, 0.3, 0.35);
    app.scene.toneMapping = pc.TONEMAP_ACES;
    app.scene.gammaCorrection = pc.GAMMA_SRGB;

    // --- Camera ---
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.6, 0.7, 0.8), // Haze color
        farClip: 200 // Acts like thick fog/haze
    });
    camera.setPosition(0, 80, 120);
    camera.lookAt(0, 0, 0);
    app.root.addChild(camera);

    // --- Directional light (sun) ---
    const sun = new pc.Entity('sun');
    sun.addComponent('light', {
        type: 'directional',
        color: pc.Color.WHITE,
        intensity: 1.5,
        castShadows: true,
        shadowResolution: 2048
    });
    sun.setEulerAngles(45, 30, 0);
    app.root.addChild(sun);

    // --- Load Textures ---
    const loadTexture = (url, name) => {
        const asset = new pc.Asset(name, 'texture', { url });
        app.assets.add(asset);
        app.assets.load(asset);
        return asset;
    };
    
    const textures = {
        grass: loadTexture('textures/grass.jpg', 'grassTex'),
        brick: loadTexture('textures/brick.jpg', 'brickTex'),
        wood: loadTexture('textures/wood.jpg', 'woodTex'),
        face: loadTexture('textures/face.jpg', 'faceTex')
    };

    // --- Ground plane (Greenery) ---
    const ground = new pc.Entity('ground');
    const groundMaterial = new pc.StandardMaterial();
    groundMaterial.diffuse = new pc.Color(0.2, 0.4, 0.15); // Fallback color
    
    textures.grass.ready((asset) => {
        groundMaterial.diffuseMap = asset.resource;
        groundMaterial.diffuseMapTiling.set(50, 50); // Tile heavily
        groundMaterial.update();
    });
    
    groundMaterial.update();
    ground.addComponent('render', {
        type: 'box',
        material: groundMaterial
    });
    ground.setLocalScale(1000, 1, 1000);
    ground.setPosition(0, -0.5, 0);
    app.root.addChild(ground);

    // Ground physics collider
    const groundBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0);
    const groundBody = world.createRigidBody(groundBodyDesc);
    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(500, 0.5, 500);
    world.createCollider(groundColliderDesc, groundBody);

    // --- Mountains (Edges of World) ---
    const mountainMat = new pc.StandardMaterial();
    mountainMat.diffuse = new pc.Color(0.1, 0.3, 0.1); // Dark green
    
    textures.grass.ready((asset) => {
        mountainMat.diffuseMap = asset.resource;
        mountainMat.diffuseMapTiling.set(5, 5);
        mountainMat.update();
    });
    
    mountainMat.update();
    
    const numMountains = 24;
    for (let i = 0; i < numMountains; i++) {
        const angle = (i / numMountains) * Math.PI * 2;
        const dist = 600 + Math.random() * 100;
        
        const m = new pc.Entity('mountain');
        m.addComponent('render', { type: 'cone', material: mountainMat });
        const width = 100 + Math.random() * 150;
        const height = 100 + Math.random() * 100;
        m.setLocalScale(width, height, width);
        m.setPosition(Math.cos(angle) * dist, height/2 - 20, Math.sin(angle) * dist);
        m.setEulerAngles(Math.random()*10, Math.random()*360, Math.random()*10);
        app.root.addChild(m);
    }

    // --- City ---
    createCity(app, world, textures);

    // --- Player / FPS Controls ---
    setupPlayer(app, world, camera, { x: 0, y: 5, z: 390 }, textures);

    // --- Update loop ---
    app.on('update', (dt) => {
        world.step();
    });

    // --- Start (AFTER all setup) ---
    app.start();

    // --- Hide loading screen ---
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
    status.textContent = 'Ready';
}

init().catch(console.error);
