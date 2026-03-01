import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { SEATS, toRelativeSeat } from '/src/scene/seats.js';

const MODES = {
  TRUMPS: 'trumps',
  FOLLOW_ME: 'followMe',
  SEVENS: 'sevens'
};

const PHASES = {
  LOBBY: 'lobby',
  BIDDING: 'bidding',
  CHOOSE_MODE: 'chooseMode',
  CHOOSE_TRUMP: 'chooseTrump',
  PLAYING: 'playing',
  TRICK_PAUSE: 'trickPause',
  HAND_OVER: 'handOver'
};

const PLAY_PLANE_Y = 0.6;
const DOMINO_THICKNESS = 0.14;
const DOMINO_Y = PLAY_PLANE_Y + DOMINO_THICKNESS / 2;

const DEFAULT_AVATAR_ID = 'cowboy_male';
const AVATAR_STORAGE_KEY = 'avatarId';
const PLAYER_NAME_STORAGE_KEY = 'playerName';

const canvas = document.getElementById('gameCanvas');
const panel = document.getElementById('sidePanel');
const panelToggle = document.getElementById('panelToggle');
const closePanelBtn = document.getElementById('closePanelBtn');
const changeAvatarBtn = document.getElementById('changeAvatarBtn');
const roomIdInput = document.getElementById('roomIdInput');
const roomStatus = document.getElementById('roomStatus');
const eventLog = document.getElementById('eventLog');
const seatControls = document.getElementById('seatControls');
const hudBidValue = document.getElementById('hudBidValue');
const hudTrumpValue = document.getElementById('hudTrumpValue');
const turnTimerHud = document.getElementById('turnTimerHud');
const timerEnabledToggle = document.getElementById('timerEnabledToggle');
const timerPauseBtn = document.getElementById('timerPauseBtn');
const timerStateText = document.getElementById('timerStateText');
const resetViewBtn = document.getElementById('resetViewBtn');
const environmentSelect = document.getElementById('environmentSelect');
const environmentPreview = document.getElementById('environmentPreview');
const environmentStateText = document.getElementById('environmentStateText');
const emojiOverlays = document.getElementById('emojiOverlays');

const sectionRoom = document.getElementById('section-room');
const sectionPlayers = document.getElementById('section-players');
const sectionGame = document.getElementById('section-game');
const sectionBidding = document.getElementById('section-bidding');
const sectionTrump = document.getElementById('section-trump');
const sectionMarks = document.getElementById('section-marks');

const bidButtonsWrap = document.getElementById('bidButtons');
const trumpButtonsWrap = document.getElementById('trumpButtons');
const modeButtonsWrap = document.getElementById('modeButtons');

const avatarModal = document.getElementById('avatarModal');
const avatarModalBackdrop = document.getElementById('avatarModalBackdrop');
const closeAvatarModalBtn = document.getElementById('closeAvatarModalBtn');
const avatarGrid = document.getElementById('avatarGrid');
const avatarPickerStatus = document.getElementById('avatarPickerStatus');

const scoreTeamAMain = document.getElementById('score-teamA-main');
const scoreTeamBMain = document.getElementById('score-teamB-main');
const menuRoundsTeamA = document.getElementById('menu-rounds-teamA');
const menuRoundsTeamB = document.getElementById('menu-rounds-teamB');
const menuMarksTeamA = document.getElementById('menu-marks-teamA');
const menuMarksTeamB = document.getElementById('menu-marks-teamB');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.physicallyCorrectLights = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0.22, 1.24, 5.58);
camera.lookAt(0, 0.78, 0);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 4.9;
controls.maxDistance = 7.1;
controls.minPolarAngle = 1.07;
controls.maxPolarAngle = 1.5;
controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
controls.target.set(0, 0.78, 0);

const visualsGroup = new THREE.Group();
visualsGroup.name = 'visualsGroup';
scene.add(visualsGroup);

const tableRoot = new THREE.Group();
tableRoot.name = 'tableRoot';
visualsGroup.add(tableRoot);

const themeGroup = new THREE.Group();
themeGroup.name = 'themeGroup';
scene.add(themeGroup);

const environmentGroup = new THREE.Group();
environmentGroup.name = 'environmentGroup';
tableRoot.add(environmentGroup);

const handGroup = new THREE.Group();
handGroup.name = 'handGroup';
scene.add(handGroup);

const oppHandGroup = new THREE.Group();
oppHandGroup.name = 'oppHandGroup';
scene.add(oppHandGroup);

const trickGroup = new THREE.Group();
trickGroup.name = 'trickGroup';
scene.add(trickGroup);

const burnGroupA = new THREE.Group();
const burnGroupB = new THREE.Group();
oppHandGroup.add(burnGroupA);
oppHandGroup.add(burnGroupB);

const chairSeatGroups = [0, 1, 2, 3].map(() => {
  const g = new THREE.Group();
  tableRoot.add(g);
  return g;
});

const avatarSeatGroups = [0, 1, 2, 3].map(() => {
  const g = new THREE.Group();
  tableRoot.add(g);
  return g;
});

const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

const ambient = new THREE.HemisphereLight(0xf5e9cf, 0x2f516b, 0.52);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xfff2db, 1.17);
keyLight.position.set(4.8, 8.9, 4.5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 28;
keyLight.shadow.bias = -0.0003;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x8ab4ff, 0.34);
fillLight.position.set(-5.6, 6.2, -3.6);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffd3a6, 0.22);
rimLight.position.set(0, 5, -7.4);
scene.add(rimLight);

const debugPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(12, 12),
  new THREE.MeshBasicMaterial({
    color: 0x60bdf5,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
    depthWrite: false
  })
);
debugPlane.rotation.x = -Math.PI / 2;
debugPlane.position.y = PLAY_PLANE_Y;
debugPlane.visible = false;
scene.add(debugPlane);

const axesHelper = new THREE.AxesHelper(3.5);
axesHelper.position.y = PLAY_PLANE_Y;
axesHelper.visible = false;
scene.add(axesHelper);

const dominoGeometry = new RoundedBoxGeometry(1.24, DOMINO_THICKNESS, 0.62, 5, 0.052);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();

const gltfLoader = new GLTFLoader();
const objLoader = new OBJLoader();
const mtlLoader = new MTLLoader();

const textureCache = new Map();
const modelCache = new Map();
const activeAvatarLoadToken = new Map();
const skyTextureCache = new Map();
const environmentTemplates = {
  table: null,
  chair: null
};
const tableMetrics = {
  topY: PLAY_PLANE_Y,
  floorY: 0
};
const seatRuntime = [0, 1, 2, 3].map(() => ({
  chairSeatY: 0.42
}));
const oneShotWarnings = new Set();

const nameplateOffsets = [0, 1, 2, 3].map(() => ({ x: 0, y: 0 }));
let draggingNameplateSeat = null;
let draggingPointerId = null;
let draggingStartClient = { x: 0, y: 0 };
let draggingStartOffset = { x: 0, y: 0 };

const tmpV3A = new THREE.Vector3();
const tmpV3B = new THREE.Vector3();
const tmpBox = new THREE.Box3();

const avatarCatalog = [];
const avatarById = new Map();
const environmentCatalog = [];
const environmentById = new Map();
let currentEnvironmentId = null;

const timeoutPenaltyBySeat = new Map();

let ws = null;
let localClientId = null;
let roomState = null;
let panelOpen = true;
let forceClosePanel = false;
let lastPhase = null;
let lastLocalSeat = null;
let debugVisible = false;
let storedAvatarAppliedSeat = null;
let storedNameAppliedSeat = null;
let roomChangingAvatarOptimistic = false;
let hoveredDominoMesh = null;
let selectedDominoTileId = null;
let pendingLocalBidChoice = null;

function logMessage(text, timeoutMs = 2600) {
  eventLog.textContent = text;
  if (timeoutMs > 0) {
    const stamp = Date.now();
    logMessage.lastStamp = stamp;
    setTimeout(() => {
      if (logMessage.lastStamp === stamp) {
        eventLog.textContent = '';
      }
    }, timeoutMs);
  }
}

function warnOnce(key, text) {
  if (oneShotWarnings.has(key)) return;
  oneShotWarnings.add(key);
  console.warn(text);
}

function getStoredPlayerName() {
  const raw = (localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || '').trim();
  if (!raw) return 'Player';
  return raw.slice(0, 24);
}

