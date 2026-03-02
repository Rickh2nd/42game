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
import { emitSafe, getSocket, getSocketInfo, isConnected, probeHealth, socket } from '/src/net/socket.js';

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
const DOMINO_LONG = 0.056;
const DOMINO_SHORT = 0.029;
const DOMINO_THICKNESS = 0.011;
const DOMINO_TILE_THICKNESS = 0.0014;
const DOMINO_SCALE = 1.0;
const DOMINO_Y = PLAY_PLANE_Y + DOMINO_THICKNESS / 2;

const DEFAULT_AVATAR_ID = 'cowboy_male';
const AVATAR_STORAGE_KEY = 'avatarId';
const PLAYER_NAME_STORAGE_KEY = 'playerName';
const VIEW_STORAGE_KEY = 'texas42_view_settings_v1';
const SCENE_TUNING_STORAGE_KEY = 'texas42_scene_tuning_v1';
const CHAIRS_VISIBLE_STORAGE_KEY = 'texas42_chairs_visible_v1';
const BURN_PANEL_OPACITY_STORAGE_KEY = 'texas42_burn_panel_opacity_v1';
const PLAYER_ID_STORAGE_KEY = 'texas42_player_id';
const CLIENT_VERSION = '1.0.0';

const canvas = document.getElementById('gameCanvas');
const panel = document.getElementById('sidePanel');
const panelToggle = document.getElementById('panelToggle');
const closePanelBtn = document.getElementById('closePanelBtn');
const changeAvatarBtn = document.getElementById('changeAvatarBtn');
const roomIdInput = document.getElementById('roomIdInput');
const roomStatus = document.getElementById('roomStatus');
const eventLog = document.getElementById('eventLog');
const socketStatusBadge = document.getElementById('socketStatusBadge');
const seatControls = document.getElementById('seatControls');
const hudBidValue = document.getElementById('hudBidValue');
const hudTrumpValue = document.getElementById('hudTrumpValue');
const turnTimerHud = document.getElementById('turnTimerHud');
const timerEnabledToggle = document.getElementById('timerEnabledToggle');
const timerPauseBtn = document.getElementById('timerPauseBtn');
const timerStateText = document.getElementById('timerStateText');
const resetViewBtn = document.getElementById('resetViewBtn');
const copyViewBtn = document.getElementById('copyViewBtn');
const resetSceneTuningBtn = document.getElementById('resetSceneTuningBtn');
const copySceneTuningBtn = document.getElementById('copySceneTuningBtn');
const chairsVisibleToggle = document.getElementById('chairsVisibleToggle');
const debugTableBoundsToggle = document.getElementById('debugTableBoundsToggle');
const spawnTestDominoBtn = document.getElementById('spawnTestDominoBtn');
const tableDominoDebugReadout = document.getElementById('tableDominoDebugReadout');
const environmentSelect = document.getElementById('environmentSelect');
const environmentPreview = document.getElementById('environmentPreview');
const environmentStateText = document.getElementById('environmentStateText');
const environmentLoadText = document.getElementById('environmentLoadText');
const burnPanelOpacityInput = document.getElementById('burn_panel_opacity');
const burnPanelOpacityValue = document.getElementById('burn_panel_opacity_val');
const emojiOverlays = document.getElementById('emojiOverlays');
const networkStatusValue = document.getElementById('networkStatusValue');
const networkUrlValue = document.getElementById('networkUrlValue');
const networkPathValue = document.getElementById('networkPathValue');
const networkSocketIdValue = document.getElementById('networkSocketIdValue');
const networkTransportValue = document.getElementById('networkTransportValue');
const networkLastConnectValue = document.getElementById('networkLastConnectValue');
const networkLastDisconnectValue = document.getElementById('networkLastDisconnectValue');
const networkLastErrorValue = document.getElementById('networkLastErrorValue');
const networkHealthValue = document.getElementById('networkHealthValue');
const pingServerBtn = document.getElementById('pingServerBtn');
const reconnectNowBtn = document.getElementById('reconnectNowBtn');

const sectionRoom = document.getElementById('section-room');
const sectionPlayers = document.getElementById('section-players');
const sectionGame = document.getElementById('section-game');
const sectionBidding = document.getElementById('section-bidding');
const sectionTrump = document.getElementById('section-trump');
const sectionMarks = document.getElementById('section-marks');
const sectionView = document.getElementById('section-view');
const sectionSceneTuning = document.getElementById('section-scene-tuning');
const sectionDebugTable = document.getElementById('section-debug-table');

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

const burnPanelDom = {
  teamA: {
    title: document.getElementById('burn-title-team1'),
    stats: document.getElementById('burn-stats-team1'),
    stack: document.getElementById('burn-hands-team1') || document.getElementById('burn-row-team1'),
    footer: document.getElementById('burn-footer-team1')
  },
  teamB: {
    title: document.getElementById('burn-title-team2'),
    stats: document.getElementById('burn-stats-team2'),
    stack: document.getElementById('burn-hands-team2') || document.getElementById('burn-row-team2'),
    footer: document.getElementById('burn-footer-team2')
  }
};

const viewInputs = {
  distance: document.getElementById('view_distance'),
  height: document.getElementById('view_height'),
  forward: document.getElementById('view_forward'),
  shoulder: document.getElementById('view_shoulder'),
  lookAtY: document.getElementById('view_lookat_y'),
  fov: document.getElementById('view_fov'),
  pitchDeg: document.getElementById('view_pitch_deg'),
  near: document.getElementById('view_near'),
  handY: document.getElementById('hand_y'),
  handZ: document.getElementById('hand_z'),
  handDominoScale: document.getElementById('hand_domino_scale'),
  handDominoRotDeg: document.getElementById('hand_domino_rot_deg'),
  tableDominoScale: document.getElementById('table_domino_scale')
};

const viewValueLabels = {
  distance: document.getElementById('view_distance_val'),
  height: document.getElementById('view_height_val'),
  forward: document.getElementById('view_forward_val'),
  shoulder: document.getElementById('view_shoulder_val'),
  lookAtY: document.getElementById('view_lookat_y_val'),
  fov: document.getElementById('view_fov_val'),
  pitchDeg: document.getElementById('view_pitch_deg_val'),
  near: document.getElementById('view_near_val'),
  handY: document.getElementById('hand_y_val'),
  handZ: document.getElementById('hand_z_val'),
  handDominoScale: document.getElementById('hand_domino_scale_val'),
  handDominoRotDeg: document.getElementById('hand_domino_rot_deg_val'),
  tableDominoScale: document.getElementById('table_domino_scale_val')
};

const sceneTuneInputs = {
  tableScale: document.getElementById('tune_table_scale'),
  chairScale: document.getElementById('tune_chair_scale'),
  avatarScale: document.getElementById('tune_avatar_scale'),
  seatRadius: document.getElementById('tune_seat_radius'),
  avatarBack: document.getElementById('tune_avatar_back'),
  avatarY: document.getElementById('tune_avatar_y'),
  chairY: document.getElementById('tune_chair_y'),
  tableY: document.getElementById('tune_table_y')
};

const sceneTuneLabels = {
  tableScale: document.getElementById('tune_table_scale_val'),
  chairScale: document.getElementById('tune_chair_scale_val'),
  avatarScale: document.getElementById('tune_avatar_scale_val'),
  seatRadius: document.getElementById('tune_seat_radius_val'),
  avatarBack: document.getElementById('tune_avatar_back_val'),
  avatarY: document.getElementById('tune_avatar_y_val'),
  chairY: document.getElementById('tune_chair_y_val'),
  tableY: document.getElementById('tune_table_y_val')
};

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
controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
controls.target.set(0, 0.78, 0);

const visualsGroup = new THREE.Group();
visualsGroup.name = 'visualsGroup';
scene.add(visualsGroup);

const tableRoot = new THREE.Group();
tableRoot.name = 'tableRoot';
visualsGroup.add(tableRoot);

const chairsRoot = new THREE.Group();
chairsRoot.name = 'chairsRoot';
tableRoot.add(chairsRoot);

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

const tablePlayRoot = new THREE.Group();
tablePlayRoot.name = 'tablePlayRoot';
scene.add(tablePlayRoot);

const burnGroupA = new THREE.Group();
const burnGroupB = new THREE.Group();
oppHandGroup.add(burnGroupA);
oppHandGroup.add(burnGroupB);

const chairSeatGroups = [0, 1, 2, 3].map(() => {
  const g = new THREE.Group();
  chairsRoot.add(g);
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

const dominoGeometry = new RoundedBoxGeometry(DOMINO_LONG, DOMINO_THICKNESS, DOMINO_SHORT, 4, 0.0035);
const dominoTileGeometry = new THREE.PlaneGeometry(DOMINO_SHORT, DOMINO_LONG, 1, 1);
dominoTileGeometry.rotateX(-Math.PI / 2);
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
const environmentTextureCache = new Map();
const environmentFileCatalogCache = new Map();
const environmentHdriCache = new Map();
const textureLoader = new THREE.TextureLoader();
const environmentTemplates = {
  table: null,
  chair: null
};
const tableMetrics = {
  topY: PLAY_PLANE_Y,
  floorY: 0,
  radius: 2.9
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
const tmpV3E = new THREE.Vector3();
const tmpBox = new THREE.Box3();

const avatarCatalog = [];
const avatarById = new Map();
const environmentCatalog = [];
const environmentById = new Map();
let currentEnvironmentId = null;
let environmentApplyToken = 0;
let environmentLoadState = 'idle';
let environmentLoadDetail = '';

const timeoutPenaltyBySeat = new Map();
const tempV3C = new THREE.Vector3();
const tempV3D = new THREE.Vector3();

const DEFAULT_VIEW_SETTINGS = {
  distance: 1.85,
  height: 1.24,
  forward: -0.08,
  shoulder: 0.19,
  lookAtY: 0.78,
  fov: 47,
  pitchDeg: -2.5,
  near: 0.08,
  handY: 0.02,
  handZ: 0.0,
  handDominoScale: 1.0,
  handDominoRotDeg: 0,
  tableDominoScale: 1.0
};

const viewSettings = { ...DEFAULT_VIEW_SETTINGS };

const DEFAULT_SCENE_TUNING = {
  tableScale: 1.46,
  chairScale: 1.0,
  avatarScale: 1.0,
  seatRadius: 3.12,
  avatarBack: 0.0,
  avatarY: 0.0,
  chairY: 0.0,
  tableY: 0.0
};

const sceneTuning = { ...DEFAULT_SCENE_TUNING };
const DEFAULT_BURN_PANEL_OPACITY = 0.55;
let burnPanelOpacity = DEFAULT_BURN_PANEL_OPACITY;

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
let socketStatus = 'connecting';
let socketUrl = window.location.origin;
let socketPath = '/socket.io';
let socketId = '';
let socketTransport = '';
let socketLastError = '';
let networkLastConnectAt = null;
let networkLastDisconnectReason = '';
let socketHandlersBound = false;
let lastDisconnectedToastAt = 0;
let socketInfoPollTimer = null;
let healthPollTimer = null;
let chairsVisible = true;
let showTableDominoBounds = false;
localClientId = localStorage.getItem(PLAYER_ID_STORAGE_KEY) || null;

const localHandScreenBounds = {
  valid: false,
  minX: 0,
  maxX: 0,
  minY: 0,
  maxY: 0
};

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

function formatNetworkTime(ts) {
  if (!Number.isFinite(ts)) return '—';
  return new Date(ts).toLocaleTimeString();
}

function updateSocketUi() {
  const status = socketStatus;
  const connected = status === 'connected';
  const statusLabel = connected ? 'Connected' : status === 'connecting' ? 'Connecting' : 'Disconnected';
  const statusClass = connected ? 'connected' : status === 'connecting' ? 'connecting' : 'disconnected';

  if (socketStatusBadge) {
    socketStatusBadge.textContent = statusLabel;
    socketStatusBadge.classList.remove('connected', 'connecting', 'disconnected');
    socketStatusBadge.classList.add(statusClass);
  }

  if (networkStatusValue) {
    networkStatusValue.textContent = statusLabel;
    networkStatusValue.classList.remove('connected', 'connecting', 'disconnected');
    networkStatusValue.classList.add(statusClass);
  }
  if (networkUrlValue) {
    networkUrlValue.textContent = socketUrl || window.location.origin;
  }
  if (networkPathValue) {
    networkPathValue.textContent = socketPath || '/socket.io';
  }
  if (networkSocketIdValue) {
    networkSocketIdValue.textContent = socketId || '—';
  }
  if (networkTransportValue) {
    networkTransportValue.textContent = socketTransport || '—';
  }
  if (networkLastConnectValue) {
    networkLastConnectValue.textContent = formatNetworkTime(networkLastConnectAt);
  }
  if (networkLastDisconnectValue) {
    networkLastDisconnectValue.textContent = networkLastDisconnectReason || '—';
  }
  if (networkLastErrorValue) {
    networkLastErrorValue.textContent = socketLastError || '—';
    networkLastErrorValue.title = socketLastError || '';
  }
  if (reconnectNowBtn) {
    reconnectNowBtn.disabled = connected;
  }
  if (pingServerBtn) {
    pingServerBtn.disabled = !connected;
  }

  const connectionOnlyControls = [
    'createRoomBtn',
    'joinRoomBtn',
    'leaveRoomBtn',
    'startGameBtn',
    'restartGameBtn',
    'changeAvatarBtn'
  ];
  for (const id of connectionOnlyControls) {
    const node = document.getElementById(id);
    if (!node) continue;
    node.disabled = !connected;
  }
}

async function runNetworkHealthProbe() {
  const result = await probeHealth(3500);
  if (!networkHealthValue) return;
  if (result.ok) {
    networkHealthValue.textContent = `ok (${result.status})`;
    networkHealthValue.classList.remove('fail');
    networkHealthValue.classList.add('ok');
  } else {
    networkHealthValue.textContent = `unreachable (${result.status || 'ERR'})`;
    networkHealthValue.classList.remove('ok');
    networkHealthValue.classList.add('fail');
  }
  networkHealthValue.title = result.url || '';
}

function syncSocketInfoFromSingleton() {
  const info = getSocketInfo();
  socketStatus = info.status || (info.connected ? 'connected' : 'disconnected');
  socketUrl = info.url || window.location.origin;
  socketPath = info.path || '/socket.io';
  socketId = info.id || '';
  socketTransport = info.transport || '';
  socketLastError = info.lastError || '';
  updateSocketUi();
}

function startSocketInfoPolling() {
  if (socketInfoPollTimer) {
    clearInterval(socketInfoPollTimer);
  }
  syncSocketInfoFromSingleton();
  socketInfoPollTimer = setInterval(() => {
    syncSocketInfoFromSingleton();
  }, 350);

  if (healthPollTimer) {
    clearInterval(healthPollTimer);
  }
  runNetworkHealthProbe();
  healthPollTimer = setInterval(runNetworkHealthProbe, 10000);
}

function emitWithAckTimeout(event, payload, timeoutMs = 3000) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, message: 'Request timed out.' });
    }, timeoutMs);

    socket.emit(event, payload, (ack) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (ack && typeof ack === 'object') {
        resolve(ack);
      } else {
        resolve({ ok: false, message: 'Invalid server ack.' });
      }
    });
  });
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

