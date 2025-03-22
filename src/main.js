import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createExplosions } from './explosions.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import nipplejs from 'nipplejs';

// DOM elements
const explosionTypeEl = document.getElementById('explosion-type');
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;

// Show appropriate instructions based on device
document.getElementById('desktop-instructions').style.display = isMobile ? 'none' : 'block';
document.getElementById('mobile-instructions').style.display = isMobile ? 'block' : 'none';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky blue background

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;
camera.position.y = 2;

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.appendChild(renderer.domElement);

// Loading Manager to track progress
const loadingManager = new THREE.LoadingManager();
const loadingElement = document.createElement('div');
loadingElement.style.position = 'absolute';
loadingElement.style.top = '50%';
loadingElement.style.left = '50%';
loadingElement.style.transform = 'translate(-50%, -50%)';
loadingElement.style.padding = '20px';
loadingElement.style.background = 'rgba(0, 0, 0, 0.7)';
loadingElement.style.color = 'white';
loadingElement.style.borderRadius = '5px';
loadingElement.style.fontFamily = 'Arial, sans-serif';
loadingElement.textContent = 'Loading...';
document.body.appendChild(loadingElement);

loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
  const progress = Math.round((itemsLoaded / itemsTotal) * 100);
  loadingElement.textContent = `Loading: ${progress}%`;
};

loadingManager.onLoad = () => {
  loadingElement.style.display = 'none';
};

// Environment map loading for realistic reflections
new RGBELoader(loadingManager)
  .setPath('src/textures/')
  .load('venice_sunset_1k.hdr', function(texture) {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;
    
    // Debug log for successful HDR loading
    console.log("HDR environment map loaded successfully");
    
    // Continue with scene setup after environment map is loaded
    setupScene();
  }, undefined, function(error) {
    console.warn('HDR texture could not be loaded:', error);
    
    // Create a fallback environment map
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(128);
    const cubeCamera = new THREE.CubeCamera(0.1, 1000, cubeRenderTarget);
    
    const bgColor = new THREE.Color(0x88ccff);
    scene.background = bgColor;
    
    // Create a simple gradient environment
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x88ccff);
    
    const gradientGeometry = new THREE.SphereGeometry(100, 32, 32);
    const gradientMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec3 viewDirection = normalize(vWorldPosition);
          float y = viewDirection.y * 0.5 + 0.5;
          
          vec3 topColor = vec3(0.1, 0.3, 0.6);    // Darker blue
          vec3 bottomColor = vec3(0.6, 0.8, 1.0);  // Light blue
          
          gl_FragColor = vec4(mix(bottomColor, topColor, y), 1.0);
        }
      `,
      side: THREE.BackSide
    });
    
    const gradientSphere = new THREE.Mesh(gradientGeometry, gradientMaterial);
    envScene.add(gradientSphere);
    
    cubeCamera.update(renderer, envScene);
    scene.environment = cubeRenderTarget.texture;
    
    // Continue with scene setup
    setupScene();
  });

// Global variable to store the human model and its bounding box
let humanModel = null;
let humanBoundingBox = null;

function setupScene() {
  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 10, 7);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;
  directionalLight.shadow.bias = -0.0001;
  scene.add(directionalLight);

  // Add some additional lights for better illumination
  const fillLight = new THREE.DirectionalLight(0x9090ff, 0.5);
  fillLight.position.set(-5, 2, 7);
  scene.add(fillLight);

  const backLight = new THREE.DirectionalLight(0xffddcc, 0.3);
  backLight.position.set(0, 5, -10);
  scene.add(backLight);

  // Floor with better texture
  const floorSize = 20;
  const floorGeometry = new THREE.PlaneGeometry(floorSize, floorSize);
  
  // Create a floor texture
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = 1024;
  floorCanvas.height = 1024;
  const floorCtx = floorCanvas.getContext('2d');
  
  // Fill background
  floorCtx.fillStyle = '#3a3a3a';
  floorCtx.fillRect(0, 0, floorCanvas.width, floorCanvas.height);
  
  // Draw some tiles
  const tileSize = 64;
  for (let y = 0; y < floorCanvas.height; y += tileSize) {
    for (let x = 0; x < floorCanvas.width; x += tileSize) {
      if ((x / tileSize + y / tileSize) % 2 === 0) {
        floorCtx.fillStyle = '#444444';
        floorCtx.fillRect(x, y, tileSize, tileSize);
      }
    }
  }
  
  // Add some noise
  for (let i = 0; i < 10000; i++) {
    const x = Math.random() * floorCanvas.width;
    const y = Math.random() * floorCanvas.height;
    const shade = Math.floor(Math.random() * 30) + 40;
    floorCtx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, 0.1)`;
    floorCtx.fillRect(x, y, 2, 2);
  }
  
  const floorTexture = new THREE.CanvasTexture(floorCanvas);
  floorTexture.wrapS = THREE.RepeatWrapping;
  floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(2, 2);
  
  const floorNormalCanvas = document.createElement('canvas');
  floorNormalCanvas.width = 1024;
  floorNormalCanvas.height = 1024;
  const normalCtx = floorNormalCanvas.getContext('2d');
  
  // Create a simple normal map
  normalCtx.fillStyle = '#8080ff'; // Default normal pointing up
  normalCtx.fillRect(0, 0, floorNormalCanvas.width, floorNormalCanvas.height);
  
  for (let y = 0; y < floorNormalCanvas.height; y += tileSize) {
    for (let x = 0; x < floorNormalCanvas.width; x += tileSize) {
      if ((x / tileSize + y / tileSize) % 2 === 0) {
        // Add some bump variation to alternating tiles
        normalCtx.fillStyle = '#7878f7';
        normalCtx.fillRect(x, y, tileSize, tileSize);
        
        // Add bump at the edges
        normalCtx.fillStyle = '#7070f0';
        normalCtx.fillRect(x, y, tileSize, 2);
        normalCtx.fillRect(x, y, 2, tileSize);
        normalCtx.fillRect(x + tileSize - 2, y, 2, tileSize);
        normalCtx.fillRect(x, y + tileSize - 2, tileSize, 2);
      }
    }
  }
  
  const floorNormalMap = new THREE.CanvasTexture(floorNormalCanvas);
  floorNormalMap.wrapS = THREE.RepeatWrapping;
  floorNormalMap.wrapT = THREE.RepeatWrapping;
  floorNormalMap.repeat.set(2, 2);
  
  const floorMaterial = new THREE.MeshStandardMaterial({
    map: floorTexture,
    normalMap: floorNormalMap,
    normalScale: new THREE.Vector2(0.1, 0.1),
    roughness: 0.8,
    metalness: 0.1,
    color: 0x999999
  });
  
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Create a human model instead of the wall
  createHumanModel();
  
  // Create the detailed iPhone
  const phone = createIPhone();
  scene.add(phone);
  
  // Rest of the game logic
  setupGameLogic(phone);
}