function formatTimerMs(ms) {
  const safe = Math.max(0, Number(ms) || 0);
  const total = Math.ceil(safe / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function currentTimerRemainingMs() {
  if (!roomState?.turnTimerEnabled) return null;
  if (roomState.turnTimerPaused || !roomState.turnDeadlineTs) {
    return Number(roomState.turnRemainingMs ?? roomState.turnTimeLimitMs ?? 0);
  }
  return Math.max(0, Number(roomState.turnDeadlineTs) - Date.now());
}

const ENV_THEME_PRESETS = {
  default_lounge: {
    top: '#203546',
    bottom: '#0c1218',
    key: { color: 0xffe4ba, intensity: 1.2, pos: [4.2, 7.8, 4.0] },
    fill: { color: 0x8aaed2, intensity: 0.36, pos: [-5.8, 6.1, -3.7] },
    rim: { color: 0xf8c98c, intensity: 0.26, pos: [0, 4.8, -7.8] },
    ambient: { sky: 0xffefd2, ground: 0x294357, intensity: 0.54 },
    fog: { color: '#101720', near: 18, far: 62 }
  },
  witch_parlor: {
    top: '#3a2a53',
    bottom: '#141020',
    key: { color: 0xcca3ff, intensity: 1.03, pos: [3.7, 7.0, 4.8] },
    fill: { color: 0x6fbf8b, intensity: 0.24, pos: [-5.4, 4.7, -4.2] },
    rim: { color: 0xa57dff, intensity: 0.28, pos: [0, 4.5, -7.5] },
    ambient: { sky: 0xc9b3ff, ground: 0x1e1730, intensity: 0.46 },
    fog: { color: '#1a1530', near: 16, far: 58 }
  },
  zombie_graveyard: {
    top: '#1b2433',
    bottom: '#0a0f17',
    key: { color: 0x9cc5ff, intensity: 0.98, pos: [5.2, 8.7, 3.5] },
    fill: { color: 0x7fb58b, intensity: 0.3, pos: [-5.3, 5.0, -5.8] },
    rim: { color: 0x9de8a8, intensity: 0.22, pos: [0, 5.3, -8.2] },
    ambient: { sky: 0xceddf7, ground: 0x1b2836, intensity: 0.46 },
    fog: { color: '#0f1620', near: 14, far: 50 }
  },
  pirate_cove: {
    top: '#1f3340',
    bottom: '#0d131a',
    key: { color: 0xf7cf97, intensity: 1.15, pos: [4.8, 7.5, 3.9] },
    fill: { color: 0x7ea8d7, intensity: 0.32, pos: [-6.2, 5.6, -5.8] },
    rim: { color: 0xf0b26f, intensity: 0.25, pos: [0, 4.9, -8.6] },
    ambient: { sky: 0xf3dbb2, ground: 0x203446, intensity: 0.5 },
    fog: { color: '#0f171f', near: 15, far: 55 }
  },
  cowboy_saloon: {
    top: '#4a2f20',
    bottom: '#1b120c',
    key: { color: 0xffd295, intensity: 1.22, pos: [4.3, 6.8, 4.6] },
    fill: { color: 0xc39f7b, intensity: 0.28, pos: [-4.8, 5.6, -4.2] },
    rim: { color: 0xf8b870, intensity: 0.23, pos: [0, 4.7, -7.2] },
    ambient: { sky: 0xf5d5a7, ground: 0x3f291e, intensity: 0.5 },
    fog: { color: '#21170f', near: 18, far: 64 }
  },
  ninja_dojo: {
    top: '#272e38',
    bottom: '#11161d',
    key: { color: 0xf5dfb9, intensity: 1.08, pos: [3.8, 7.4, 4.2] },
    fill: { color: 0x91a7b8, intensity: 0.3, pos: [-5.8, 5.2, -4.6] },
    rim: { color: 0xd8bd8a, intensity: 0.2, pos: [0, 4.4, -7.0] },
    ambient: { sky: 0xe8dfcb, ground: 0x252b34, intensity: 0.5 },
    fog: { color: '#181e26', near: 20, far: 65 }
  },
  knight_castle: {
    top: '#4f5562',
    bottom: '#1c2028',
    key: { color: 0xf8e0ba, intensity: 1.08, pos: [4.5, 7.9, 4.0] },
    fill: { color: 0x90a2be, intensity: 0.31, pos: [-5.6, 5.3, -4.5] },
    rim: { color: 0xe2ba82, intensity: 0.22, pos: [0, 4.8, -7.8] },
    ambient: { sky: 0xe0e6ef, ground: 0x2a313d, intensity: 0.5 },
    fog: { color: '#1d232d', near: 18, far: 62 }
  },
  goblin_cave: {
    top: '#243329',
    bottom: '#0f1612',
    key: { color: 0x8ee1a2, intensity: 1.02, pos: [4.7, 7.2, 4.4] },
    fill: { color: 0x5fa36f, intensity: 0.28, pos: [-6.0, 5.7, -4.8] },
    rim: { color: 0x79cc8b, intensity: 0.24, pos: [0, 4.8, -8.2] },
    ambient: { sky: 0xcde7d3, ground: 0x1e2d23, intensity: 0.47 },
    fog: { color: '#131f17', near: 15, far: 52 }
  },
  elf_forest: {
    top: '#2d4537',
    bottom: '#101913',
    key: { color: 0xbce9bf, intensity: 1.05, pos: [4.3, 7.6, 3.8] },
    fill: { color: 0x82b29a, intensity: 0.29, pos: [-5.3, 5.3, -5.0] },
    rim: { color: 0xa6eab0, intensity: 0.2, pos: [0, 4.8, -7.8] },
    ambient: { sky: 0xd8f0d8, ground: 0x1d2a20, intensity: 0.5 },
    fog: { color: '#142016', near: 15, far: 54 }
  },
  wizard_tower: {
    top: '#2a385f',
    bottom: '#11182a',
    key: { color: 0xa6c8ff, intensity: 1.08, pos: [4.6, 7.9, 3.6] },
    fill: { color: 0x6f98ff, intensity: 0.28, pos: [-5.8, 5.4, -4.8] },
    rim: { color: 0x8bb2ff, intensity: 0.26, pos: [0, 4.8, -8.4] },
    ambient: { sky: 0xc8d8fa, ground: 0x1f2943, intensity: 0.48 },
    fog: { color: '#151d2f', near: 18, far: 58 }
  },
  hospital_clinic: {
    top: '#3a596f',
    bottom: '#182733',
    key: { color: 0xe9f8ff, intensity: 1.1, pos: [3.9, 7.5, 4.3] },
    fill: { color: 0xa6cbde, intensity: 0.37, pos: [-5.5, 5.8, -4.0] },
    rim: { color: 0x9dd7ff, intensity: 0.17, pos: [0, 4.8, -7.0] },
    ambient: { sky: 0xe8f7ff, ground: 0x29495b, intensity: 0.56 },
    fog: { color: '#1d3040', near: 24, far: 72 }
  },
  battlefield: {
    top: '#524d47',
    bottom: '#1a1918',
    key: { color: 0xf8d8bf, intensity: 1.08, pos: [4.8, 7.4, 4.8] },
    fill: { color: 0xb5a695, intensity: 0.3, pos: [-6.2, 5.8, -4.2] },
    rim: { color: 0xe09d84, intensity: 0.24, pos: [0, 4.9, -7.5] },
    ambient: { sky: 0xefe1d5, ground: 0x3b352f, intensity: 0.48 },
    fog: { color: '#252220', near: 16, far: 56 }
  },
  kitchen: {
    top: '#4a3b2a',
    bottom: '#1d1711',
    key: { color: 0xffdda8, intensity: 1.2, pos: [4.1, 7.1, 4.4] },
    fill: { color: 0xc6ad8a, intensity: 0.3, pos: [-5.3, 5.4, -3.8] },
    rim: { color: 0xffc184, intensity: 0.2, pos: [0, 4.4, -7.0] },
    ambient: { sky: 0xf6e4c9, ground: 0x382a1e, intensity: 0.5 },
    fog: { color: '#20170f', near: 20, far: 64 }
  },
  modern_office: {
    top: '#405265',
    bottom: '#18222b',
    key: { color: 0xdde8f7, intensity: 1.13, pos: [4.4, 7.7, 4.2] },
    fill: { color: 0xa6bed5, intensity: 0.34, pos: [-6.0, 5.8, -4.4] },
    rim: { color: 0xb6d1ea, intensity: 0.18, pos: [0, 4.8, -7.4] },
    ambient: { sky: 0xdce9f5, ground: 0x2a3a48, intensity: 0.54 },
    fog: { color: '#1b2832', near: 24, far: 75 }
  },
  viking_longhouse: {
    top: '#4f3b2a',
    bottom: '#1a120d',
    key: { color: 0xffc589, intensity: 1.2, pos: [4.2, 6.9, 4.7] },
    fill: { color: 0xc49b73, intensity: 0.27, pos: [-5.5, 5.2, -3.9] },
    rim: { color: 0xf0a86c, intensity: 0.24, pos: [0, 4.4, -7.6] },
    ambient: { sky: 0xf1ddc1, ground: 0x35251a, intensity: 0.48 },
    fog: { color: '#1f150f', near: 18, far: 58 }
  }
};

function makeNoiseTexture(size, drawFn) {
  const canvasEl = document.createElement('canvas');
  canvasEl.width = size;
  canvasEl.height = size;
  const ctx = canvasEl.getContext('2d');
  drawFn(ctx, size);
  const tex = new THREE.CanvasTexture(canvasEl);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.needsUpdate = true;
  return tex;
}

const woodTexture = makeNoiseTexture(1024, (ctx, size) => {
  ctx.fillStyle = '#5b3a24';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 200; i += 1) {
    const x = Math.random() * size;
    const alpha = 0.05 + Math.random() * 0.12;
    ctx.strokeStyle = `rgba(140, 100, 72, ${alpha})`;
    ctx.lineWidth = 1 + Math.random() * 3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(
      x + (Math.random() * 16 - 8),
      size * 0.3,
      x + (Math.random() * 16 - 8),
      size * 0.7,
      x + (Math.random() * 16 - 8),
      size
    );
    ctx.stroke();
  }

  for (let i = 0; i < 4500; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const c = 45 + Math.floor(Math.random() * 35);
    ctx.fillStyle = `rgba(${c}, ${c - 8}, ${c - 14}, ${0.09 + Math.random() * 0.08})`;
    ctx.fillRect(x, y, 2, 2);
  }
});
woodTexture.repeat.set(4.5, 4.5);

const feltTexture = makeNoiseTexture(1024, (ctx, size) => {
  ctx.fillStyle = '#2f7e59';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 7000; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const shade = 90 + Math.floor(Math.random() * 70);
    ctx.fillStyle = `rgba(${shade - 55}, ${shade + 20}, ${shade - 45}, ${0.06 + Math.random() * 0.08})`;
    const s = Math.random() < 0.8 ? 1 : 2;
    ctx.fillRect(x, y, s, s);
  }
});
feltTexture.repeat.set(1.6, 1.6);

const ivoryPatternCanvas = (() => {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#efe5d3';
  ctx.fillRect(0, 0, c.width, c.height);

  for (let i = 0; i < 2400; i += 1) {
    const x = Math.random() * c.width;
    const y = Math.random() * c.height;
    const d = Math.random() * 1.2;
    const tone = 208 + Math.floor(Math.random() * 28);
    ctx.fillStyle = `rgba(${tone}, ${tone - 8}, ${tone - 22}, ${0.06 + Math.random() * 0.06})`;
    ctx.fillRect(x, y, d + 1, d + 1);
  }

  for (let i = 0; i < 220; i += 1) {
    const x = Math.random() * c.width;
    const y = Math.random() * c.height;
    const arc = 12 + Math.random() * 38;
    ctx.strokeStyle = `rgba(173, 150, 123, ${0.04 + Math.random() * 0.05})`;
    ctx.lineWidth = 1.1 + Math.random() * 1.4;
    ctx.beginPath();
    ctx.arc(x, y, arc, Math.random() * Math.PI, Math.random() * Math.PI * 2);
    ctx.stroke();
  }
  return c;
})();

function buildTableMaterial(kind) {
  if (kind === 'felt') {
    return new THREE.MeshStandardMaterial({
      map: feltTexture,
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0.0
    });
  }
  return new THREE.MeshStandardMaterial({
    map: woodTexture,
    color: 0xffffff,
    roughness: 0.58,
    metalness: 0.0
  });
}

function applyTableSurfaceMaterials(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const name = `${obj.name || ''} ${obj.material?.name || ''}`.toLowerCase();
    const felt = name.includes('felt');
    obj.material = buildTableMaterial(felt ? 'felt' : 'wood');
    obj.castShadow = true;
    obj.receiveShadow = true;
  });
}

function findSeatAnchorY(object3d) {
  let seatAnchor = null;
  object3d.traverse((node) => {
    if (seatAnchor) return;
    if (!node?.name) return;
    const n = node.name.toLowerCase();
    if (n.includes('seatanchor') || n.includes('seat_anchor') || n === 'seat') {
      seatAnchor = node;
    }
  });
  if (seatAnchor) {
    seatAnchor.updateWorldMatrix(true, false);
    tmpV3A.setFromMatrixPosition(seatAnchor.matrixWorld);
    object3d.worldToLocal(tmpV3A);
    return tmpV3A.y;
  }

  tmpBox.setFromObject(object3d);
  const height = Math.max(0.0001, tmpBox.max.y - tmpBox.min.y);
  return tmpBox.min.y + height * 0.35;
}

function updateTableMetricsFromObject(object3d) {
  tmpBox.setFromObject(object3d);
  if (!Number.isFinite(tmpBox.max.y) || !Number.isFinite(tmpBox.min.y)) return;
  tableMetrics.topY = tmpBox.max.y;
  tableMetrics.floorY = tmpBox.min.y;
}

function projectWorldToScreen(world, out = { x: 0, y: 0 }) {
  tmpV3A.copy(world).project(camera);
  out.x = (tmpV3A.x * 0.5 + 0.5) * window.innerWidth;
  out.y = (-tmpV3A.y * 0.5 + 0.5) * window.innerHeight;
  return out;
}

function clampAvatarBaseY(baseY, seatIndex) {
  const floorLimit = tableMetrics.floorY + 0.02;
  const tableLimit = tableMetrics.topY - 0.1;
  let out = Math.max(baseY, floorLimit);
  if (out > tableLimit) {
    warnOnce(`avatarTableClamp:${seatIndex}`, `Avatar seat ${seatIndex} clamped below table surface.`);
    out = tableLimit;
  }
  return out;
}

function beginNameplateDrag(seatIndex, pointerId, clientX, clientY) {
  draggingNameplateSeat = seatIndex;
  draggingPointerId = pointerId;
  draggingStartClient = { x: clientX, y: clientY };
  draggingStartOffset = { ...nameplateOffsets[seatIndex] };
  const node = document.getElementById(`nameplate-${seatIndex}`);
  if (node) node.classList.add('dragging');
}

function updateDraggedNameplate(clientX, clientY) {
  if (draggingNameplateSeat == null) return;
  const dx = clientX - draggingStartClient.x;
  const dy = clientY - draggingStartClient.y;
  nameplateOffsets[draggingNameplateSeat].x = draggingStartOffset.x + dx;
  nameplateOffsets[draggingNameplateSeat].y = draggingStartOffset.y + dy;
}

function endNameplateDrag() {
  if (draggingNameplateSeat == null) return;
  const node = document.getElementById(`nameplate-${draggingNameplateSeat}`);
  if (node) node.classList.remove('dragging');
  draggingNameplateSeat = null;
  draggingPointerId = null;
}