function loadStoredViewSettings() {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    for (const key of Object.keys(DEFAULT_VIEW_SETTINGS)) {
      if (Number.isFinite(Number(parsed[key]))) {
        viewSettings[key] = Number(parsed[key]);
      }
    }
  } catch {
    // ignore invalid stored view payload
  }
}

function persistViewSettings() {
  localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({
    distance: Number(viewSettings.distance),
    height: Number(viewSettings.height),
    forward: Number(viewSettings.forward),
    shoulder: Number(viewSettings.shoulder),
    lookAtY: Number(viewSettings.lookAtY),
    fov: Number(viewSettings.fov),
    pitchDeg: Number(viewSettings.pitchDeg),
    near: Number(viewSettings.near),
    handY: Number(viewSettings.handY),
    handZ: Number(viewSettings.handZ),
    handDominoScale: Number(viewSettings.handDominoScale),
    handDominoRotDeg: Number(viewSettings.handDominoRotDeg),
    tableDominoScale: Number(viewSettings.tableDominoScale)
  }));
}

function loadStoredSceneTuning() {
  try {
    const raw = localStorage.getItem(SCENE_TUNING_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    for (const key of Object.keys(DEFAULT_SCENE_TUNING)) {
      if (Number.isFinite(Number(parsed[key]))) {
        sceneTuning[key] = Number(parsed[key]);
      }
    }
  } catch {
    // ignore invalid scene tuning payload
  }
}

function persistSceneTuning() {
  localStorage.setItem(SCENE_TUNING_STORAGE_KEY, JSON.stringify({
    tableScale: Number(sceneTuning.tableScale),
    chairScale: Number(sceneTuning.chairScale),
    avatarScale: Number(sceneTuning.avatarScale),
    seatRadius: Number(sceneTuning.seatRadius),
    avatarBack: Number(sceneTuning.avatarBack),
    avatarY: Number(sceneTuning.avatarY),
    chairY: Number(sceneTuning.chairY),
    tableY: Number(sceneTuning.tableY)
  }));
}

function loadStoredChairVisibility() {
  const raw = localStorage.getItem(CHAIRS_VISIBLE_STORAGE_KEY);
  if (raw == null) {
    chairsVisible = true;
    return;
  }
  chairsVisible = raw !== '0';
}

function persistChairVisibility() {
  localStorage.setItem(CHAIRS_VISIBLE_STORAGE_KEY, chairsVisible ? '1' : '0');
}

function sanitizeBurnPanelOpacity(value) {
  return clampValue(value, 0.05, 0.95, DEFAULT_BURN_PANEL_OPACITY);
}

function applyBurnPanelOpacity(value, { persist = false } = {}) {
  burnPanelOpacity = sanitizeBurnPanelOpacity(value);
  document.documentElement.style.setProperty('--burnPanelBgAlpha', burnPanelOpacity.toFixed(2));
  if (burnPanelOpacityInput) {
    burnPanelOpacityInput.value = burnPanelOpacity.toFixed(2);
  }
  if (burnPanelOpacityValue) {
    burnPanelOpacityValue.textContent = burnPanelOpacity.toFixed(2);
  }
  if (persist) {
    localStorage.setItem(BURN_PANEL_OPACITY_STORAGE_KEY, burnPanelOpacity.toFixed(2));
  }
}

function loadStoredBurnPanelOpacity() {
  const raw = localStorage.getItem(BURN_PANEL_OPACITY_STORAGE_KEY);
  if (raw == null) {
    applyBurnPanelOpacity(DEFAULT_BURN_PANEL_OPACITY);
    return;
  }
  applyBurnPanelOpacity(raw);
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
  casino_lounge: {
    top: '#5c4536',
    bottom: '#1d1612',
    key: { color: 0xffd7a1, intensity: 1.08, pos: [4.2, 7.1, 4.3] },
    fill: { color: 0x8ea9c8, intensity: 0.24, pos: [-5.7, 5.4, -4.1] },
    rim: { color: 0xf3be86, intensity: 0.18, pos: [0, 4.4, -7.2] },
    ambient: { sky: 0xf0e4d1, ground: 0x2f241c, intensity: 0.46 },
    fog: { color: '#211913', near: 26, far: 72 }
  },
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

const wallpaperTexture = makeNoiseTexture(1024, (ctx, size) => {
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#7a5b47');
  grad.addColorStop(1, '#5e4638');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(222, 197, 147, 0.18)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= size; x += size / 8) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  for (let i = 0; i < 1800; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const alpha = 0.02 + Math.random() * 0.05;
    ctx.fillStyle = `rgba(26, 16, 9, ${alpha})`;
    ctx.fillRect(x, y, 2, 2);
  }
});
wallpaperTexture.repeat.set(4, 2.5);

const carpetTexture = makeNoiseTexture(1024, (ctx, size) => {
  ctx.fillStyle = '#3c2f2a';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 12000; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const t = 65 + Math.floor(Math.random() * 40);
    ctx.fillStyle = `rgba(${t}, ${t - 10}, ${t - 12}, ${0.08 + Math.random() * 0.16})`;
    ctx.fillRect(x, y, 1, 1);
  }
});
carpetTexture.repeat.set(9, 9);

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
  const sizeX = Math.max(0.1, tmpBox.max.x - tmpBox.min.x);
  const sizeZ = Math.max(0.1, tmpBox.max.z - tmpBox.min.z);
  tableMetrics.radius = Math.max(1.8, Math.min(sizeX, sizeZ) * 0.48);
  updateViewControlsUi();
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