// Function to create the human 3D model
function createHumanModel() {
  // Create a simple human figure using primitives
  humanModel = new THREE.Group();
  
  // Materials
  const skinMaterial = new THREE.MeshStandardMaterial({
    color: 0x8d5524,
    roughness: 0.7,
    metalness: 0.1
  });
  
  const shirtMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.8,
    metalness: 0.1
  });
  
  const pantsMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.8,
    metalness: 0.1
  });
  
  // Head
  const headGeometry = new THREE.SphereGeometry(0.5, 32, 16);
  const head = new THREE.Mesh(headGeometry, skinMaterial);
  head.position.y = 3.7;
  head.castShadow = true;
  humanModel.add(head);
  
  // Torso
  const torsoGeometry = new THREE.BoxGeometry(1.5, 2, 0.75);
  const torso = new THREE.Mesh(torsoGeometry, shirtMaterial);
  torso.position.y = 2;
  torso.castShadow = true;
  humanModel.add(torso);
  
  // Left arm
  const leftArmGroup = new THREE.Group();
  const leftUpperArmGeometry = new THREE.CylinderGeometry(0.2, 0.2, 1.2, 16);
  const leftUpperArm = new THREE.Mesh(leftUpperArmGeometry, shirtMaterial);
  leftUpperArm.position.y = -0.6;
  leftUpperArm.castShadow = true;
  leftArmGroup.add(leftUpperArm);
  
  const leftForearmGeometry = new THREE.CylinderGeometry(0.15, 0.15, 1.2, 16);
  const leftForearm = new THREE.Mesh(leftForearmGeometry, skinMaterial);
  leftForearm.position.y = -1.7;
  leftForearm.castShadow = true;
  leftArmGroup.add(leftForearm);
  
  // Position and rotate left arm
  leftArmGroup.position.set(-1.5, 2.5, 0);
  leftArmGroup.rotation.z = Math.PI / 2; // Arm outstretched
  humanModel.add(leftArmGroup);
  
  // Right arm
  const rightArmGroup = new THREE.Group();
  const rightUpperArmGeometry = new THREE.CylinderGeometry(0.2, 0.2, 1.2, 16);
  const rightUpperArm = new THREE.Mesh(rightUpperArmGeometry, shirtMaterial);
  rightUpperArm.position.y = -0.6;
  rightUpperArm.castShadow = true;
  rightArmGroup.add(rightUpperArm);
  
  const rightForearmGeometry = new THREE.CylinderGeometry(0.15, 0.15, 1.2, 16);
  const rightForearm = new THREE.Mesh(rightForearmGeometry, skinMaterial);
  rightForearm.position.y = -1.7;
  rightForearm.castShadow = true;
  rightArmGroup.add(rightForearm);
  
  // Position and rotate right arm
  rightArmGroup.position.set(1.5, 2.5, 0);
  rightArmGroup.rotation.z = -Math.PI / 2; // Arm outstretched
  humanModel.add(rightArmGroup);
  
  // Legs
  const leftLegGeometry = new THREE.CylinderGeometry(0.25, 0.25, 2.5, 16);
  const leftLeg = new THREE.Mesh(leftLegGeometry, pantsMaterial);
  leftLeg.position.set(-0.4, -0.25, 0);
  leftLeg.castShadow = true;
  humanModel.add(leftLeg);
  
  const rightLegGeometry = new THREE.CylinderGeometry(0.25, 0.25, 2.5, 16);
  const rightLeg = new THREE.Mesh(rightLegGeometry, pantsMaterial);
  rightLeg.position.set(0.4, -0.25, 0);
  rightLeg.castShadow = true;
  humanModel.add(rightLeg);
  
  // Position the human model where the wall was
  humanModel.position.set(0, 0, -10);
  humanModel.scale.set(1.5, 1.5, 1.5);
  
  // Add the model to the scene
  scene.add(humanModel);
  
  // Create a bounding box for collision detection
  humanBoundingBox = new THREE.Box3().setFromObject(humanModel);
  
  // Optionally add a bounding box helper for debugging
  const humanBoundingBoxHelper = new THREE.Box3Helper(humanBoundingBox, 0xff0000);
  //scene.add(humanBoundingBoxHelper); // Uncomment for debugging
}