function updateNameplatePositions() {
  const localSeat = getLocalSeat();
  const screen = { x: 0, y: 0 };
  const handScreen = { x: 0, y: 0 };

  for (let seatIndex = 0; seatIndex < 4; seatIndex += 1) {
    const rel = toRelativeSeat(seatIndex, localSeat);
    const node = document.getElementById(`nameplate-${seatIndex}`);
    if (!node) continue;

    const anchor = SEATS[rel]?.nameplateAnchor?.pos || [0, 1.8, 0];
    tmpV3B.set(anchor[0], anchor[1], anchor[2]);
    tableRoot.localToWorld(tmpV3B);
    projectWorldToScreen(tmpV3B, screen);

    let x = screen.x + nameplateOffsets[seatIndex].x;
    let y = screen.y + nameplateOffsets[seatIndex].y;

    const handAnchor = SEATS[rel]?.handAnchor?.pos || [0, PLAY_PLANE_Y, 0];
    tmpV3B.set(handAnchor[0], handAnchor[1], handAnchor[2]);
    tableRoot.localToWorld(tmpV3B);
    projectWorldToScreen(tmpV3B, handScreen);

    if (Math.abs(x - handScreen.x) < 120 && Math.abs(y - handScreen.y) < 84) {
      y -= 82;
    }

    if (rel === 0 && y > window.innerHeight - 185) {
      y = window.innerHeight - 185;
    }

    x = Math.max(60, Math.min(window.innerWidth - 60, x));
    y = Math.max(36, Math.min(window.innerHeight - 36, y));
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
  }
}

function tileId(tile) {
  const hi = Math.max(tile.a, tile.b);
  const lo = Math.min(tile.a, tile.b);
  return `${hi}-${lo}`;
}

function tileContainsSuit(tile, suit) {
  return tile.a === suit || tile.b === suit;
}

function countTilePoints(tile) {
  const id = tile.id || tileId(tile);
  if (id === '5-5' || id === '6-4') return 10;
  if (id === '5-0' || id === '4-1' || id === '3-2') return 5;
  return 0;
}

function teamForSeat(seat) {
  return seat % 2 === 0 ? 'teamA' : 'teamB';
}

function getLocalSeat() {
  if (!roomState || !localClientId) return null;
  const seat = roomState.seats.find((s) => s.occupantClientId === localClientId && s.type === 'human');
  return seat ? seat.seatIndex : null;
}

function localCanControlSeat(seatIndex) {
  if (!roomState || seatIndex == null) return false;
  const seat = roomState.seats[seatIndex];
  if (!seat) return false;
  if (seat.type === 'human') {
    return seat.occupantClientId === localClientId;
  }
  if (seat.type === 'cpu') {
    return roomState.hostClientId === localClientId;
  }
  return false;
}

function localIsBidder() {
  return roomState && roomState.bidderSeat != null && localCanControlSeat(roomState.bidderSeat);
}

function localTurnToBid() {
  return roomState && roomState.phase === PHASES.BIDDING && roomState.turnSeat != null && localCanControlSeat(roomState.turnSeat);
}

function isMyTurnToPlay() {
  return roomState && roomState.phase === PHASES.PLAYING && roomState.turnSeat != null && localCanControlSeat(roomState.turnSeat);
}

function currentTrumpLabel() {
  if (!roomState || !roomState.mode) return '-';
  if (roomState.mode === MODES.TRUMPS) {
    return roomState.trumpSuit == null ? '-' : String(roomState.trumpSuit);
  }
  if (roomState.mode === MODES.FOLLOW_ME) return 'FOLLOW';
  if (roomState.mode === MODES.SEVENS) return '7s';
  return '-';
}

function shouldAutoOpenPanel() {
  if (!roomState) return true;
  if (roomState.phase === PHASES.LOBBY) return true;
  if (localTurnToBid()) return true;
  if (roomState.phase === PHASES.CHOOSE_MODE && localIsBidder()) return true;
  if (roomState.phase === PHASES.CHOOSE_TRUMP && localIsBidder()) return true;
  return false;
}

function setPanelOpen(open) {
  panelOpen = open;
  panel.classList.toggle('closed', !open);
}

function updatePanelAutoBehavior() {
  if (!roomState) {
    setPanelOpen(true);
    return;
  }

  if (forceClosePanel) {
    setPanelOpen(false);
    forceClosePanel = false;
  }

  if (shouldAutoOpenPanel()) {
    setPanelOpen(true);
  }

  if (roomState.phase === PHASES.PLAYING && lastPhase !== PHASES.PLAYING) {
    setPanelOpen(false);
  }

  lastPhase = roomState.phase;
}

function showSections() {
  const show = {
    room: false,
    players: false,
    game: false,
    bidding: false,
    trump: false,
    marks: false
  };

  if (!roomState) {
    show.room = true;
  } else if (roomState.phase === PHASES.LOBBY) {
    show.players = true;
    show.game = true;
    show.room = true;
  } else if (roomState.phase === PHASES.BIDDING) {
    show.game = true;
    show.bidding = true;
  } else if (roomState.phase === PHASES.CHOOSE_MODE || roomState.phase === PHASES.CHOOSE_TRUMP) {
    show.game = true;
    show.trump = true;
  } else if (roomState.phase === PHASES.PLAYING) {
    show.game = true;
    show.marks = true;
    show.room = true;
  } else {
    show.game = true;
    show.marks = true;
    show.room = true;
  }

  sectionRoom.classList.toggle('hidden', !show.room);
  sectionPlayers.classList.toggle('hidden', !show.players);
  sectionGame.classList.toggle('hidden', !show.game);
  sectionBidding.classList.toggle('hidden', !show.bidding);
  sectionTrump.classList.toggle('hidden', !show.trump);
  sectionMarks.classList.toggle('hidden', !show.marks);
}

function renderTallies(svg, value) {
  const count = Math.max(0, Number(value) || 0);
  svg.replaceChildren();

  const ns = 'http://www.w3.org/2000/svg';
  const stroke = '#f8e3b0';
  const slash = '#f7c77a';

  let x = 6;
  const yTop = 8;
  const yBottom = 34;

  const addLine = (x1, y1, x2, y2, color = stroke, width = 2.8) => {
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', `${x1}`);
    line.setAttribute('y1', `${y1}`);
    line.setAttribute('x2', `${x2}`);
    line.setAttribute('y2', `${y2}`);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', `${width}`);
    line.setAttribute('stroke-linecap', 'round');
    svg.append(line);
  };

  const fives = Math.floor(count / 5);
  const remainder = count % 5;

  for (let g = 0; g < fives; g += 1) {
    addLine(x + 0, yTop, x + 0, yBottom);
    addLine(x + 8, yTop, x + 8, yBottom);
    addLine(x + 16, yTop, x + 16, yBottom);
    addLine(x + 24, yTop, x + 24, yBottom);
    addLine(x - 2, yBottom - 1, x + 26, yTop + 1, slash, 3.2);
    x += 38;
  }

  for (let r = 0; r < remainder; r += 1) {
    addLine(x + r * 8, yTop, x + r * 8, yBottom);
  }

  const width = Math.max(220, x + Math.max(0, remainder - 1) * 8 + 16);
  svg.setAttribute('viewBox', `0 0 ${width} 42`);
}

function updateScoreboard() {
  if (!roomState) {
    scoreTeamAMain.textContent = '0/0';
    scoreTeamBMain.textContent = '0/0';
    return;
  }

  const points = roomState.pointsThisHand || { teamA: 0, teamB: 0 };
  const target = roomState.targetThisHand || { teamA: 0, teamB: 0 };
  scoreTeamAMain.textContent = `${points.teamA}/${target.teamA}`;
  scoreTeamBMain.textContent = `${points.teamB}/${target.teamB}`;
}

function updateMarksMenu() {
  const rounds = roomState?.roundWins || { teamA: 0, teamB: 0 };
  const marks = roomState?.gameMarks || { teamA: 0, teamB: 0 };
  renderTallies(menuRoundsTeamA, rounds.teamA);
  renderTallies(menuRoundsTeamB, rounds.teamB);
  renderTallies(menuMarksTeamA, marks.teamA);
  renderTallies(menuMarksTeamB, marks.teamB);
}