function refreshLocalHandScreenBounds() {
  localHandScreenBounds.valid = false;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const screen = { x: 0, y: 0 };

  handGroup.traverse((node) => {
    if (!node?.isMesh || !node.userData?.clickable) return;
    tmpV3A.setFromMatrixPosition(node.matrixWorld);
    projectWorldToScreen(tmpV3A, screen);
    // Approximate tile footprint in pixels to guard nameplate overlap.
    const padX = 62;
    const padY = 44;
    minX = Math.min(minX, screen.x - padX);
    minY = Math.min(minY, screen.y - padY);
    maxX = Math.max(maxX, screen.x + padX);
    maxY = Math.max(maxY, screen.y + padY);
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return;
  }

  localHandScreenBounds.valid = true;
  localHandScreenBounds.minX = minX;
  localHandScreenBounds.minY = minY;
  localHandScreenBounds.maxX = maxX;
  localHandScreenBounds.maxY = maxY;
}

function updateNameplatePositions() {
  const localSeat = getLocalSeat();
  const screen = { x: 0, y: 0 };
  const handScreen = { x: 0, y: 0 };
  refreshLocalHandScreenBounds();

  for (let seatIndex = 0; seatIndex < 4; seatIndex += 1) {
    const rel = toRelativeSeat(seatIndex, localSeat);
    const node = document.getElementById(`nameplate-${seatIndex}`);
    if (!node) continue;

    getSeatHeadWorld(seatIndex, tmpV3B);
    tmpV3B.y += 0.18;
    projectWorldToScreen(tmpV3B, screen);

    let x = screen.x + nameplateOffsets[seatIndex].x;
    let y = screen.y + nameplateOffsets[seatIndex].y;

    if (seatIndex === localSeat && localHandScreenBounds.valid) {
      const npHalfW = 132;
      const npHalfH = 46;
      const overlap = (
        x + npHalfW > localHandScreenBounds.minX &&
        x - npHalfW < localHandScreenBounds.maxX &&
        y + npHalfH > localHandScreenBounds.minY &&
        y - npHalfH < localHandScreenBounds.maxY
      );
      if (overlap) {
        y = localHandScreenBounds.minY - 76;
      }
    } else {
      const handAnchor = SEATS[rel]?.handAnchor?.pos || [0, PLAY_PLANE_Y, 0];
      tmpV3B.set(handAnchor[0], handAnchor[1], handAnchor[2]);
      tableRoot.localToWorld(tmpV3B);
      projectWorldToScreen(tmpV3B, handScreen);

      if (Math.abs(x - handScreen.x) < 120 && Math.abs(y - handScreen.y) < 84) {
        y -= 82;
      }
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
    view: false,
    sceneTuning: false,
    debugTable: false,
    bidding: false,
    trump: false,
    marks: false
  };

  if (!roomState) {
    show.room = true;
  } else if (roomState.phase === PHASES.LOBBY) {
    show.players = true;
    show.game = true;
    show.view = true;
    show.sceneTuning = true;
    show.debugTable = true;
    show.room = true;
  } else if (roomState.phase === PHASES.BIDDING) {
    show.game = true;
    show.view = true;
    show.sceneTuning = true;
    show.debugTable = true;
    show.bidding = true;
  } else if (roomState.phase === PHASES.CHOOSE_MODE || roomState.phase === PHASES.CHOOSE_TRUMP) {
    show.game = true;
    show.view = true;
    show.sceneTuning = true;
    show.debugTable = true;
    show.trump = true;
  } else if (roomState.phase === PHASES.PLAYING) {
    show.game = true;
    show.view = true;
    show.sceneTuning = true;
    show.debugTable = true;
    show.marks = true;
    show.room = true;
  } else {
    show.game = true;
    show.view = true;
    show.sceneTuning = true;
    show.debugTable = true;
    show.marks = true;
    show.room = true;
  }

  sectionRoom.classList.toggle('hidden', !show.room);
  sectionPlayers.classList.toggle('hidden', !show.players);
  sectionGame.classList.toggle('hidden', !show.game);
  sectionView.classList.toggle('hidden', !show.view);
  sectionSceneTuning.classList.toggle('hidden', !show.sceneTuning);
  sectionDebugTable.classList.toggle('hidden', !show.debugTable);
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

function pipPositions(value) {
  return {
    0: [],
    1: [[0.5, 0.5]],
    2: [[0.3, 0.22], [0.7, 0.78]],
    3: [[0.3, 0.22], [0.5, 0.5], [0.7, 0.78]],
    4: [[0.3, 0.22], [0.7, 0.22], [0.3, 0.78], [0.7, 0.78]],
    5: [[0.3, 0.22], [0.7, 0.22], [0.5, 0.5], [0.3, 0.78], [0.7, 0.78]],
    6: [[0.3, 0.22], [0.3, 0.5], [0.3, 0.78], [0.7, 0.22], [0.7, 0.5], [0.7, 0.78]]
  }[value] || [];
}

function drawPipSetInCell(ctx, value, cell, color) {
  const positions = pipPositions(value);
  const pipRadius = Math.max(2.4, Math.min(cell.w, cell.h) * 0.072);
  const left = cell.cx - (cell.w * 0.5);
  const top = cell.cy - (cell.h * 0.5);

  for (const [nx, ny] of positions) {
    const px = left + (nx * cell.w);
    const py = top + (ny * cell.h);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.arc(px + 0.8, py + 1.0, pipRadius + 0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, pipRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = Math.max(0.8, pipRadius * 0.14);
    ctx.beginPath();
    ctx.arc(px - pipRadius * 0.2, py - pipRadius * 0.2, pipRadius * 0.55, Math.PI * 1.08, Math.PI * 1.78);
    ctx.stroke();
  }
}

function roundedRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) * 0.5));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawDominoFaceCanvas(ctx, width, height, tile, {
  faceUp = true,
  glowCount = false,
  mode = MODES.TRUMPS,
  trumpSuit = null,
  orientation = 'landscape'
} = {}) {
  ctx.clearRect(0, 0, width, height);
  const corner = Math.max(12, Math.min(width, height) * 0.09);
  const inset = Math.max(6, Math.min(width, height) * 0.04);
  const bodyX = inset;
  const bodyY = inset;
  const bodyW = width - inset * 2;
  const bodyH = height - inset * 2;

  if (!faceUp || !tile) {
    const backGrad = ctx.createLinearGradient(0, 0, width, height);
    backGrad.addColorStop(0, '#2e3e4e');
    backGrad.addColorStop(1, '#182431');
    roundedRectPath(ctx, bodyX, bodyY, bodyW, bodyH, corner);
    ctx.fillStyle = backGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(129, 160, 193, 0.72)';
    ctx.lineWidth = Math.max(2, width * 0.014);
    roundedRectPath(ctx, bodyX + 2, bodyY + 2, bodyW - 4, bodyH - 4, corner * 0.92);
    ctx.stroke();
    for (let i = 0; i < 12; i += 1) {
      const x = bodyX + 14 + ((i + 0.5) * (bodyW - 28) / 12);
      const y = height * 0.5 + (i % 2 === 0 ? -height * 0.08 : height * 0.08);
      ctx.fillStyle = 'rgba(122, 151, 182, 0.35)';
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2, width * 0.012), 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  const pattern = ctx.createPattern(ivoryPatternCanvas, 'repeat');
  const baseGrad = ctx.createLinearGradient(0, bodyY, 0, bodyY + bodyH);
  baseGrad.addColorStop(0, '#f4eebd');
  baseGrad.addColorStop(0.45, '#ece2ab');
  baseGrad.addColorStop(1, '#dfd59d');
  roundedRectPath(ctx, bodyX, bodyY, bodyW, bodyH, corner);
  ctx.fillStyle = baseGrad;
  ctx.fill();
  if (pattern) {
    ctx.save();
    roundedRectPath(ctx, bodyX, bodyY, bodyW, bodyH, corner);
    ctx.clip();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = pattern;
    ctx.fillRect(bodyX, bodyY, bodyW, bodyH);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  const vignette = ctx.createRadialGradient(width * 0.5, height * 0.45, Math.min(width, height) * 0.12, width * 0.5, height * 0.45, Math.max(width, height) * 0.72);
  vignette.addColorStop(0, 'rgba(255,255,255,0)');
  vignette.addColorStop(1, 'rgba(72,51,34,0.19)');
  ctx.save();
  roundedRectPath(ctx, bodyX, bodyY, bodyW, bodyH, corner);
  ctx.clip();
  ctx.fillStyle = vignette;
  ctx.fillRect(bodyX, bodyY, bodyW, bodyH);
  const edgeGlow = ctx.createLinearGradient(bodyX, bodyY, bodyX, bodyY + bodyH);
  edgeGlow.addColorStop(0, 'rgba(255,255,255,0.22)');
  edgeGlow.addColorStop(0.14, 'rgba(255,255,255,0)');
  edgeGlow.addColorStop(0.86, 'rgba(0,0,0,0)');
  edgeGlow.addColorStop(1, 'rgba(82,54,31,0.18)');
  ctx.fillStyle = edgeGlow;
  ctx.fillRect(bodyX, bodyY, bodyW, bodyH);
  ctx.restore();

  const border = Math.max(2.8, Math.min(width, height) * 0.028);
  ctx.strokeStyle = '#3a2f25';
  ctx.lineWidth = border;
  roundedRectPath(ctx, bodyX, bodyY, bodyW, bodyH, corner);
  ctx.stroke();

  if (glowCount) {
    ctx.shadowColor = 'rgba(255,210,109,0.8)';
    ctx.shadowBlur = Math.max(8, width * 0.05);
    ctx.strokeStyle = 'rgba(255,213,112,0.95)';
    ctx.lineWidth = Math.max(3, border * 1.35);
    roundedRectPath(ctx, bodyX, bodyY, bodyW, bodyH, corner);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  const pipDark = '#090909';
  const pipMagenta = '#cf3df6';
  const isPortrait = orientation === 'portrait';
  const sideAColor = mode === MODES.TRUMPS && trumpSuit != null && tile.a === trumpSuit ? pipMagenta : pipDark;
  const sideBColor = mode === MODES.TRUMPS && trumpSuit != null && tile.b === trumpSuit ? pipMagenta : pipDark;

  if (isPortrait) {
    const splitY = height * 0.5;
    ctx.strokeStyle = '#1f1b16';
    ctx.lineWidth = Math.max(3.5, border * 1.2);
    ctx.beginPath();
    ctx.moveTo(bodyX + (bodyW * 0.11), splitY);
    ctx.lineTo(bodyX + bodyW - (bodyW * 0.11), splitY);
    ctx.stroke();
    drawPipSetInCell(ctx, tile.a, {
      cx: width * 0.5,
      cy: height * 0.25,
      w: width * 0.62,
      h: height * 0.34
    }, sideAColor);
    drawPipSetInCell(ctx, tile.b, {
      cx: width * 0.5,
      cy: height * 0.75,
      w: width * 0.62,
      h: height * 0.34
    }, sideBColor);
  } else {
    const splitX = width * 0.5;
    ctx.strokeStyle = '#1f1b16';
    ctx.lineWidth = Math.max(3.5, border * 1.2);
    ctx.beginPath();
    ctx.moveTo(splitX, bodyY + (bodyH * 0.11));
    ctx.lineTo(splitX, bodyY + bodyH - (bodyH * 0.11));
    ctx.stroke();
    drawPipSetInCell(ctx, tile.a, {
      cx: width * 0.25,
      cy: height * 0.5,
      w: width * 0.32,
      h: height * 0.64
    }, sideAColor);
    drawPipSetInCell(ctx, tile.b, {
      cx: width * 0.75,
      cy: height * 0.5,
      w: width * 0.32,
      h: height * 0.64
    }, sideBColor);
  }
}

function buildBurnDominoTile(tile, { highlightCount = false, mode = MODES.TRUMPS, trumpSuit = null } = {}) {
  const wrap = document.createElement('div');
  wrap.className = `burnDominoTile${highlightCount ? ' countTile' : ''}`;
  const canvasEl = document.createElement('canvas');
  canvasEl.className = 'burnDominoCanvas';
  canvasEl.width = 220;
  canvasEl.height = 396;
  const ctx = canvasEl.getContext('2d');
  drawDominoFaceCanvas(ctx, canvasEl.width, canvasEl.height, tile, {
    faceUp: true,
    glowCount: highlightCount,
    mode,
    trumpSuit,
    orientation: 'portrait'
  });
  wrap.appendChild(canvasEl);
  return wrap;
}

function teamCaptainSeat(team) {
  return team === 'teamA' ? 0 : 1;
}

function contributorForSeat(seatIndex, team) {
  const seat = roomState?.seats?.[seatIndex];
  if (!seat) {
    return {
      name: team === 'teamA' ? 'Team 1 Captain' : 'Team 2 Captain',
      meta: `Seat ${seatIndex + 1} | CPU`
    };
  }
  const typeLabel = seat.type === 'cpu' ? `CPU L${seat.cpuLevel ?? 0}` : 'Human';
  return {
    name: seat.name || `Seat ${seatIndex + 1}`,
    meta: `Seat ${seatIndex + 1} | ${typeLabel}`
  };
}

function lastContributorForTeam(team, handRecord = null) {
  const fallbackSeat = Number.isInteger(roomState?.lastBurnContributor?.[team])
    ? roomState.lastBurnContributor[team]
    : teamCaptainSeat(team);
  const seatIndex = Number.isInteger(handRecord?.winnerSeat) ? handRecord.winnerSeat : fallbackSeat;
  return contributorForSeat(seatIndex, team);
}

function splitTilesIntoLiveTrickRows(tiles) {
  const list = Array.isArray(tiles) ? tiles : [];
  const rows = [];
  if (!list.length) return rows;
  const totalTricks = Math.ceil(list.length / 4);
  for (let rowIndex = 0; rowIndex < totalTricks; rowIndex += 1) {
    const end = list.length - rowIndex * 4;
    const start = Math.max(0, end - 4);
    const chunk = list.slice(start, end);
    rows.push({
      label: `LIVE TRICK #${Math.ceil(end / 4)}`,
      tiles: chunk,
      countPoints: chunk.reduce((sum, tile) => sum + countTilePoints(tile), 0)
    });
  }
  return rows;
}

function renderBurnPanel(team, data) {
  const panel = burnPanelDom[team];
  if (!panel || !panel.stack) return;

  const titleTeam = team === 'teamA' ? 'TEAM 1 BURN PILE' : 'TEAM 2 BURN PILE';
  const handRecords = Array.isArray(data.handRecords) ? data.handRecords : [];
  const liveTiles = Array.isArray(data.liveTiles) ? data.liveTiles : [];
  const liveRows = splitTilesIntoLiveTrickRows(liveTiles);
  const totalTiles = liveTiles.length + handRecords.reduce((sum, record) => sum + (record.tiles?.length || 0), 0);
  const totalCountPoints = liveTiles.reduce((sum, tile) => sum + countTilePoints(tile), 0)
    + handRecords.reduce((sum, record) => sum + Number(record.countPoints || 0), 0);
  const handWins = Number(data.handWins || 0);
  panel.title.textContent = titleTeam;
  panel.stats.textContent = `Tiles: ${totalTiles} | Count pts: ${totalCountPoints} | Hand: ${handWins}`;

  panel.stack.replaceChildren();
  if (!liveRows.length && !handRecords.length) {
    const empty = document.createElement('div');
    empty.className = 'burnHandRow';
    empty.innerHTML = '<div class="burnHandHeader"><span>No completed hands yet</span><span class="burnHandPts">+0 pts</span></div>';
    panel.stack.appendChild(empty);
  }

  for (const liveRow of liveRows) {
    const row = document.createElement('div');
    row.className = 'burnHandRow';

    const header = document.createElement('div');
    header.className = 'burnHandHeader';
    const handLabel = document.createElement('span');
    handLabel.textContent = liveRow.label;
    const ptsLabel = document.createElement('span');
    ptsLabel.className = 'burnHandPts';
    ptsLabel.textContent = `+${Number(liveRow.countPoints || 0)} pts`;
    header.append(handLabel, ptsLabel);

    const tilesRow = document.createElement('div');
    tilesRow.className = 'burnHandTilesRow';
    for (const tile of liveRow.tiles) {
      tilesRow.appendChild(buildBurnDominoTile(tile, {
        highlightCount: countTilePoints(tile) > 0,
        mode: data.mode,
        trumpSuit: data.trumpSuit
      }));
    }
    row.append(header, tilesRow);
    panel.stack.appendChild(row);
  }

  if (handRecords.length) {
    for (const record of handRecords) {
      const row = document.createElement('div');
      row.className = 'burnHandRow';

      const header = document.createElement('div');
      header.className = 'burnHandHeader';
      const handLabel = document.createElement('span');
      handLabel.textContent = `HAND #${Number(record.handIndex || 0)}`;
      const ptsLabel = document.createElement('span');
      ptsLabel.className = 'burnHandPts';
      ptsLabel.textContent = `+${Number(record.countPoints || 0)} pts`;
      header.append(handLabel, ptsLabel);

      const tilesRow = document.createElement('div');
      tilesRow.className = 'burnHandTilesRow';
      const rowTiles = (record.tiles || []).slice(0, 4);
      for (const tile of rowTiles) {
        tilesRow.appendChild(buildBurnDominoTile(tile, {
          highlightCount: countTilePoints(tile) > 0,
          mode: data.mode,
          trumpSuit: data.trumpSuit
        }));
      }
      const overflow = Math.max(0, (record.tiles || []).length - rowTiles.length);
      if (overflow > 0) {
        const badge = document.createElement('span');
        badge.className = 'burnOverflowBadge';
        badge.textContent = `+${overflow}`;
        tilesRow.appendChild(badge);
      }

      row.append(header, tilesRow);
      panel.stack.appendChild(row);
    }
  }

  const contributor = lastContributorForTeam(team, liveRows.length ? null : handRecords[0]);
  panel.footer.innerHTML = `
    <div class="burnFooterName">${contributor.name}</div>
    <div class="burnFooterMeta">${contributor.meta}</div>
  `;
}

function updateBurnPanels() {
  if (!roomState) {
    renderBurnPanel('teamA', { liveTiles: [], handRecords: [], handWins: 0, mode: MODES.TRUMPS, trumpSuit: null });
    renderBurnPanel('teamB', { liveTiles: [], handRecords: [], handWins: 0, mode: MODES.TRUMPS, trumpSuit: null });
    return;
  }
  const showLiveHandCaptures = roomState.phase === PHASES.PLAYING || roomState.phase === PHASES.TRICK_PAUSE;

  renderBurnPanel('teamA', {
    liveTiles: showLiveHandCaptures ? (roomState.burnPiles?.teamA || []) : [],
    handRecords: roomState.burnHandsTeamA || [],
    handWins: roomState.roundWins?.teamA || 0,
    mode: roomState.mode || MODES.TRUMPS,
    trumpSuit: roomState.trumpSuit
  });
  renderBurnPanel('teamB', {
    liveTiles: showLiveHandCaptures ? (roomState.burnPiles?.teamB || []) : [],
    handRecords: roomState.burnHandsTeamB || [],
    handWins: roomState.roundWins?.teamB || 0,
    mode: roomState.mode || MODES.TRUMPS,
    trumpSuit: roomState.trumpSuit
  });
}

function getDominoTexture(tile, options = {}) {
  const {
    faceUp = true,
    glowCount = false,
    trumpSuit = null,
    mode = MODES.TRUMPS,
    orientation = 'landscape'
  } = options;

  const id = tile ? tile.id || tileId(tile) : 'back';
  const key = `${id}:${faceUp ? 'up' : 'down'}:${orientation}:${glowCount ? 1 : 0}:m${mode}:t${trumpSuit == null ? 'n' : trumpSuit}`;
  if (textureCache.has(key)) return textureCache.get(key);

  const c = document.createElement('canvas');
  if (orientation === 'portrait') {
    c.width = 384;
    c.height = 768;
  } else {
    c.width = 768;
    c.height = 384;
  }
  const ctx = c.getContext('2d');
  drawDominoFaceCanvas(ctx, c.width, c.height, tile, {
    faceUp,
    glowCount,
    mode,
    trumpSuit,
    orientation
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.needsUpdate = true;
  textureCache.set(key, tex);
  return tex;
}

function getDominoBaseMaterial({ faceUp, map = null, flat = false } = {}) {
  return new THREE.MeshStandardMaterial({
    map: map || null,
    color: faceUp ? 0xf4efe4 : 0xe5dece,
    metalness: 0.0,
    roughness: faceUp ? (flat ? 0.38 : 0.43) : 0.5,
    side: flat ? THREE.DoubleSide : THREE.FrontSide
  });
}

function getDominoPipMaterial(faceUp) {
  return new THREE.MeshStandardMaterial({
    color: faceUp ? 0xd9cebb : 0x2c3948,
    roughness: faceUp ? 0.46 : 0.72,
    metalness: 0.0
  });
}

function createDomino3D(tile, options = {}) {
  const {
    faceUp = true,
    scale = DOMINO_SCALE,
    glowCount = false,
    trumpSuit = null,
    useMagentaTrump = false,
    mode = MODES.TRUMPS
  } = options;

  const trumpTintSuit = useMagentaTrump && trumpSuit != null ? trumpSuit : null;
  const topTexture = getDominoTexture(tile, {
    faceUp,
    glowCount,
    trumpSuit: trumpTintSuit,
    mode,
    orientation: 'landscape'
  });
  const bottomTexture = getDominoTexture(tile, {
    faceUp: false,
    glowCount: false,
    trumpSuit: null,
    orientation: 'landscape'
  });

  const sideMat = getDominoPipMaterial(faceUp);
  const topMat = getDominoBaseMaterial({ faceUp: true, map: topTexture });
  const bottomMat = getDominoBaseMaterial({ faceUp: false, map: bottomTexture });
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

function createDominoTile(tile, options = {}) {
  const {
    faceUp = true,
    scale = 1,
    glowCount = false,
    trumpSuit = null,
    useMagentaTrump = false,
    mode = MODES.TRUMPS,
    orientation = 'portrait'
  } = options;
  const trumpTintSuit = useMagentaTrump && trumpSuit != null ? trumpSuit : null;
  const texture = getDominoTexture(tile, {
    faceUp,
    glowCount,
    trumpSuit: trumpTintSuit,
    mode,
    orientation
  });

  const material = getDominoBaseMaterial({ faceUp, map: texture, flat: true });
  material.transparent = true;
  material.alphaTest = 0.02;

  const mesh = new THREE.Mesh(dominoTileGeometry, material);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.scale.setScalar(scale);
  mesh.frustumCulled = false;
  mesh.renderOrder = 11;
  mesh.userData = {
    tileId: tile.id || tileId(tile),
    seatIndex: null,
    clickable: false,
    isFlatTile: true
  };
  return mesh;
}

function createDominoMesh(tile, options = {}) {
  return createDomino3D(tile, options);
}

function clearGroup(group) {
  const children = [...group.children];
  for (const child of children) {
    if (child.children && child.children.length) {
      clearGroup(child);
    }
    group.remove(child);
    if (child.geometry && child.geometry !== dominoGeometry && child.geometry !== dominoTileGeometry) {
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
  tableNode.scale.set(1, 1, 1);
  tableNode.position.set(0, 0, 0);
  environmentGroup.add(tableNode);
  updateTableMetricsFromObject(tableNode);

  for (let seat = 0; seat < 4; seat += 1) {
    setChairModelForSeat(seat, environmentTemplates.chair);
  }

  applySceneTuning({ rerenderHand: false });
  resetViewForLocalSeat(false);
}

function updateSeatTransforms() {
  sanitizeSceneTuning();
  const localSeat = getLocalSeat();
  for (let seatIndex = 0; seatIndex < 4; seatIndex += 1) {
    const rel = toRelativeSeat(seatIndex, localSeat);
    const seatConfig = SEATS[rel];
    const seatDir = tmpV3A.set(seatConfig.chair.pos[0], 0, seatConfig.chair.pos[2]);
    if (seatDir.lengthSq() < 0.0001) {
      seatDir.set(0, 0, 1);
    } else {
      seatDir.normalize();
    }

    const chairGroup = chairSeatGroups[seatIndex];
    chairGroup.scale.setScalar(sceneTuning.chairScale);
    chairGroup.position.set(
      seatDir.x * sceneTuning.seatRadius,
      seatConfig.chair.pos[1] + sceneTuning.chairY,
      seatDir.z * sceneTuning.seatRadius
    );
    chairGroup.rotation.y = seatConfig.chair.rotY;

    const avatarGroup = avatarSeatGroups[seatIndex];
    avatarGroup.scale.setScalar(sceneTuning.avatarScale);
    const avatarRadius = Math.max(0.4, sceneTuning.seatRadius - 0.18 + sceneTuning.avatarBack);
    let avatarBaseY = (
      seatConfig.avatar.pos[1]
      + sceneTuning.chairY
      + (seatRuntime[seatIndex].chairSeatY * sceneTuning.chairScale)
      + 0.02
      + sceneTuning.avatarY
    );
    avatarBaseY = Math.min(avatarBaseY, tableMetrics.topY - 0.28);
    avatarBaseY = clampAvatarBaseY(avatarBaseY, seatIndex);
    avatarGroup.position.set(seatDir.x * avatarRadius, avatarBaseY, seatDir.z * avatarRadius);
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

function clampValue(value, min, max, fallback = min) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function lookAtBounds() {
  return {
    min: -1.0,
    max: 6.0
  };
}

function sanitizeViewSettings() {
  const lookBounds = lookAtBounds();
  viewSettings.distance = clampValue(Number(viewSettings.distance), 0.1, 8.0);
  viewSettings.height = clampValue(Number(viewSettings.height), 0.1, 6.0);
  viewSettings.forward = clampValue(Number(viewSettings.forward), -4.0, 4.0);
  viewSettings.shoulder = clampValue(Number(viewSettings.shoulder), -4.0, 4.0);
  viewSettings.lookAtY = clampValue(Number(viewSettings.lookAtY), lookBounds.min, lookBounds.max);
  viewSettings.fov = clampValue(Number(viewSettings.fov), 15, 120);
  viewSettings.pitchDeg = clampValue(Number(viewSettings.pitchDeg), -80, 80);
  viewSettings.near = clampValue(Number(viewSettings.near), 0.001, 1.0);
  viewSettings.handY = clampValue(Number(viewSettings.handY), -1.0, 1.0);
  viewSettings.handZ = clampValue(Number(viewSettings.handZ), -4.0, 4.0);
  viewSettings.handDominoScale = clampValue(Number(viewSettings.handDominoScale), 0.05, 12.0);
  viewSettings.handDominoRotDeg = clampValue(Number(viewSettings.handDominoRotDeg), -180, 180);
  viewSettings.tableDominoScale = clampValue(Number(viewSettings.tableDominoScale), 0.05, 25.0);
}

function updateViewControlsUi() {
  sanitizeViewSettings();
  const lookBounds = lookAtBounds();
  viewInputs.lookAtY.min = `${lookBounds.min}`;
  viewInputs.lookAtY.max = `${lookBounds.max}`;

  for (const key of Object.keys(viewInputs)) {
    const input = viewInputs[key];
    const label = viewValueLabels[key];
    if (!input || !label) continue;
    input.value = `${viewSettings[key]}`;
    label.textContent = key === 'fov' || key === 'handDominoRotDeg'
      ? `${Math.round(viewSettings[key])}`
      : key === 'pitchDeg'
        ? `${viewSettings[key].toFixed(1)}`
        : key === 'near'
          ? `${viewSettings[key].toFixed(3)}`
        : viewSettings[key].toFixed(2);
  }
}

function sanitizeSceneTuning() {
  sceneTuning.tableScale = clampValue(Number(sceneTuning.tableScale), 0.5, 2.5);
  sceneTuning.chairScale = clampValue(Number(sceneTuning.chairScale), 0.5, 2.5);
  sceneTuning.avatarScale = clampValue(Number(sceneTuning.avatarScale), 0.5, 2.5);
  sceneTuning.seatRadius = clampValue(Number(sceneTuning.seatRadius), 1.0, 5.0);
  sceneTuning.avatarBack = clampValue(Number(sceneTuning.avatarBack), -1.0, 1.0);
  sceneTuning.avatarY = clampValue(Number(sceneTuning.avatarY), -0.5, 0.5);
  sceneTuning.chairY = clampValue(Number(sceneTuning.chairY), -0.5, 0.5);
  sceneTuning.tableY = clampValue(Number(sceneTuning.tableY), -0.5, 0.5);
}

function updateSceneTuningUi() {
  sanitizeSceneTuning();
  for (const key of Object.keys(sceneTuneInputs)) {
    const input = sceneTuneInputs[key];
    const label = sceneTuneLabels[key];
    if (!input || !label) continue;
    input.value = `${sceneTuning[key]}`;
    label.textContent = sceneTuning[key].toFixed(2);
  }
  if (chairsVisibleToggle) {
    chairsVisibleToggle.checked = chairsVisible;
  }
}

function applySceneTuning({ rerenderHand = true } = {}) {
  sanitizeSceneTuning();
  chairsRoot.visible = !!chairsVisible;

  const tableNode = environmentGroup.getObjectByName('tableModel');
  if (tableNode) {
    tableNode.scale.set(sceneTuning.tableScale, sceneTuning.tableScale, sceneTuning.tableScale);
    tableNode.position.y = sceneTuning.tableY;
    updateTableMetricsFromObject(tableNode);
  }

  updateSeatTransforms();
  safeApplyViewSettings(true);
  if (rerenderHand && roomState) {
    renderHandsAndTrick();
  }
  updateNameplatePositions();
  updatePenaltyEmojiPositions();
}

function computeSeatedCameraPose(seatIndex, settings) {
  const localSeat = getLocalSeat();
  const rel = toRelativeSeat(seatIndex ?? 0, localSeat);
  const seat = SEATS[rel] || SEATS[0];
  const avatarGroup = avatarSeatGroups[seatIndex];

  const chairPos = tmpV3A.set(seat.chair.pos[0], 0, seat.chair.pos[2]);
  const forward = tmpV3B.set(-chairPos.x, 0, -chairPos.z);
  if (forward.lengthSq() < 0.0001) {
    forward.set(0, 0, -1);
  } else {
    forward.normalize();
  }

  const right = tempV3C.set(0, 1, 0).cross(forward).normalize();
  const anchor = tempV3D.set(seat.avatar.pos[0], seat.avatar.pos[1], seat.avatar.pos[2]);
  if (avatarGroup) {
    anchor.copy(avatarGroup.position);
  }
  anchor.y = Number(seatRuntime[seatIndex]?.chairSeatY || 0.42) + 0.94;

  const pos = new THREE.Vector3()
    .copy(anchor)
    .addScaledVector(forward, -settings.distance)
    .addScaledVector(forward, settings.forward)
    .addScaledVector(right, settings.shoulder);
  pos.y = settings.height;

  const target = new THREE.Vector3(0, settings.lookAtY, 0);
  const lookDistance = Math.max(0.9, pos.distanceTo(target));
  const dir = target.clone().sub(pos).normalize();
  if (Math.abs(settings.pitchDeg) > 0.001) {
    dir.applyAxisAngle(right, (settings.pitchDeg * Math.PI) / 180);
  }
  target.copy(pos).addScaledVector(dir, lookDistance);

  const radial = Math.hypot(pos.x, pos.z);
  const safeRadius = Math.max(1.35, tableMetrics.radius + 0.35);
  if (radial < safeRadius) {
    const outX = radial <= 0.0001 ? 0 : pos.x / radial;
    const outZ = radial <= 0.0001 ? 1 : pos.z / radial;
    pos.x = outX * safeRadius;
    pos.z = outZ * safeRadius;
  }

  if (pos.y <= tableMetrics.topY + 0.3) {
    pos.y = tableMetrics.topY + 0.3;
  }

  return { position: pos, target };
}

function setDefaultSeatedCamera() {
  const fallbackTargetY = Number.isFinite(tableMetrics.topY)
    ? tableMetrics.topY + 0.16
    : 0.78;
  const fallbackRadius = Math.max(
    4.8,
    (Number.isFinite(tableMetrics.radius) ? tableMetrics.radius : 2.9) + 1.8
  );
  const fallbackY = Math.max(1.12, fallbackTargetY + 0.42);
  camera.position.set(0.22, fallbackY, fallbackRadius);
  controls.target.set(0, fallbackTargetY, 0);
  camera.fov = DEFAULT_VIEW_SETTINGS.fov;
  camera.near = DEFAULT_VIEW_SETTINGS.near;
  camera.updateProjectionMatrix();
  controls.minPolarAngle = 1.02;
  controls.maxPolarAngle = 1.54;
  controls.minDistance = Math.max(1.2, tableMetrics.radius - 1.4);
  controls.maxDistance = Math.max(10.5, tableMetrics.radius + 7.5);
  controls.update();
}

function applyViewSettings(immediate = true) {
  sanitizeViewSettings();
  const localSeat = getLocalSeat();
  const seatIndex = Number.isInteger(localSeat) ? localSeat : 0;
  const pose = computeSeatedCameraPose(seatIndex, viewSettings);

  camera.fov = viewSettings.fov;
  camera.near = viewSettings.near;
  camera.updateProjectionMatrix();

  controls.minPolarAngle = 1.02;
  controls.maxPolarAngle = 1.54;
  controls.minDistance = Math.max(1.2, tableMetrics.radius - 1.4);
  controls.maxDistance = Math.max(10.5, tableMetrics.radius + 7.5);

  if (immediate) {
    camera.position.copy(pose.position);
    controls.target.copy(pose.target);
  } else {
    camera.position.lerp(pose.position, 0.26);
    controls.target.lerp(pose.target, 0.26);
  }
  controls.update();
}

function safeApplyViewSettings(immediate = true) {
  try {
    applyViewSettings(immediate);
    return true;
  } catch (error) {
    console.error('[view] applyViewSettings failed', error);
    try {
      setDefaultSeatedCamera();
    } catch (fallbackError) {
      console.error('[view] setDefaultSeatedCamera failed', fallbackError);
    }
    return false;
  }
}

function resetViewForLocalSeat(immediate = true) {
  safeApplyViewSettings(immediate);
}

function resetViewSettingsToDefault() {
  Object.assign(viewSettings, DEFAULT_VIEW_SETTINGS);
  persistViewSettings();
  updateViewControlsUi();
  safeApplyViewSettings(true);
  renderHandsAndTrick();
  updateNameplatePositions();
}

function getSeatHeadWorld(seatIndex, out = new THREE.Vector3()) {
  const avatarGroup = avatarSeatGroups[seatIndex];
  if (!avatarGroup || !avatarGroup.children.length) {
    if (avatarGroup) {
      avatarGroup.getWorldPosition(out);
      out.y += 1.62 * sceneTuning.avatarScale;
    } else {
      out.set(0, 1.9, 0);
      tableRoot.localToWorld(out);
    }
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

function setEnvironmentLoadStatus(state, detail = '') {
  environmentLoadState = state;
  environmentLoadDetail = detail;
  if (environmentLoadText) {
    if (state === 'loading') {
      environmentLoadText.textContent = 'Environment loading...';
    } else if (state === 'ok') {
      environmentLoadText.textContent = 'Environment loaded: OK';
    } else if (state === 'fallback') {
      environmentLoadText.textContent = `Environment fallback: ${detail || 'missing HDR/texture'}`;
    } else {
      environmentLoadText.textContent = '';
    }
  }
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

function environmentRootFor(entry) {
  if (entry?.root && typeof entry.root === 'string') {
    return entry.root.replace(/\/$/, '');
  }
  return `/assets/environments/${entry?.id || 'default_lounge'}`;
}

async function fetchEnvironmentFiles(entry) {
  const envId = String(entry?.id || '').trim();
  if (!envId) return [];
  if (environmentFileCatalogCache.has(envId)) {
    return environmentFileCatalogCache.get(envId);
  }

  const task = (async () => {
    try {
      const res = await fetch(`/api/environment-files/${encodeURIComponent(envId)}`, { cache: 'no-cache' });
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data?.files)) return [];
      return data.files
        .filter((file) => typeof file === 'string' && !file.includes('/._'))
        .map((file) => file.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  })();

  environmentFileCatalogCache.set(envId, task);
  return task;
}

function findTextureFile(files, { dirHint, tags = [] }) {
  const lowerTags = tags.map((tag) => tag.toLowerCase());
  const candidates = files.filter((file) => {
    const low = file.toLowerCase();
    if (!(low.endsWith('.png') || low.endsWith('.jpg') || low.endsWith('.jpeg') || low.endsWith('.webp'))) return false;
    if (dirHint && !low.includes(dirHint.toLowerCase())) return false;
    return true;
  });

  for (const file of candidates) {
    const low = file.toLowerCase();
    if (lowerTags.some((tag) => low.includes(tag))) return file;
  }
  return candidates[0] || '';
}

function mapCasinoLoungeAssets(files) {
  const floorDir = '/materials/floor/';
  const wallDir = '/materials/walls/';
  const trimDir = '/materials/trim/';
  const baseTags = ['basecolor', 'base_color', 'albedo', 'diffuse', 'color'];
  const normalTags = ['normal', '_nrm', '_n'];
  const roughTags = ['roughness', 'rough'];
  const aoTags = ['ambientocclusion', 'ambient_occlusion', 'ao'];

  const hdri = files.find((file) => file.toLowerCase().includes('/hdri/') && file.toLowerCase().endsWith('.hdr')) || '';
  const props = files.filter((file) => {
    const low = file.toLowerCase();
    return low.includes('/props/') && (low.endsWith('.glb') || low.endsWith('.gltf') || low.endsWith('.obj'));
  });

  return {
    floor: {
      base: findTextureFile(files, { dirHint: floorDir, tags: baseTags }),
      normal: findTextureFile(files, { dirHint: floorDir, tags: normalTags }),
      roughness: findTextureFile(files, { dirHint: floorDir, tags: roughTags }),
      ao: findTextureFile(files, { dirHint: floorDir, tags: aoTags })
    },
    walls: {
      base: findTextureFile(files, { dirHint: wallDir, tags: baseTags }),
      normal: findTextureFile(files, { dirHint: wallDir, tags: normalTags }),
      roughness: findTextureFile(files, { dirHint: wallDir, tags: roughTags }),
      ao: findTextureFile(files, { dirHint: wallDir, tags: aoTags })
    },
    trim: {
      base: findTextureFile(files, { dirHint: trimDir, tags: baseTags }),
      normal: findTextureFile(files, { dirHint: trimDir, tags: normalTags }),
      roughness: findTextureFile(files, { dirHint: trimDir, tags: roughTags }),
      ao: findTextureFile(files, { dirHint: trimDir, tags: aoTags })
    },
    hdri,
    props
  };
}

async function loadEnvironmentTexture(url, { srgb = true, repeat = [1, 1] } = {}) {
  if (!url) return null;
  const key = `${url}|${srgb ? 's' : 'l'}|${repeat[0]}|${repeat[1]}`;
  if (environmentTextureCache.has(key)) {
    return environmentTextureCache.get(key);
  }

  const task = new Promise((resolve) => {
    textureLoader.load(
      url,
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeat[0], repeat[1]);
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        tex.needsUpdate = true;
        resolve(tex);
      },
      undefined,
      () => resolve(null)
    );
  });

  environmentTextureCache.set(key, task);
  return task;
}

async function loadEnvironmentHdri(url) {
  if (!url) return null;
  if (environmentHdriCache.has(url)) {
    return environmentHdriCache.get(url);
  }

  const task = (async () => {
    try {
      const tex = await new RGBELoader().loadAsync(url);
      const pmrem = pmremGenerator.fromEquirectangular(tex).texture;
      tex.dispose();
      return pmrem;
    } catch {
      return null;
    }
  })();
  environmentHdriCache.set(url, task);
  return task;
}

function addCasinoTrim(roomRoot, roomWidth, roomDepth, wallHeight, material) {
  const trimHeight = 0.16;
  const trimDepth = 0.06;
  const zBack = -(roomDepth * 0.5) + (trimDepth * 0.5);
  const xLeft = -(roomWidth * 0.5) + (trimDepth * 0.5);
  const xRight = (roomWidth * 0.5) - (trimDepth * 0.5);
  const y = trimHeight * 0.5;

  const backTrim = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, trimHeight, trimDepth), material);
  backTrim.position.set(0, y, zBack);
  backTrim.receiveShadow = true;
  backTrim.castShadow = true;
  roomRoot.add(backTrim);

  const leftTrim = new THREE.Mesh(new THREE.BoxGeometry(trimDepth, trimHeight, roomDepth), material);
  leftTrim.position.set(xLeft, y, 0);
  leftTrim.receiveShadow = true;
  leftTrim.castShadow = true;
  roomRoot.add(leftTrim);

  const rightTrim = leftTrim.clone();
  rightTrim.position.x = xRight;
  roomRoot.add(rightTrim);
}

async function buildCasinoLoungeEnvironment(entry, token) {
  const roomRoot = new THREE.Group();
  roomRoot.name = 'casinoRoomRoot';
  roomRoot.position.set(0, -0.02, 0);

  const roomWidth = 18;
  const roomDepth = 20;
  const wallHeight = 5.2;

  const floorMaterial = new THREE.MeshStandardMaterial({
    map: carpetTexture,
    color: 0xffffff,
    roughness: 0.94,
    metalness: 0.0
  });
  const wallMaterial = new THREE.MeshStandardMaterial({
    map: wallpaperTexture,
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0.0
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    map: woodTexture,
    color: 0xffffff,
    roughness: 0.58,
    metalness: 0.0
  });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomDepth), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  floor.castShadow = false;
  roomRoot.add(floor);

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, wallHeight), wallMaterial);
  backWall.position.set(0, wallHeight * 0.5, -(roomDepth * 0.5));
  backWall.receiveShadow = true;
  backWall.castShadow = false;
  roomRoot.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(roomDepth, wallHeight), wallMaterial);
  leftWall.position.set(-(roomWidth * 0.5), wallHeight * 0.5, 0);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.receiveShadow = true;
  leftWall.castShadow = false;
  roomRoot.add(leftWall);

  const rightWall = leftWall.clone();
  rightWall.position.x = roomWidth * 0.5;
  rightWall.rotation.y = -Math.PI / 2;
  roomRoot.add(rightWall);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(roomWidth, roomDepth),
    new THREE.MeshStandardMaterial({ color: 0x2a211b, roughness: 0.9, metalness: 0.0 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = wallHeight;
  roomRoot.add(ceiling);

  addCasinoTrim(roomRoot, roomWidth, roomDepth, wallHeight, trimMaterial);
  themeGroup.add(roomRoot);

  const catalog = await fetchEnvironmentFiles(entry);
  if (token !== environmentApplyToken) return;
  const mapped = mapCasinoLoungeAssets(catalog);
  const missing = [];
  if (!mapped.floor.base) missing.push('missing floor texture');
  if (!mapped.walls.base) missing.push('missing wall texture');
  if (!mapped.trim.base) missing.push('missing trim texture');
  if (!mapped.hdri) missing.push('missing HDR');

  const [floorBase, floorNormal, floorRough, wallBase, wallNormal, wallRough, trimBase, trimNormal, trimRough] = await Promise.all([
    loadEnvironmentTexture(mapped.floor.base, { srgb: true, repeat: [10, 12] }),
    loadEnvironmentTexture(mapped.floor.normal, { srgb: false, repeat: [10, 12] }),
    loadEnvironmentTexture(mapped.floor.roughness, { srgb: false, repeat: [10, 12] }),
    loadEnvironmentTexture(mapped.walls.base, { srgb: true, repeat: [4, 3] }),
    loadEnvironmentTexture(mapped.walls.normal, { srgb: false, repeat: [4, 3] }),
    loadEnvironmentTexture(mapped.walls.roughness, { srgb: false, repeat: [4, 3] }),
    loadEnvironmentTexture(mapped.trim.base, { srgb: true, repeat: [7, 2] }),
    loadEnvironmentTexture(mapped.trim.normal, { srgb: false, repeat: [7, 2] }),
    loadEnvironmentTexture(mapped.trim.roughness, { srgb: false, repeat: [7, 2] })
  ]);

  if (token !== environmentApplyToken) return;

  if (floorBase) floorMaterial.map = floorBase;
  else missing.push('floor map load failed');
  if (floorNormal) floorMaterial.normalMap = floorNormal;
  if (floorRough) floorMaterial.roughnessMap = floorRough;
  floorMaterial.needsUpdate = true;

  if (wallBase) wallMaterial.map = wallBase;
  else missing.push('wall map load failed');
  if (wallNormal) wallMaterial.normalMap = wallNormal;
  if (wallRough) wallMaterial.roughnessMap = wallRough;
  wallMaterial.needsUpdate = true;

  if (trimBase) trimMaterial.map = trimBase;
  else missing.push('trim map load failed');
  if (trimNormal) trimMaterial.normalMap = trimNormal;
  if (trimRough) trimMaterial.roughnessMap = trimRough;
  trimMaterial.needsUpdate = true;

  if (mapped.hdri) {
    const hdriTex = await loadEnvironmentHdri(mapped.hdri);
    if (token !== environmentApplyToken) return;
    if (hdriTex) {
      scene.environment = hdriTex;
    } else {
      missing.push('HDR load failed');
    }
  }

  if (mapped.props.length) {
    const propSlots = [
      { pos: [-6.6, 0, -8.6], rotY: Math.PI * 0.2, scale: 0.9 },
      { pos: [6.5, 0, -8.9], rotY: -Math.PI * 0.18, scale: 0.9 },
      { pos: [-6.7, 0, -2.7], rotY: Math.PI * 0.45, scale: 0.85 },
      { pos: [6.6, 0, -2.8], rotY: -Math.PI * 0.45, scale: 0.85 }
    ];

    const propUrls = mapped.props.slice(0, propSlots.length);
    for (let i = 0; i < propUrls.length; i += 1) {
      const url = propUrls[i];
      try {
        const template = await loadModelTemplate(url);
        if (token !== environmentApplyToken) return;
        const clone = clonedModelAsset(template).scene;
        tuneImportedMaterials(clone);
        const slot = propSlots[i];
        clone.position.set(slot.pos[0], slot.pos[1], slot.pos[2]);
        clone.rotation.y = slot.rotY;
        clone.scale.setScalar(slot.scale);
        roomRoot.add(clone);
      } catch {
        // Optional props are best-effort.
      }
    }
  }

  if (token !== environmentApplyToken) return;
  const dedupedMissing = [...new Set(missing)];
  if (dedupedMissing.length) {
    console.warn('[env] Casino Lounge fallback assets:', dedupedMissing.join(', '));
    setEnvironmentLoadStatus('fallback', dedupedMissing.join(', '));
  } else {
    setEnvironmentLoadStatus('ok');
  }
}

function applyEnvironment(environmentId) {
  const safeId = environmentById.has(environmentId) ? environmentId : 'default_lounge';
  if (currentEnvironmentId === safeId) return;
  currentEnvironmentId = safeId;
  environmentApplyToken += 1;
  const token = environmentApplyToken;
  setEnvironmentLoadStatus('loading');

  clearGroup(themeGroup);
  const preset = getThemePreset(safeId);
  const entry = environmentById.get(safeId) || { id: safeId, name: safeId, root: `/assets/environments/${safeId}` };

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

  if (safeId === 'casino_lounge') {
    scene.background = new THREE.Color(0x1c1512);
    void buildCasinoLoungeEnvironment({
      ...entry,
      root: environmentRootFor(entry)
    }, token).catch(() => {
      if (token !== environmentApplyToken) return;
      const fallbackSky = getSkyTexture('casino_lounge-fallback', '#4e3b2e', '#17110d');
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(56, 36, 20),
        new THREE.MeshBasicMaterial({ map: fallbackSky, side: THREE.BackSide, depthWrite: false })
      );
      themeGroup.add(dome);
      setEnvironmentLoadStatus('fallback', 'missing HDR/texture');
    });
    updateEnvironmentControls();
    return;
  }

  const skyTex = getSkyTexture(safeId, preset.top, preset.bottom);
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(56, 36, 20),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false })
  );
  themeGroup.add(skyDome);
  scene.background = new THREE.Color(preset.bottom);

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
  setEnvironmentLoadStatus('ok');
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

function getSeatBasisForHandLayout(seatIndex) {
  const safeSeat = Number.isInteger(seatIndex) ? seatIndex : 0;
  const chairGroup = chairSeatGroups[safeSeat];
  const avatarGroup = avatarSeatGroups[safeSeat];

  const chairWorld = new THREE.Vector3();
  if (chairGroup) {
    chairGroup.getWorldPosition(chairWorld);
  } else {
    chairWorld.set(0, 0, sceneTuning.seatRadius);
    tableRoot.localToWorld(chairWorld);
  }
  const tableCenter = new THREE.Vector3(0, tableMetrics.topY, 0);
  tableRoot.localToWorld(tableCenter);

  const forward = tableCenter.clone().sub(chairWorld);
  forward.y = 0;
  if (forward.lengthSq() < 0.0001) {
    forward.set(0, 0, -1);
  } else {
    forward.normalize();
  }

  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(forward, up).normalize();

  const fallbackBase = new THREE.Vector3();
  if (avatarGroup) {
    avatarGroup.getWorldPosition(fallbackBase);
  } else {
    fallbackBase.copy(chairWorld);
  }
  fallbackBase.addScaledVector(forward, 0.58);
  fallbackBase.y = tableMetrics.topY + 0.05;

  return { base: fallbackBase, forward, right, up };
}

function layoutPlayerHandDominos(seatId, dominos, settings) {
  localHandScreenBounds.valid = false;
  if (!dominos?.length) return;

  const basis = getSeatBasisForHandLayout(seatId);
  if (!basis) return;

  let base = basis.base
    .clone()
    .addScaledVector(basis.up, Number(settings.handY) || 0)
    .addScaledVector(basis.forward, -(Number(settings.handZ) || 0));

  base.y = Math.max(base.y, tableMetrics.topY + 0.03);

  const handScale = Math.max(0.05, Number(settings.handDominoScale) || 1);
  const handRotateRad = THREE.MathUtils.degToRad(Number(settings.handDominoRotDeg) || 0);
  const n = dominos.length;
  let effectiveScale = handScale;
  let dominoWidth = DOMINO_SHORT * effectiveScale;
  let baseSpacing = dominoWidth + 0.008;
  let spacing = Math.max(baseSpacing, dominoWidth * 1.1);
  let arcStrength = 0.16;
  const liftY = 0.016 + DOMINO_TILE_THICKNESS;
  const pitch = THREE.MathUtils.degToRad(14);
  const baseRot = Math.atan2(basis.forward.z, basis.forward.x);
  const meshes = [];

  if (handScale > 1.2) {
    base.addScaledVector(basis.forward, (handScale - 1.2) * 0.1);
    base.y -= Math.min(0.16, (handScale - 1.2) * 0.018);
  }

  for (const tile of dominos) {
    const mesh = createDominoTile(tile, {
      faceUp: true,
      glowCount: countTilePoints(tile) > 0,
      scale: effectiveScale,
      trumpSuit: roomState?.trumpSuit,
      useMagentaTrump: roomState?.mode === MODES.TRUMPS,
      mode: roomState?.mode || MODES.TRUMPS,
      orientation: 'portrait'
    });
    mesh.userData.tileId = tile.id;
    mesh.userData.seatIndex = seatId;
    mesh.userData.clickable = true;
    handGroup.add(mesh);
    meshes.push(mesh);
  }

  const screenBounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const sample = { x: 0, y: 0 };

  const placeMeshes = () => {
    for (let i = 0; i < meshes.length; i += 1) {
      const mesh = meshes[i];
      const t = n <= 1 ? 0 : i - (n - 1) / 2;
      const x = t * spacing;
      const yArc = -(x * x) * arcStrength;
      mesh.position.copy(base)
        .addScaledVector(basis.right, x)
        .addScaledVector(basis.forward, yArc)
        .addScaledVector(basis.up, liftY);
      mesh.rotation.set(0, baseRot + handRotateRad, 0);
      mesh.rotateX(pitch);
      mesh.rotateY(t * 0.024);
      mesh.userData.baseY = mesh.position.y;
      mesh.updateMatrixWorld(true);
    }
  };

  const measureBounds = () => {
    screenBounds.minX = Infinity;
    screenBounds.minY = Infinity;
    screenBounds.maxX = -Infinity;
    screenBounds.maxY = -Infinity;
    for (const mesh of meshes) {
      tmpV3E.setFromMatrixPosition(mesh.matrixWorld);
      projectWorldToScreen(tmpV3E, sample);
      screenBounds.minX = Math.min(screenBounds.minX, sample.x - 34);
      screenBounds.maxX = Math.max(screenBounds.maxX, sample.x + 34);
      screenBounds.minY = Math.min(screenBounds.minY, sample.y - 24);
      screenBounds.maxY = Math.max(screenBounds.maxY, sample.y + 24);
    }
  };

  for (let i = 0; i < 8; i += 1) {
    placeMeshes();
    measureBounds();
    const overflowX = screenBounds.minX < 24 || screenBounds.maxX > window.innerWidth - 24;
    const overflowBottom = screenBounds.maxY > window.innerHeight - 70;
    const overflowTop = screenBounds.minY < 62;
    if (!overflowX && !overflowBottom && !overflowTop) break;

    if (overflowX) {
      const maxFitSpacing = n > 1 ? Math.max(0.02, (window.innerWidth * 0.00016) / (n - 1)) : spacing;
      spacing = Math.max(Math.min(maxFitSpacing, spacing * 0.92), dominoWidth * 1.1);
      arcStrength = Math.max(0.1, arcStrength * 0.94);
      if (spacing <= (dominoWidth * 1.1 + 0.0005) && effectiveScale > 0.08) {
        effectiveScale = Math.max(0.08, effectiveScale * 0.92);
        dominoWidth = DOMINO_SHORT * effectiveScale;
        baseSpacing = dominoWidth + 0.008;
        spacing = Math.max(baseSpacing, dominoWidth * 1.1);
        for (const mesh of meshes) {
          mesh.scale.setScalar(effectiveScale);
        }
      }
    }
    if (overflowBottom) {
      base.addScaledVector(basis.forward, 0.08);
      base.y += 0.008;
    } else if (overflowTop) {
      base.addScaledVector(basis.forward, -0.07);
    }
  }

  const minCamDistance = 0.85;
  const distToCam = camera.position.distanceTo(base);
  if (distToCam < minCamDistance) {
    base.addScaledVector(basis.forward, minCamDistance - distToCam + 0.12);
    placeMeshes();
    measureBounds();
  }

  localHandScreenBounds.valid = Number.isFinite(screenBounds.minX);
  localHandScreenBounds.minX = screenBounds.minX;
  localHandScreenBounds.maxX = screenBounds.maxX;
  localHandScreenBounds.minY = screenBounds.minY;
  localHandScreenBounds.maxY = screenBounds.maxY;
}

function updateTableDominoDebugReadout(trickLenOverride = null) {
  if (!tableDominoDebugReadout) return;
  const trickLen = trickLenOverride != null
    ? Number(trickLenOverride)
    : Number(roomState?.trick?.length || 0);
  tableDominoDebugReadout.textContent = `Trick: ${trickLen} | Rendered: ${tablePlayRoot.children.length} | tabletopY: ${tableMetrics.topY.toFixed(3)}`;
}

function renderTableTrick(trick) {
  clearGroup(tablePlayRoot);
  const plays = Array.isArray(trick) ? trick : [];
  if (!plays.length) {
    updateTableDominoDebugReadout(0);
    return;
  }

  const localSeat = getLocalSeat();
  const seatBasis = getSeatBasisForHandLayout(Number.isInteger(localSeat) ? localSeat : 0);
  const tableScale = clampValue(Number(viewSettings.tableDominoScale), 0.05, 25.0, 1.0);
  const centerY = tableMetrics.topY + Math.max(0.012, DOMINO_TILE_THICKNESS * Math.max(1, tableScale) + 0.004);
  const forwardTowardPlayer = seatBasis.forward.clone().multiplyScalar(-1);
  const anchor = new THREE.Vector3(0, centerY, 0).addScaledVector(forwardTowardPlayer, 0.15);
  const rowRight = seatBasis.right.clone().normalize();
  const dominoWidth = DOMINO_SHORT * tableScale;
  const gap = clampValue(dominoWidth * 0.35, 0.01, 0.02, 0.012);
  const spacing = Math.max(dominoWidth + gap, dominoWidth * 1.1);
  const startX = -((plays.length - 1) * spacing) * 0.5;
  const facingYaw = Math.atan2(seatBasis.forward.z, seatBasis.forward.x);

  for (let i = 0; i < plays.length; i += 1) {
    const play = plays[i];
    const mesh = createDominoTile(play.tile, {
      faceUp: true,
      glowCount: countTilePoints(play.tile) > 0,
      trumpSuit: roomState?.trumpSuit,
      useMagentaTrump: roomState?.mode === MODES.TRUMPS,
      mode: roomState?.mode || MODES.TRUMPS,
      orientation: 'portrait',
      scale: tableScale
    });
    mesh.position.copy(anchor).addScaledVector(rowRight, startX + i * spacing);
    mesh.rotation.set(0, facingYaw, 0);
    mesh.userData.tableDomino = true;
    tablePlayRoot.add(mesh);

    if (showTableDominoBounds) {
      const helper = new THREE.BoxHelper(mesh, 0xf5d36a);
      helper.material.depthTest = false;
      helper.material.transparent = true;
      helper.material.opacity = 0.9;
      tablePlayRoot.add(helper);
    }
  }

  updateTableDominoDebugReadout(plays.length);
}

function renderHandsAndTrick() {
  clearGroup(handGroup);
  clearGroup(oppHandGroup);
  clearGroup(tablePlayRoot);
  localHandScreenBounds.valid = false;

  if (!roomState) return;

  oppHandGroup.add(burnGroupA);
  oppHandGroup.add(burnGroupB);

  const localSeat = getLocalSeat();
  const myHand = localSeat != null ? roomState.hands?.[localSeat] || [] : [];

  if (myHand.length) {
    layoutPlayerHandDominos(localSeat, myHand, viewSettings);
  }

  for (let seatIndex = 0; seatIndex < 4; seatIndex += 1) {
    if (seatIndex === localSeat) continue;
    const count = roomState.handCounts?.[seatIndex] || 0;
    const basis = getSeatBasisForHandLayout(seatIndex);
    const stackBase = basis.base
      .clone()
      .addScaledVector(basis.forward, 0.18)
      .addScaledVector(basis.up, 0.01);
    const yaw = Math.atan2(basis.right.z, basis.right.x);

    for (let i = 0; i < count; i += 1) {
      const mesh = createDomino3D({ a: 0, b: 0, id: 'back' }, { faceUp: false, scale: DOMINO_SCALE * 0.92 });
      mesh.position.copy(stackBase)
        .addScaledVector(basis.up, i * 0.008)
        .addScaledVector(basis.right, (i % 2 === 0 ? -1 : 1) * 0.01);
      mesh.rotation.y = yaw;
      oppHandGroup.add(mesh);
    }
  }

  renderTableTrick(roomState.trick || []);

  renderBurnPiles();
  if (typeof handGroup.userData.refreshSelection === 'function') {
    handGroup.userData.refreshSelection();
  }
}

function renderBurnPiles() {
  clearGroup(burnGroupA);
  clearGroup(burnGroupB);
}

function updateHud() {
  if (!roomState) {
    hudBidValue.textContent = '-';
    hudTrumpValue.textContent = '-';
    turnTimerHud.textContent = 'TIME: --';
    updateScoreboard();
    updateMarksMenu();
    updateBurnPanels();
    updateTimerControls();
    updateEnvironmentControls();
    updateTableDominoDebugReadout(0);
    return;
  }

  hudBidValue.textContent = roomState.bidValue == null ? '-' : String(roomState.bidValue);
  hudTrumpValue.textContent = currentTrumpLabel();

  updateScoreboard();
  updateMarksMenu();
  updateBurnPanels();
  updateTimerControls();
  updateEnvironmentControls();
  updateTableDominoDebugReadout(roomState.trick?.length || 0);
}

function updateTimerControls() {
  const isHost = roomState?.hostClientId === localClientId;
  const enabled = !!roomState?.turnTimerEnabled;
  const paused = !!roomState?.turnTimerPaused;
  const connected = isConnected();
  timerEnabledToggle.checked = enabled;
  timerEnabledToggle.disabled = !connected || !isHost || !roomState;
  timerPauseBtn.disabled = !connected || !isHost || !roomState || !enabled;
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
    setEnvironmentLoadStatus('loading');
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
  environmentSelect.disabled = !isConnected() || !roomState || !isHost;
  if (!roomState) {
    environmentStateText.textContent = `Current: ${entry?.name || safeId}`;
  } else if (isHost) {
    environmentStateText.textContent = `Host selected: ${entry?.name || safeId}`;
  } else {
    environmentStateText.textContent = `Host controls background (${entry?.name || safeId})`;
  }
  if (!environmentLoadText?.textContent) {
    setEnvironmentLoadStatus(environmentLoadState || 'idle', environmentLoadDetail || '');
  }
}

function setupViewControls() {
  const bindSlider = (key) => {
    const input = viewInputs[key];
    if (!input) return;
    input.addEventListener('input', () => {
      const value = Number(input.value);
      if (!Number.isFinite(value)) return;
      viewSettings[key] = value;
      sanitizeViewSettings();
      updateViewControlsUi();
      persistViewSettings();
      safeApplyViewSettings(true);
      if (roomState) {
        renderHandsAndTrick();
        updateNameplatePositions();
      }
    });
  };

  for (const key of Object.keys(viewInputs)) {
    bindSlider(key);
  }

  copyViewBtn.addEventListener('click', async () => {
    const payload = JSON.stringify({
      distance: Number(viewSettings.distance),
      height: Number(viewSettings.height),
      forward: Number(viewSettings.forward),
      shoulder: Number(viewSettings.shoulder),
      lookAtY: Number(viewSettings.lookAtY),
      fov: Number(viewSettings.fov),
      pitchDeg: Number(viewSettings.pitchDeg),
      near: Number(viewSettings.near),
      handY: Number(viewSettings.handY),
      handZ: Number(viewSettings.handZ),
      handDominoScale: Number(viewSettings.handDominoScale),
      handDominoRotDeg: Number(viewSettings.handDominoRotDeg),
      tableDominoScale: Number(viewSettings.tableDominoScale)
    }, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      logMessage('View settings copied.');
    } catch {
      logMessage('Clipboard unavailable.');
    }
  });
}

function setupSceneTuningControls() {
  const bindSlider = (key) => {
    const input = sceneTuneInputs[key];
    if (!input) return;
    input.addEventListener('input', () => {
      const value = Number(input.value);
      if (!Number.isFinite(value)) return;
      sceneTuning[key] = value;
      updateSceneTuningUi();
      persistSceneTuning();
      applySceneTuning({ rerenderHand: true });
    });
  };

  for (const key of Object.keys(sceneTuneInputs)) {
    bindSlider(key);
  }

  resetSceneTuningBtn?.addEventListener('click', () => {
    localStorage.removeItem(SCENE_TUNING_STORAGE_KEY);
    Object.assign(sceneTuning, DEFAULT_SCENE_TUNING);
    updateSceneTuningUi();
    persistSceneTuning();
    applySceneTuning({ rerenderHand: true });
    logMessage('Scene tuning reset.');
  });

  copySceneTuningBtn?.addEventListener('click', async () => {
    const payload = JSON.stringify({
      tableScale: Number(sceneTuning.tableScale),
      chairScale: Number(sceneTuning.chairScale),
      avatarScale: Number(sceneTuning.avatarScale),
      seatRadius: Number(sceneTuning.seatRadius),
      avatarBack: Number(sceneTuning.avatarBack),
      avatarY: Number(sceneTuning.avatarY),
      chairY: Number(sceneTuning.chairY),
      tableY: Number(sceneTuning.tableY)
    }, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      logMessage('Scene tuning copied.');
    } catch {
      logMessage('Clipboard unavailable.');
    }
  });
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
  if (!isConnected()) {
    logMessage('Not connected to server.', 1800);
    return;
  }
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
  const connected = isConnected();

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
        <button data-action="claim" data-seat="${seat.seatIndex}" ${(!connected || roomState.phase !== PHASES.LOBBY || seat.occupantClientId) ? 'disabled' : ''}>Claim</button>
        <button data-action="release" data-seat="${seat.seatIndex}" ${(!connected || roomState.phase !== PHASES.LOBBY || (!occupiedByMe && !isHost) || !seat.occupantClientId) ? 'disabled' : ''}>Release</button>
      </div>
      <div class="controlRow">
        <label>Seat Type</label>
        <select data-action="setType" data-seat="${seat.seatIndex}" ${(!connected || !isHost || roomState.phase !== PHASES.LOBBY) ? 'disabled' : ''}>
          <option value="human" ${seat.type === 'human' ? 'selected' : ''}>human</option>
          <option value="cpu" ${seat.type === 'cpu' ? 'selected' : ''}>cpu</option>
        </select>
      </div>
      <div class="controlRow">
        <label>CPU Level</label>
        <select data-action="setCpu" data-seat="${seat.seatIndex}" ${(!connected || !isHost || roomState.phase !== PHASES.LOBBY) ? 'disabled' : ''}>
          <option value="0" ${seat.cpuLevel === 0 ? 'selected' : ''}>0</option>
          <option value="1" ${seat.cpuLevel === 1 ? 'selected' : ''}>1</option>
          <option value="2" ${seat.cpuLevel === 2 ? 'selected' : ''}>2</option>
          <option value="3" ${seat.cpuLevel === 3 ? 'selected' : ''}>3</option>
          <option value="4" ${seat.cpuLevel === 4 ? 'selected' : ''}>4</option>
        </select>
      </div>
      <div class="controlRow">
        <label>Avatar</label>
        <select data-action="avatar" data-seat="${seat.seatIndex}" ${(connected && canAvatarEdit) ? '' : 'disabled'}>
          ${avatarCatalog.map((entry) => `<option value="${entry.id}" ${entry.id === seat.avatarId ? 'selected' : ''}>${entry.name}</option>`).join('')}
        </select>
      </div>
      <div class="controlRow">
        <label>Name</label>
        <input data-action="nameInput" data-seat="${seat.seatIndex}" maxlength="24" value="${currentName.replace(/"/g, '&quot;')}" ${(connected && canNameEdit) ? '' : 'disabled'} />
        <button data-action="nameSave" data-seat="${seat.seatIndex}" ${(connected && canNameEdit) ? '' : 'disabled'}>Save Name</button>
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
    roomStatus.textContent = `Room ${roomState.roomId} | You are seat ${localSeat + 1}${isHost ? ' (Host)' : ''} | ${socketStatus}`;
  } else {
    roomStatus.textContent = roomState ? `Room ${roomState.roomId}${isHost ? ' | Host' : ''} | ${socketStatus}` : '';
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
  const connected = isConnected();

  if (!roomState || roomState.phase !== PHASES.BIDDING) {
    passBtn.disabled = true;
    updateNameplates();
    return;
  }

  const canBid = connected && localTurnToBid();
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
  const connected = isConnected();
  const canChooseMode = connected && roomState && roomState.phase === PHASES.CHOOSE_MODE && localIsBidder();
  const canChooseTrump = connected && roomState && roomState.phase === PHASES.CHOOSE_TRUMP && localIsBidder() && roomState.mode === MODES.TRUMPS;

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
  if (room?.localClientId) {
    localClientId = String(room.localClientId);
    localStorage.setItem(PLAYER_ID_STORAGE_KEY, localClientId);
  }
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

function resetRoomLocally() {
  roomState = null;
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
}

function sendClientHello() {
  emitSafe('client:hello', {
    clientVersion: CLIENT_VERSION,
    lastKnownGameId: roomState?.roomId || roomIdInput.value.trim() || null,
    lastKnownPlayerId: localClientId || localStorage.getItem(PLAYER_ID_STORAGE_KEY) || null,
    lastKnownSeat: Number.isInteger(lastLocalSeat) ? lastLocalSeat : null,
    playerName: getStoredPlayerName()
  }, { requireConnected: false });
}

function handleServerPacket(data) {
  if (!data || typeof data !== 'object') return;

  if (data.type === 'welcome') {
    if (data.clientId) {
      localClientId = data.clientId;
      localStorage.setItem(PLAYER_ID_STORAGE_KEY, localClientId);
      renderSeatControls();
      updateNameplates();
    }
    roomStatus.textContent = `Connected as ${localClientId || 'unknown'}`;
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
}

function sendAction(action, payload = {}) {
  const sent = emitSafe('action', { action, payload }, { requireConnected: true });
  if (!sent) {
    if (Date.now() - lastDisconnectedToastAt > 900) {
      lastDisconnectedToastAt = Date.now();
      logMessage('Not connected to server.', 1800);
    }
    return false;
  }
  return true;
}

function connect() {
  const socketRef = getSocket();
  if (socketHandlersBound) {
    return;
  }
  socketHandlersBound = true;
  startSocketInfoPolling();

  socketRef.on('connect', () => {
    networkLastConnectAt = Date.now();
    networkLastDisconnectReason = '';
    syncSocketInfoFromSingleton();
    updateSocketUi();
    sendClientHello();
    logMessage('Connected', 1300);
  });

  socketRef.on('disconnect', (reason) => {
    networkLastDisconnectReason = String(reason || 'disconnect');
    syncSocketInfoFromSingleton();
    updateSocketUi();
    updateTimerControls();
    updateEnvironmentControls();
    updateBidControls();
    updateTrumpControls();
    renderSeatControls();
    logMessage('Disconnected from server.', 2000);
  });

  socketRef.on('connect_error', (error) => {
    socketLastError = String(error?.message || 'connect_error');
    syncSocketInfoFromSingleton();
    updateSocketUi();
    logMessage(`Socket error: ${socketLastError}`, 2200);
  });

  socketRef.on('packet', (payload) => {
    handleServerPacket(payload);
  });

  socketRef.on('game:state', (payload) => {
    const fullState = payload?.fullState || null;
    if (!fullState) {
      resetRoomLocally();
      return;
    }
    applySnapshot(fullState);
  });

  socketRef.on('player:identity', (payload) => {
    if (!payload || typeof payload !== 'object') return;
    if (payload.playerId) {
      localClientId = String(payload.playerId);
      localStorage.setItem(PLAYER_ID_STORAGE_KEY, localClientId);
    }
    renderSeatControls();
    updateNameplates();
  });

  socketRef.on('game:dominoPlayed', (payload) => {
    const trickState = Array.isArray(payload?.trickState) ? payload.trickState : null;
    if (trickState) {
      renderTableTrick(trickState);
    }
  });

  if (socketRef.connected) {
    networkLastConnectAt = Date.now();
    syncSocketInfoFromSingleton();
    updateSocketUi();
    sendClientHello();
  } else {
    socketRef.connect();
  }
}

async function loadHdrTexture(url) {
  try {
    const head = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    if (!head.ok) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    return await new RGBELoader().loadAsync(url);
  } catch (error) {
    console.warn('[env] HDR load failed, falling back', url, error);
    return null;
  }
}

async function initHdrEnvironment() {
  const fallbackEnv = () => {
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.05).texture;
    scene.environment = envTex;
    scene.background = null;
  };

  const hdrCandidates = [
    '/assets/environments/default_lounge/warm_interior_01.hdr',
    '/assets/hdr/warm_interior_01.hdr'
  ];

  for (const candidate of hdrCandidates) {
    const texture = await loadHdrTexture(candidate);
    if (!texture) continue;
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;
    scene.environment = envMap;
    scene.background = null;
    texture.dispose();
    return;
  }

  console.warn('[env] No HDR found; using RoomEnvironment fallback.');
  fallbackEnv();
}

function runBootStep(label, fn) {
  try {
    return fn();
  } catch (error) {
    console.error(`[boot] ${label} failed`, error);
    return null;
  }
}

function ensureButtons() {
  document.getElementById('createRoomBtn').addEventListener('click', async () => {
    if (!socket.connected) {
      logMessage('Not connected to server.', 1800);
      return;
    }
    const roomId = roomIdInput.value.trim() || undefined;
    const ack = await emitWithAckTimeout('room:create', { roomId }, 3000);
    if (!ack?.ok) {
      logMessage(ack?.message || 'Create room failed.', 2500);
      return;
    }
    if (ack.roomId) {
      roomIdInput.value = String(ack.roomId);
    }
  });

  document.getElementById('joinRoomBtn').addEventListener('click', async () => {
    if (!socket.connected) {
      logMessage('Not connected to server.', 1800);
      return;
    }
    const roomId = roomIdInput.value.trim();
    if (!roomId) {
      logMessage('Enter room ID first.');
      return;
    }
    const ack = await emitWithAckTimeout('room:join', { roomId }, 3000);
    if (!ack?.ok) {
      logMessage(ack?.message || 'Join failed.', 2500);
      return;
    }
    logMessage(`Joined room ${ack.roomId || roomId}`, 1800);
  });

  document.getElementById('leaveRoomBtn').addEventListener('click', () => {
    if (!sendAction('leaveRoom')) {
      return;
    }
    resetRoomLocally();
  });

  document.getElementById('startGameBtn').addEventListener('click', () => {
    sendAction('startGame');
  });

  document.getElementById('restartGameBtn').addEventListener('click', () => {
    sendAction('restartGame');
  });

  resetViewBtn.addEventListener('click', () => {
    localStorage.removeItem(VIEW_STORAGE_KEY);
    resetViewSettingsToDefault();
  });

  chairsVisibleToggle?.addEventListener('change', () => {
    chairsVisible = !!chairsVisibleToggle.checked;
    persistChairVisibility();
    chairsRoot.visible = chairsVisible;
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

  burnPanelOpacityInput?.addEventListener('input', () => {
    applyBurnPanelOpacity(burnPanelOpacityInput.value, { persist: true });
  });

  reconnectNowBtn?.addEventListener('click', () => {
    socket.disconnect();
    socket.connect();
  });

  pingServerBtn?.addEventListener('click', () => {
    if (!socket.connected) {
      logMessage('Not connected to server.', 1600);
      return;
    }
    socket.timeout(3000).emit('debug:ping', { t: Date.now() }, (err, ack) => {
      if (err) {
        logMessage('Ping timeout.', 1800);
        return;
      }
      logMessage(`Ping ok ${ack?.serverTime ? new Date(ack.serverTime).toLocaleTimeString() : ''}`, 1800);
    });
  });

  debugTableBoundsToggle?.addEventListener('change', () => {
    showTableDominoBounds = !!debugTableBoundsToggle.checked;
    renderTableTrick(roomState?.trick || []);
  });

  spawnTestDominoBtn?.addEventListener('click', () => {
    const testTile = { a: 6, b: 4, id: '6-4' };
    const mesh = createDominoTile(testTile, {
      faceUp: true,
      glowCount: true,
      trumpSuit: roomState?.trumpSuit,
      useMagentaTrump: roomState?.mode === MODES.TRUMPS,
      mode: roomState?.mode || MODES.TRUMPS,
      orientation: 'portrait',
      scale: Math.max(0.05, Number(viewSettings.tableDominoScale) || 1)
    });
    mesh.position.set(0, tableMetrics.topY + Math.max(0.008, DOMINO_TILE_THICKNESS * 0.8), 0);
    mesh.rotation.y = 0;
    tablePlayRoot.add(mesh);
    if (showTableDominoBounds) {
      const helper = new THREE.BoxHelper(mesh, 0xffd777);
      helper.material.depthTest = false;
      tablePlayRoot.add(helper);
    }
    updateTableDominoDebugReadout(roomState?.trick?.length || 0);
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
    const baseY = Number.isFinite(mesh.userData?.baseY) ? mesh.userData.baseY : DOMINO_Y;
    const targetY = baseY + (selected ? 0.016 : hovered ? 0.008 : 0);
    mesh.position.y = targetY;
    const topMat = Array.isArray(mesh.material) ? mesh.material[2] : mesh.material;
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

    if (!isConnected()) {
      if (Date.now() - lastDisconnectedToastAt > 900) {
        lastDisconnectedToastAt = Date.now();
        logMessage('Not connected to server.', 1800);
      }
      return;
    }

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
  safeApplyViewSettings(false);
  if (roomState) {
    renderHandsAndTrick();
  }
  controls.update();
  updateNameplatePositions();
  updatePenaltyEmojiPositions();
  updateTableDominoDebugReadout();
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
            preview: entry.preview ? String(entry.preview) : '',
            root: entry.root ? String(entry.root) : `/assets/environments/${String(entry.id)}`
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
      preview: '',
      root: `/assets/environments/${id}`
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

runBootStep('ensureButtons', ensureButtons);
runBootStep('connect', connect);

runBootStep('loadStoredViewSettings', loadStoredViewSettings);
runBootStep('loadStoredSceneTuning', loadStoredSceneTuning);
runBootStep('loadStoredChairVisibility', loadStoredChairVisibility);
runBootStep('loadStoredBurnPanelOpacity', loadStoredBurnPanelOpacity);
runBootStep('updateViewControlsUi', updateViewControlsUi);
runBootStep('updateSceneTuningUi', updateSceneTuningUi);
runBootStep('setupViewControls', setupViewControls);
runBootStep('setupSceneTuningControls', setupSceneTuningControls);
runBootStep('addPointerInteraction', addPointerInteraction);
runBootStep('showSections', showSections);
runBootStep('setPanelOpen', () => setPanelOpen(true));
runBootStep('updateScoreboard', updateScoreboard);
runBootStep('updateTimerControls', updateTimerControls);
runBootStep('updateTimerHud', updateTimerHud);
runBootStep('updateEnvironmentControls', updateEnvironmentControls);
runBootStep('updateSocketUi', updateSocketUi);
runBootStep('resetViewForLocalSeat', () => resetViewForLocalSeat(true));

void initHdrEnvironment().catch((error) => {
  console.error('[env] initHdrEnvironment failed', error);
});

Promise.all([loadAvatarManifest(), loadEnvironmentManifest(), loadEnvironmentModels()])
  .then(() => {
    renderSeatControls();
    renderAvatars();
  })
  .catch(() => {
    console.warn('[boot] manifest/model warmup failed; runtime fallbacks active');
  });

runBootStep('updateNameplates', updateNameplates);
runBootStep('animate', animate);