// Create a realistic iPhone model
function createIPhone() {
  // Phone body
  const phoneGroup = new THREE.Group();
  
  // Main body with rounded corners
  const bodyGeometry = new THREE.BoxGeometry(0.7, 1.5, 0.08);
  bodyGeometry.translate(0, 0, 0);
  const radiusSegments = 8;
  
  // Round the corners of the geometry
  for (let i = 0; i < bodyGeometry.attributes.position.count; i++) {
    const x = bodyGeometry.attributes.position.getX(i);
    const y = bodyGeometry.attributes.position.getY(i);
    const z = bodyGeometry.attributes.position.getZ(i);
    
    const absX = Math.abs(x);
    const absY = Math.abs(y);
    const absZ = Math.abs(z);
    
    const radius = 0.1;
    if (absX > 0.3 && absY > 0.7) {
      // Round the corners
      const direction = new THREE.Vector3(x, y, z).normalize();
      const distance = Math.sqrt((absX - 0.3) ** 2 + (absY - 0.7) ** 2);
      if (distance > radius) {
        const newX = x > 0 ? 0.3 + radius * direction.x : -0.3 + radius * direction.x;
        const newY = y > 0 ? 0.7 + radius * direction.y : -0.7 + radius * direction.y;
        bodyGeometry.attributes.position.setX(i, newX);
        bodyGeometry.attributes.position.setY(i, newY);
      }
    }
  }
  
  // Create materials for different parts of the phone
  const phoneMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    metalness: 0.8,
    roughness: 0.2,
    envMapIntensity: 1.0
  });
  
  // Create textures for the screen
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 512;
  screenCanvas.height = 1024;
  const ctx = screenCanvas.getContext('2d');
  
  // Draw the screen content - blue gradient background
  const gradient = ctx.createLinearGradient(0, 0, 0, screenCanvas.height);
  gradient.addColorStop(0, '#0088ff');
  gradient.addColorStop(1, '#3366cc');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, screenCanvas.width, screenCanvas.height);
  
  // Draw app icons
  const iconSize = 80;
  const iconMargin = 20;
  const iconColors = ['#ff3b30', '#ff9500', '#ffcc00', '#4cd964', '#5ac8fa', '#007aff', '#5856d6', '#ff2d55'];
  
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      ctx.fillStyle = iconColors[(row * 4 + col) % iconColors.length];
      ctx.beginPath();
      const x = iconMargin + col * (iconSize + iconMargin);
      const y = iconMargin + row * (iconSize + iconMargin) + 100; // Add some margin at top
      const radius = 15;
      ctx.roundRect(x, y, iconSize, iconSize, radius);
      ctx.fill();
    }
  }
  
  // Add status bar
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(0, 0, screenCanvas.width, 40);
  
  // Create screen texture
  const screenTexture = new THREE.CanvasTexture(screenCanvas);
  screenTexture.needsUpdate = true;
  
  const screenMaterial = new THREE.MeshBasicMaterial({
    map: screenTexture,
    roughness: 0.1,
    metalness: 0.1
  });
  
  // Create glass texture for the screen (slight reflection/refraction)
  const screenGlassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.1,
    metalness: 0.0,
    roughness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    reflectivity: 1.0,
    envMapIntensity: 1.0
  });
  
  // Create the body and screen
  const phone = new THREE.Mesh(bodyGeometry, phoneMaterial);
  phoneGroup.add(phone);
  
  // Add screen
  const screenGeometry = new THREE.PlaneGeometry(0.65, 1.4);
  const screen = new THREE.Mesh(screenGeometry, screenMaterial);
  screen.position.z = 0.041;
  phoneGroup.add(screen);
  
  // Add camera bump
  const cameraBumpGeometry = new THREE.BoxGeometry(0.25, 0.25, 0.02);
  const cameraBumpMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.9,
    roughness: 0.2
  });
  const cameraBump = new THREE.Mesh(cameraBumpGeometry, cameraBumpMaterial);
  cameraBump.position.set(0, 0.5, -0.05);
  phoneGroup.add(cameraBump);
  
  // Add camera lens
  const cameraGeometry = new THREE.CircleGeometry(0.05, 32);
  const cameraMaterial = new THREE.MeshStandardMaterial({
    color: 0x000000,
    metalness: 0.5,
    roughness: 0.3
  });
  const camera1 = new THREE.Mesh(cameraGeometry, cameraMaterial);
  camera1.position.set(-0.05, 0.5, -0.04);
  camera1.rotation.set(-Math.PI / 2, 0, 0);
  phoneGroup.add(camera1);
  
  const camera2 = new THREE.Mesh(cameraGeometry, cameraMaterial);
  camera2.position.set(0.05, 0.5, -0.04);
  camera2.rotation.set(-Math.PI / 2, 0, 0);
  phoneGroup.add(camera2);
  
  // Add buttons
  const buttonGeometry = new THREE.BoxGeometry(0.03, 0.1, 0.01);
  const buttonMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.9,
    roughness: 0.4
  });
  
  // Volume buttons
  const volumeUpButton = new THREE.Mesh(buttonGeometry, buttonMaterial);
  volumeUpButton.position.set(-0.37, 0.2, 0);
  phoneGroup.add(volumeUpButton);
  
  const volumeDownButton = new THREE.Mesh(buttonGeometry, buttonMaterial);
  volumeDownButton.position.set(-0.37, 0.05, 0);
  phoneGroup.add(volumeDownButton);
  
  // Power button
  const powerButton = new THREE.Mesh(buttonGeometry, buttonMaterial);
  powerButton.position.set(0.37, 0.2, 0);
  phoneGroup.add(powerButton);
  
  phoneGroup.castShadow = true;
  phoneGroup.receiveShadow = false;
  
  return phoneGroup;
}