function drawPips(ctx, value, xCenter, color) {
  const layout = {
    0: [],
    1: [[0, 0]],
    2: [[-0.18, -0.2], [0.18, 0.2]],
    3: [[-0.18, -0.2], [0, 0], [0.18, 0.2]],
    4: [[-0.18, -0.2], [0.18, -0.2], [-0.18, 0.2], [0.18, 0.2]],
    5: [[-0.18, -0.2], [0.18, -0.2], [0, 0], [-0.18, 0.2], [0.18, 0.2]],
    6: [[-0.18, -0.22], [0.18, -0.22], [-0.18, 0], [0.18, 0], [-0.18, 0.22], [0.18, 0.22]]
  };

  const positions = layout[value] || [];
  for (const [x, y] of positions) {
    const px = xCenter + x * 185;
    const py = 128 + y * 205;

    // Slightly inset-look pips with micro highlights.
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.arc(px + 0.7, py + 0.9, 13.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, 12.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(px - 1.6, py - 1.2, 7.5, Math.PI * 1.1, Math.PI * 1.8);
    ctx.stroke();
  }
}

function getDominoTexture(tile, options = {}) {
  const {
    faceUp = true,
    pipColor = '#111111',
    glowCount = false,
    trumpSuit = null
  } = options;

  const id = tile ? tile.id || tileId(tile) : 'back';
  const key = `${id}:${faceUp ? 'up' : 'down'}:${pipColor}:${glowCount ? 1 : 0}:t${trumpSuit == null ? 'n' : trumpSuit}`;
  if (textureCache.has(key)) return textureCache.get(key);

  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');

  if (!faceUp) {
    ctx.fillStyle = '#253342';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#4a5f73';
    ctx.lineWidth = 8;
    ctx.strokeRect(12, 12, c.width - 24, c.height - 24);
    ctx.fillStyle = '#3d5266';
    for (let i = 0; i < 12; i += 1) {
      ctx.beginPath();
      ctx.arc(40 + i * 40, 128 + (i % 2 === 0 ? -18 : 18), 6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    const ivoryPattern = ctx.createPattern(ivoryPatternCanvas, 'repeat');
    ctx.fillStyle = ivoryPattern || '#efe5d3';
    ctx.fillRect(0, 0, c.width, c.height);

    const edgeFade = ctx.createLinearGradient(0, 0, 512, 0);
    edgeFade.addColorStop(0, 'rgba(99, 79, 58, 0.1)');
    edgeFade.addColorStop(0.1, 'rgba(255,255,255,0)');
    edgeFade.addColorStop(0.9, 'rgba(255,255,255,0)');
    edgeFade.addColorStop(1, 'rgba(99, 79, 58, 0.1)');
    ctx.fillStyle = edgeFade;
    ctx.fillRect(0, 0, c.width, c.height);

    ctx.strokeStyle = '#5a4632';
    ctx.lineWidth = 7.5;
    ctx.strokeRect(8, 8, c.width - 16, c.height - 16);

    if (glowCount) {
      ctx.shadowColor = 'rgba(255, 212, 98, 0.9)';
      ctx.shadowBlur = 26;
      ctx.strokeStyle = 'rgba(255, 214, 104, 0.95)';
      ctx.lineWidth = 12;
      ctx.strokeRect(8, 8, c.width - 16, c.height - 16);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255, 214, 97, 0.22)';
      ctx.fillRect(0, 0, c.width, c.height);
    }

    ctx.strokeStyle = '#5c4a39';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(256, 12);
    ctx.lineTo(256, 244);
    ctx.stroke();

    const leftColor = trumpSuit != null && tile.a === trumpSuit ? '#cf3df6' : '#141311';
    const rightColor = trumpSuit != null && tile.b === trumpSuit ? '#cf3df6' : '#141311';
    drawPips(ctx, tile.a, 128, leftColor);
    drawPips(ctx, tile.b, 384, rightColor);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.needsUpdate = true;
  textureCache.set(key, tex);
  return tex;
}

function createDominoMesh(tile, options = {}) {
  const {
    faceUp = true,
    scale = 1,
    glowCount = false,
    trumpSuit = null,
    useMagentaTrump = false
  } = options;

  const trumpTintSuit = useMagentaTrump && trumpSuit != null ? trumpSuit : null;
  const topTexture = getDominoTexture(tile, {
    faceUp,
    pipColor: '#121212',
    glowCount,
    trumpSuit: trumpTintSuit
  });
  const bottomTexture = getDominoTexture(tile, {
    faceUp: false,
    pipColor: '#111',
    glowCount: false,
    trumpSuit: null
  });

  const sideMat = new THREE.MeshStandardMaterial({ color: faceUp ? 0xe9dcc7 : 0x2f3f4d, roughness: 0.57, metalness: 0.0 });
  const topMat = new THREE.MeshStandardMaterial({ map: topTexture, color: 0xffffff, roughness: 0.55, metalness: 0.0 });
  const bottomMat = new THREE.MeshStandardMaterial({ map: bottomTexture, roughness: 0.88, metalness: 0.0 });
  const mats = [sideMat, sideMat, topMat, bottomMat, sideMat, sideMat];

  const mesh = new THREE.Mesh(dominoGeometry, mats);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.scale.setScalar(scale);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  mesh.userData = {
    tileId: tile.id || tileId(tile),
    seatIndex: null,
    clickable: false
  };

  return mesh;
}

function clearGroup(group) {
  const children = [...group.children];
  for (const child of children) {
    if (child.children && child.children.length) {
      clearGroup(child);
    }
    group.remove(child);
    if (child.geometry && child.geometry !== dominoGeometry) {
      child.geometry.dispose();
    }
    if (Array.isArray(child.material)) {
      child.material.forEach((mat) => mat?.dispose && mat.dispose());
    } else if (child.material) {
      child.material.dispose && child.material.dispose();
    }
  }
}

function normalizeAvatarModel(model, targetHeight = 1.68) {
  tmpBox.setFromObject(model);
  const size = new THREE.Vector3();
  tmpBox.getSize(size);
  if (size.y <= 0.0001) return;

  const scale = targetHeight / size.y;
  model.scale.multiplyScalar(scale);

  tmpBox.setFromObject(model);
  const center = new THREE.Vector3();
  tmpBox.getCenter(center);
  model.position.x -= center.x;
  model.position.z -= center.z;

  tmpBox.setFromObject(model);
  model.position.y -= tmpBox.min.y;
}

function applyStaticSeatedPose(model) {
  model.rotation.x = -0.2;
  model.scale.y *= 0.76;
  tmpBox.setFromObject(model);
  model.position.y -= tmpBox.min.y;
  model.position.y -= 0.06;
}

function tuneImportedMaterials(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((mat) => {
      if (!mat) return;
      if (mat.map) {
        mat.map.colorSpace = THREE.SRGBColorSpace;
        mat.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
      }
      if (mat.emissiveMap) {
        mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
      }
      if (mat.roughness == null) mat.roughness = 0.82;
      if (mat.metalness == null) mat.metalness = 0.08;
      mat.needsUpdate = true;
    });
  });
}

function loaderPromise(loader, url) {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
}

async function loadModelTemplate(url) {
  if (!modelCache.has(url)) {
    const task = (async () => {
      const lower = url.toLowerCase();
      if (lower.endsWith('.glb') || lower.endsWith('.gltf')) {
        const gltf = await loaderPromise(gltfLoader, url);
        const sceneRoot = gltf.scene || gltf.scenes?.[0];
        if (!sceneRoot) {
          throw new Error(`Model has no scene: ${url}`);
        }
        return {
          scene: sceneRoot,
          animations: gltf.animations || []
        };
      }

      if (lower.endsWith('.obj')) {
        const mtlUrl = url.replace(/\.obj$/i, '.mtl');
        try {
          const mats = await loaderPromise(mtlLoader, mtlUrl);
          mats.preload();
          objLoader.setMaterials(mats);
        } catch {
          // Optional MTL fallback.
        }
        const obj = await loaderPromise(objLoader, url);
        return {
          scene: obj,
          animations: []
        };
      }

      throw new Error(`Unsupported model extension: ${url}`);
    })();

    modelCache.set(url, task);
  }

  return modelCache.get(url);
}

function clonedModelAsset(asset) {
  let cloned;
  try {
    cloned = skeletonClone(asset.scene);
  } catch {
    cloned = asset.scene.clone(true);
  }
  return {
    scene: cloned,
    animations: asset.animations || []
  };
}

function buildFallbackAvatar() {
  const avatar = new THREE.Group();
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.19, 0.5, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x9fb0c7, roughness: 0.65, metalness: 0.08 })
  );
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 20, 20),
    new THREE.MeshStandardMaterial({ color: 0xe7d8c0, roughness: 0.64, metalness: 0.02 })
  );
  torso.position.y = 0.3;
  head.position.y = 0.77;
  torso.castShadow = true;
  torso.receiveShadow = true;
  head.castShadow = true;
  head.receiveShadow = true;
  avatar.add(torso, head);
  avatar.rotation.x = -0.17;
  avatar.position.y = 0.12;
  return avatar;
}

function clearSeatMixer(seatIndex) {
  void seatIndex;
}

async function setSeatAvatarModel(seatIndex, avatarId) {
  const targetGroup = avatarSeatGroups[seatIndex];
  clearSeatMixer(seatIndex);
  clearGroup(targetGroup);

  const token = `${seatIndex}:${avatarId || 'default'}:${Date.now()}`;
  activeAvatarLoadToken.set(seatIndex, token);

  const entry = avatarById.get(avatarId) || avatarById.get(DEFAULT_AVATAR_ID) || avatarCatalog[0] || null;

  const applyFallback = () => {
    if (activeAvatarLoadToken.get(seatIndex) !== token) return;
    targetGroup.add(buildFallbackAvatar());
    updateSeatTransforms();
  };

  if (!entry?.file) {
    applyFallback();
    return;
  }

  try {
    const asset = await loadModelTemplate(entry.file);
    if (activeAvatarLoadToken.get(seatIndex) !== token) return;

    const cloned = clonedModelAsset(asset);
    tuneImportedMaterials(cloned.scene);
    normalizeAvatarModel(cloned.scene, 1.68);
    targetGroup.add(cloned.scene);

    // Keep avatars fully static to avoid rocking/sway.
    void cloned.animations;
    applyStaticSeatedPose(cloned.scene);
    updateSeatTransforms();
  } catch {
    applyFallback();
  }
}

function setChairModelForSeat(seatIndex, chairTemplate) {
  const group = chairSeatGroups[seatIndex];
  clearGroup(group);

  const createProceduralChair = () => {
    const chair = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({
      map: woodTexture,
      color: 0xf1f1f1,
      roughness: 0.63,
      metalness: 0.04
    });
    const cushionMat = new THREE.MeshStandardMaterial({
      map: feltTexture,
      color: 0xf2f2f2,
      roughness: 0.92,
      metalness: 0
    });

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.09, 0.72), wood);
    seat.position.set(0, 0.47, 0);
    chair.add(seat);

    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.055, 0.66), cushionMat);
    cushion.position.set(0, 0.545, -0.01);
    chair.add(cushion);

    const back = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.72, 0.09), wood);
    back.position.set(0, 0.83, -0.32);
    chair.add(back);

    const backTop = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.07, 0.11), wood);
    backTop.position.set(0, 1.16, -0.33);
    chair.add(backTop);

    const legGeo = new THREE.BoxGeometry(0.085, 0.47, 0.085);
    const legPositions = [
      [-0.31, 0.235, 0.26],
      [0.31, 0.235, 0.26],
      [-0.31, 0.235, -0.26],
      [0.31, 0.235, -0.26]
    ];
    legPositions.forEach(([x, y, z]) => {
      const leg = new THREE.Mesh(legGeo, wood);
      leg.position.set(x, y, z);
      chair.add(leg);
    });

    const sideRailGeo = new THREE.BoxGeometry(0.085, 0.07, 0.52);
    const sideRailL = new THREE.Mesh(sideRailGeo, wood);
    sideRailL.position.set(-0.31, 0.37, 0.0);
    const sideRailR = sideRailL.clone();
    sideRailR.position.x = 0.31;
    chair.add(sideRailL, sideRailR);

    const frontRail = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.07, 0.085), wood);
    frontRail.position.set(0, 0.37, 0.26);
    chair.add(frontRail);

    chair.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;
    });
    return chair;
  };

  const meshCount = (obj) => {
    let count = 0;
    obj.traverse((node) => {
      if (node.isMesh) count += 1;
    });
    return count;
  };

  if (!chairTemplate) {
    const fallback = createProceduralChair();
    group.add(fallback);
    seatRuntime[seatIndex].chairSeatY = 0.47;
    return;
  }

  const clone = clonedModelAsset(chairTemplate).scene;
  tuneImportedMaterials(clone);
  const templateIsTooSimple = meshCount(clone) < 10;
  if (templateIsTooSimple) {
    const fallback = createProceduralChair();
    group.add(fallback);
    seatRuntime[seatIndex].chairSeatY = 0.47;
    return;
  }

  group.add(clone);
  seatRuntime[seatIndex].chairSeatY = Math.min(findSeatAnchorY(clone), tableMetrics.topY - 0.28);
}

async function loadEnvironmentModels() {
  try {
    environmentTemplates.table = await loadModelTemplate('/assets/models/table.glb');
  } catch {
    environmentTemplates.table = null;
  }

  try {
    environmentTemplates.chair = await loadModelTemplate('/assets/models/chair.glb');
  } catch {
    environmentTemplates.chair = null;
  }

  const tableNode = new THREE.Group();
  tableNode.name = 'tableModel';
  if (environmentTemplates.table) {
    const tableClone = clonedModelAsset(environmentTemplates.table).scene;
    applyTableSurfaceMaterials(tableClone);
    tableNode.add(tableClone);
  } else {
    const wood = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.4, 0.22, 64),
      buildTableMaterial('wood')
    );
    wood.position.y = 0.52;
    wood.receiveShadow = true;
    wood.castShadow = true;
    tableNode.add(wood);

    const felt = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.1, 0.02, 64),
      buildTableMaterial('felt')
    );
    felt.position.y = 0.63;
    felt.receiveShadow = true;
    felt.castShadow = false;
    tableNode.add(felt);
  }

  // Add a guaranteed felt cap + wood rim so the table always reads clearly.
  tmpBox.setFromObject(tableNode);
  const widthX = Math.max(0.1, tmpBox.max.x - tmpBox.min.x);
  const widthZ = Math.max(0.1, tmpBox.max.z - tmpBox.min.z);
  const radius = Math.max(1.85, Math.min(widthX, widthZ) * 0.43);
  const topY = Number.isFinite(tmpBox.max.y) ? tmpBox.max.y : 0.64;

  const feltCap = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 0.026, 64),
    buildTableMaterial('felt')
  );
  feltCap.position.y = topY + 0.015;
  feltCap.receiveShadow = true;
  feltCap.castShadow = false;
  tableNode.add(feltCap);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius + 0.1, 0.065, 16, 72),
    buildTableMaterial('wood')
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = topY + 0.037;
  rim.castShadow = true;
  rim.receiveShadow = true;
  tableNode.add(rim);

  const prevTable = environmentGroup.getObjectByName('tableModel');
  if (prevTable) {
    environmentGroup.remove(prevTable);
    clearGroup(prevTable);
  }
  tableNode.scale.set(1.46, 1, 1.46);
  environmentGroup.add(tableNode);
  updateTableMetricsFromObject(tableNode);

  for (let seat = 0; seat < 4; seat += 1) {
    setChairModelForSeat(seat, environmentTemplates.chair);
  }

  updateSeatTransforms();
  resetViewForLocalSeat(false);
}

function updateSeatTransforms() {
  const localSeat = getLocalSeat();
  for (let seatIndex = 0; seatIndex < 4; seatIndex += 1) {
    const rel = toRelativeSeat(seatIndex, localSeat);
    const seatConfig = SEATS[rel];

    const chairGroup = chairSeatGroups[seatIndex];
    chairGroup.position.set(...seatConfig.chair.pos);
    chairGroup.rotation.y = seatConfig.chair.rotY;

    const avatarGroup = avatarSeatGroups[seatIndex];
    let avatarBaseY = seatConfig.avatar.pos[1] + seatRuntime[seatIndex].chairSeatY + 0.02;
    avatarBaseY = Math.min(avatarBaseY, tableMetrics.topY - 0.28);
    avatarBaseY = clampAvatarBaseY(avatarBaseY, seatIndex);
    avatarGroup.position.set(seatConfig.avatar.pos[0], avatarBaseY, seatConfig.avatar.pos[2]);
    if (avatarBaseY >= tableMetrics.topY - 0.11) {
      avatarGroup.position.x *= 1.18;
      avatarGroup.position.z *= 1.18;
      avatarGroup.position.y = tableMetrics.topY - 0.18;
    }
    avatarGroup.rotation.y = seatConfig.avatar.rotY;
  }

  updateNameplatePositions();
  updatePenaltyEmojiPositions();
}

function cameraAnchorForSeat(seatIndex) {
  const localSeat = getLocalSeat();
  const rel = toRelativeSeat(seatIndex ?? 0, localSeat);
  return SEATS[rel]?.camera || SEATS[0].camera;
}

function resetViewForLocalSeat(immediate = true) {
  const localSeat = getLocalSeat();
  const seatIndex = Number.isInteger(localSeat) ? localSeat : 0;
  const anchor = cameraAnchorForSeat(seatIndex);
  const lookTarget = anchor?.lookAt || [0, 0.78, 0];
  const targetY = Math.max(0.74, Math.min(tableMetrics.topY + 0.06, lookTarget[1]));
  const nextPos = new THREE.Vector3(anchor.pos[0], anchor.pos[1], anchor.pos[2]);
  const nextTarget = new THREE.Vector3(lookTarget[0], targetY, lookTarget[2]);

  if (immediate) {
    camera.position.copy(nextPos);
    controls.target.copy(nextTarget);
  } else {
    camera.position.lerp(nextPos, 0.22);
    controls.target.lerp(nextTarget, 0.22);
  }
  controls.update();
}

function getSeatHeadWorld(seatIndex, out = new THREE.Vector3()) {
  const avatarGroup = avatarSeatGroups[seatIndex];
  if (!avatarGroup || !avatarGroup.children.length) {
    const localSeat = getLocalSeat();
    const rel = toRelativeSeat(seatIndex, localSeat);
    const fallback = SEATS[rel]?.nameplateAnchor?.pos || [0, 1.9, 0];
    out.set(fallback[0], fallback[1], fallback[2]);
    tableRoot.localToWorld(out);
    return out;
  }

  const bbox = new THREE.Box3().setFromObject(avatarGroup);
  if (!Number.isFinite(bbox.max.y)) {
    out.copy(avatarGroup.position);
    out.y += 1.7;
    return out;
  }
  out.set(
    (bbox.min.x + bbox.max.x) * 0.5,
    bbox.max.y + 0.16,
    (bbox.min.z + bbox.max.z) * 0.5
  );
  return out;
}

function showTimeoutPenaltyEmoji(seatIndex, emoji = '🤡', durationMs = 3000, activeTurnId = null) {
  if (!Number.isInteger(seatIndex)) return;
  const existing = timeoutPenaltyBySeat.get(seatIndex);
  const expiresAt = Date.now() + Math.max(500, Number(durationMs) || 3000);
  if (existing?.el) {
    existing.el.textContent = emoji;
    existing.expiresAt = expiresAt;
    existing.activeTurnId = activeTurnId;
    existing.el.style.animation = 'none';
    existing.el.offsetHeight;
    existing.el.style.animation = '';
    return;
  }

  const el = document.createElement('div');
  el.className = 'penaltyEmoji';
  el.textContent = emoji;
  emojiOverlays.appendChild(el);
  timeoutPenaltyBySeat.set(seatIndex, { el, expiresAt, activeTurnId });
}

function clearTimeoutPenaltyEmojis() {
  for (const value of timeoutPenaltyBySeat.values()) {
    value.el?.remove();
  }
  timeoutPenaltyBySeat.clear();
}

function updatePenaltyEmojiPositions() {
  const now = Date.now();
  for (const [seatIndex, data] of timeoutPenaltyBySeat.entries()) {
    if (!data?.el || data.expiresAt <= now) {
      data?.el?.remove();
      timeoutPenaltyBySeat.delete(seatIndex);
      continue;
    }

    getSeatHeadWorld(seatIndex, tmpV3B);
    projectWorldToScreen(tmpV3B, data);
    data.el.style.left = `${data.x}px`;
    data.el.style.top = `${data.y}px`;
  }
}

function getThemePreset(environmentId) {
  return ENV_THEME_PRESETS[environmentId] || ENV_THEME_PRESETS.default_lounge;
}

function getSkyTexture(environmentId, top, bottom) {
  const key = `${environmentId}:${top}:${bottom}`;
  if (skyTextureCache.has(key)) return skyTextureCache.get(key);

  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);

  for (let i = 0; i < 2400; i += 1) {
    const x = Math.random() * c.width;
    const y = Math.random() * c.height;
    const alpha = 0.016 + Math.random() * 0.04;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(x, y, 1, 1);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  skyTextureCache.set(key, tex);
  return tex;
}

function makeCandle(x, z, colorHex) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.07, 0.45, 10),
    new THREE.MeshStandardMaterial({ color: 0xdcc5a1, roughness: 0.8, metalness: 0.0 })
  );
  body.position.y = 0.22;
  const flame = new THREE.PointLight(colorHex, 0.55, 5.8, 2);
  flame.position.y = 0.52;
  g.add(body, flame);
  g.position.set(x, 0, z);
  body.castShadow = true;
  return g;
}

function applyEnvironment(environmentId) {
  const safeId = environmentById.has(environmentId) ? environmentId : 'default_lounge';
  if (currentEnvironmentId === safeId) return;
  currentEnvironmentId = safeId;

  clearGroup(themeGroup);
  const preset = getThemePreset(safeId);

  const skyTex = getSkyTexture(safeId, preset.top, preset.bottom);
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(56, 36, 20),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false })
  );
  themeGroup.add(skyDome);
  scene.background = new THREE.Color(preset.bottom);

  ambient.color.setHex(preset.ambient.sky);
  ambient.groundColor.setHex(preset.ambient.ground);
  ambient.intensity = preset.ambient.intensity;

  keyLight.color.setHex(preset.key.color);
  keyLight.intensity = preset.key.intensity;
  keyLight.position.set(...preset.key.pos);

  fillLight.color.setHex(preset.fill.color);
  fillLight.intensity = preset.fill.intensity;
  fillLight.position.set(...preset.fill.pos);

  rimLight.color.setHex(preset.rim.color);
  rimLight.intensity = preset.rim.intensity;
  rimLight.position.set(...preset.rim.pos);

  scene.fog = new THREE.Fog(preset.fog.color, preset.fog.near, preset.fog.far);

  const backgroundStage = new THREE.Group();
  const backPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 10),
    new THREE.MeshStandardMaterial({
      color: 0x11161c,
      emissive: new THREE.Color(preset.top),
      emissiveIntensity: 0.2,
      roughness: 0.9,
      metalness: 0.0
    })
  );
  backPanel.position.set(0, 2.6, -11.5);
  backgroundStage.add(backPanel);

  const addLantern = (x, z, warm = 0xffc37e) => {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.09, 2.2, 10),
      new THREE.MeshStandardMaterial({ map: woodTexture, color: 0xffffff, roughness: 0.62, metalness: 0.0 })
    );
    pole.position.set(x, 1.1, z);
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0xf8ddb4, emissive: warm, emissiveIntensity: 0.35, roughness: 0.4 })
    );
    orb.position.set(x, 2.15, z);
    const lamp = new THREE.PointLight(warm, 0.45, 8.8, 2);
    lamp.position.set(x, 2.2, z);
    backgroundStage.add(pole, orb, lamp);
  };

  switch (safeId) {
    case 'witch_parlor':
      backgroundStage.add(makeCandle(-3.2, -8.8, 0xba77ff));
      backgroundStage.add(makeCandle(0.0, -9.3, 0x9cfa74));
      backgroundStage.add(makeCandle(3.2, -8.7, 0xba77ff));
      break;
    case 'zombie_graveyard': {
      const moon = new THREE.Mesh(
        new THREE.SphereGeometry(1.2, 24, 18),
        new THREE.MeshStandardMaterial({ color: 0xd7e6ff, emissive: 0x9bbfff, emissiveIntensity: 0.42, roughness: 0.84 })
      );
      moon.position.set(-7.8, 7.1, -15.5);
      backgroundStage.add(moon);
      for (let i = 0; i < 3; i += 1) {
        const fogPlane = new THREE.Mesh(
          new THREE.PlaneGeometry(13, 2.3),
          new THREE.MeshBasicMaterial({ color: 0xc9d8df, transparent: true, opacity: 0.12, depthWrite: false })
        );
        fogPlane.position.set(-6 + i * 6, 0.9 + i * 0.15, -8.6 - i * 1.4);
        backgroundStage.add(fogPlane);
      }
      break;
    }
    case 'pirate_cove':
      addLantern(-4.8, -9.0, 0xffcf82);
      addLantern(4.8, -8.7, 0xffcf82);
      break;
    case 'cowboy_saloon':
      addLantern(-4.5, -8.9, 0xffbd70);
      addLantern(4.5, -8.9, 0xffbd70);
      break;
    case 'ninja_dojo': {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 7),
        new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.92, metalness: 0.0 })
      );
      panel.position.set(0, 2.8, -10.9);
      backgroundStage.add(panel);
      break;
    }
    case 'knight_castle': {
      for (let i = -1; i <= 1; i += 1) {
        const banner = new THREE.Mesh(
          new THREE.PlaneGeometry(1.0, 2.4),
          new THREE.MeshStandardMaterial({ color: 0x6b2d2d, roughness: 0.88 })
        );
        banner.position.set(i * 2.1, 3.5, -10.8);
        backgroundStage.add(banner);
      }
      break;
    }
    case 'goblin_cave':
      backgroundStage.add(makeCandle(-3.4, -8.9, 0x77ff96));
      backgroundStage.add(makeCandle(3.4, -8.9, 0x77ff96));
      break;
    case 'elf_forest':
      addLantern(-3.6, -8.7, 0x9ee8a9);
      addLantern(3.6, -8.5, 0x9ee8a9);
      break;
    case 'wizard_tower':
      addLantern(-3.5, -8.8, 0x7ea7ff);
      addLantern(3.5, -8.8, 0x7ea7ff);
      break;
    case 'hospital_clinic':
      addLantern(-2.8, -8.7, 0xaad6ff);
      addLantern(2.8, -8.7, 0xaad6ff);
      break;
    case 'battlefield':
      addLantern(-4.0, -8.7, 0xff9e7d);
      addLantern(4.0, -8.7, 0xff9e7d);
      break;
    case 'kitchen':
      addLantern(-2.9, -8.7, 0xffc994);
      addLantern(2.9, -8.7, 0xffc994);
      break;
    case 'modern_office':
      addLantern(-3.2, -8.8, 0xa7c7e9);
      addLantern(3.2, -8.8, 0xa7c7e9);
      break;
    case 'viking_longhouse':
      addLantern(-3.6, -8.8, 0xffb071);
      addLantern(3.6, -8.8, 0xffb071);
      break;
    default:
      addLantern(-3.2, -8.7, 0xf1c786);
      addLantern(3.2, -8.7, 0xf1c786);
      break;
  }

  themeGroup.add(backgroundStage);
  updateEnvironmentControls();
}

function renderAvatars() {
  if (!roomState) {
    for (let i = 0; i < 4; i += 1) {
      clearSeatMixer(i);
      clearGroup(avatarSeatGroups[i]);
    }
    return;
  }

  updateSeatTransforms();
  for (const seat of roomState.seats) {
    void setSeatAvatarModel(seat.seatIndex, seat.avatarId);
  }
}