// Function to setup game logic with the phone model
function setupGameLogic(phone) {
  // Variables for player control
  const mouse = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const playerPosition = new THREE.Vector3(0, 0, 0);
  let phoneThrown = false;
  let currentExplosionType = 1;
  let maxExplosionTypes = 9; // Update this based on actual number of explosion types
  
  // Physics variables
  const gravity = new THREE.Vector3(0, -0.01, 0);
  let phoneInHand = true;
  let isThrown = false;
  let velocity = new THREE.Vector3();
  let throwStrength = 1.2;
  
  // Initialize joystick for mobile
  let joystick = null;
  let joystickData = { force: 0, angle: { radian: 0 } };
  
  if (isMobile) {
    joystick = nipplejs.create({
      zone: document.getElementById('joystick-zone'),
      mode: 'static',
      position: { left: '60px', bottom: '60px' },
      color: 'white',
      size: 100
    });
    
    joystick.on('move', (evt, data) => {
      joystickData = data;
    });
    
    joystick.on('end', () => {
      joystickData = { force: 0, angle: { radian: 0 } };
    });
    
    // Add throw button event
    const throwButton = document.getElementById('throw-button');
    throwButton.addEventListener('touchstart', (event) => {
      event.preventDefault();
      if (phoneInHand) {
        throwPhone();
      }
    });
    
    // Create explosion selector buttons
    const explosionSelector = document.getElementById('explosion-selector');
    for (let i = 1; i <= Math.min(maxExplosionTypes, 5); i++) {
      const button = document.createElement('div');
      button.className = 'explosion-option';
      button.textContent = i;
      button.dataset.type = i;
      if (i === currentExplosionType) button.classList.add('active');
      
      button.addEventListener('touchstart', (event) => {
        event.preventDefault();
        document.querySelectorAll('.explosion-option').forEach(el => el.classList.remove('active'));
        button.classList.add('active');
        currentExplosionType = parseInt(button.dataset.type);
        explosionTypeEl.textContent = `Current Explosion: ${currentExplosionType}`;
      });
      
      explosionSelector.appendChild(button);
    }
  }
  
  // Aim raycaster
  const aimHelper = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(0, 0, 0),
    5,
    0xff0000
  );
  scene.add(aimHelper);

  // Load explosion effects
  const explosions = createExplosions(scene);
  
  // Variables for human movement and phone throwing
  let humanPhone = null;
  let humanPhoneInHand = true;
  let humanPhoneThrown = false;
  let humanPhoneVelocity = new THREE.Vector3();
  let humanTargetPosition = new THREE.Vector3();
  let humanMovementSpeed = 0.05;
  let humanThrowTimer = 0;
  let humanThrowInterval = Math.random() * 3000 + 2000; // 2-5 seconds
  let lastHumanThrowTime = Date.now();
  let playerHit = false;
  
  // Create a phone for the human to throw
  function createHumanPhone() {
    if (humanPhone) return humanPhone;
    
    humanPhone = createIPhone();
    humanPhone.scale.set(0.8, 0.8, 0.8); // Slightly smaller phone
    scene.add(humanPhone);
    return humanPhone;
  }
  
  // Initialize human's phone
  createHumanPhone();

  // Mouse move event for desktop
  document.addEventListener('mousemove', (event) => {
    if (isMobile) return; // Skip for mobile
    
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  });
  
  // Keyboard event for desktop
  document.addEventListener('keydown', (event) => {
    if (isMobile) return; // Skip for mobile
    
    // Throwing the phone with spacebar
    if (event.code === 'Space' && phoneInHand) {
      throwPhone();
    }
    
    // Select explosion type with number keys
    if (event.key >= '1' && event.key <= '9') {
      currentExplosionType = parseInt(event.key);
      explosionTypeEl.textContent = `Current Explosion: ${currentExplosionType}`;
    }
  });
  
  // Responsive resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  
  // Phone throwing function
  function throwPhone() {
    if (!phoneInHand) return;
    
    phoneInHand = false;
    isThrown = true;
    
    // Set velocity based on aim direction
    if (isMobile) {
      // Use joystick data for direction on mobile
      if (joystickData.force > 0) {
        const angle = joystickData.angle.radian;
        velocity = new THREE.Vector3(
          -Math.cos(angle) * (joystickData.force / 50),
          0.3,
          -Math.sin(angle) * (joystickData.force / 50)
        );
      } else {
        velocity = new THREE.Vector3(0, 0.3, -1); // Default forward throw
      }
    } else {
      // Use mouse position for desktop
      raycaster.setFromCamera(mouse, camera);
      velocity = raycaster.ray.direction.clone().multiplyScalar(throwStrength);
    }
    
    // Set the initial position in front of the camera
    phone.position.set(0, 0, 3);
    
    // Add rotation to the phone
    phone.rotation.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );
    
    console.log("Phone thrown with velocity:", velocity);
  }
  
  // Function for the human to throw a phone at the player
  function humanThrowPhone() {
    if (humanPhoneInHand && humanPhone) {
      // Position the phone in the human's hand
      const humanPosition = humanModel.position.clone();
      humanPhone.position.set(
        humanPosition.x,
        humanPosition.y + 2, // Position at human's head height
        humanPosition.z
      );
      
      // Direction towards the player/camera
      const directionToPlayer = camera.position.clone().sub(humanPhone.position).normalize();
      
      // Add some randomness to make it not perfectly accurate
      directionToPlayer.x += (Math.random() - 0.5) * 0.2;
      directionToPlayer.y += (Math.random() - 0.5) * 0.2;
      directionToPlayer.z += (Math.random() - 0.5) * 0.2;
      
      // Set velocity towards player
      humanPhoneVelocity = directionToPlayer.multiplyScalar(throwStrength * 0.8);
      
      // Add spin to the phone
      humanPhone.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );
      
      humanPhoneInHand = false;
      humanPhoneThrown = true;
      
      console.log("Human threw phone at player with velocity:", humanPhoneVelocity);
      
      // Reset the throw timer
      lastHumanThrowTime = Date.now();
      humanThrowInterval = Math.random() * 3000 + 2000; // 2-5 seconds
    }
  }

  // Function to reset the phone
  function resetPhone() {
    isThrown = false;
    phoneInHand = true;
    phone.visible = true;
  }
  
  // Function to reset the human's phone
  function resetHumanPhone() {
    humanPhoneThrown = false;
    humanPhoneInHand = true;
    humanPhone.visible = true;
  }

  // Function to create explosion
  function createExplosion(position) {
    // Use the selected explosion type (1-9)
    const explosionType = Math.min(Math.max(currentExplosionType, 1), explosions.length);
    console.log("Creating explosion type:", explosionType, "at position:", position);
    explosions[explosionType - 1](position);
  }

  // Function to check collision with the human model
  function checkHumanCollision() {
    // Update the phone's bounding box
    const phoneBoundingBox = new THREE.Box3().setFromObject(phone);
    
    // Update the human model's bounding box (in case it moved)
    humanBoundingBox.setFromObject(humanModel);
    
    // Check for intersection between the phone and human bounding boxes
    if (phoneBoundingBox.intersectsBox(humanBoundingBox)) {
      console.log("Collision with human detected at:", phone.position);
      isThrown = false;
      phone.visible = false;
      
      // Create explosion at the contact point
      createExplosion(phone.position.clone());
      
      // Reset the phone after a delay
      setTimeout(resetPhone, 2000);
    }
  }
  
  // Function to check if human's phone hits the player
  function checkPlayerCollision() {
    if (!humanPhoneThrown || !humanPhone) return;
    
    // Distance from the phone to the camera/player
    const distanceToPlayer = humanPhone.position.distanceTo(camera.position);
    
    // Consider the player hit if the phone gets close enough
    if (distanceToPlayer < 1.0) {
      console.log("Player hit by phone at distance:", distanceToPlayer);
      humanPhoneThrown = false;
      humanPhone.visible = false;
      playerHit = true;
      
      // Create explosion at the player's position
      createExplosion(camera.position.clone());
      
      // Apply screen shake effect
      applyScreenShake();
      
      // Reset the human's phone after a delay
      setTimeout(resetHumanPhone, 2000);
    }
  }
  
  // Apply screen shake effect when player is hit
  function applyScreenShake() {
    let shakeIntensity = 0.3;
    let shakeDuration = 500; // ms
    let startTime = Date.now();
    
    // Store the original camera position
    const originalPosition = camera.position.clone();
    
    function shakeCamera() {
      const elapsed = Date.now() - startTime;
      
      if (elapsed < shakeDuration) {
        // Calculate remaining shake intensity based on time left
        const remainingIntensity = shakeIntensity * (1 - elapsed / shakeDuration);
        
        // Apply random offset to camera
        camera.position.set(
          originalPosition.x + (Math.random() - 0.5) * remainingIntensity,
          originalPosition.y + (Math.random() - 0.5) * remainingIntensity,
          originalPosition.z + (Math.random() - 0.5) * remainingIntensity
        );
        
        // Continue shaking
        requestAnimationFrame(shakeCamera);
      } else {
        // Reset to original position
        camera.position.copy(originalPosition);
        playerHit = false;
      }
    }
    
    // Start the shake effect
    shakeCamera();
  }
  
  // Move the human model around
  function moveHuman() {
    // Check if we need to set a new target position
    if (Math.random() < 0.01 || humanModel.position.distanceTo(humanTargetPosition) < 0.5) {
      // Create a new random target position within bounds
      humanTargetPosition.set(
        (Math.random() - 0.5) * 10, // X: -5 to 5
        0, // Y: keep at ground level
        -10 + (Math.random() - 0.5) * 5 // Z: -12.5 to -7.5
      );
    }
    
    // Move towards target position
    const direction = humanTargetPosition.clone().sub(humanModel.position).normalize();
    humanModel.position.add(direction.multiplyScalar(humanMovementSpeed));
    
    // Rotate human to face the player
    const targetRotation = Math.atan2(
      camera.position.x - humanModel.position.x,
      camera.position.z - humanModel.position.z
    );
    
    // Smoothly rotate towards the target rotation
    humanModel.rotation.y = targetRotation;
  }

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    
    // Update aim direction
    if (phoneInHand) {
      raycaster.setFromCamera(mouse, camera);
      aimHelper.position.set(0, 0, 3);
      aimHelper.setDirection(raycaster.ray.direction);
    }
    
    // Update phone position based on controls
    if (isThrown) {
      // Apply velocity and gravity for thrown phone
      phone.position.add(velocity);
      velocity.add(gravity);
      
      // Add rotation to the phone while flying
      phone.rotation.x += 0.05;
      phone.rotation.y += 0.05;
      phone.rotation.z += 0.03;
      
      // Check for collisions
      checkHumanCollision();
      
      // Check if phone is out of bounds
      if (phone.position.y < -5 || 
          phone.position.z < -20 || 
          Math.abs(phone.position.x) > 20) {
        console.log("Phone out of bounds, resetting");
        resetPhone();
      }
    } else if (phoneInHand) {
      if (isMobile) {
        // Position phone based on joystick for aiming
        if (joystickData.force > 0) {
          const angle = joystickData.angle.radian;
          const magnitude = Math.min(joystickData.force / 100, 0.5);
          
          phone.position.set(
            camera.position.x + Math.cos(angle) * magnitude,
            camera.position.y - 0.5,
            camera.position.z + Math.sin(angle) * magnitude
          );
        } else {
          // Default position when joystick is not used
          phone.position.set(
            camera.position.x + 0.5,
            camera.position.y - 0.5,
            camera.position.z
          );
        }
      } else {
        // Desktop mouse control
        phone.position.set(
          camera.position.x + 0.5,
          camera.position.y - 0.5,
          camera.position.z
        );
      }
    }
    
    // Update human movement
    if (!playerHit) {
      moveHuman();
    }
    
    // Check if it's time for the human to throw a phone
    if (humanPhoneInHand && Date.now() - lastHumanThrowTime > humanThrowInterval) {
      humanThrowPhone();
    }
    
    // Update human's thrown phone position
    if (humanPhoneThrown && humanPhone) {
      // Apply velocity and gravity
      humanPhone.position.add(humanPhoneVelocity);
      humanPhoneVelocity.add(gravity);
      
      // Add rotation to the phone while flying
      humanPhone.rotation.x += 0.05;
      humanPhone.rotation.y += 0.05;
      humanPhone.rotation.z += 0.03;
      
      // Check for collisions with player
      checkPlayerCollision();
      
      // Check if human's phone is out of bounds
      if (humanPhone.position.y < -5 || 
          humanPhone.position.z > 10 || 
          Math.abs(humanPhone.position.x) > 20) {
        console.log("Human's phone out of bounds, resetting");
        resetHumanPhone();
      }
    } else if (humanPhoneInHand && humanPhone) {
      // Position the phone in the human's hand
      humanPhone.position.set(
        humanModel.position.x + 0.6, // Position to the side of human
        humanModel.position.y + 2, // Position at head level
        humanModel.position.z + 0.5
      );
    }
    
    renderer.render(scene, camera);
  }

  animate();
}

// End of main.js file 