function renderHandsAndTrick() {
  clearGroup(handGroup);
  clearGroup(oppHandGroup);
  clearGroup(trickGroup);

  if (!roomState) return;

  oppHandGroup.add(burnGroupA);
  oppHandGroup.add(burnGroupB);

  const localSeat = getLocalSeat();
  const myHand = localSeat != null ? roomState.hands?.[localSeat] || [] : [];

  if (myHand.length) {
    const seatAnchor = SEATS[0].handAnchor;
    const spacing = 1.08;
    const startOffset = -((myHand.length - 1) * spacing) / 2;

    myHand.forEach((tile, index) => {
      const mesh = createDominoMesh(tile, {
        faceUp: true,
        glowCount: countTilePoints(tile) > 0,
        scale: 1.09
      });
      const t = myHand.length <= 1 ? 0 : (index / (myHand.length - 1)) * 2 - 1;
      const arcLift = Math.abs(t) * 0.012;
      const arcForward = Math.abs(t) * 0.2;
      mesh.position.set(
        seatAnchor.pos[0] + startOffset + index * spacing,
        DOMINO_Y + 0.055 + arcLift,
        seatAnchor.pos[2] - 0.06 + arcForward
      );
      mesh.rotation.y = seatAnchor.rotY + t * 0.14;
      mesh.userData.tileId = tile.id;
      mesh.userData.seatIndex = localSeat;
      mesh.userData.clickable = true;
      handGroup.add(mesh);
    });
  }

  for (let seatIndex = 0; seatIndex < 4; seatIndex += 1) {
    if (seatIndex === localSeat) continue;
    const count = roomState.handCounts?.[seatIndex] || 0;
    const rel = toRelativeSeat(seatIndex, localSeat);
    const seatAnchor = SEATS[rel].handAnchor;

    for (let i = 0; i < count; i += 1) {
      const mesh = createDominoMesh({ a: 0, b: 0, id: 'back' }, { faceUp: false });
      mesh.position.set(seatAnchor.pos[0], DOMINO_Y + i * 0.012, seatAnchor.pos[2] + i * 0.06);
      mesh.rotation.y = seatAnchor.rotY;
      mesh.scale.setScalar(0.92);
      oppHandGroup.add(mesh);
    }
  }

  const trick = roomState.trick || [];
  const trickSpacing = 1.35;
  trick.forEach((play) => {
    const rel = toRelativeSeat(play.seatIndex, localSeat);
    const pos = [
      { x: 0, z: 1.02 },
      { x: trickSpacing, z: 0 },
      { x: 0, z: -1.02 },
      { x: -trickSpacing, z: 0 }
    ][rel] || { x: 0, z: 0 };

    const mesh = createDominoMesh(play.tile, {
      faceUp: true,
      glowCount: countTilePoints(play.tile) > 0,
      trumpSuit: roomState.trumpSuit,
      useMagentaTrump: roomState.mode === MODES.TRUMPS
    });
    mesh.position.set(pos.x, DOMINO_Y + 0.03, pos.z);
    mesh.rotation.y = rel === 1 ? -Math.PI / 2 : rel === 3 ? Math.PI / 2 : rel === 2 ? Math.PI : 0;
    trickGroup.add(mesh);
  });

  renderBurnPiles();
  if (typeof handGroup.userData.refreshSelection === 'function') {
    handGroup.userData.refreshSelection();
  }
}

function renderBurnPiles() {
  clearGroup(burnGroupA);
  clearGroup(burnGroupB);
  if (!roomState) return;

  const aTiles = roomState.burnPiles?.teamA || [];
  const bTiles = roomState.burnPiles?.teamB || [];
  const renderPile = (tiles, group, xBase, zBase) => {
    const sample = tiles.slice(-16);
    const colGap = 0.26;
    const rowGap = 0.71;
    sample.forEach((tile, i) => {
      const mesh = createDominoMesh(tile, {
        faceUp: true,
        scale: 1.11,
        glowCount: countTilePoints(tile) > 0,
        trumpSuit: roomState.trumpSuit,
        useMagentaTrump: roomState.mode === MODES.TRUMPS
      });
      const col = i % 2;
      const row = Math.floor(i / 2);
      mesh.position.set(xBase + col * colGap, DOMINO_Y + row * 0.012, zBase + row * rowGap);
      mesh.rotation.y = Math.PI / 2;
      group.add(mesh);
    });
  };

  // Team 1 left side, Team 2 right side.
  renderPile(aTiles, burnGroupA, -5.45, -2.2);
  renderPile(bTiles, burnGroupB, 5.02, -2.2);
}

function updateHud() {
  if (!roomState) {
    hudBidValue.textContent = '-';
    hudTrumpValue.textContent = '-';
    turnTimerHud.textContent = 'TIME: --';
    updateScoreboard();
    updateMarksMenu();
    updateTimerControls();
    updateEnvironmentControls();
    return;
  }

  hudBidValue.textContent = roomState.bidValue == null ? '-' : String(roomState.bidValue);
  hudTrumpValue.textContent = currentTrumpLabel();

  updateScoreboard();
  updateMarksMenu();
  updateTimerControls();
  updateEnvironmentControls();
}

function updateTimerControls() {
  const isHost = roomState?.hostClientId === localClientId;
  const enabled = !!roomState?.turnTimerEnabled;
  const paused = !!roomState?.turnTimerPaused;
  timerEnabledToggle.checked = enabled;
  timerEnabledToggle.disabled = !isHost || !roomState;
  timerPauseBtn.disabled = !isHost || !roomState || !enabled;
  timerPauseBtn.textContent = paused ? 'Resume Timer' : 'Pause Timer';

  if (!roomState) {
    timerStateText.textContent = 'Timer Off';
    return;
  }

  const remaining = currentTimerRemainingMs();
  const activeSeat = Number.isInteger(roomState.turnSeat) ? roomState.turnSeat + 1 : '-';
  timerStateText.textContent = enabled
    ? `${paused ? 'Paused' : 'Running'} | Seat ${activeSeat} | ${formatTimerMs(remaining)}`
    : 'Timer Off';
}

function updateTimerHud() {
  if (!roomState?.turnTimerEnabled) {
    turnTimerHud.textContent = 'TIME: --';
    return;
  }
  const remaining = currentTimerRemainingMs();
  turnTimerHud.textContent = `TIME: ${formatTimerMs(remaining)}`;
}

function updateEnvironmentControls() {
  if (!environmentCatalog.length) {
    environmentSelect.innerHTML = '<option value="default_lounge">default_lounge</option>';
    environmentSelect.disabled = true;
    environmentPreview.removeAttribute('src');
    environmentStateText.textContent = 'Loading backgrounds...';
    return;
  }

  if (environmentSelect.options.length !== environmentCatalog.length) {
    environmentSelect.innerHTML = environmentCatalog
      .map((entry) => `<option value="${entry.id}">${entry.name}</option>`)
      .join('');
  }

  const activeId = roomState?.environmentId || currentEnvironmentId || environmentCatalog[0].id;
  const safeId = environmentById.has(activeId) ? activeId : environmentCatalog[0].id;
  environmentSelect.value = safeId;
  const entry = environmentById.get(safeId);

  if (entry?.preview) {
    environmentPreview.src = entry.preview;
  } else {
    environmentPreview.removeAttribute('src');
  }

  const isHost = roomState?.hostClientId === localClientId;
  environmentSelect.disabled = !roomState || !isHost;
  if (!roomState) {
    environmentStateText.textContent = `Current: ${entry?.name || safeId}`;
  } else if (isHost) {
    environmentStateText.textContent = `Host selected: ${entry?.name || safeId}`;
  } else {
    environmentStateText.textContent = `Host controls background (${entry?.name || safeId})`;
  }
}

function updateNameplates() {
  const seatBids = roomState?.bidBySeat || { 0: '-', 1: '-', 2: '-', 3: '-' };
  const marks = roomState?.gameMarks || { teamA: 0, teamB: 0 };
  const maxMarks = Math.max(marks.teamA || 0, marks.teamB || 0);
  const tied = (marks.teamA || 0) === (marks.teamB || 0);
  const crownTeam = maxMarks > 0 && !tied ? (marks.teamA > marks.teamB ? 'teamA' : 'teamB') : null;
  const localSeat = getLocalSeat();
  const timerRemainingMs = currentTimerRemainingMs();

  for (let seatIndex = 0; seatIndex < 4; seatIndex += 1) {
    const node = document.getElementById(`nameplate-${seatIndex}`);
    const seat = roomState?.seats?.[seatIndex] || {
      seatIndex,
      name: `Seat ${seatIndex + 1}`,
      type: 'human',
      occupantClientId: null
    };

    const active = roomState?.turnSeat === seatIndex;
    const role = seat.type === 'cpu'
      ? `CPU L${seat.cpuLevel ?? 0}`
      : seat.occupantClientId
        ? (seat.occupantClientId === localClientId ? 'YOU' : 'HUMAN')
        : 'OPEN';

    const crown = crownTeam && teamForSeat(seatIndex) === crownTeam ? ' 👑' : '';
    const bidValue = roomState?.phase === PHASES.BIDDING
      ? (seatIndex === localSeat && pendingLocalBidChoice != null ? pendingLocalBidChoice : (seatBids[seatIndex] || 'PASS'))
      : null;
    const bidText = bidValue != null ? ` | Bid: ${bidValue}` : '';
    const teamTag = teamForSeat(seatIndex) === 'teamA' ? 'Team 1' : 'Team 2';
    const timerText = active && roomState?.turnTimerEnabled && timerRemainingMs != null ? ` | TIME ${formatTimerMs(timerRemainingMs)}` : '';
    const canEditName = localSeat === seatIndex && seat.type === 'human';
    const nameSafe = String(seat.name || `Seat ${seatIndex + 1}`).replace(/"/g, '&quot;');

    node.innerHTML = `
      <div class="dragHandle" data-drag-seat="${seatIndex}" title="Drag">MOVE</div>
      <div class="teamTag">${teamTag}</div>
      <div class="seatName">${seat.name || `Seat ${seatIndex + 1}`}${crown}</div>
      <div class="seatMeta">${role}${bidText}${timerText}</div>
      ${canEditName ? `<input class="nameInput" data-seat-name="${seatIndex}" maxlength="24" value="${nameSafe}" />` : ''}
    `;

    node.classList.toggle('active', active);
  }

  updateNameplatePositions();
}

function buildAvatarPickerGrid() {
  avatarGrid.innerHTML = '';
  const selected = localStorage.getItem(AVATAR_STORAGE_KEY) || '';

  avatarCatalog.forEach((entry) => {
    const card = document.createElement('button');
    card.className = `avatarCard${entry.id === selected ? ' active' : ''}`;
    card.type = 'button';
    card.innerHTML = `<div class="avatarName">${entry.name}</div><div class="avatarId">${entry.id}</div>`;
    card.addEventListener('click', () => {
      applyAvatarSelection(entry.id);
    });
    avatarGrid.appendChild(card);
  });
}

function openAvatarModal() {
  const localSeat = getLocalSeat();
  if (localSeat == null) {
    logMessage('Claim a human seat before changing avatar.');
    return;
  }

  avatarPickerStatus.textContent = `Seat ${localSeat + 1}: choose a look`; 
  buildAvatarPickerGrid();
  avatarModal.classList.remove('hidden');
}

function closeAvatarModal() {
  avatarModal.classList.add('hidden');
}

function applyAvatarSelection(avatarId) {
  localStorage.setItem(AVATAR_STORAGE_KEY, avatarId);
  const localSeat = getLocalSeat();
  if (localSeat == null || !roomState?.seats?.[localSeat]) {
    buildAvatarPickerGrid();
    return;
  }

  roomState.seats[localSeat].avatarId = avatarId;
  roomChangingAvatarOptimistic = true;
  renderAvatars();
  renderSeatControls();
  buildAvatarPickerGrid();

  sendAction('player:setAvatar', { avatarId });
}

function renderSeatControls() {
  seatControls.innerHTML = '';
  if (!roomState) return;

  const localSeat = getLocalSeat();
  const isHost = roomState.hostClientId === localClientId;

  roomState.seats.forEach((seat) => {
    const card = document.createElement('div');
    card.className = 'seatCard';

    const typeClass = seat.type === 'cpu' ? 'cpu' : 'human';
    const occupiedByMe = seat.occupantClientId === localClientId;
    const canAvatarEdit = seat.type === 'human' ? occupiedByMe : isHost;
    const canNameEdit = seat.type === 'human' ? occupiedByMe : isHost;
    const currentName = (seat.name || `Seat ${seat.seatIndex + 1}`).slice(0, 24);

    card.innerHTML = `
      <div class="seatTop">
        <div class="seatTitle">Seat ${seat.seatIndex + 1}: ${seat.name || 'Open'}</div>
        <span class="seatBadge ${typeClass}">${seat.type.toUpperCase()}</span>
      </div>
      <div class="seatGrid">
        <button data-action="claim" data-seat="${seat.seatIndex}" ${roomState.phase !== PHASES.LOBBY || seat.occupantClientId ? 'disabled' : ''}>Claim</button>
        <button data-action="release" data-seat="${seat.seatIndex}" ${(roomState.phase !== PHASES.LOBBY || (!occupiedByMe && !isHost) || !seat.occupantClientId) ? 'disabled' : ''}>Release</button>
      </div>
      <div class="controlRow">
        <label>Seat Type</label>
        <select data-action="setType" data-seat="${seat.seatIndex}" ${(!isHost || roomState.phase !== PHASES.LOBBY) ? 'disabled' : ''}>
          <option value="human" ${seat.type === 'human' ? 'selected' : ''}>human</option>
          <option value="cpu" ${seat.type === 'cpu' ? 'selected' : ''}>cpu</option>
        </select>
      </div>
      <div class="controlRow">
        <label>CPU Level</label>
        <select data-action="setCpu" data-seat="${seat.seatIndex}" ${(!isHost || roomState.phase !== PHASES.LOBBY) ? 'disabled' : ''}>
          <option value="0" ${seat.cpuLevel === 0 ? 'selected' : ''}>0</option>
          <option value="1" ${seat.cpuLevel === 1 ? 'selected' : ''}>1</option>
          <option value="2" ${seat.cpuLevel === 2 ? 'selected' : ''}>2</option>
          <option value="3" ${seat.cpuLevel === 3 ? 'selected' : ''}>3</option>
          <option value="4" ${seat.cpuLevel === 4 ? 'selected' : ''}>4</option>
        </select>
      </div>
      <div class="controlRow">
        <label>Avatar</label>
        <select data-action="avatar" data-seat="${seat.seatIndex}" ${canAvatarEdit ? '' : 'disabled'}>
          ${avatarCatalog.map((entry) => `<option value="${entry.id}" ${entry.id === seat.avatarId ? 'selected' : ''}>${entry.name}</option>`).join('')}
        </select>
      </div>
      <div class="controlRow">
        <label>Name</label>
        <input data-action="nameInput" data-seat="${seat.seatIndex}" maxlength="24" value="${currentName.replace(/"/g, '&quot;')}" ${canNameEdit ? '' : 'disabled'} />
        <button data-action="nameSave" data-seat="${seat.seatIndex}" ${canNameEdit ? '' : 'disabled'}>Save Name</button>
      </div>
      <div class="smallText">${seat.occupantClientId ? `Client ${seat.occupantClientId}` : (seat.type === 'cpu' ? 'CPU seat' : 'Unclaimed')}</div>
    `;

    seatControls.appendChild(card);
  });

  seatControls.querySelectorAll('[data-action]').forEach((el) => {
    const action = el.dataset.action;
    const seatIndex = Number(el.dataset.seat);

    if (action === 'claim') {
      el.addEventListener('click', () => {
        sendAction('claimSeat', { seatIndex, name: getStoredPlayerName() });
      });
    }

    if (action === 'release') {
      el.addEventListener('click', () => {
        sendAction('releaseSeat', { seatIndex });
      });
    }

    if (action === 'setType') {
      el.addEventListener('change', () => {
        sendAction('setSeatType', {
          seatIndex,
          type: el.value,
          cpuLevel: roomState.seats[seatIndex].cpuLevel,
          claimForSelf: el.value === 'human',
          name: getStoredPlayerName()
        });
      });
    }

    if (action === 'setCpu') {
      el.addEventListener('change', () => {
        sendAction('setSeatType', {
          seatIndex,
          type: roomState.seats[seatIndex].type,
          cpuLevel: Number(el.value)
        });
      });
    }

    if (action === 'avatar') {
      el.addEventListener('change', () => {
        sendAction('setSeatAvatar', {
          seatIndex,
          avatarId: el.value
        });
      });
    }

    if (action === 'nameSave') {
      el.addEventListener('click', () => {
        const input = seatControls.querySelector(`input[data-action="nameInput"][data-seat="${seatIndex}"]`);
        if (!input) return;
        const name = String(input.value || '').trim().slice(0, 24);
        if (!name) return;
        sendAction('setSeatName', { seatIndex, name });
        const seat = roomState?.seats?.[seatIndex];
        if (seat?.occupantClientId === localClientId && seat.type === 'human') {
          localStorage.setItem(PLAYER_NAME_STORAGE_KEY, name);
        }
      });
    }
  });

  if (localSeat != null) {
    roomStatus.textContent = `Room ${roomState.roomId} | You are seat ${localSeat + 1}${isHost ? ' (Host)' : ''}`;
  } else {
    roomStatus.textContent = roomState ? `Room ${roomState.roomId}${isHost ? ' | Host' : ''}` : '';
  }
}

function getCurrentHighBid() {
  if (!roomState?.bidHistory) return 0;
  return roomState.bidHistory.reduce((max, entry) => {
    if (Number.isInteger(entry.bid) && entry.bid > max) return entry.bid;
    return max;
  }, 0);
}

function updateBidControls() {
  bidButtonsWrap.innerHTML = '';
  const passBtn = document.getElementById('passBidBtn');
  pendingLocalBidChoice = null;

  if (!roomState || roomState.phase !== PHASES.BIDDING) {
    passBtn.disabled = true;
    updateNameplates();
    return;
  }

  const canBid = localTurnToBid();
  passBtn.disabled = !canBid;

  const highBid = getCurrentHighBid();
  for (let bid = 30; bid <= 42; bid += 1) {
    const btn = document.createElement('button');
    btn.textContent = String(bid);
    btn.disabled = !canBid || bid <= highBid;
    btn.addEventListener('mouseenter', () => {
      if (!btn.disabled) {
        pendingLocalBidChoice = bid;
        updateNameplates();
      }
    });
    btn.addEventListener('mouseleave', () => {
      if (pendingLocalBidChoice === bid) {
        pendingLocalBidChoice = null;
        updateNameplates();
      }
    });
    btn.addEventListener('click', () => {
      pendingLocalBidChoice = null;
      sendAction('submitBid', { bid });
      forceClosePanel = true;
      updatePanelAutoBehavior();
    });
    bidButtonsWrap.appendChild(btn);
  }

  passBtn.onclick = () => {
    pendingLocalBidChoice = 'PASS';
    updateNameplates();
    sendAction('submitBid', { bid: null });
    forceClosePanel = true;
    updatePanelAutoBehavior();
  };
}

function updateTrumpControls() {
  trumpButtonsWrap.innerHTML = '';

  const modeButtons = Array.from(modeButtonsWrap.querySelectorAll('button'));
  const canChooseMode = roomState && roomState.phase === PHASES.CHOOSE_MODE && localIsBidder();
  const canChooseTrump = roomState && roomState.phase === PHASES.CHOOSE_TRUMP && localIsBidder() && roomState.mode === MODES.TRUMPS;

  modeButtons.forEach((btn) => {
    const mode = btn.dataset.mode;
    btn.disabled = !canChooseMode;
    btn.classList.toggle('active', roomState?.mode === mode);
    btn.onclick = () => {
      if (!canChooseMode) return;
      sendAction('chooseMode', { mode });
      forceClosePanel = true;
      updatePanelAutoBehavior();
    };
  });

  for (let trump = 0; trump <= 6; trump += 1) {
    const btn = document.createElement('button');
    btn.textContent = String(trump);
    btn.disabled = !canChooseTrump;
    btn.addEventListener('click', () => {
      sendAction('chooseTrump', { trumpSuit: trump });
      forceClosePanel = true;
      updatePanelAutoBehavior();
    });
    trumpButtonsWrap.appendChild(btn);
  }
}

function applyStoredAvatarIfNeeded() {
  if (!roomState || !localClientId) return;
  const localSeat = getLocalSeat();
  if (localSeat == null) return;
  if (storedAvatarAppliedSeat === localSeat) return;

  const desired = localStorage.getItem(AVATAR_STORAGE_KEY);
  if (!desired || !avatarById.has(desired)) {
    storedAvatarAppliedSeat = localSeat;
    return;
  }

  const current = roomState.seats[localSeat]?.avatarId;
  if (current === desired) {
    storedAvatarAppliedSeat = localSeat;
    return;
  }

  roomState.seats[localSeat].avatarId = desired;
  sendAction('player:setAvatar', { avatarId: desired });
  storedAvatarAppliedSeat = localSeat;
}

function applyStoredNameIfNeeded() {
  if (!roomState || !localClientId) return;
  const localSeat = getLocalSeat();
  if (localSeat == null) return;
  if (storedNameAppliedSeat === localSeat) return;

  const desired = getStoredPlayerName();
  if (!desired) {
    storedNameAppliedSeat = localSeat;
    return;
  }

  const current = String(roomState.seats[localSeat]?.name || '').trim();
  if (current === desired) {
    storedNameAppliedSeat = localSeat;
    return;
  }

  sendAction('setSeatName', { seatIndex: localSeat, name: desired });
  storedNameAppliedSeat = localSeat;
}

function applySnapshot(room) {
  const prevPhase = roomState?.phase || null;
  const prevLocalSeat = lastLocalSeat;
  roomState = room;

  const newLocalSeat = getLocalSeat();
  lastLocalSeat = newLocalSeat;
  if (prevLocalSeat !== newLocalSeat) {
    storedAvatarAppliedSeat = null;
    storedNameAppliedSeat = null;
    updateSeatTransforms();
    resetViewForLocalSeat(true);
  }

  if (selectedDominoTileId && newLocalSeat != null) {
    const myHand = roomState.hands?.[newLocalSeat] || [];
    if (!myHand.some((tile) => tile.id === selectedDominoTileId)) {
      selectedDominoTileId = null;
    }
  }

  if (roomState.phase === PHASES.PLAYING && prevPhase !== PHASES.PLAYING) {
    resetViewForLocalSeat(true);
  }

  applyStoredAvatarIfNeeded();
  applyStoredNameIfNeeded();
  applyEnvironment(roomState.environmentId || 'default_lounge');
  if (roomState.timeoutPenalty && Number.isInteger(roomState.timeoutPenalty.seat)) {
    showTimeoutPenaltyEmoji(
      roomState.timeoutPenalty.seat,
      roomState.timeoutPenalty.emoji || '🤡',
      Number(roomState.timeoutPenalty.remainingMs || roomState.timeoutPenalty.durationMs || 3000),
      roomState.timeoutPenalty.activeTurnId ?? null
    );
  }
  updatePanelAutoBehavior();
  showSections();
  updateHud();
  updateNameplates();
  renderSeatControls();
  updateBidControls();
  updateTrumpControls();
  renderHandsAndTrick();
  renderAvatars();
  roomChangingAvatarOptimistic = false;
}

function sendAction(action, payload = {}) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    logMessage('Socket not connected.');
    return;
  }
  ws.send(JSON.stringify({ action, payload }));
}

function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${protocol}://${window.location.host}`);

  ws.addEventListener('open', () => {
    logMessage('Connected', 1300);
  });

  ws.addEventListener('close', () => {
    roomState = null;
    localClientId = null;
    lastLocalSeat = null;
    clearTimeoutPenaltyEmojis();
    applyEnvironment('default_lounge');
    updateHud();
    showSections();
    setPanelOpen(true);
    renderHandsAndTrick();
    updateNameplates();
    renderAvatars();
    resetViewForLocalSeat(true);
  });

  ws.addEventListener('message', (event) => {
    let data = null;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }

    if (data.type === 'welcome') {
      localClientId = data.clientId;
      roomStatus.textContent = `Connected as ${localClientId}`;
      return;
    }

    if (data.type === 'roomCreated') {
      roomIdInput.value = data.roomId;
      logMessage(`Room ${data.roomId} created`);
      return;
    }

    if (data.type === 'player:update') {
      if (!roomState || !Number.isInteger(data.seatIndex)) return;
      const seat = roomState.seats?.[data.seatIndex];
      if (!seat) return;
      if (data.avatarId != null) seat.avatarId = data.avatarId;
      if (typeof data.name === 'string') seat.name = data.name;
      renderAvatars();
      updateNameplates();
      renderSeatControls();
      return;
    }

    if (data.type === 'game:timerUpdate') {
      if (!roomState) return;
      roomState.turnTimerEnabled = !!data.turnTimerEnabled;
      roomState.turnTimerPaused = !!data.turnTimerPaused;
      roomState.turnTimeLimitMs = Number(data.turnTimeLimitMs || 60000);
      roomState.turnDeadlineTs = data.turnDeadlineTs == null ? null : Number(data.turnDeadlineTs);
      roomState.turnRemainingMs = Number(data.remainingMs ?? roomState.turnRemainingMs ?? roomState.turnTimeLimitMs);
      roomState.activeTurnId = Number(data.activeTurnId ?? roomState.activeTurnId ?? 0);
      updateTimerControls();
      return;
    }

    if (data.type === 'game:autoMove') {
      if (Number.isInteger(data.seat)) {
        logMessage(`Seat ${Number(data.seat) + 1} auto-played on timeout.`);
      }
      return;
    }

    if (data.type === 'game:timeoutPenalty') {
      if (Number.isInteger(data.seat)) {
        showTimeoutPenaltyEmoji(
          data.seat,
          data.emoji || '🤡',
          Number(data.durationMs || 3000),
          data.activeTurnId ?? null
        );
      }
      return;
    }

    if (data.type === 'game:environmentChanged') {
      if (!roomState) return;
      roomState.environmentId = data.environmentId || roomState.environmentId;
      applyEnvironment(roomState.environmentId || 'default_lounge');
      updateEnvironmentControls();
      return;
    }

    if (data.type === 'snapshot') {
      applySnapshot(data.room);
      return;
    }

    if (data.type === 'error') {
      if (roomChangingAvatarOptimistic) {
        roomChangingAvatarOptimistic = false;
      }
      logMessage(data.message || 'Action rejected', 3300);
      return;
    }

    if (data.type === 'info') {
      logMessage(data.message || 'Info');
    }
  });
}

function initHdrEnvironment() {
  const fallbackEnv = () => {
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.05).texture;
    scene.environment = envTex;
  };

  new RGBELoader().load(
    '/assets/hdr/warm_interior_01.hdr',
    (texture) => {
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;
      scene.environment = envMap;
      texture.dispose();
    },
    undefined,
    fallbackEnv
  );
}

function ensureButtons() {
  document.getElementById('createRoomBtn').addEventListener('click', () => {
    sendAction('createRoom', { roomId: roomIdInput.value.trim() || undefined });
  });

  document.getElementById('joinRoomBtn').addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    if (!roomId) {
      logMessage('Enter room ID first.');
      return;
    }
    sendAction('joinRoom', { roomId });
  });

  document.getElementById('leaveRoomBtn').addEventListener('click', () => {
    sendAction('leaveRoom');
    roomState = null;
    clearTimeoutPenaltyEmojis();
    applyEnvironment('default_lounge');
    showSections();
    renderHandsAndTrick();
    updateNameplates();
    renderAvatars();
    resetViewForLocalSeat(true);
  });

  document.getElementById('startGameBtn').addEventListener('click', () => {
    sendAction('startGame');
  });

  document.getElementById('restartGameBtn').addEventListener('click', () => {
    sendAction('restartGame');
  });

  resetViewBtn.addEventListener('click', () => {
    resetViewForLocalSeat(true);
  });

  timerEnabledToggle.addEventListener('change', () => {
    sendAction('host:timerEnable', { enabled: !!timerEnabledToggle.checked });
  });

  timerPauseBtn.addEventListener('click', () => {
    if (!roomState) return;
    sendAction('host:timerPause', { paused: !roomState.turnTimerPaused });
  });

  environmentSelect.addEventListener('change', () => {
    const environmentId = environmentSelect.value;
    if (!roomState || roomState.hostClientId !== localClientId) return;
    if (!environmentById.has(environmentId)) return;
    sendAction('host:setEnvironment', { environmentId });
  });

  panelToggle.addEventListener('click', () => {
    setPanelOpen(!panelOpen);
  });

  closePanelBtn.addEventListener('click', () => {
    setPanelOpen(false);
  });

  changeAvatarBtn.addEventListener('click', () => {
    openAvatarModal();
  });

  avatarModalBackdrop.addEventListener('click', closeAvatarModal);
  closeAvatarModalBtn.addEventListener('click', closeAvatarModal);

  const nameplatesWrap = document.getElementById('nameplates');
  nameplatesWrap.addEventListener('pointerdown', (event) => {
    const handle = event.target.closest('.dragHandle');
    if (!handle) return;
    const seatIndex = Number(handle.dataset.dragSeat);
    if (!Number.isInteger(seatIndex)) return;
    beginNameplateDrag(seatIndex, event.pointerId, event.clientX, event.clientY);
    event.preventDefault();
  });

  nameplatesWrap.addEventListener('change', (event) => {
    const input = event.target.closest('.nameInput');
    if (!input) return;
    const seatIndex = Number(input.dataset.seatName);
    if (!Number.isInteger(seatIndex)) return;
    const name = String(input.value || '').trim().slice(0, 24);
    if (!name) return;
    sendAction('setSeatName', { seatIndex, name });
    if (roomState?.seats?.[seatIndex]?.occupantClientId === localClientId) {
      localStorage.setItem(PLAYER_NAME_STORAGE_KEY, name);
    }
  });

  nameplatesWrap.addEventListener('keydown', (event) => {
    const input = event.target.closest('.nameInput');
    if (!input) return;
    if (event.key === 'Enter') {
      input.blur();
    }
  });

  window.addEventListener('pointermove', (event) => {
    if (draggingNameplateSeat == null) return;
    if (draggingPointerId != null && event.pointerId !== draggingPointerId) return;
    updateDraggedNameplate(event.clientX, event.clientY);
  });

  window.addEventListener('pointerup', (event) => {
    if (draggingPointerId != null && event.pointerId !== draggingPointerId) return;
    endNameplateDrag();
  });

  window.addEventListener('pointercancel', endNameplateDrag);

  window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'd' && event.shiftKey) {
      debugVisible = !debugVisible;
      debugPlane.visible = debugVisible;
      axesHelper.visible = debugVisible;
      logMessage(`Debug ${debugVisible ? 'on' : 'off'}`);
    }

    if (event.key === 'Escape' && !avatarModal.classList.contains('hidden')) {
      closeAvatarModal();
    }
  });
}

function addPointerInteraction() {
  const applyVisualState = (mesh, { hovered, selected }) => {
    if (!mesh?.isMesh) return;
    const targetY = DOMINO_Y + (selected ? 0.1 : hovered ? 0.045 : 0);
    mesh.position.y = targetY;
    const topMat = Array.isArray(mesh.material) ? mesh.material[2] : null;
    if (topMat?.emissive) {
      if (selected) {
        topMat.emissive.setHex(0x5a4b1f);
        topMat.emissiveIntensity = 0.75;
      } else if (hovered) {
        topMat.emissive.setHex(0x2a2412);
        topMat.emissiveIntensity = 0.45;
      } else {
        topMat.emissive.setHex(0x000000);
        topMat.emissiveIntensity = 0;
      }
    }
  };

  const refreshHandVisuals = () => {
    handGroup.traverse((obj) => {
      if (!obj.isMesh || !obj.userData?.clickable) return;
      const hovered = obj === hoveredDominoMesh;
      const selected = selectedDominoTileId && obj.userData?.tileId === selectedDominoTileId;
      applyVisualState(obj, { hovered, selected });
    });
  };

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(handGroup.children, true);
    const hit = intersects.find((entry) => entry.object?.userData?.clickable);
    hoveredDominoMesh = hit?.object || null;
    refreshHandVisuals();
  });

  canvas.addEventListener('pointerleave', () => {
    hoveredDominoMesh = null;
    refreshHandVisuals();
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (!roomState) return;

    const localSeat = getLocalSeat();
    if (localSeat == null) return;

    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(handGroup.children, true);
    const selected = intersects.find((hit) => hit.object?.userData?.clickable);
    if (!selected) return;

    const pickedId = selected.object.userData.tileId;
    if (!pickedId) return;
    selectedDominoTileId = pickedId;
    refreshHandVisuals();

    if (!isMyTurnToPlay() || roomState.turnSeat !== localSeat) {
      logMessage('Not your turn yet.');
      return;
    }

    event.preventDefault();
    sendAction('playTile', { tileId: pickedId });
  });

  handGroup.userData.refreshSelection = refreshHandVisuals;
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  controls.update();
  updatePenaltyEmojiPositions();
}

function animate() {
  requestAnimationFrame(animate);
  clock.getDelta();
  controls.update();
  updateNameplatePositions();
  updatePenaltyEmojiPositions();
  updateTimerHud();
  renderer.render(scene, camera);
}

async function loadAvatarManifest() {
  const fallback = async () => {
    const res = await fetch('/assets/avatars/avatars.json', { cache: 'no-cache' });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .filter((entry) => entry?.id && entry?.url && !entry.url.includes('._'))
      .map((entry) => ({ id: entry.id, name: entry.label || entry.id, file: entry.url }));
  };

  let entries = [];
  try {
    const res = await fetch('/assets/avatars/manifest.json', { cache: 'no-cache' });
    if (!res.ok) {
      entries = await fallback();
    } else {
      const data = await res.json();
      if (!Array.isArray(data)) {
        entries = await fallback();
      } else {
        entries = data
          .filter((entry) => entry?.id && entry?.file && !entry.file.includes('._'))
          .map((entry) => ({
            id: String(entry.id),
            name: String(entry.name || entry.id),
            file: String(entry.file)
          }));
      }
    }
  } catch {
    entries = await fallback();
  }

  avatarCatalog.length = 0;
  avatarById.clear();

  entries.forEach((entry) => {
    avatarCatalog.push(entry);
    avatarById.set(entry.id, entry);
  });

  if (avatarCatalog.length > 0 && !avatarById.has(DEFAULT_AVATAR_ID)) {
    const first = avatarCatalog[0].id;
    avatarById.set(DEFAULT_AVATAR_ID, avatarById.get(first));
  }

  buildAvatarPickerGrid();
}

async function loadEnvironmentManifest() {
  let entries = [];
  try {
    const res = await fetch('/assets/environments/environments.json', { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        entries = data
          .filter((entry) => entry?.id)
          .map((entry) => ({
            id: String(entry.id),
            name: String(entry.name || entry.id),
            preview: entry.preview ? String(entry.preview) : ''
          }));
      }
    }
  } catch {
    entries = [];
  }

  if (!entries.length) {
    entries = Object.keys(ENV_THEME_PRESETS).map((id) => ({
      id,
      name: id.replace(/_/g, ' '),
      preview: ''
    }));
  }

  environmentCatalog.length = 0;
  environmentById.clear();
  entries.forEach((entry) => {
    environmentCatalog.push(entry);
    environmentById.set(entry.id, entry);
  });
  if (!environmentById.has('default_lounge') && environmentCatalog.length) {
    const first = environmentCatalog[0];
    environmentById.set('default_lounge', first);
  }

  updateEnvironmentControls();
  const targetEnv = roomState?.environmentId || 'default_lounge';
  applyEnvironment(targetEnv);
}

window.addEventListener('resize', onResize);

initHdrEnvironment();
ensureButtons();
addPointerInteraction();
showSections();
setPanelOpen(true);
updateScoreboard();
updateTimerControls();
updateTimerHud();
updateEnvironmentControls();
resetViewForLocalSeat(true);
connect();

Promise.all([loadAvatarManifest(), loadEnvironmentManifest(), loadEnvironmentModels()])
  .then(() => {
    renderSeatControls();
    renderAvatars();
  })
  .catch(() => {
    // Keep running with runtime fallbacks.
  });

updateNameplates();
animate();
