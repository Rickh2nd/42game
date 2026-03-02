import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
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
  BETTING: 'betting',
  CHOOSE_MODE: 'chooseMode',
  CHOOSE_TRUMP: 'chooseTrump',
  PLAYING: 'playing',
  TRICK_PAUSE: 'trickPause',
  HAND_OVER: 'handOver'
};

const FLOOR_Y = 0;
const AVATAR_GLOBAL_NUDGE_Y = -0.06;
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
const AVATAR_Y_OFFSETS_STORAGE_KEY = 'texas42_avatar_y_offsets_v1';
const CHAIRS_VISIBLE_STORAGE_KEY = 'texas42_chairs_visible_v1';
const BURN_PANEL_OPACITY_STORAGE_KEY = 'texas42_burn_panel_opacity_v1';
const TABLE_HUD_STORAGE_KEY = 'texas42_table_hud_v1';
const BETTING_MODAL_STORAGE_KEY = 'texas42_bet_modal_pos_v1';
const BETTING_MODAL_STORAGE_KEY_LEGACY = 'texas42_betting_modal_v1';
const CHIP_WIDGET_STORAGE_KEY = 'texas42_chip_widget_pos_v1';
const HDRI_VARIANT_STORAGE_PREFIX = 'texas42_hdri_variant_';
const MUTE_STORAGE_KEY = 'texas42_mute_v1';
const PLAYER_ID_STORAGE_KEY = 'texas42_player_id';
const CLIENT_VERSION = '1.0.0';
const VIEW_SETTINGS_VERSION = 2;
const SCENE_TUNING_VERSION = 2;

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
const hudBidBlock = document.getElementById('hudBidBlock');
const hudTrumpBlock = document.getElementById('hudTrumpBlock');
const hudBidDragHandle = document.getElementById('hudBidDragHandle');
const hudTrumpDragHandle = document.getElementById('hudTrumpDragHandle');
const hudBidValue = document.getElementById('hudBidValue');
const hudTrumpValue = document.getElementById('hudTrumpValue');
const turnTimerHud = document.getElementById('turnTimerHud');
const bidTray = document.getElementById('bidTray');
const bidTrayTitle = document.getElementById('bidTrayTitle');
const bidTrayTimer = document.getElementById('bidTrayTimer');
const bidTrayStatus = document.getElementById('bidTrayStatus');
const bidTrayButtons = document.getElementById('bidTrayButtons');
const bidTrayPassBtn = document.getElementById('bidTrayPassBtn');
const modeTray = document.getElementById('modeTray');
const modeTrayTitle = document.getElementById('modeTrayTitle');
const modeTrayStatus = document.getElementById('modeTrayStatus');
const modeTrayButtons = document.getElementById('modeTrayButtons');
const trumpTray = document.getElementById('trumpTray');
const trumpTrayTitle = document.getElementById('trumpTrayTitle');
const trumpTrayStatus = document.getElementById('trumpTrayStatus');
const trumpTrayButtons = document.getElementById('trumpTrayButtons');
const chooserWaitBanner = document.getElementById('chooserWaitBanner');
const chipTray = document.getElementById('chipTray');
const chipTrayTitle = document.getElementById('chipTrayTitle');
const chipTrayBody = document.getElementById('chipTrayBody');
const chipTrayPotText = document.getElementById('chipTrayPotText');
const chipTrayButtons = document.getElementById('chipTrayButtons');
const chipInc1Btn = document.getElementById('chipInc1Btn');
const chipInc5Btn = document.getElementById('chipInc5Btn');
const chipInc10Btn = document.getElementById('chipInc10Btn');
const chipInc20Btn = document.getElementById('chipInc20Btn');
const chipYourBetText = document.getElementById('chipYourBetText');
const chipTotalsWidget = document.getElementById('chipTotalsWidget');
const chipTotalsDragHandle = document.getElementById('chipTotalsDragHandle');
const chipTotalsList = document.getElementById('chipTotalsList');
const chipTotalsPot = document.getElementById('chipTotalsPot');
const timerEnabledToggle = document.getElementById('timerEnabledToggle');
const timerPauseBtn = document.getElementById('timerPauseBtn');
const timerStateText = document.getElementById('timerStateText');
const tableHudScaleInput = document.getElementById('table_hud_scale');
const tableHudScaleValue = document.getElementById('table_hud_scale_val');
const muteToggle = document.getElementById('muteToggle');
const bettingEnabledToggle = document.getElementById('bettingEnabledToggle');
const betAmountInput = document.getElementById('bet_amount');
const betAmountValue = document.getElementById('bet_amount_val');
const bettingStateText = document.getElementById('bettingStateText');
const bettingDebugText = document.getElementById('bettingDebugText');
const bettingTotals = document.getElementById('bettingTotals');
const resetViewBtn = document.getElementById('resetViewBtn');
const copyViewBtn = document.getElementById('copyViewBtn');
const settingsLoadText = document.getElementById('settingsLoadText');
const resetSceneTuningBtn = document.getElementById('resetSceneTuningBtn');
const copySceneTuningBtn = document.getElementById('copySceneTuningBtn');
const chairsVisibleToggle = document.getElementById('chairsVisibleToggle');
const debugTableBoundsToggle = document.getElementById('debugTableBoundsToggle');
const spawnTestDominoBtn = document.getElementById('spawnTestDominoBtn');
const tableDominoDebugReadout = document.getElementById('tableDominoDebugReadout');
const environmentSelect = document.getElementById('environmentSelect');
const hdriVariantSelect = document.getElementById('hdriVariantSelect');
const environmentPreview = document.getElementById('environmentPreview');
const environmentStateText = document.getElementById('environmentStateText');
const environmentLoadText = document.getElementById('environmentLoadText');
const decorLoadText = document.getElementById('decorLoadText');
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
const sectionBetting = document.getElementById('section-betting');
const sectionLighting = document.getElementById('section-lighting');
const sectionDebugTable = document.getElementById('section-debug-table');

const bidButtonsWrap = document.getElementById('bidButtons');
const trumpButtonsWrap = document.getElementById('trumpButtons');
const modeButtonsWrap = document.getElementById('modeButtons');

const avatarModal = document.getElementById('avatarModal');
const avatarModalBackdrop = document.getElementById('avatarModalBackdrop');
const closeAvatarModalBtn = document.getElementById('closeAvatarModalBtn');
const avatarGrid = document.getElementById('avatarGrid');
const avatarPickerStatus = document.getElementById('avatarPickerStatus');
const actionModal = document.getElementById('actionModal');
const actionModalTitle = document.getElementById('actionModalTitle');
const actionModalBody = document.getElementById('actionModalBody');
const actionModalButtons = document.getElementById('actionModalButtons');
const actionModalModeButtons = document.getElementById('actionModalModeButtons');
const decorBoundsToggle = document.getElementById('decorBoundsToggle');
const listLoadedPropsBtn = document.getElementById('listLoadedPropsBtn');
const decorTestSpawnBtn = document.getElementById('decorTestSpawnBtn');
const decorDebugList = document.getElementById('decorDebugList');

const lightingInputs = {
  decorGlobalScale: document.getElementById('decor_global_scale'),
  floorTextureScale: document.getElementById('floor_texture_scale'),
  wallTextureScale: document.getElementById('wall_texture_scale'),
  trimTextureScale: document.getElementById('trim_texture_scale'),
  keyIntensity: document.getElementById('light_key_intensity'),
  fillIntensity: document.getElementById('light_fill_intensity'),
  rimIntensity: document.getElementById('light_rim_intensity'),
  ambientIntensity: document.getElementById('light_ambient_intensity'),
  temperature: document.getElementById('light_temperature'),
  hdriIntensity: document.getElementById('light_hdri_intensity'),
  shadowDarkness: document.getElementById('light_shadow_darkness'),
  fogDensity: document.getElementById('light_fog_density')
};

const LIGHTING_ONLY_KEYS = [
  'keyIntensity',
  'fillIntensity',
  'rimIntensity',
  'ambientIntensity',
  'temperature',
  'hdriIntensity',
  'shadowDarkness',
  'fogDensity'
];

const lightingValueLabels = {
  decorGlobalScale: document.getElementById('decor_global_scale_val'),
  floorTextureScale: document.getElementById('floor_texture_scale_val'),
  wallTextureScale: document.getElementById('wall_texture_scale_val'),
  trimTextureScale: document.getElementById('trim_texture_scale_val'),
  keyIntensity: document.getElementById('light_key_intensity_val'),
  fillIntensity: document.getElementById('light_fill_intensity_val'),
  rimIntensity: document.getElementById('light_rim_intensity_val'),
  ambientIntensity: document.getElementById('light_ambient_intensity_val'),
  temperature: document.getElementById('light_temperature_val'),
  hdriIntensity: document.getElementById('light_hdri_intensity_val'),
  shadowDarkness: document.getElementById('light_shadow_darkness_val'),
  fogDensity: document.getElementById('light_fog_density_val')
};
const resetLightingBtn = document.getElementById('resetLightingBtn');
const resetTextureDetailBtn = document.getElementById('resetTextureDetailBtn');
const copyLightingBtn = document.getElementById('copyLightingBtn');
const lightingStateText = document.getElementById('lightingStateText');

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
    stack: document.getElementById('burn-hands-team1') || document.getElementById('burn-row-team1')
  },
  teamB: {
    title: document.getElementById('burn-title-team2'),
    stats: document.getElementById('burn-stats-team2'),
    stack: document.getElementById('burn-hands-team2') || document.getElementById('burn-row-team2')
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
  tableDominoScale: document.getElementById('table_domino_scale'),
  tableDominoTiltDeg: document.getElementById('table_domino_tilt_deg')
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
  tableDominoScale: document.getElementById('table_domino_scale_val'),
  tableDominoTiltDeg: document.getElementById('table_domino_tilt_deg_val')
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
const seatAvatarYOffsetInputs = [
  document.getElementById('tune_seat0_avatar_y'),
  document.getElementById('tune_seat1_avatar_y'),
  document.getElementById('tune_seat2_avatar_y'),
  document.getElementById('tune_seat3_avatar_y')
];

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
const seatAvatarYOffsetLabels = [
  document.getElementById('tune_seat0_avatar_y_val'),
  document.getElementById('tune_seat1_avatar_y_val'),
  document.getElementById('tune_seat2_avatar_y_val'),
  document.getElementById('tune_seat3_avatar_y_val')
];

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

const seatsRoot = new THREE.Group();
seatsRoot.name = 'seatsRoot';
tableRoot.add(seatsRoot);

const chairsRoot = new THREE.Group();
chairsRoot.name = 'chairsRoot';
seatsRoot.add(chairsRoot);

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
  seatsRoot.add(g);
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
  floorY: FLOOR_Y,
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
const tmpMeshBox = new THREE.Box3();
const tmpGeoBox = new THREE.Box3();

const avatarCatalog = [];
const avatarById = new Map();
const environmentCatalog = [];
const environmentById = new Map();
let currentEnvironmentId = null;
let environmentApplyToken = 0;
let environmentLoadState = 'idle';
let environmentLoadDetail = '';
const decorDebugState = {
  props: [],
  helpers: [],
  sharedCatalog: null,
  failures: [],
  requested: 0
};
const loggedDecorScaleFolders = new Set();
let sharedPropCatalogLogged = false;
let showDecorBounds = false;
const envLightingStateById = new Map();
let activeLightingState = null;
let currentFogColor = '#1f1f1f';
let currentFogNear = 22;
let currentFogFar = 70;

const timeoutPenaltyBySeat = new Map();
const tempV3C = new THREE.Vector3();
const tempV3D = new THREE.Vector3();

const DEFAULT_VIEW_SETTINGS = {
  distance: 9.58,
  height: 7.88,
  forward: 5.86,
  shoulder: -0.26,
  lookAtY: -0.26,
  fov: 63,
  pitchDeg: 0,
  near: 0.08,
  handY: 0.49,
  handZ: 0.54,
  handDominoScale: 16.86,
  handDominoRotDeg: 88,
  tableDominoScale: 24.81,
  tableDominoTiltDeg: 16.5
};

const viewSettings = { ...DEFAULT_VIEW_SETTINGS };

const DEFAULT_SCENE_TUNING = {
  tableScale: 2.1,
  chairScale: 1.79,
  avatarScale: 1.76,
  seatRadius: 5.96,
  avatarBack: -0.39,
  avatarY: -0.01,
  chairY: 0.01,
  tableY: 0,
  seatAvatarYOffset: [0.37, 0.015, 0.17, 0.11]
};

const SCENE_TUNING_NUMERIC_KEYS = [
  'tableScale',
  'chairScale',
  'avatarScale',
  'seatRadius',
  'avatarBack',
  'avatarY',
  'chairY',
  'tableY'
];

const sceneTuning = {
  tableScale: DEFAULT_SCENE_TUNING.tableScale,
  chairScale: DEFAULT_SCENE_TUNING.chairScale,
  avatarScale: DEFAULT_SCENE_TUNING.avatarScale,
  seatRadius: DEFAULT_SCENE_TUNING.seatRadius,
  avatarBack: DEFAULT_SCENE_TUNING.avatarBack,
  avatarY: DEFAULT_SCENE_TUNING.avatarY,
  chairY: DEFAULT_SCENE_TUNING.chairY,
  tableY: DEFAULT_SCENE_TUNING.tableY
};
const avatarSeatYOffsets = [...DEFAULT_SCENE_TUNING.seatAvatarYOffset];
const DEFAULT_BURN_PANEL_OPACITY = 0.55;
let burnPanelOpacity = DEFAULT_BURN_PANEL_OPACITY;
const DEFAULT_TABLE_HUD_SETTINGS = {
  scale: 1,
  bidOffsetX: 0,
  bidOffsetY: 0,
  trumpOffsetX: 0,
  trumpOffsetY: 0
};
const tableHudSettings = { ...DEFAULT_TABLE_HUD_SETTINGS };
const DEFAULT_CHIP_WIDGET_SETTINGS = {
  offsetX: 0,
  offsetY: 0
};
const chipWidgetSettings = { ...DEFAULT_CHIP_WIDGET_SETTINGS };
const DEFAULT_HDRI_VARIANT = 'primary';
let chipBetDraftAmount = 0;
const hdriVariantByEnv = new Map();

const ENV_HDRI_CHOICES = {
  casino_lounge: {
    primary: '/assets/environments/_shared/hdri/anniversary_lounge_4k.exr',
    alt: '/assets/environments/_shared/hdri/wooden_lounge_4k.exr'
  },
  spooky_parlor: {
    primary: '/assets/environments/_shared/hdri/kiara_interior_4k.exr',
    alt: '/assets/environments/_shared/hdri/indoor_pool_4k.exr'
  },
  rustic_tavern: {
    primary: '/assets/environments/_shared/hdri/small_workshop_4k.exr',
    alt: '/assets/environments/_shared/hdri/wooden_studio_01_4k.exr'
  },
  modern_suite: {
    primary: '/assets/environments/_shared/hdri/de_balie_4k.exr',
    alt: '/assets/environments/_shared/hdri/aft_lounge_4k.exr'
  },
  neon_arcade: {
    primary: '/assets/environments/_shared/hdri/wooden_studio_11_4k.exr',
    alt: '/assets/environments/_shared/hdri/wooden_studio_09_4k.exr'
  }
};

const DECOR_SCALE_STORAGE_PREFIX = 'texas42_decor_scale_';
const DECOR_SCALE_STORAGE_SUFFIX = '_v1';
const TEXTURE_DETAIL_STORAGE_PREFIX = 'tex_detail_';
const envDecorScaleById = new Map();
const envTextureDetailById = new Map();

function getEnvironmentBaseRepeats(envId) {
  if (envId === 'casino_lounge') {
    return {
      floor: [10, 10],
      walls: [4, 3],
      trim: [10, 2]
    };
  }
  return {
    floor: [14, 14],
    walls: [5, 4],
    trim: [10, 2]
  };
}

const LIGHTING_STORAGE_PREFIX = 'texas42_lighting_';
const LIGHTING_STORAGE_SUFFIX = '_v1';
const DEFAULT_LIGHTING = {
  keyIntensity: 1.0,
  fillIntensity: 0.3,
  rimIntensity: 0.2,
  ambientIntensity: 0.5,
  temperature: 5200,
  hdriIntensity: 1.0,
  shadowDarkness: 0.35,
  fogDensity: 0
};

let muted = false;
let audioCtx = null;
let audioUnlocked = false;
let audioWarnedUnlocked = false;
let audioWarnedMissing = false;
const audioElements = {
  thud: null,
  party: null
};
let pendingSeatTypeTransformGuard = null;
let draggingHudBlock = null;
let hudPointerId = null;
let hudDragStart = { x: 0, y: 0 };
let hudOffsetStart = { x: 0, y: 0 };
let draggingChipWidget = false;
let chipWidgetPointerId = null;
let chipWidgetDragStart = { x: 0, y: 0 };
let chipWidgetOffsetStart = { x: 0, y: 0 };
let lastAvatarFloorClampTs = 0;

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
let viewSettingsLoadSource = 'defaults';
let sceneTuningLoadSource = 'defaults';
let pendingBettingOpenEvent = null;
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

function updateSettingsLoadedText() {
  if (!settingsLoadText) return;
  settingsLoadText.textContent = `Settings Loaded | view source: ${viewSettingsLoadSource} | scene source: ${sceneTuningLoadSource}`;
}

function applyDefaultViewSettings() {
  Object.assign(viewSettings, DEFAULT_VIEW_SETTINGS);
  sanitizeViewSettings();
}

function buildViewSettingsPayload() {
  return {
    version: VIEW_SETTINGS_VERSION,
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
    tableDominoScale: Number(viewSettings.tableDominoScale),
    tableDominoTiltDeg: Number(viewSettings.tableDominoTiltDeg)
  };
}

function loadStoredViewSettings() {
  applyDefaultViewSettings();
  viewSettingsLoadSource = 'defaults';
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY);
    if (!raw) {
      persistViewSettings();
      updateSettingsLoadedText();
      return;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      persistViewSettings();
      updateSettingsLoadedText();
      return;
    }

    let hasAnySavedValue = false;
    for (const key of Object.keys(DEFAULT_VIEW_SETTINGS)) {
      if (Number.isFinite(Number(parsed[key]))) {
        viewSettings[key] = Number(parsed[key]);
        hasAnySavedValue = true;
      }
    }
    if (!hasAnySavedValue) {
      applyDefaultViewSettings();
      viewSettingsLoadSource = 'defaults';
    } else {
      viewSettingsLoadSource = 'storage';
    }
    sanitizeViewSettings();

    const storedVersion = Number(parsed.version || 1);
    if (!Number.isFinite(storedVersion) || storedVersion < VIEW_SETTINGS_VERSION) {
      persistViewSettings();
    }
  } catch {
    applyDefaultViewSettings();
    viewSettingsLoadSource = 'defaults';
    persistViewSettings();
  }
  updateSettingsLoadedText();
}

function persistViewSettings() {
  sanitizeViewSettings();
  localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(buildViewSettingsPayload()));
}

function applyDefaultSceneTuningSettings() {
  for (const key of SCENE_TUNING_NUMERIC_KEYS) {
    sceneTuning[key] = Number(DEFAULT_SCENE_TUNING[key]);
  }
  for (let i = 0; i < 4; i += 1) {
    avatarSeatYOffsets[i] = Number(DEFAULT_SCENE_TUNING.seatAvatarYOffset?.[i] ?? 0);
  }
  sanitizeSceneTuning();
  sanitizeAvatarSeatOffsets();
}

function buildSceneTuningPayload() {
  return {
    version: SCENE_TUNING_VERSION,
    tableScale: Number(sceneTuning.tableScale),
    chairScale: Number(sceneTuning.chairScale),
    avatarScale: Number(sceneTuning.avatarScale),
    seatRadius: Number(sceneTuning.seatRadius),
    avatarBack: Number(sceneTuning.avatarBack),
    avatarY: Number(sceneTuning.avatarY),
    chairY: Number(sceneTuning.chairY),
    tableY: Number(sceneTuning.tableY),
    seatAvatarYOffset: avatarSeatYOffsets.map((value) => Number(value))
  };
}

function loadStoredSceneTuning() {
  applyDefaultSceneTuningSettings();
  sceneTuningLoadSource = 'defaults';
  try {
    const raw = localStorage.getItem(SCENE_TUNING_STORAGE_KEY);
    if (!raw) {
      try {
        const legacyRaw = localStorage.getItem(AVATAR_Y_OFFSETS_STORAGE_KEY);
        if (legacyRaw) {
          const legacyParsed = JSON.parse(legacyRaw);
          if (Array.isArray(legacyParsed)) {
            for (let i = 0; i < 4; i += 1) {
              avatarSeatYOffsets[i] = Number(legacyParsed[i] ?? avatarSeatYOffsets[i]);
            }
            sanitizeAvatarSeatOffsets();
          }
        }
      } catch {
        // ignore legacy payload parse failures
      }
      persistSceneTuning();
      localStorage.removeItem(AVATAR_Y_OFFSETS_STORAGE_KEY);
      updateSettingsLoadedText();
      return;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      persistSceneTuning();
      localStorage.removeItem(AVATAR_Y_OFFSETS_STORAGE_KEY);
      updateSettingsLoadedText();
      return;
    }

    let hasAnyNumeric = false;
    for (const key of SCENE_TUNING_NUMERIC_KEYS) {
      if (Number.isFinite(Number(parsed[key]))) {
        sceneTuning[key] = Number(parsed[key]);
        hasAnyNumeric = true;
      }
    }
    if (!hasAnyNumeric) {
      for (const key of SCENE_TUNING_NUMERIC_KEYS) {
        sceneTuning[key] = Number(DEFAULT_SCENE_TUNING[key]);
      }
      sceneTuningLoadSource = 'defaults';
    } else {
      sceneTuningLoadSource = 'storage';
    }

    let offsetLoaded = false;
    if (Array.isArray(parsed.seatAvatarYOffset)) {
      for (let i = 0; i < 4; i += 1) {
        avatarSeatYOffsets[i] = Number(parsed.seatAvatarYOffset[i] ?? avatarSeatYOffsets[i]);
      }
      offsetLoaded = true;
    }
    if (!offsetLoaded) {
      try {
        const legacyRaw = localStorage.getItem(AVATAR_Y_OFFSETS_STORAGE_KEY);
        if (legacyRaw) {
          const legacyParsed = JSON.parse(legacyRaw);
          if (Array.isArray(legacyParsed)) {
            for (let i = 0; i < 4; i += 1) {
              avatarSeatYOffsets[i] = Number(legacyParsed[i] ?? avatarSeatYOffsets[i]);
            }
            offsetLoaded = true;
          }
        }
      } catch {
        // ignore legacy payload parse failures
      }
    }
    if (!offsetLoaded) {
      for (let i = 0; i < 4; i += 1) {
        avatarSeatYOffsets[i] = Number(DEFAULT_SCENE_TUNING.seatAvatarYOffset?.[i] ?? avatarSeatYOffsets[i]);
      }
    }

    sanitizeSceneTuning();
    sanitizeAvatarSeatOffsets();
    const storedVersion = Number(parsed.version || 1);
    if (!Number.isFinite(storedVersion) || storedVersion < SCENE_TUNING_VERSION || !Array.isArray(parsed.seatAvatarYOffset)) {
      persistSceneTuning();
    }
    localStorage.removeItem(AVATAR_Y_OFFSETS_STORAGE_KEY);
  } catch {
    applyDefaultSceneTuningSettings();
    sceneTuningLoadSource = 'defaults';
    persistSceneTuning();
    localStorage.removeItem(AVATAR_Y_OFFSETS_STORAGE_KEY);
  }
  updateSettingsLoadedText();
}

function persistSceneTuning() {
  sanitizeSceneTuning();
  sanitizeAvatarSeatOffsets();
  localStorage.setItem(SCENE_TUNING_STORAGE_KEY, JSON.stringify(buildSceneTuningPayload()));
}

function sanitizeAvatarSeatOffsets() {
  for (let i = 0; i < avatarSeatYOffsets.length; i += 1) {
    avatarSeatYOffsets[i] = clampValue(Number(avatarSeatYOffsets[i]), -5, 5, 0);
  }
}

function loadStoredAvatarSeatOffsets() {
  // Legacy no-op: seat offsets are now persisted within SCENE_TUNING_STORAGE_KEY.
  sanitizeAvatarSeatOffsets();
}

function persistAvatarSeatOffsets() {
  sanitizeAvatarSeatOffsets();
  persistSceneTuning();
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
  return clampValue(value, 0.01, 1.0, DEFAULT_BURN_PANEL_OPACITY);
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

function sanitizeTableHudSettings() {
  tableHudSettings.bidOffsetX = clampValue(Number(tableHudSettings.bidOffsetX), -1400, 1400, 0);
  tableHudSettings.bidOffsetY = clampValue(Number(tableHudSettings.bidOffsetY), -900, 900, 0);
  tableHudSettings.trumpOffsetX = clampValue(Number(tableHudSettings.trumpOffsetX), -1400, 1400, 0);
  tableHudSettings.trumpOffsetY = clampValue(Number(tableHudSettings.trumpOffsetY), -900, 900, 0);
  tableHudSettings.scale = clampValue(Number(tableHudSettings.scale), 0.15, 10.5, 1);
}

function applyTableHudSettings({ persist = false } = {}) {
  sanitizeTableHudSettings();
  document.documentElement.style.setProperty('--hudBidOffsetX', `${tableHudSettings.bidOffsetX.toFixed(1)}px`);
  document.documentElement.style.setProperty('--hudBidOffsetY', `${tableHudSettings.bidOffsetY.toFixed(1)}px`);
  document.documentElement.style.setProperty('--hudTrumpOffsetX', `${tableHudSettings.trumpOffsetX.toFixed(1)}px`);
  document.documentElement.style.setProperty('--hudTrumpOffsetY', `${tableHudSettings.trumpOffsetY.toFixed(1)}px`);
  document.documentElement.style.setProperty('--tableHudScale', `${tableHudSettings.scale.toFixed(2)}`);
  if (tableHudScaleInput) {
    tableHudScaleInput.value = tableHudSettings.scale.toFixed(2);
  }
  if (tableHudScaleValue) {
    tableHudScaleValue.textContent = tableHudSettings.scale.toFixed(2);
  }
  if (persist) {
    localStorage.setItem(TABLE_HUD_STORAGE_KEY, JSON.stringify({
      scale: Number(tableHudSettings.scale),
      bidOffsetX: Number(tableHudSettings.bidOffsetX),
      bidOffsetY: Number(tableHudSettings.bidOffsetY),
      trumpOffsetX: Number(tableHudSettings.trumpOffsetX),
      trumpOffsetY: Number(tableHudSettings.trumpOffsetY)
    }));
  }
}

function loadStoredTableHudSettings() {
  try {
    const raw = localStorage.getItem(TABLE_HUD_STORAGE_KEY);
    if (!raw) {
      applyTableHudSettings();
      return;
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      tableHudSettings.bidOffsetX = Number(parsed.bidOffsetX ?? parsed.offsetX ?? tableHudSettings.bidOffsetX);
      tableHudSettings.bidOffsetY = Number(parsed.bidOffsetY ?? parsed.offsetY ?? tableHudSettings.bidOffsetY);
      tableHudSettings.trumpOffsetX = Number(parsed.trumpOffsetX ?? tableHudSettings.trumpOffsetX);
      tableHudSettings.trumpOffsetY = Number(parsed.trumpOffsetY ?? tableHudSettings.trumpOffsetY);
      tableHudSettings.scale = Number(parsed.scale ?? tableHudSettings.scale);
    }
  } catch {
    // ignore invalid payload
  }
  applyTableHudSettings();
}

function sanitizeChipWidgetSettings() {
  chipWidgetSettings.offsetX = clampValue(Number(chipWidgetSettings.offsetX), -1400, 1400, 0);
  chipWidgetSettings.offsetY = clampValue(Number(chipWidgetSettings.offsetY), -900, 900, 0);
}

function applyChipWidgetSettings({ persist = false } = {}) {
  sanitizeChipWidgetSettings();
  document.documentElement.style.setProperty('--chipWidgetOffsetX', `${chipWidgetSettings.offsetX.toFixed(1)}px`);
  document.documentElement.style.setProperty('--chipWidgetOffsetY', `${chipWidgetSettings.offsetY.toFixed(1)}px`);
  if (persist) {
    localStorage.setItem(CHIP_WIDGET_STORAGE_KEY, JSON.stringify({
      offsetX: Number(chipWidgetSettings.offsetX),
      offsetY: Number(chipWidgetSettings.offsetY)
    }));
  }
}

function loadStoredChipWidgetSettings() {
  try {
    const raw = localStorage.getItem(CHIP_WIDGET_STORAGE_KEY)
      || localStorage.getItem(BETTING_MODAL_STORAGE_KEY)
      || localStorage.getItem(BETTING_MODAL_STORAGE_KEY_LEGACY);
    if (!raw) {
      applyChipWidgetSettings();
      return;
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      chipWidgetSettings.offsetX = Number(parsed.offsetX ?? chipWidgetSettings.offsetX);
      chipWidgetSettings.offsetY = Number(parsed.offsetY ?? chipWidgetSettings.offsetY);
    }
  } catch {
    // ignore invalid payload
  }
  localStorage.removeItem(BETTING_MODAL_STORAGE_KEY_LEGACY);
  applyChipWidgetSettings();
}

function sanitizeHdriVariant(value) {
  return value === 'alt' ? 'alt' : 'primary';
}

function hdriVariantStorageKey(environmentId) {
  return `${HDRI_VARIANT_STORAGE_PREFIX}${String(environmentId || '').trim()}`;
}

function getHdriVariantForEnvironment(environmentId) {
  const envId = String(environmentId || '').trim();
  if (!envId) return DEFAULT_HDRI_VARIANT;
  if (!ENV_HDRI_CHOICES[envId]) return DEFAULT_HDRI_VARIANT;
  if (hdriVariantByEnv.has(envId)) {
    return hdriVariantByEnv.get(envId);
  }
  let variant = DEFAULT_HDRI_VARIANT;
  try {
    const raw = localStorage.getItem(hdriVariantStorageKey(envId));
    if (raw) variant = sanitizeHdriVariant(raw);
  } catch {
    variant = DEFAULT_HDRI_VARIANT;
  }
  hdriVariantByEnv.set(envId, variant);
  return variant;
}

function setHdriVariantForEnvironment(environmentId, variant, { persist = true } = {}) {
  const envId = String(environmentId || '').trim();
  if (!envId || !ENV_HDRI_CHOICES[envId]) return;
  const safeVariant = sanitizeHdriVariant(variant);
  hdriVariantByEnv.set(envId, safeVariant);
  if (persist) {
    try {
      localStorage.setItem(hdriVariantStorageKey(envId), safeVariant);
    } catch {
      // ignore storage failures
    }
  }
}

function setMuted(value, { persist = false } = {}) {
  muted = !!value;
  if (muteToggle) {
    muteToggle.checked = muted;
  }
  if (persist) {
    localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
  }
}

function loadStoredMuteSetting() {
  const raw = localStorage.getItem(MUTE_STORAGE_KEY);
  setMuted(raw === '1', { persist: false });
}

function ensureAudioContext() {
  if (audioCtx) return audioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audioCtx = new Ctx();
  return audioCtx;
}

function initAudioManager() {
  if (!audioElements.thud) {
    audioElements.thud = new Audio('/assets/sounds/thud.wav');
    audioElements.thud.preload = 'auto';
  }
  if (!audioElements.party) {
    audioElements.party = new Audio('/assets/sounds/party.wav');
    audioElements.party.preload = 'auto';
  }
}

async function unlockAudio() {
  initAudioManager();
  const ctx = ensureAudioContext();
  if (!ctx) {
    audioUnlocked = true;
    return true;
  }
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      // keep trying on next gesture
    }
  }
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.00001;
    osc.frequency.value = 220;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.02);
  } catch {
    // ignore warmup failures
  }
  audioUnlocked = ctx.state === 'running';
  if (!audioUnlocked) {
    audioWarnedUnlocked = false;
  }
  for (const clip of Object.values(audioElements)) {
    if (!clip) continue;
    try {
      const prevVolume = clip.volume;
      clip.volume = 0;
      clip.currentTime = 0;
      const p = clip.play();
      if (p && typeof p.then === 'function') {
        await p;
      }
      clip.pause();
      clip.currentTime = 0;
      clip.volume = prevVolume;
    } catch {
      // ignore element unlock failure; clip may still play after subsequent gestures
    }
  }
  return audioUnlocked;
}

function playAudioClip(type) {
  if (muted) return;
  initAudioManager();
  if (!audioUnlocked) {
    if (!audioWarnedUnlocked) {
      audioWarnedUnlocked = true;
      console.warn('[audio] not unlocked yet');
    }
    return;
  }
  const base = audioElements[type];
  if (!base || !base.src) {
    if (!audioWarnedMissing) {
      audioWarnedMissing = true;
      console.warn('[audio] file missing');
    }
    return;
  }
  const clip = base.cloneNode(true);
  clip.muted = muted;
  clip.volume = type === 'thud' ? 0.5 : 0.65;
  clip.play().catch((error) => {
    if (!audioWarnedMissing) {
      audioWarnedMissing = true;
      console.warn('[audio] playback failed', error);
    }
  });
}

function playDominoThud() {
  playAudioClip('thud');
}

function playPartyBlower() {
  playAudioClip('party');
}

function playFallbackPartySynth() {
  const ctx = ensureAudioContext();
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(360, now);
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.16);
  osc.frequency.exponentialRampToValueAtTime(520, now + 0.45);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.11, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.52);
}

function captureSeatTypeTransformSnapshot() {
  const tablePos = {
    x: Number(tableRoot.position.x || 0),
    y: Number(tableRoot.position.y || 0),
    z: Number(tableRoot.position.z || 0)
  };
  const environmentPos = {
    x: Number(environmentGroup.position.x || 0),
    y: Number(environmentGroup.position.y || 0),
    z: Number(environmentGroup.position.z || 0)
  };
  const seatPos = avatarSeatGroups.map((group) => ({
    x: Number(group.position.x || 0),
    y: Number(group.position.y || 0),
    z: Number(group.position.z || 0)
  }));
  const chairPos = chairSeatGroups.map((group) => ({
    x: Number(group.position.x || 0),
    y: Number(group.position.y || 0),
    z: Number(group.position.z || 0)
  }));
  const avatarSlotPos = avatarSeatGroups.map((group) => ({
    x: Number(group.position.x || 0),
    y: Number(group.position.y || 0),
    z: Number(group.position.z || 0)
  }));
  return {
    tablePos,
    environmentPos,
    seatPos,
    chairPos,
    avatarSlotPos
  };
}

function restoreSeatTypeTransformSnapshot(snapshot) {
  if (!snapshot) return;
  tableRoot.position.set(
    Number(snapshot.tablePos?.x || 0),
    Number(snapshot.tablePos?.y || 0),
    Number(snapshot.tablePos?.z || 0)
  );
  environmentGroup.position.set(
    Number(snapshot.environmentPos?.x || 0),
    Number(snapshot.environmentPos?.y || 0),
    Number(snapshot.environmentPos?.z || 0)
  );
  for (let i = 0; i < avatarSeatGroups.length; i += 1) {
    const g = avatarSeatGroups[i];
    if (!g) continue;
    if (snapshot.seatPos?.[i]) {
      g.position.set(
        Number(snapshot.seatPos[i].x || 0),
        Number(snapshot.seatPos[i].y || 0),
        Number(snapshot.seatPos[i].z || 0)
      );
    }
  }
  for (let i = 0; i < chairSeatGroups.length; i += 1) {
    const g = chairSeatGroups[i];
    if (!g || !snapshot.chairPos?.[i]) continue;
    g.position.set(
      Number(snapshot.chairPos[i].x || 0),
      Number(snapshot.chairPos[i].y || 0),
      Number(snapshot.chairPos[i].z || 0)
    );
  }
}

function enforceSeatTypeTransformGuard() {
  if (!pendingSeatTypeTransformGuard) return;
  const before = pendingSeatTypeTransformGuard.before;
  const after = captureSeatTypeTransformSnapshot();
  const drift = (a, b) => Math.abs(Number(a || 0) - Number(b || 0));
  const vecDrift = (a, b) => drift(a?.x, b?.x) > 0.0005 || drift(a?.y, b?.y) > 0.0005 || drift(a?.z, b?.z) > 0.0005;
  const changed = vecDrift(after.tablePos, before.tablePos)
    || vecDrift(after.environmentPos, before.environmentPos)
    || after.seatPos.some((value, index) => vecDrift(value, before.seatPos[index]))
    || after.chairPos.some((value, index) => vecDrift(value, before.chairPos[index]))
    || after.avatarSlotPos.some((value, index) => vecDrift(value, before.avatarSlotPos[index]));

  if (changed) {
    console.warn('[seat-type-guard] Transform drift detected on seat type toggle. Restoring.', {
      tableBefore: before.tablePos,
      tableAfter: after.tablePos,
      envBefore: before.environmentPos,
      envAfter: after.environmentPos,
      seatBefore: before.seatPos,
      seatAfter: after.seatPos,
      chairBefore: before.chairPos,
      chairAfter: after.chairPos,
      avatarBefore: before.avatarSlotPos,
      avatarAfter: after.avatarSlotPos
    });
    restoreSeatTypeTransformSnapshot(before);
  } else {
    console.log('[seat-type-guard] stable', {
      before: {
        table: before.tablePos,
        env: before.environmentPos,
        seats: before.seatPos,
        chairs: before.chairPos,
        avatarSlots: before.avatarSlotPos
      },
      after: {
        table: after.tablePos,
        env: after.environmentPos,
        seats: after.seatPos,
        chairs: after.chairPos,
        avatarSlots: after.avatarSlotPos
      }
    });
  }
  pendingSeatTypeTransformGuard = null;
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
  spooky_parlor: {
    top: '#372b42',
    bottom: '#16111d',
    key: { color: 0xc7a4ff, intensity: 1.0, pos: [3.8, 7.0, 4.6] },
    fill: { color: 0x7a9ba6, intensity: 0.22, pos: [-5.2, 5.1, -4.1] },
    rim: { color: 0x8a73d4, intensity: 0.2, pos: [0, 4.5, -7.4] },
    ambient: { sky: 0xd0c2ef, ground: 0x1f1728, intensity: 0.42 },
    fog: { color: '#181321', near: 18, far: 58 }
  },
  rustic_tavern: {
    top: '#5a3d28',
    bottom: '#1f1610',
    key: { color: 0xffd29b, intensity: 1.12, pos: [4.1, 6.9, 4.6] },
    fill: { color: 0xc5a17a, intensity: 0.27, pos: [-5.3, 5.2, -4.0] },
    rim: { color: 0xe9ab72, intensity: 0.2, pos: [0, 4.4, -7.2] },
    ambient: { sky: 0xf2dcc1, ground: 0x342417, intensity: 0.48 },
    fog: { color: '#24180f', near: 18, far: 60 }
  },
  modern_suite: {
    top: '#425767',
    bottom: '#19222b',
    key: { color: 0xe7edf5, intensity: 1.1, pos: [4.3, 7.5, 4.0] },
    fill: { color: 0xa7c1d2, intensity: 0.32, pos: [-5.8, 5.6, -4.5] },
    rim: { color: 0xc0d8eb, intensity: 0.16, pos: [0, 4.9, -7.5] },
    ambient: { sky: 0xe5edf5, ground: 0x283947, intensity: 0.52 },
    fog: { color: '#1d2832', near: 22, far: 70 }
  },
  neon_arcade: {
    top: '#23314e',
    bottom: '#111725',
    key: { color: 0x9cc5ff, intensity: 1.0, pos: [4.9, 7.4, 4.1] },
    fill: { color: 0x7df3d7, intensity: 0.24, pos: [-5.7, 5.5, -4.8] },
    rim: { color: 0xff5eb9, intensity: 0.2, pos: [0, 4.6, -7.8] },
    ambient: { sky: 0xccdbff, ground: 0x1f2940, intensity: 0.44 },
    fog: { color: '#161d2c', near: 18, far: 62 }
  },
  default_lounge: {
    top: '#5c4536',
    bottom: '#1d1612',
    key: { color: 0xffd7a1, intensity: 1.08, pos: [4.2, 7.1, 4.3] },
    fill: { color: 0x8ea9c8, intensity: 0.24, pos: [-5.7, 5.4, -4.1] },
    rim: { color: 0xf3be86, intensity: 0.18, pos: [0, 4.4, -7.2] },
    ambient: { sky: 0xf0e4d1, ground: 0x2f241c, intensity: 0.46 },
    fog: { color: '#211913', near: 26, far: 72 }
  }
};

function lightingStorageKey(envId) {
  return `${LIGHTING_STORAGE_PREFIX}${String(envId || 'casino_lounge')}${LIGHTING_STORAGE_SUFFIX}`;
}

function decorScaleStorageKey(envId) {
  return `${DECOR_SCALE_STORAGE_PREFIX}${String(envId || 'casino_lounge')}${DECOR_SCALE_STORAGE_SUFFIX}`;
}

function textureDetailStorageKey(envId, type) {
  return `${TEXTURE_DETAIL_STORAGE_PREFIX}${String(envId || 'casino_lounge')}_${type}`;
}

function kelvinToRgb(kelvinInput) {
  const kelvin = Math.max(1000, Math.min(40000, Number(kelvinInput) || 5200));
  const temp = kelvin / 100;
  let red;
  let green;
  let blue;

  if (temp <= 66) {
    red = 255;
    green = 99.4708025861 * Math.log(temp) - 161.1195681661;
    blue = temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
  } else {
    red = 329.698727446 * ((temp - 60) ** -0.1332047592);
    green = 288.1221695283 * ((temp - 60) ** -0.0755148492);
    blue = 255;
  }
  return {
    r: Math.max(0, Math.min(255, red)) / 255,
    g: Math.max(0, Math.min(255, green)) / 255,
    b: Math.max(0, Math.min(255, blue)) / 255
  };
}

function makeDefaultLightingState(envId) {
  const preset = ENV_THEME_PRESETS[envId] || ENV_THEME_PRESETS.default_lounge;
  return {
    keyIntensity: Number(preset.key.intensity || DEFAULT_LIGHTING.keyIntensity),
    fillIntensity: Number(preset.fill.intensity || DEFAULT_LIGHTING.fillIntensity),
    rimIntensity: Number(preset.rim.intensity || DEFAULT_LIGHTING.rimIntensity),
    ambientIntensity: Number(preset.ambient.intensity || DEFAULT_LIGHTING.ambientIntensity),
    temperature: DEFAULT_LIGHTING.temperature,
    hdriIntensity: DEFAULT_LIGHTING.hdriIntensity,
    shadowDarkness: DEFAULT_LIGHTING.shadowDarkness,
    fogDensity: DEFAULT_LIGHTING.fogDensity
  };
}

function sanitizeLightingState(settings) {
  return {
    keyIntensity: clampValue(Number(settings?.keyIntensity), 0, 10, DEFAULT_LIGHTING.keyIntensity),
    fillIntensity: clampValue(Number(settings?.fillIntensity), 0, 10, DEFAULT_LIGHTING.fillIntensity),
    rimIntensity: clampValue(Number(settings?.rimIntensity), 0, 10, DEFAULT_LIGHTING.rimIntensity),
    ambientIntensity: clampValue(Number(settings?.ambientIntensity), 0, 5, DEFAULT_LIGHTING.ambientIntensity),
    temperature: clampValue(Number(settings?.temperature), 2000, 9000, DEFAULT_LIGHTING.temperature),
    hdriIntensity: clampValue(Number(settings?.hdriIntensity), 0, 3, DEFAULT_LIGHTING.hdriIntensity),
    shadowDarkness: clampValue(Number(settings?.shadowDarkness), 0, 1, DEFAULT_LIGHTING.shadowDarkness),
    fogDensity: clampValue(Number(settings?.fogDensity), 0, 0.08, DEFAULT_LIGHTING.fogDensity)
  };
}

function sanitizeDecorScale(value) {
  return clampValue(Number(value), 0.25, 3.0, 1.0);
}

function defaultTextureDetailState() {
  return {
    floorTextureScale: 1.0,
    wallTextureScale: 1.0,
    trimTextureScale: 1.0
  };
}

function sanitizeTextureDetailState(settings) {
  const defaults = defaultTextureDetailState();
  return {
    floorTextureScale: clampValue(Number(settings?.floorTextureScale), 0.25, 8.0, defaults.floorTextureScale),
    wallTextureScale: clampValue(Number(settings?.wallTextureScale), 0.25, 8.0, defaults.wallTextureScale),
    trimTextureScale: clampValue(Number(settings?.trimTextureScale), 0.25, 8.0, defaults.trimTextureScale)
  };
}

function loadDecorScaleForEnvironment(envId) {
  const id = String(envId || 'casino_lounge');
  if (envDecorScaleById.has(id)) {
    return sanitizeDecorScale(envDecorScaleById.get(id));
  }
  let value = 1.0;
  try {
    const raw = localStorage.getItem(decorScaleStorageKey(id));
    if (raw != null) {
      value = sanitizeDecorScale(Number(raw));
    } else {
      localStorage.setItem(decorScaleStorageKey(id), String(value));
    }
  } catch {
    value = 1.0;
  }
  envDecorScaleById.set(id, value);
  return value;
}

function persistDecorScaleForEnvironment(envId, value) {
  const id = String(envId || currentEnvironmentId || 'casino_lounge');
  const safe = sanitizeDecorScale(value);
  envDecorScaleById.set(id, safe);
  localStorage.setItem(decorScaleStorageKey(id), String(safe));
}

function loadTextureDetailForEnvironment(envId) {
  const id = String(envId || 'casino_lounge');
  if (envTextureDetailById.has(id)) {
    return sanitizeTextureDetailState(envTextureDetailById.get(id));
  }
  const defaults = defaultTextureDetailState();
  let merged = { ...defaults };
  try {
    const floorStored = localStorage.getItem(textureDetailStorageKey(id, 'floor'));
    const wallStored = localStorage.getItem(textureDetailStorageKey(id, 'walls'));
    const trimStored = localStorage.getItem(textureDetailStorageKey(id, 'trim'));
    if (floorStored != null) merged.floorTextureScale = Number(floorStored);
    if (wallStored != null) merged.wallTextureScale = Number(wallStored);
    if (trimStored != null) merged.trimTextureScale = Number(trimStored);
    if (floorStored == null) localStorage.setItem(textureDetailStorageKey(id, 'floor'), String(defaults.floorTextureScale));
    if (wallStored == null) localStorage.setItem(textureDetailStorageKey(id, 'walls'), String(defaults.wallTextureScale));
    if (trimStored == null) localStorage.setItem(textureDetailStorageKey(id, 'trim'), String(defaults.trimTextureScale));
  } catch {
    // Ignore storage read failure and keep defaults.
  }
  const safe = sanitizeTextureDetailState(merged);
  envTextureDetailById.set(id, safe);
  return safe;
}

function persistTextureDetailForEnvironment(envId, value) {
  const id = String(envId || currentEnvironmentId || 'casino_lounge');
  const safe = sanitizeTextureDetailState(value);
  envTextureDetailById.set(id, safe);
  localStorage.setItem(textureDetailStorageKey(id, 'floor'), String(safe.floorTextureScale));
  localStorage.setItem(textureDetailStorageKey(id, 'walls'), String(safe.wallTextureScale));
  localStorage.setItem(textureDetailStorageKey(id, 'trim'), String(safe.trimTextureScale));
}

function resetTextureDetailForEnvironment(envId) {
  const id = String(envId || currentEnvironmentId || 'casino_lounge');
  persistTextureDetailForEnvironment(id, defaultTextureDetailState());
}

function loadLightingForEnvironment(envId) {
  const id = String(envId || 'casino_lounge');
  if (envLightingStateById.has(id)) {
    return sanitizeLightingState(envLightingStateById.get(id));
  }
  const defaults = makeDefaultLightingState(id);
  let merged = { ...defaults };
  try {
    const raw = localStorage.getItem(lightingStorageKey(id));
    if (raw) {
      const parsed = JSON.parse(raw);
      merged = { ...defaults, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
    } else {
      localStorage.setItem(lightingStorageKey(id), JSON.stringify(defaults));
    }
  } catch {
    localStorage.setItem(lightingStorageKey(id), JSON.stringify(defaults));
    merged = defaults;
  }
  const sanitized = sanitizeLightingState(merged);
  envLightingStateById.set(id, sanitized);
  return sanitized;
}

function persistLightingForEnvironment(envId) {
  if (!activeLightingState) return;
  const id = String(envId || currentEnvironmentId || 'casino_lounge');
  const safe = sanitizeLightingState(activeLightingState);
  envLightingStateById.set(id, safe);
  localStorage.setItem(lightingStorageKey(id), JSON.stringify(safe));
}

function setLightingControlValues(settings) {
  const safe = sanitizeLightingState(settings);
  for (const key of LIGHTING_ONLY_KEYS) {
    const input = lightingInputs[key];
    const label = lightingValueLabels[key];
    const value = Number(safe[key]);
    if (input) {
      input.value = `${value}`;
    }
    if (label) {
      label.textContent = key === 'temperature'
        ? `${Math.round(value)}`
        : value.toFixed(key === 'fogDensity' ? 3 : 2);
    }
  }

  const envId = currentEnvironmentId || roomState?.environmentId || 'casino_lounge';
  const decorScale = loadDecorScaleForEnvironment(envId);
  const textureDetail = loadTextureDetailForEnvironment(envId);
  if (lightingInputs.decorGlobalScale) lightingInputs.decorGlobalScale.value = `${decorScale}`;
  if (lightingValueLabels.decorGlobalScale) lightingValueLabels.decorGlobalScale.textContent = decorScale.toFixed(2);
  if (lightingInputs.floorTextureScale) lightingInputs.floorTextureScale.value = `${textureDetail.floorTextureScale}`;
  if (lightingValueLabels.floorTextureScale) lightingValueLabels.floorTextureScale.textContent = textureDetail.floorTextureScale.toFixed(2);
  if (lightingInputs.wallTextureScale) lightingInputs.wallTextureScale.value = `${textureDetail.wallTextureScale}`;
  if (lightingValueLabels.wallTextureScale) lightingValueLabels.wallTextureScale.textContent = textureDetail.wallTextureScale.toFixed(2);
  if (lightingInputs.trimTextureScale) lightingInputs.trimTextureScale.value = `${textureDetail.trimTextureScale}`;
  if (lightingValueLabels.trimTextureScale) lightingValueLabels.trimTextureScale.textContent = textureDetail.trimTextureScale.toFixed(2);
}

function applyLightingState(settings, { persist = false } = {}) {
  const safe = sanitizeLightingState(settings);
  activeLightingState = { ...safe };
  const warmth = kelvinToRgb(safe.temperature);
  const ambientDarknessFactor = 1 - safe.shadowDarkness * 0.45;

  keyLight.color.setRGB(warmth.r, warmth.g, warmth.b);
  fillLight.color.setRGB(
    Math.min(1, warmth.r * 0.72 + 0.18),
    Math.min(1, warmth.g * 0.8 + 0.16),
    Math.min(1, warmth.b * 1.08 + 0.14)
  );
  rimLight.color.setRGB(
    Math.min(1, warmth.r * 1.03 + 0.05),
    Math.min(1, warmth.g * 0.92 + 0.06),
    Math.min(1, warmth.b * 0.86 + 0.07)
  );

  keyLight.intensity = safe.keyIntensity * 1.12;
  fillLight.intensity = safe.fillIntensity * 0.82;
  rimLight.intensity = safe.rimIntensity * 0.9;
  ambient.intensity = safe.ambientIntensity * ambientDarknessFactor * 0.88;

  scene.environmentIntensity = safe.hdriIntensity;
  if (scene.fog) {
    if (safe.fogDensity > 0.0001) {
      scene.fog = new THREE.FogExp2(currentFogColor, safe.fogDensity);
    } else {
      scene.fog = new THREE.Fog(currentFogColor, currentFogNear, currentFogFar);
    }
  }

  keyLight.shadow.normalBias = 0.012 + safe.shadowDarkness * 0.025;
  keyLight.shadow.radius = 1 + safe.shadowDarkness * 8;

  setLightingControlValues(safe);
  if (lightingStateText) {
    lightingStateText.textContent = `Lighting: ${currentEnvironmentId || 'env'} | K ${Math.round(safe.temperature)} | HDRI ${safe.hdriIntensity.toFixed(2)}`;
  }
  if (persist) {
    persistLightingForEnvironment(currentEnvironmentId || 'casino_lounge');
  }
}

function updateLightingFromControls({ persist = false } = {}) {
  const next = {
    keyIntensity: Number(lightingInputs.keyIntensity?.value ?? activeLightingState?.keyIntensity ?? DEFAULT_LIGHTING.keyIntensity),
    fillIntensity: Number(lightingInputs.fillIntensity?.value ?? activeLightingState?.fillIntensity ?? DEFAULT_LIGHTING.fillIntensity),
    rimIntensity: Number(lightingInputs.rimIntensity?.value ?? activeLightingState?.rimIntensity ?? DEFAULT_LIGHTING.rimIntensity),
    ambientIntensity: Number(lightingInputs.ambientIntensity?.value ?? activeLightingState?.ambientIntensity ?? DEFAULT_LIGHTING.ambientIntensity),
    temperature: Number(lightingInputs.temperature?.value ?? activeLightingState?.temperature ?? DEFAULT_LIGHTING.temperature),
    hdriIntensity: Number(lightingInputs.hdriIntensity?.value ?? activeLightingState?.hdriIntensity ?? DEFAULT_LIGHTING.hdriIntensity),
    shadowDarkness: Number(lightingInputs.shadowDarkness?.value ?? activeLightingState?.shadowDarkness ?? DEFAULT_LIGHTING.shadowDarkness),
    fogDensity: Number(lightingInputs.fogDensity?.value ?? activeLightingState?.fogDensity ?? DEFAULT_LIGHTING.fogDensity)
  };
  applyLightingState(next, { persist });
}

function resetLightingForCurrentEnvironment() {
  const envId = currentEnvironmentId || 'casino_lounge';
  const defaults = makeDefaultLightingState(envId);
  envLightingStateById.set(envId, defaults);
  localStorage.setItem(lightingStorageKey(envId), JSON.stringify(defaults));
  applyLightingState(defaults, { persist: false });
}

async function copyLightingJson() {
  const payload = sanitizeLightingState(activeLightingState || makeDefaultLightingState(currentEnvironmentId || 'casino_lounge'));
  const text = JSON.stringify(payload, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    logMessage('Copied lighting JSON.', 1400);
  } catch {
    logMessage('Could not copy lighting JSON.', 1800);
  }
}

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
  tableMetrics.floorY = FLOOR_Y;
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
  const localFloorLimit = (FLOOR_Y - Number(tableRoot.position.y || 0)) + 0.02;
  const out = Math.max(baseY, localFloorLimit);
  if (out !== baseY) {
    warnOnce(`avatarLocalFloorClamp:${seatIndex}`, `[avatar] local floor clamp seat=${seatIndex} baseY=${Number(baseY).toFixed(3)}`);
  }
  return out;
}

function enforceAvatarWorldFloorClamp(seatIndex, avatarGroup) {
  if (!avatarGroup) return;
  const minWorldY = FLOOR_Y + 0.05;

  avatarGroup.updateWorldMatrix(true, true);
  let meshBottomY = null;
  let meshFound = false;
  avatarGroup.traverse((node) => {
    if (!node?.isMesh || !node.geometry) return;
    meshFound = true;
    if (!node.geometry.boundingBox) {
      node.geometry.computeBoundingBox();
    }
    if (!node.geometry.boundingBox) return;
    tmpGeoBox.copy(node.geometry.boundingBox);
    tmpMeshBox.copy(tmpGeoBox).applyMatrix4(node.matrixWorld);
    if (!Number.isFinite(tmpMeshBox.min.y)) return;
    meshBottomY = meshBottomY == null ? tmpMeshBox.min.y : Math.min(meshBottomY, tmpMeshBox.min.y);
  });

  if (!meshFound) {
    tmpBox.setFromObject(avatarGroup);
    if (Number.isFinite(tmpBox.min.y)) {
      meshBottomY = tmpBox.min.y;
    }
  }

  if (meshBottomY != null && meshBottomY < minWorldY) {
    const delta = minWorldY - meshBottomY;
    avatarGroup.position.y += delta;
    warnOnce(
      `avatarWorldFloorClamp:${seatIndex}`,
      `[avatar] clamped above floor seat=${seatIndex} worldY=${meshBottomY.toFixed(3)}`
    );
  }

  // Fallback to group-origin clamp in case bbox is unavailable.
  avatarGroup.updateWorldMatrix(true, false);
  tmpV3B.setFromMatrixPosition(avatarGroup.matrixWorld);
  if (tmpV3B.y < minWorldY) {
    const delta = minWorldY - tmpV3B.y;
    avatarGroup.position.y += delta;
    warnOnce(
      `avatarWorldFloorClampOrigin:${seatIndex}`,
      `[avatar] origin clamp seat=${seatIndex} worldY=${tmpV3B.y.toFixed(3)}`
    );
  }
}

function enforceAllAvatarFloorClamps() {
  for (let seatIndex = 0; seatIndex < avatarSeatGroups.length; seatIndex += 1) {
    enforceAvatarWorldFloorClamp(seatIndex, avatarSeatGroups[seatIndex]);
  }
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

function beginHudBlockDrag(block, pointerId, clientX, clientY) {
  draggingHudBlock = block;
  hudPointerId = pointerId;
  hudDragStart = { x: clientX, y: clientY };
  if (block === 'bid') {
    hudOffsetStart = {
      x: Number(tableHudSettings.bidOffsetX || 0),
      y: Number(tableHudSettings.bidOffsetY || 0)
    };
    hudBidDragHandle?.classList.add('dragging');
  } else {
    hudOffsetStart = {
      x: Number(tableHudSettings.trumpOffsetX || 0),
      y: Number(tableHudSettings.trumpOffsetY || 0)
    };
    hudTrumpDragHandle?.classList.add('dragging');
  }
}

function updateHudBlockDrag(clientX, clientY) {
  if (!draggingHudBlock) return;
  const dx = clientX - hudDragStart.x;
  const dy = clientY - hudDragStart.y;
  if (draggingHudBlock === 'bid') {
    tableHudSettings.bidOffsetX = hudOffsetStart.x + dx;
    tableHudSettings.bidOffsetY = hudOffsetStart.y + dy;
  } else {
    tableHudSettings.trumpOffsetX = hudOffsetStart.x + dx;
    tableHudSettings.trumpOffsetY = hudOffsetStart.y + dy;
  }
  applyTableHudSettings({ persist: true });
}

function endHudBlockDrag() {
  if (!draggingHudBlock) return;
  if (draggingHudBlock === 'bid') {
    hudBidDragHandle?.classList.remove('dragging');
  } else {
    hudTrumpDragHandle?.classList.remove('dragging');
  }
  draggingHudBlock = null;
  hudPointerId = null;
}

function beginChipWidgetDrag(pointerId, clientX, clientY) {
  draggingChipWidget = true;
  chipWidgetPointerId = pointerId;
  chipWidgetDragStart = { x: clientX, y: clientY };
  chipWidgetOffsetStart = {
    x: Number(chipWidgetSettings.offsetX || 0),
    y: Number(chipWidgetSettings.offsetY || 0)
  };
  chipTotalsDragHandle?.classList.add('dragging');
}

function updateChipWidgetDrag(clientX, clientY) {
  if (!draggingChipWidget) return;
  const dx = clientX - chipWidgetDragStart.x;
  const dy = clientY - chipWidgetDragStart.y;
  chipWidgetSettings.offsetX = chipWidgetOffsetStart.x + dx;
  chipWidgetSettings.offsetY = chipWidgetOffsetStart.y + dy;
  applyChipWidgetSettings({ persist: true });
}

function endChipWidgetDrag() {
  if (!draggingChipWidget) return;
  draggingChipWidget = false;
  chipWidgetPointerId = null;
  chipTotalsDragHandle?.classList.remove('dragging');
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
  return false;
}

function setPanelOpen(open) {
  panelOpen = open;
  panel.classList.toggle('closed', !open);
}

function updatePanelAutoBehavior() {
  if (!roomState) {
    setPanelOpen(true);
    updateActionModal();
    closeModeTray();
    closeTrumpTray();
    chooserWaitBanner?.classList.add('hidden');
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
  if (
    [PHASES.BIDDING, PHASES.BETTING, PHASES.CHOOSE_MODE, PHASES.CHOOSE_TRUMP].includes(roomState.phase)
    && lastPhase !== roomState.phase
  ) {
    setPanelOpen(false);
  }

  updateActionModal();
  updateBidTray();
  updateModeTrumpTrays();
  updateChipTray();
  lastPhase = roomState.phase;
}

function showSections() {
  const show = {
    room: false,
    players: false,
    game: false,
    betting: false,
    lighting: false,
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
    show.betting = true;
    show.lighting = true;
    show.view = true;
    show.sceneTuning = true;
    show.debugTable = true;
    show.room = true;
  } else if (roomState.phase === PHASES.BIDDING) {
    show.game = true;
    show.betting = true;
    show.lighting = true;
    show.view = true;
    show.sceneTuning = true;
    show.debugTable = true;
    show.room = true;
  } else if (roomState.phase === PHASES.BETTING) {
    show.game = true;
    show.betting = true;
    show.lighting = true;
    show.view = true;
    show.sceneTuning = true;
    show.debugTable = true;
    show.room = true;
  } else if (roomState.phase === PHASES.CHOOSE_MODE || roomState.phase === PHASES.CHOOSE_TRUMP) {
    show.game = true;
    show.betting = true;
    show.lighting = true;
    show.view = true;
    show.sceneTuning = true;
    show.debugTable = true;
    show.room = true;
  } else if (roomState.phase === PHASES.PLAYING) {
    show.game = true;
    show.betting = true;
    show.lighting = true;
    show.view = true;
    show.sceneTuning = true;
    show.debugTable = true;
    show.marks = true;
    show.room = true;
  } else {
    show.game = true;
    show.betting = true;
    show.lighting = true;
    show.view = true;
    show.sceneTuning = true;
    show.debugTable = true;
    show.marks = true;
    show.room = true;
  }

  sectionRoom.classList.toggle('hidden', !show.room);
  sectionPlayers.classList.toggle('hidden', !show.players);
  sectionGame.classList.toggle('hidden', !show.game);
  sectionBetting.classList.toggle('hidden', !show.betting);
  sectionLighting.classList.toggle('hidden', !show.lighting);
  sectionView.classList.toggle('hidden', !show.view);
  sectionSceneTuning.classList.toggle('hidden', !show.sceneTuning);
  sectionDebugTable.classList.toggle('hidden', !show.debugTable);
  sectionBidding.classList.toggle('hidden', !show.bidding);
  sectionTrump.classList.toggle('hidden', !show.trump);
  sectionMarks.classList.toggle('hidden', !show.marks);
}

function closeActionModal() {
  if (!actionModal) return;
  actionModal.classList.add('hidden');
  actionModalButtons?.replaceChildren();
  actionModalModeButtons?.replaceChildren();
}

function closeBidTray() {
  if (!bidTray) return;
  bidTray.classList.add('hidden');
  bidTrayButtons?.replaceChildren();
}

function closeModeTray() {
  if (!modeTray) return;
  modeTray.classList.add('hidden');
  modeTrayButtons?.replaceChildren();
}

function closeTrumpTray() {
  if (!trumpTray) return;
  trumpTray.classList.add('hidden');
  trumpTrayButtons?.replaceChildren();
}

function closeChipTray() {
  if (!chipTray) return;
  chipTray.classList.add('hidden');
  chipTrayButtons?.replaceChildren();
  chipBetDraftAmount = 0;
  if (chipYourBetText) chipYourBetText.textContent = 'Your Bet: $0';
}

function createActionButton(label, onClick, { disabled = false, className = '' } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  btn.disabled = !!disabled;
  if (className) btn.className = className;
  btn.addEventListener('click', onClick);
  return btn;
}

function updateActionModal() {
  closeActionModal();
}

function updateModeTrumpTrays() {
  if (!modeTray || !trumpTray || !chooserWaitBanner) return;

  closeModeTray();
  closeTrumpTray();
  chooserWaitBanner.classList.add('hidden');

  if (!roomState || !isConnected()) return;

  const phase = roomState.phase;
  const canChooseMode = phase === PHASES.CHOOSE_MODE && localIsBidder();
  const canChooseTrump = phase === PHASES.CHOOSE_TRUMP && localIsBidder() && roomState.mode === MODES.TRUMPS;
  const waitingSeat = Number.isInteger(roomState.bidderSeat) ? roomState.bidderSeat + 1 : '-';

  if (phase === PHASES.CHOOSE_MODE) {
    if (!canChooseMode) {
      chooserWaitBanner.textContent = `Waiting for bidder (Seat ${waitingSeat}) to choose mode...`;
      chooserWaitBanner.classList.remove('hidden');
      return;
    }
    modeTray.classList.remove('hidden');
    modeTrayTitle.textContent = 'Choose Mode';
    modeTrayStatus.textContent = 'Select hand mode for this hand.';
    modeTrayButtons.replaceChildren();
    const modeDefs = [
      { id: MODES.TRUMPS, label: 'TRUMPS' },
      { id: MODES.FOLLOW_ME, label: 'FOLLOW ME' },
      { id: MODES.SEVENS, label: 'SEVENS' }
    ];
    for (const modeDef of modeDefs) {
      const btn = createActionButton(modeDef.label, () => {
        sendAction('chooseMode', { mode: modeDef.id });
        forceClosePanel = true;
        updatePanelAutoBehavior();
      });
      modeTrayButtons.appendChild(btn);
    }
    return;
  }

  if (phase === PHASES.CHOOSE_TRUMP) {
    if (!canChooseTrump) {
      chooserWaitBanner.textContent = `Waiting for bidder (Seat ${waitingSeat}) to choose trump...`;
      chooserWaitBanner.classList.remove('hidden');
      return;
    }
    trumpTray.classList.remove('hidden');
    trumpTrayTitle.textContent = 'Choose Trump Number';
    trumpTrayStatus.textContent = 'Pick trump suit number (0-6).';
    trumpTrayButtons.replaceChildren();
    for (let trump = 0; trump <= 6; trump += 1) {
      const btn = createActionButton(String(trump), () => {
        sendAction('chooseTrump', { trumpSuit: trump });
        forceClosePanel = true;
        updatePanelAutoBehavior();
      });
      trumpTrayButtons.appendChild(btn);
    }
  }
}

function currentHighBidInfo() {
  if (!roomState?.bidHistory) return { highBid: 0, highBidderSeat: null };
  let highBid = 0;
  let highBidderSeat = null;
  for (const entry of roomState.bidHistory) {
    if (!Number.isInteger(entry?.bid)) continue;
    if (entry.bid >= highBid) {
      highBid = entry.bid;
      highBidderSeat = Number.isInteger(entry.seatIndex) ? entry.seatIndex : highBidderSeat;
    }
  }
  return { highBid, highBidderSeat };
}

function updateBidTray() {
  if (!bidTray || !bidTrayButtons || !bidTrayStatus || !bidTrayTimer || !bidTrayPassBtn) return;
  if (!roomState || roomState.phase !== PHASES.BIDDING || !isConnected()) {
    closeBidTray();
    return;
  }

  const canBid = localTurnToBid();
  const { highBid, highBidderSeat } = currentHighBidInfo();
  const bidderText = Number.isInteger(highBidderSeat)
    ? (roomState.seats?.[highBidderSeat]?.name || `Seat ${highBidderSeat + 1}`)
    : 'none';
  const timerText = roomState.turnTimerEnabled ? formatTimerMs(currentTimerRemainingMs()) : '--:--';
  bidTray.classList.remove('hidden');
  bidTrayTitle.textContent = canBid ? 'Your turn to bid' : 'Bidding in progress';
  bidTrayStatus.textContent = `Current high bid: ${highBid || 'none'} by ${bidderText}`;
  bidTrayTimer.textContent = `TIME: ${timerText}`;
  bidTrayButtons.replaceChildren();

  bidTrayPassBtn.disabled = !canBid;
  bidTrayPassBtn.onclick = () => {
    if (!canBid) return;
    pendingLocalBidChoice = 'PASS';
    updateNameplates();
    sendAction('submitBid', { bid: null });
    forceClosePanel = true;
    updatePanelAutoBehavior();
  };

  for (let bid = 30; bid <= 42; bid += 1) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = String(bid);
    btn.disabled = !canBid || bid <= highBid;
    btn.addEventListener('mouseenter', () => {
      if (btn.disabled) return;
      pendingLocalBidChoice = bid;
      updateNameplates();
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
    bidTrayButtons.appendChild(btn);
  }
}

function currentBettingState() {
  if (!roomState) return null;
  const model = roomState.betting && typeof roomState.betting === 'object' ? roomState.betting : null;
  if (model) {
    const pendingOpenForHand = pendingBettingOpenEvent
      && Number(pendingBettingOpenEvent.handId || 0) === Number(model.handId || roomState.handNumber || 0);
    const mergedState = pendingOpenForHand && pendingBettingOpenEvent.betState && typeof pendingBettingOpenEvent.betState === 'object'
      ? { ...pendingBettingOpenEvent.betState, ...(model.betState || {}) }
      : (model.betState && typeof model.betState === 'object' ? { ...model.betState } : {});
    return {
      enabled: !!model.enabled,
      isOpen: !!model.isOpen || !!pendingOpenForHand || roomState.phase === PHASES.BETTING,
      handId: Number(model.handId || roomState.handNumber || 0),
      amount: Math.max(1, Number(model.betAmount || roomState.baseBetAmount || 10)),
      pot: Number(((pendingOpenForHand ? pendingBettingOpenEvent?.betPot : null) ?? model.betPot) || 0),
      currentBid: Math.max(
        1,
        Number(
          ((pendingOpenForHand ? pendingBettingOpenEvent?.currentBid : null) ?? model.currentBid)
          || model.betAmount
          || roomState.baseBetAmount
          || 10
        )
      ),
      wagers: pendingOpenForHand && pendingBettingOpenEvent?.betWagers && typeof pendingBettingOpenEvent.betWagers === 'object'
        ? { ...pendingBettingOpenEvent.betWagers, ...(model.betWagers || {}) }
        : (model.betWagers && typeof model.betWagers === 'object' ? { ...model.betWagers } : {}),
      responses: Object.keys(mergedState).length
        ? mergedState
        : (roomState.pendingBets?.responses ? { ...roomState.pendingBets.responses } : {})
    };
  }
  const pending = roomState.pendingBets || null;
  return {
    enabled: !!roomState.bettingEnabled,
    isOpen: roomState.phase === PHASES.BETTING && !!pending,
    handId: Number(pending?.handId || roomState.handNumber || 0),
    amount: Math.max(1, Number(pending?.amount || roomState.baseBetAmount || 10)),
    pot: Number(pending?.pot || 0),
    currentBid: Math.max(1, Number(pending?.currentBid || pending?.amount || roomState.baseBetAmount || 10)),
    wagers: pending?.wagers && typeof pending.wagers === 'object' ? { ...pending.wagers } : {},
    responses: pending?.responses ? { ...pending.responses } : {}
  };
}

function updateChipTray() {
  if (!chipTray || !chipTrayBody || !chipTrayPotText || !chipTrayButtons) {
    return;
  }
  const betting = currentBettingState();
  if (!roomState || !betting?.isOpen) {
    closeChipTray();
    return;
  }

  const localSeat = getLocalSeat();
  const responses = betting.responses || {};
  const baseAmount = Math.max(1, Number(betting.amount || roomState.baseBetAmount || 10));
  const currentBid = Math.max(baseAmount, Number(betting.currentBid || baseAmount));
  const myStatus = Number.isInteger(localSeat) ? responses[String(localSeat)] : null;
  const myWager = Number.isInteger(localSeat) ? Number((betting.wagers || {})[String(localSeat)] || 0) : 0;
  const remaining = Object.values(responses).filter((value) => value === 'pending').length;
  const isPending = Number.isInteger(localSeat) && myStatus === 'pending';

  chipTray.classList.remove('hidden');
  chipTrayTitle.textContent = 'Dollar Betting';
  chipTrayPotText.textContent = `Hand ${Number(betting.handId || roomState.handNumber || 0)} | Base $${baseAmount} | Current $${currentBid} | Pot $${Number(betting.pot || 0)} | Waiting ${remaining}`;
  chipTrayButtons.replaceChildren();
  const incrementButtons = [chipInc1Btn, chipInc5Btn, chipInc10Btn, chipInc20Btn].filter(Boolean);
  incrementButtons.forEach((btn) => { btn.disabled = !isPending; });
  chipBetDraftAmount = Math.max(0, Number(chipBetDraftAmount || 0));
  if (chipYourBetText) {
    chipYourBetText.textContent = `Your Bet: $${chipBetDraftAmount}`;
  }

  if (!Number.isInteger(localSeat)) {
    chipTrayBody.textContent = 'You are spectating. Waiting for bets...';
    return;
  }

  if (!isPending) {
    const statusText = myStatus === 'called' ? 'CALLED' : 'FOLDED';
    chipTrayBody.textContent = `Waiting for other players... Your choice: ${statusText} | Your wager: $${myWager}`;
    return;
  }
  chipTrayBody.textContent = `Seat ${localSeat + 1}: wager $${myWager}. Current required bet: $${currentBid}.`;
  if (chipBetDraftAmount <= 0) {
    chipBetDraftAmount = baseAmount;
  }
  if (chipYourBetText) {
    chipYourBetText.textContent = `Your Bet: $${chipBetDraftAmount}`;
  }

  const sendBetDecision = async (decision, amount = null) => {
    const payload = amount == null ? { decision } : { decision, amount: Number(amount) };
    const ack = await emitWithAckTimeout('betting:respond', payload, 3000);
    if (!ack?.ok) {
      logMessage(ack?.message || 'Betting response failed.', 1800);
      return false;
    }
    return true;
  };

  const setDraftAmount = (nextAmount) => {
    chipBetDraftAmount = Math.max(1, Math.round(Number(nextAmount) || baseAmount));
    if (chipYourBetText) {
      chipYourBetText.textContent = `Your Bet: $${chipBetDraftAmount}`;
    }
  };
  chipInc1Btn.onclick = () => setDraftAmount(chipBetDraftAmount + 1);
  chipInc5Btn.onclick = () => setDraftAmount(chipBetDraftAmount + 5);
  chipInc10Btn.onclick = () => setDraftAmount(chipBetDraftAmount + 10);
  chipInc20Btn.onclick = () => setDraftAmount(chipBetDraftAmount + 20);

  const bidBtn = createActionButton(`Bet $${chipBetDraftAmount}`, async () => {
    const value = Math.max(1, Math.round(chipBetDraftAmount));
    await sendBetDecision('bid', value);
  });
  const raiseBtn = createActionButton('Raise (+$5)', async () => {
    const value = Math.max(currentBid + 5, Math.round(chipBetDraftAmount || 0));
    await sendBetDecision('raise', value);
  });
  const callBtn = createActionButton(`Call $${currentBid}`, async () => {
    await sendBetDecision('call');
  });
  const foldBtn = createActionButton('Fold', async () => {
    await sendBetDecision('folded');
  });

  chipTrayButtons.append(bidBtn, raiseBtn, callBtn, foldBtn);
}

function updateChipTotalsWidget() {
  if (!chipTotalsWidget || !chipTotalsList || !chipTotalsPot) return;
  if (!roomState || !(roomState.bettingEnabledNextHand || roomState.bettingEnabled)) {
    chipTotalsWidget.classList.add('hidden');
    chipTotalsList.replaceChildren();
    return;
  }

  chipTotalsWidget.classList.remove('hidden');
  chipTotalsList.replaceChildren();
  const betting = currentBettingState();
  chipTotalsPot.textContent = `Pot: $${Number(betting?.pot || 0)}`;
  for (let seatIndex = 0; seatIndex < 4; seatIndex += 1) {
    const seat = roomState.seats?.[seatIndex];
    const chips = Number(roomState.sessionBankroll?.[String(seatIndex)] ?? 0);
    const line = document.createElement('div');
    line.textContent = `${seat?.name || `Seat ${seatIndex + 1}`}: $${chips}`;
    chipTotalsList.appendChild(line);
  }
}

function updateBettingModal() {
  // Legacy alias retained for existing call sites.
  updateChipTray();
  updateChipTotalsWidget();
}

function closeBettingModal() {
  // Legacy alias retained for existing call sites.
  closeChipTray();
}

function updateBettingControls() {
  const connected = isConnected();
  const isHost = roomState?.hostClientId === localClientId;
  const betting = currentBettingState();
  const enabled = !!(roomState?.bettingEnabledNextHand ?? roomState?.bettingEnabled);
  const amount = Math.max(1, Number(roomState?.baseBetAmount || 10));

  if (bettingEnabledToggle) {
    bettingEnabledToggle.checked = enabled;
    bettingEnabledToggle.disabled = !connected || !roomState || !isHost;
  }
  if (betAmountInput) {
    betAmountInput.value = `${amount}`;
    betAmountInput.disabled = !connected || !roomState || !isHost;
  }
  if (betAmountValue) {
    betAmountValue.textContent = `${amount}`;
  }

  if (!roomState) {
    if (bettingStateText) bettingStateText.textContent = 'Betting Off';
    if (bettingDebugText) {
      bettingDebugText.textContent = 'Betting Debug | enabled: false | isOpen: false | handId: -';
    }
    if (bettingTotals) bettingTotals.replaceChildren();
    closeChipTray();
    updateChipTotalsWidget();
    return;
  }

  if (bettingStateText) {
    if (!enabled) {
      bettingStateText.textContent = 'Betting Off';
    } else if (betting?.isOpen) {
      const waiting = Object.values(betting.responses || {}).filter((value) => value === 'pending').length;
      bettingStateText.textContent = `Betting Open | Pot $${Number(betting.pot || 0)} | Waiting ${waiting}`;
    } else {
      bettingStateText.textContent = 'Betting On (next hand if already playing)';
    }
  }
  if (bettingDebugText) {
    const isOpen = !!betting?.isOpen;
    const handId = Number(betting?.handId || roomState.handNumber || 0);
    bettingDebugText.textContent = `Betting Debug | enabled: ${enabled} | isOpen: ${isOpen} | handId: ${handId} | phase: ${roomState.phase || '-'}`;
  }

  if (bettingTotals) {
    bettingTotals.replaceChildren();
    for (let seatIndex = 0; seatIndex < 4; seatIndex += 1) {
      const seat = roomState.seats?.[seatIndex];
      const chips = Number(roomState.sessionBankroll?.[String(seatIndex)] ?? 0);
      const line = document.createElement('div');
      line.textContent = `Seat ${seatIndex + 1} (${seat?.name || `Seat ${seatIndex + 1}`}): $${chips}`;
      bettingTotals.appendChild(line);
    }
  }

  updateBettingModal();
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

  const titleTeam = team === 'teamA' ? 'TEAM 1 CAPTURED' : 'TEAM 2 CAPTURED';
  const handRecords = Array.isArray(data.handRecords) ? data.handRecords : [];
  const liveTiles = Array.isArray(data.liveTiles) ? data.liveTiles : [];
  const liveRows = splitTilesIntoLiveTrickRows(liveTiles);
  const totalTiles = Number(data.tileCount || 0);
  const totalCountPoints = Number(data.countPoints || 0);
  const trickWins = Number(data.trickWins || 0);
  const liveScore = trickWins + totalCountPoints;
  panel.title.textContent = titleTeam;
  panel.stats.textContent = `Tiles: ${totalTiles} | Count: ${totalCountPoints} | Wins: ${trickWins} | Score: ${liveScore}`;

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
      handLabel.textContent = `LAST HAND #${Number(record.handIndex || 0)}`;
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
}

function updateBurnPanels() {
  if (!roomState) {
    renderBurnPanel('teamA', { liveTiles: [], handRecords: [], trickWins: 0, countPoints: 0, mode: MODES.TRUMPS, trumpSuit: null });
    renderBurnPanel('teamB', { liveTiles: [], handRecords: [], trickWins: 0, countPoints: 0, mode: MODES.TRUMPS, trumpSuit: null });
    return;
  }
  const showLiveHandCaptures = roomState.phase === PHASES.PLAYING || roomState.phase === PHASES.TRICK_PAUSE;

  renderBurnPanel('teamA', {
    liveTiles: showLiveHandCaptures ? (roomState.burnPiles?.teamA || []) : [],
    tileCount: roomState.burnPiles?.teamA?.length || 0,
    handRecords: roomState.burnHandsTeamA || [],
    trickWins: roomState.trickWinsThisHand?.teamA || 0,
    countPoints: roomState.countPointsThisHand?.teamA || 0,
    mode: roomState.mode || MODES.TRUMPS,
    trumpSuit: roomState.trumpSuit
  });
  renderBurnPanel('teamB', {
    liveTiles: showLiveHandCaptures ? (roomState.burnPiles?.teamB || []) : [],
    tileCount: roomState.burnPiles?.teamB?.length || 0,
    handRecords: roomState.burnHandsTeamB || [],
    trickWins: roomState.trickWinsThisHand?.teamB || 0,
    countPoints: roomState.countPointsThisHand?.teamB || 0,
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
  model.rotation.x = -0.24;
  model.scale.y *= 0.76;
  tmpBox.setFromObject(model);
  model.position.y -= tmpBox.min.y;
  model.position.y -= 0.035;
}

function alignAvatarModelBaseToLocalGround(model) {
  if (!model) return;
  tmpBox.setFromObject(model);
  if (!Number.isFinite(tmpBox.min.y)) return;
  if (Math.abs(tmpBox.min.y) <= 0.00001) return;
  model.position.y -= tmpBox.min.y;
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
    alignAvatarModelBaseToLocalGround(cloned.scene);
    updateSeatTransforms();
    enforceAvatarWorldFloorClamp(seatIndex, targetGroup);
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
  seatRuntime[seatIndex].chairSeatY = Math.max(0, Number(findSeatAnchorY(clone) || 0.42));
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
      0,
      seatDir.z * sceneTuning.seatRadius
    );
    for (const child of chairGroup.children) {
      child.position.y = sceneTuning.chairY;
    }
    chairGroup.rotation.y = seatConfig.chair.rotY;

    const avatarGroup = avatarSeatGroups[seatIndex];
    avatarGroup.scale.setScalar(sceneTuning.avatarScale);
    const avatarRadius = Math.max(0.4, sceneTuning.seatRadius - 0.28 + sceneTuning.avatarBack);
    const perSeatYOffset = Number(avatarSeatYOffsets?.[seatIndex] || 0);
    const baseSeatHeightAboveFloor = Math.max(
      0,
      (Number(seatRuntime[seatIndex].chairSeatY || 0.42) * sceneTuning.chairScale) + sceneTuning.chairY + 0.02
    );
    let avatarBaseY = baseSeatHeightAboveFloor + sceneTuning.avatarY + perSeatYOffset;
    avatarBaseY = clampAvatarBaseY(avatarBaseY, seatIndex);
    avatarBaseY += AVATAR_GLOBAL_NUDGE_Y;
    avatarGroup.position.set(seatDir.x * avatarRadius, avatarBaseY, seatDir.z * avatarRadius);
    avatarGroup.rotation.y = seatConfig.avatar.rotY;
    enforceAvatarWorldFloorClamp(seatIndex, avatarGroup);
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
    min: -3.0,
    max: 18.0
  };
}

function sanitizeViewSettings() {
  const lookBounds = lookAtBounds();
  viewSettings.distance = clampValue(Number(viewSettings.distance), 0.1, 24.0);
  viewSettings.height = clampValue(Number(viewSettings.height), 0.1, 18.0);
  viewSettings.forward = clampValue(Number(viewSettings.forward), -12.0, 12.0);
  viewSettings.shoulder = clampValue(Number(viewSettings.shoulder), -12.0, 12.0);
  viewSettings.lookAtY = clampValue(Number(viewSettings.lookAtY), lookBounds.min, lookBounds.max);
  viewSettings.fov = clampValue(Number(viewSettings.fov), 15, 180);
  viewSettings.pitchDeg = clampValue(Number(viewSettings.pitchDeg), -240, 240);
  viewSettings.near = clampValue(Number(viewSettings.near), 0.0003, 3.0);
  viewSettings.handY = clampValue(Number(viewSettings.handY), -3.0, 3.0);
  viewSettings.handZ = clampValue(Number(viewSettings.handZ), -12.0, 12.0);
  viewSettings.handDominoScale = clampValue(Number(viewSettings.handDominoScale), 0.01, 36.0);
  viewSettings.handDominoRotDeg = clampValue(Number(viewSettings.handDominoRotDeg), -180, 180);
  viewSettings.tableDominoScale = clampValue(Number(viewSettings.tableDominoScale), 0.01, 75.0);
  viewSettings.tableDominoTiltDeg = clampValue(Number(viewSettings.tableDominoTiltDeg), 0, 105);
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
        : key === 'tableDominoTiltDeg'
          ? `${viewSettings[key].toFixed(1)}`
        : key === 'near'
          ? `${viewSettings[key].toFixed(3)}`
        : viewSettings[key].toFixed(2);
  }
  updateSettingsLoadedText();
}

function sanitizeSceneTuning() {
  sceneTuning.tableScale = clampValue(Number(sceneTuning.tableScale), 0.17, 7.5);
  sceneTuning.chairScale = clampValue(Number(sceneTuning.chairScale), 0.17, 7.5);
  sceneTuning.avatarScale = clampValue(Number(sceneTuning.avatarScale), 0.17, 7.5);
  sceneTuning.seatRadius = clampValue(Number(sceneTuning.seatRadius), 0.33, 15.0);
  sceneTuning.avatarBack = clampValue(Number(sceneTuning.avatarBack), -3.0, 3.0);
  sceneTuning.avatarY = clampValue(Number(sceneTuning.avatarY), -1.5, 1.5);
  sceneTuning.chairY = clampValue(Number(sceneTuning.chairY), -1.5, 1.5);
  sceneTuning.tableY = clampValue(Number(sceneTuning.tableY), -1.5, 1.5);
}

function updateSceneTuningUi() {
  sanitizeSceneTuning();
  sanitizeAvatarSeatOffsets();
  for (const key of Object.keys(sceneTuneInputs)) {
    const input = sceneTuneInputs[key];
    const label = sceneTuneLabels[key];
    if (!input || !label) continue;
    input.value = `${sceneTuning[key]}`;
    label.textContent = sceneTuning[key].toFixed(2);
  }
  for (let i = 0; i < seatAvatarYOffsetInputs.length; i += 1) {
    const input = seatAvatarYOffsetInputs[i];
    const label = seatAvatarYOffsetLabels[i];
    if (!input || !label) continue;
    input.value = `${avatarSeatYOffsets[i]}`;
    label.textContent = avatarSeatYOffsets[i].toFixed(2);
  }
  if (chairsVisibleToggle) {
    chairsVisibleToggle.checked = chairsVisible;
  }
  updateSettingsLoadedText();
}

function applySceneTuning({ rerenderHand = true } = {}) {
  sanitizeSceneTuning();
  sanitizeAvatarSeatOffsets();
  chairsRoot.visible = !!chairsVisible;
  tableRoot.position.y = FLOOR_Y + sceneTuning.tableY;

  const tableNode = environmentGroup.getObjectByName('tableModel');
  if (tableNode) {
    tableNode.scale.set(sceneTuning.tableScale, sceneTuning.tableScale, sceneTuning.tableScale);
    tableNode.position.y = 0;
    tableRoot.updateMatrixWorld(true);
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
  applyDefaultViewSettings();
  viewSettingsLoadSource = 'defaults';
  persistViewSettings();
  updateViewControlsUi();
  updateSettingsLoadedText();
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
      environmentLoadText.textContent = detail
        ? `Environment loaded: OK | ${detail}`
        : 'Environment loaded: OK';
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

function normalizeAssetUrlPath(value) {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  const hasLeadingSlash = raw.startsWith('/');
  const parts = raw.split('/').filter(Boolean);
  const normalized = [];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      if (normalized.length) normalized.pop();
      continue;
    }
    normalized.push(part);
  }
  const joined = normalized.join('/');
  if (!joined) {
    return hasLeadingSlash ? '/' : '';
  }
  return hasLeadingSlash ? `/${joined}` : joined;
}

function ensureUv2(geometry) {
  if (!geometry || !geometry.attributes?.uv || geometry.attributes.uv2) return geometry;
  const uvArray = geometry.attributes.uv.array;
  geometry.setAttribute('uv2', new THREE.BufferAttribute(new Float32Array(uvArray), 2));
  return geometry;
}

function environmentRootFor(entry) {
  if (entry?.root && typeof entry.root === 'string') {
    const normalized = normalizeAssetUrlPath(entry.root);
    const envId = String(entry?.id || '').trim();
    if (!normalized) {
      return normalizeAssetUrlPath(`/assets/environments/${envId || 'casino_lounge'}`);
    }
    if (envId && normalized === '/assets/environments') {
      return normalizeAssetUrlPath(`/assets/environments/${envId}`);
    }
    return normalized;
  }
  return normalizeAssetUrlPath(`/assets/environments/${entry?.id || 'casino_lounge'}`);
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

  const wrapped = task.then((files) => {
    if (!Array.isArray(files) || files.length === 0) {
      environmentFileCatalogCache.delete(envId);
      return [];
    }
    return files;
  });

  environmentFileCatalogCache.set(envId, wrapped);
  return wrapped;
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

function findTextureInDirs(files, dirHints, tags) {
  for (const hint of dirHints) {
    const found = findTextureFile(files, { dirHint: hint, tags });
    if (found) return found;
  }
  return '';
}

function mapRoomAssets(files, environmentId) {
  const floorDirs = environmentId === 'casino_lounge'
    ? ['/materials/carpet/', '/materials/floor/']
    : ['/materials/floor/', '/materials/carpet/'];
  const wallDirs = ['/materials/walls/'];
  const trimDirs = ['/materials/trim/'];
  const baseTags = ['basecolor', 'base_color', 'albedo', 'diffuse', 'color'];
  const normalTags = ['normal', '_nrm', '_n'];
  const roughTags = ['roughness', 'rough'];
  const aoTags = ['ambientocclusion', 'ambient_occlusion', 'ao'];
  const hdriFiles = files.filter((file) => file.toLowerCase().includes('/hdri/') && file.toLowerCase().endsWith('.exr'));
  const preferredCasinoHdr = hdriFiles.find((file) => file.toLowerCase().includes('anniversary_lounge_4k.exr'));
  const hdri = (environmentId === 'casino_lounge' && preferredCasinoHdr) ? preferredCasinoHdr : (hdriFiles[0] || '');
  const props = files.filter((file) => {
    const low = file.toLowerCase();
    return low.includes('/props/') && (low.endsWith('.glb') || low.endsWith('.gltf') || low.endsWith('.obj'));
  });

  return {
    floor: {
      base: findTextureInDirs(files, floorDirs, baseTags),
      normal: findTextureInDirs(files, floorDirs, normalTags),
      roughness: findTextureInDirs(files, floorDirs, roughTags),
      ao: findTextureInDirs(files, floorDirs, aoTags)
    },
    walls: {
      base: findTextureInDirs(files, wallDirs, baseTags),
      normal: findTextureInDirs(files, wallDirs, normalTags),
      roughness: findTextureInDirs(files, wallDirs, roughTags),
      ao: findTextureInDirs(files, wallDirs, aoTags)
    },
    trim: {
      base: findTextureInDirs(files, trimDirs, baseTags),
      normal: findTextureInDirs(files, trimDirs, normalTags),
      roughness: findTextureInDirs(files, trimDirs, roughTags),
      ao: findTextureInDirs(files, trimDirs, aoTags)
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
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        tex.needsUpdate = true;
        resolve(tex);
      },
      undefined,
      () => resolve(null)
    );
  });

  const wrapped = task.then((tex) => {
    if (!tex) {
      environmentTextureCache.delete(key);
      return null;
    }
    return tex;
  });

  environmentTextureCache.set(key, wrapped);
  return wrapped;
}

async function loadEnvironmentHdri(url) {
  if (!url) return null;
  if (environmentHdriCache.has(url)) {
    return environmentHdriCache.get(url);
  }

  const task = (async () => {
    try {
      const lower = String(url).toLowerCase();
      let tex = null;
      if (lower.endsWith('.exr')) {
        tex = await new EXRLoader().loadAsync(url);
      } else if (lower.endsWith('.hdr')) {
        tex = await new RGBELoader().loadAsync(url);
      } else {
        return null;
      }
      const pmrem = pmremGenerator.fromEquirectangular(tex).texture;
      tex.dispose();
      return pmrem;
    } catch {
      return null;
    }
  })();
  const wrapped = task.then((tex) => {
    if (!tex) {
      environmentHdriCache.delete(url);
      return null;
    }
    return tex;
  });
  environmentHdriCache.set(url, wrapped);
  return wrapped;
}

const ENV_TEX_EXTS = ['png', 'jpg', 'jpeg'];

function buildMaterialMapCandidates(envRoot, materialDirCandidates, fileBase) {
  const out = [];
  for (const dir of materialDirCandidates) {
    const safeDir = String(dir || '').replace(/^\/+|\/+$/g, '');
    if (!safeDir) continue;
    const base = normalizeAssetUrlPath(`${envRoot}/${safeDir}`);
    for (const ext of ['png', 'jpg']) {
      out.push(`${base}/${fileBase}.${ext}`);
    }
  }
  return [...new Set(out)];
}

function resolveMaterialPaths(envRoot, environmentId) {
  const floorDirCandidates = environmentId === 'casino_lounge'
    ? ['materials/carpet', 'materials/floor']
    : ['materials/floor'];
  const wallDirCandidates = ['materials/walls'];
  const trimDirCandidates = ['materials/trim'];

  return {
    floor: {
      baseColor: buildMaterialMapCandidates(envRoot, floorDirCandidates, 'baseColor'),
      normal: buildMaterialMapCandidates(envRoot, floorDirCandidates, 'normal'),
      roughness: buildMaterialMapCandidates(envRoot, floorDirCandidates, 'roughness'),
      ao: [
        ...buildMaterialMapCandidates(envRoot, floorDirCandidates, 'ao'),
        ...buildMaterialMapCandidates(envRoot, floorDirCandidates, 'ambientOcclusion'),
        ...buildMaterialMapCandidates(envRoot, floorDirCandidates, 'ambient_occlusion')
      ]
    },
    walls: {
      baseColor: buildMaterialMapCandidates(envRoot, wallDirCandidates, 'baseColor'),
      normal: buildMaterialMapCandidates(envRoot, wallDirCandidates, 'normal'),
      roughness: buildMaterialMapCandidates(envRoot, wallDirCandidates, 'roughness'),
      ao: [
        ...buildMaterialMapCandidates(envRoot, wallDirCandidates, 'ao'),
        ...buildMaterialMapCandidates(envRoot, wallDirCandidates, 'ambientOcclusion'),
        ...buildMaterialMapCandidates(envRoot, wallDirCandidates, 'ambient_occlusion')
      ]
    },
    trim: {
      baseColor: buildMaterialMapCandidates(envRoot, trimDirCandidates, 'baseColor'),
      normal: buildMaterialMapCandidates(envRoot, trimDirCandidates, 'normal'),
      roughness: buildMaterialMapCandidates(envRoot, trimDirCandidates, 'roughness'),
      ao: [
        ...buildMaterialMapCandidates(envRoot, trimDirCandidates, 'ao'),
        ...buildMaterialMapCandidates(envRoot, trimDirCandidates, 'ambientOcclusion'),
        ...buildMaterialMapCandidates(envRoot, trimDirCandidates, 'ambient_occlusion')
      ]
    }
  };
}

async function loadTextureSafe(candidates, { srgb, repeat }, envStatus, statusKey) {
  const urls = Array.isArray(candidates) ? candidates : [];
  let firstTriedUrl = '';
  for (const url of urls) {
    if (!firstTriedUrl) firstTriedUrl = url;
    const tex = await loadEnvironmentTexture(url, { srgb, repeat });
    if (tex) {
      if (envStatus && statusKey) {
        envStatus.loadedMaps[statusKey] = url;
      }
      return tex;
    }
  }
  if (envStatus && statusKey && !envStatus.missingMaps.includes(statusKey)) {
    envStatus.missingMaps.push(statusKey);
  }
  if (envStatus && !envStatus.firstFailedUrl && firstTriedUrl) {
    envStatus.firstFailedUrl = firstTriedUrl;
    envStatus.firstFailedReason = 'map load failed';
  }
  return null;
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findCatalogTexture(catalog, dirPath, fileBase) {
  if (!Array.isArray(catalog) || !catalog.length) return '';
  const safeDir = String(dirPath || '').replace(/^\/+|\/+$/g, '');
  const safeBase = String(fileBase || '').trim();
  if (!safeDir || !safeBase) return '';
  const matcher = new RegExp(`/${escapeRegExp(safeDir)}/${escapeRegExp(safeBase)}\\.(png|jpg|jpeg)$`, 'i');
  for (const entry of catalog) {
    if (typeof entry !== 'string') continue;
    if (matcher.test(entry)) return entry;
  }
  return '';
}

async function loadExpectedMapTexture(envRoot, dirPath, fileBase, options = {}, catalog = []) {
  const fromCatalog = findCatalogTexture(catalog, dirPath, fileBase);
  if (fromCatalog) {
    const tex = await loadEnvironmentTexture(fromCatalog, options);
    if (tex) return tex;
  }

  const baseDir = normalizeAssetUrlPath(`${envRoot}/${dirPath}`);
  const candidateBases = [...new Set([
    String(fileBase || ''),
    String(fileBase || '').toLowerCase(),
    String(fileBase || '').charAt(0).toLowerCase() + String(fileBase || '').slice(1),
    String(fileBase || '').charAt(0).toUpperCase() + String(fileBase || '').slice(1)
  ].filter(Boolean))];

  for (const baseName of candidateBases) {
    for (const ext of ENV_TEX_EXTS) {
      const url = `${baseDir}/${baseName}.${ext}`;
      const tex = await loadEnvironmentTexture(url, options);
      if (tex) return tex;
    }
  }
  return null;
}

async function loadExpectedMaterialSet(envRoot, dirCandidates, repeat, kind, catalog = []) {
  let selectedDir = dirCandidates[0];
  let base = null;
  for (const dir of dirCandidates) {
    const candidate = await loadExpectedMapTexture(envRoot, dir, 'baseColor', { srgb: true, repeat }, catalog);
    if (candidate) {
      selectedDir = dir;
      base = candidate;
      break;
    }
  }

  const searchDirs = [selectedDir, ...dirCandidates.filter((dir) => dir !== selectedDir)];
  let normal = null;
  let roughness = null;
  for (const dir of searchDirs) {
    if (!normal) {
      normal = await loadExpectedMapTexture(envRoot, dir, 'normal', { srgb: false, repeat }, catalog);
    }
    if (!roughness) {
      roughness = await loadExpectedMapTexture(envRoot, dir, 'roughness', { srgb: false, repeat }, catalog);
    }
    if (normal && roughness) break;
  }

  if (!base) {
    warnOnce(`env:${kind}:baseMissing:${envRoot}`, `[env] ${kind} baseColor map missing at ${envRoot}`);
  }
  return { base, normal, roughness, selectedDir };
}

async function chooseEnvironmentHdri(envRoot, environmentId, catalog) {
  const candidates = [];
  const envChoices = ENV_HDRI_CHOICES[environmentId] || null;
  if (envChoices) {
    const selected = getHdriVariantForEnvironment(environmentId);
    const preferred = selected === 'alt' ? envChoices.alt : envChoices.primary;
    const alternate = selected === 'alt' ? envChoices.primary : envChoices.alt;
    if (preferred) candidates.push(preferred);
    if (alternate) candidates.push(alternate);
  }
  for (const file of catalog || []) {
    const low = String(file).toLowerCase();
    if (low.includes('/hdri/') && low.endsWith('.exr')) {
      candidates.push(file);
    }
  }
  if (envRoot) {
    candidates.push(
      `${envRoot}/hdri/anniversary_lounge_4k.exr`,
      `${envRoot}/hdri/wooden_lounge_4k.exr`
    );
  }
  const unique = [...new Set(candidates.map((item) => normalizeAssetUrlPath(item)).filter(Boolean))];
  for (const url of unique) {
    const tex = await loadEnvironmentHdri(url);
    if (tex) return tex;
  }
  return null;
}

const SHARED_PROP_FOLDERS = [
  'lightbulb_led_4k',
  'steel_frame_shelves_02_4k',
  'desk_lamp_arm_01_4k',
  'steel_frame_shelves_03_4k',
  'modern_coffee_table_01_4k',
  'Shelf_01_4k',
  'wooden_table_02_4k',
  'WoodenTable_01_4k',
  'side_table_tall_01_4k',
  'decorative_book_set_01_4k',
  'hanging_picture_frame_03_4k',
  'wooden_bookshelf_worn_4k',
  'round_wooden_table_01_4k',
  'side_table_01_4k',
  'standing_picture_frame_02_4k',
  'fancy_picture_frame_01_4k',
  'industrial_wall_lamp_4k',
  'vintage_oil_lamp_4k'
];

const ENV_DECOR_LAYOUTS = {
  casino_lounge: [
    { folder: 'industrial_wall_lamp_4k', pos: [-6, 2.2, 8], rotY: 0, scale: 0.35 },
    { folder: 'industrial_wall_lamp_4k', pos: [6, 2.2, 8], rotY: 0, scale: 0.35 },
    { folder: 'fancy_picture_frame_01_4k', pos: [0, 2.0, 8], rotY: 0, scale: 0.4 },
    { folder: 'side_table_01_4k', pos: [7, 0, 6], rotY: -Math.PI / 2, scale: 0.42 },
    { folder: 'standing_picture_frame_02_4k', pos: [7, 1.0, 6], rotY: -Math.PI / 2, scale: 0.34, onTopOf: 'side_table_01_4k' },
    { folder: 'vintage_oil_lamp_4k', pos: [7.2, 1.0, 5.8], rotY: 0, scale: 0.3, onTopOf: 'side_table_01_4k' },
    { folder: 'round_wooden_table_01_4k', pos: [-7, 0, 6], rotY: Math.PI / 7, scale: 0.46 }
  ],
  spooky_parlor: [
    { folder: 'wooden_bookshelf_worn_4k', pos: [-7.5, 0, 7.5], rotY: Math.PI / 6, scale: 0.44 },
    { folder: 'decorative_book_set_01_4k', pos: [-7.0, 1.4, 7.2], rotY: 0, scale: 0.28, onTopOf: 'wooden_bookshelf_worn_4k' },
    { folder: 'side_table_tall_01_4k', pos: [7.5, 0, 7.0], rotY: -Math.PI / 5, scale: 0.4 },
    { folder: 'vintage_oil_lamp_4k', pos: [7.5, 1.1, 7.0], rotY: 0, scale: 0.3, onTopOf: 'side_table_tall_01_4k' },
    { folder: 'hanging_picture_frame_03_4k', pos: [-1.5, 2.0, 8.0], rotY: 0, scale: 0.38 },
    { folder: 'lightbulb_led_4k', pos: [4.5, 3.5, 6.5], rotY: 0, scale: 0.34 }
  ],
  rustic_tavern: [
    { folder: 'WoodenTable_01_4k', pos: [0, 0, 7.5], rotY: 0, scale: 0.45 },
    { folder: 'wooden_table_02_4k', pos: [-6.5, 0, 6.5], rotY: Math.PI / 5, scale: 0.43 },
    { folder: 'Shelf_01_4k', pos: [7.5, 0, 7.5], rotY: -Math.PI / 8, scale: 0.44 },
    { folder: 'industrial_wall_lamp_4k', pos: [0, 2.2, 8], rotY: 0, scale: 0.34 },
    { folder: 'decorative_book_set_01_4k', pos: [7.0, 1.3, 7.4], rotY: 0, scale: 0.28, onTopOf: 'Shelf_01_4k' },
    { folder: 'vintage_oil_lamp_4k', pos: [0.4, 1.0, 7.2], rotY: 0, scale: 0.3, onTopOf: 'WoodenTable_01_4k' }
  ],
  modern_suite: [
    { folder: 'modern_coffee_table_01_4k', pos: [0, 0, 7.5], rotY: 0, scale: 0.45 },
    { folder: 'steel_frame_shelves_03_4k', pos: [-7.5, 0, 7.5], rotY: Math.PI / 8, scale: 0.44 },
    { folder: 'steel_frame_shelves_02_4k', pos: [7.5, 0, 7.5], rotY: -Math.PI / 8, scale: 0.44 },
    { folder: 'desk_lamp_arm_01_4k', pos: [0.6, 0.9, 7.3], rotY: 0, scale: 0.3, onTopOf: 'modern_coffee_table_01_4k' },
    { folder: 'standing_picture_frame_02_4k', pos: [7.2, 1.4, 7.3], rotY: 0, scale: 0.34, onTopOf: 'steel_frame_shelves_02_4k' },
    { folder: 'fancy_picture_frame_01_4k', pos: [0, 2.0, 8.0], rotY: 0, scale: 0.38 }
  ],
  neon_arcade: [
    { folder: 'steel_frame_shelves_02_4k', pos: [-7.5, 0, 7.5], rotY: Math.PI / 8, scale: 0.44 },
    { folder: 'steel_frame_shelves_03_4k', pos: [7.5, 0, 7.5], rotY: -Math.PI / 8, scale: 0.44 },
    { folder: 'lightbulb_led_4k', pos: [-7.0, 3.2, 7.0], rotY: 0, scale: 0.34 },
    { folder: 'lightbulb_led_4k', pos: [7.0, 3.2, 7.0], rotY: 0, scale: 0.34 },
    { folder: 'modern_coffee_table_01_4k', pos: [0, 0, 7.5], rotY: 0, scale: 0.45 },
    { folder: 'desk_lamp_arm_01_4k', pos: [0.6, 0.9, 7.3], rotY: 0, scale: 0.3, onTopOf: 'modern_coffee_table_01_4k' },
    { folder: 'hanging_picture_frame_03_4k', pos: [0, 2.0, 8.0], rotY: 0, scale: 0.38 }
  ]
};

const PROP_SCALE_OVERRIDES = {
  industrial_wall_lamp_4k: 1.0,
  lightbulb_led_4k: 1.0,
  decorative_book_set_01_4k: 1.0
};

function getDecorCategory(folderName) {
  const folder = String(folderName || '').toLowerCase();
  if (!folder) return 'default';
  if (folder.includes('standing_picture_frame')) return 'standing_frame';
  if (folder.includes('hanging_picture_frame') || folder.includes('fancy_picture_frame') || folder.includes('picture_frame')) return 'wall_frame';
  if (folder.includes('bookshelf')) return 'bookshelf';
  if (folder.includes('shelves') || folder.includes('shelf')) return 'shelf';
  if (folder.includes('book_set')) return 'book_set';
  if (folder.includes('lightbulb')) return 'lightbulb';
  if (folder.includes('wall_lamp')) return 'wall_lamp';
  if (folder.includes('desk_lamp')) return 'desk_lamp';
  if (folder.includes('oil_lamp')) return 'oil_lamp';
  if (folder.includes('coffee_table')) return 'coffee_table';
  if (folder.includes('side_table') && folder.includes('tall')) return 'tall_side_table';
  if (folder.includes('table')) return 'side_table';
  if (folder.includes('lamp')) return 'standing_lamp';
  if (folder.includes('frame')) return 'wall_frame';
  return 'default';
}

function targetHeightMetersForProp(folderName) {
  const category = getDecorCategory(folderName);
  switch (category) {
    case 'bookshelf':
    case 'shelf':
      return 2.05;
    case 'coffee_table':
      return 0.45;
    case 'side_table':
      return 0.6;
    case 'tall_side_table':
      return 0.85;
    case 'wall_lamp':
      return 0.48;
    case 'desk_lamp':
      return 0.45;
    case 'oil_lamp':
      return 0.3;
    case 'standing_lamp':
      return 1.4;
    case 'wall_frame':
    case 'standing_frame':
      return 0.65;
    case 'book_set':
      return 0.22;
    case 'lightbulb':
      return 0.15;
    default:
      return 1.2;
  }
}

function isWallMountedDecor(folderName) {
  const category = getDecorCategory(folderName);
  return category === 'wall_lamp' || category === 'wall_frame';
}

function isStandingFrame(folderName) {
  return getDecorCategory(folderName) === 'standing_frame';
}

function isTabletopDecor(folderName) {
  const category = getDecorCategory(folderName);
  return category === 'desk_lamp' || category === 'oil_lamp' || category === 'book_set' || category === 'standing_frame';
}

function isShelfLike(folderName) {
  const category = getDecorCategory(folderName);
  return category === 'shelf' || category === 'bookshelf';
}

function snapPropToFloor(model, floorY = FLOOR_Y, pad = 0.01) {
  const box = new THREE.Box3().setFromObject(model);
  if (!Number.isFinite(box.min.y)) return;
  model.position.y += (floorY + pad - box.min.y);
}

function snapPropBottomToY(model, targetY, pad = 0.005) {
  const box = new THREE.Box3().setFromObject(model);
  if (!Number.isFinite(box.min.y)) return;
  model.position.y += (targetY + pad - box.min.y);
}

function alignPropToBackWall(model, backWallZ, pad = 0.01) {
  const box = new THREE.Box3().setFromObject(model);
  if (!Number.isFinite(box.max.z)) return;
  model.position.z += (backWallZ - pad - box.max.z);
}

function orientYawTowardPoint(model, targetX, targetZ) {
  tmpV3A.set(targetX, model.position.y, targetZ);
  model.lookAt(tmpV3A);
  model.rotation.x = 0;
  model.rotation.z = 0;
}

function clampPropInsideRoom(model, bounds, pad = 0.01) {
  const leftX = Number(bounds?.leftX ?? -9);
  const rightX = Number(bounds?.rightX ?? 9);
  const backZ = Number(bounds?.backZ ?? -10);
  const frontZ = Number(bounds?.frontZ ?? 10);
  const floorY = Number(bounds?.floorY ?? FLOOR_Y);
  const ceilingY = Number(bounds?.ceilingY ?? 5.2);

  for (let i = 0; i < 3; i += 1) {
    const box = new THREE.Box3().setFromObject(model);
    if (!Number.isFinite(box.min.x)) break;
    if (box.min.y < floorY + pad) model.position.y += (floorY + pad - box.min.y);
    if (box.max.y > ceilingY - pad) model.position.y -= (box.max.y - (ceilingY - pad));
    if (box.min.x < leftX + pad) model.position.x += (leftX + pad - box.min.x);
    if (box.max.x > rightX - pad) model.position.x -= (box.max.x - (rightX - pad));
    if (box.min.z < backZ + pad) model.position.z += (backZ + pad - box.min.z);
    if (box.max.z > frontZ - pad) model.position.z -= (box.max.z - (frontZ - pad));
  }
}

function fitPropToSupportSurface(model, supportModel, desiredX, desiredZ) {
  if (!supportModel) return false;
  const supportBox = new THREE.Box3().setFromObject(supportModel);
  if (!Number.isFinite(supportBox.min.x)) return false;
  const supportSize = new THREE.Vector3();
  supportBox.getSize(supportSize);

  let objectBox = new THREE.Box3().setFromObject(model);
  const objectSize = new THREE.Vector3();
  objectBox.getSize(objectSize);

  const objectFootprint = Math.max(objectSize.x, objectSize.z);
  const supportFootprint = Math.max(0.0001, Math.min(supportSize.x, supportSize.z) * 0.8);
  if (objectFootprint > supportFootprint) {
    const fitScale = THREE.MathUtils.clamp(supportFootprint / objectFootprint, 0.2, 1.0);
    model.scale.multiplyScalar(fitScale);
    model.updateWorldMatrix(true, true);
    objectBox = new THREE.Box3().setFromObject(model);
    objectBox.getSize(objectSize);
  }

  const marginX = Math.max(0.02, objectSize.x * 0.55);
  const marginZ = Math.max(0.02, objectSize.z * 0.55);
  const targetX = THREE.MathUtils.clamp(desiredX, supportBox.min.x + marginX, supportBox.max.x - marginX);
  const targetZ = THREE.MathUtils.clamp(desiredZ, supportBox.min.z + marginZ, supportBox.max.z - marginZ);
  const center = new THREE.Vector3();
  objectBox.getCenter(center);
  model.position.x += (targetX - center.x);
  model.position.z += (targetZ - center.z);
  model.updateWorldMatrix(true, true);
  snapPropBottomToY(model, supportBox.max.y, 0.005);
  return true;
}

function quantizeRightAngle(rad) {
  return Math.round(rad / (Math.PI * 0.5)) * (Math.PI * 0.5);
}

function getDecorReferenceMetrics() {
  const metrics = {
    avatarHeightWorld: 0,
    worldUnitsPerMeter: 1,
    tableDiameter: 0,
    chairHeight: 0,
    avatarHeight: 0
  };

  const tableNode = environmentGroup.getObjectByName('tableModel') || tableRoot;
  if (tableNode) {
    const box = new THREE.Box3().setFromObject(tableNode);
    if (Number.isFinite(box.min.x) && Number.isFinite(box.max.x)) {
      const size = new THREE.Vector3();
      box.getSize(size);
      metrics.tableDiameter = Math.max(size.x, size.z);
    }
  }

  const chairNode = chairSeatGroups.find((group) => group && group.children && group.children.length)?.children?.[0] || null;
  if (chairNode) {
    const box = new THREE.Box3().setFromObject(chairNode);
    if (Number.isFinite(box.min.y) && Number.isFinite(box.max.y)) {
      const size = new THREE.Vector3();
      box.getSize(size);
      metrics.chairHeight = size.y;
    }
  }

  const avatarNode = avatarSeatGroups[0]?.children?.length
    ? avatarSeatGroups[0]
    : (avatarSeatGroups.find((group) => group && group.children && group.children.length) || null);
  if (avatarNode) {
    const box = new THREE.Box3().setFromObject(avatarNode);
    if (Number.isFinite(box.min.y) && Number.isFinite(box.max.y)) {
      const size = new THREE.Vector3();
      box.getSize(size);
      metrics.avatarHeight = size.y;
      metrics.avatarHeightWorld = size.y;
    }
  }

  if (Number.isFinite(metrics.avatarHeightWorld) && metrics.avatarHeightWorld > 0.001) {
    metrics.worldUnitsPerMeter = metrics.avatarHeightWorld / 1.778;
  } else if (Number.isFinite(metrics.chairHeight) && metrics.chairHeight > 0.001) {
    metrics.worldUnitsPerMeter = metrics.chairHeight / 1.0;
  } else {
    metrics.worldUnitsPerMeter = 1;
  }
  metrics.worldUnitsPerMeter = Math.max(0.01, metrics.worldUnitsPerMeter);
  return metrics;
}

async function fetchSharedPropCatalog() {
  if (decorDebugState.sharedCatalog) return decorDebugState.sharedCatalog;
  try {
    const res = await fetch('/assets/environments/_shared/props/props.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    const items = Object.entries(payload || {})
      .filter(([folder, modelFile]) => folder && modelFile)
      .map(([folder, modelFile]) => ({
        folder: String(folder),
        modelFile: String(modelFile),
        modelUrl: normalizeAssetUrlPath(`/assets/environments/_shared/props/${folder}/${modelFile}`)
      }))
      .sort((a, b) => a.folder.localeCompare(b.folder));
    if (!sharedPropCatalogLogged) {
      sharedPropCatalogLogged = true;
      if (items.length) {
        console.log(`[decor] shared props folders found: ${items.length}`);
        for (const item of items) {
          console.log(`[decor] ${item.folder} -> ${item.modelUrl || 'NO_MODEL_FOUND'}`);
        }
      } else {
        console.error('[decor] No shared props found. Expected directory: client/assets/environments/_shared/props/');
      }
    }
    decorDebugState.sharedCatalog = items;
    return items;
  } catch (error) {
    if (!sharedPropCatalogLogged) {
      sharedPropCatalogLogged = true;
      console.error('[decor] Failed to fetch shared props catalog from /assets/environments/_shared/props/props.json', error);
    }
    return [];
  }
}

function updateDecorStatusText(message) {
  if (decorLoadText) decorLoadText.textContent = message;
}

function buildDecorProxy(name, color = 0xc8b28f) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.8, 0.8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.06 })
  );
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);
  g.userData.proxy = true;
  g.userData.name = name;
  return g;
}

function clearDecorBoundsHelpers() {
  for (const helper of decorDebugState.helpers) {
    helper.parent?.remove(helper);
  }
  decorDebugState.helpers = [];
}

function refreshDecorBoundsHelpers() {
  clearDecorBoundsHelpers();
  if (!showDecorBounds) return;
  for (const item of decorDebugState.props) {
    if (!item?.object3d) continue;
    const helper = new THREE.BoxHelper(item.object3d, 0x6fd3ff);
    helper.material.depthTest = false;
    helper.renderOrder = 22;
    item.object3d.parent?.add(helper);
    decorDebugState.helpers.push(helper);
  }
}

async function loadDecorModelFromCatalogEntry(entry) {
  if (!entry?.modelUrl) return null;
  try {
    const template = await loadModelTemplate(entry.modelUrl);
    const model = clonedModelAsset(template).scene;
    tuneImportedMaterials(model);
    return model;
  } catch (error) {
    console.warn('[decor] model load failed', entry.folder, entry.modelUrl, error);
    return null;
  }
}

function getRoomBounds(roomLayout = {}) {
  const width = Number(roomLayout.width || 18);
  const depth = Number(roomLayout.depth || 20);
  const wallHeight = Number(roomLayout.wallHeight || 5.2);
  return {
    leftX: -width * 0.5,
    rightX: width * 0.5,
    backZ: Number.isFinite(roomLayout.backWallZ) ? Number(roomLayout.backWallZ) : (-depth * 0.5),
    frontZ: depth * 0.5,
    floorY: FLOOR_Y,
    ceilingY: wallHeight
  };
}

function registerPlacedProp(map, folder, model) {
  const key = String(folder || '');
  if (!key) return;
  const list = map.get(key) || [];
  list.push(model);
  map.set(key, list);
}

function resolveSupportProp(map, supportName) {
  const key = String(supportName || '');
  if (!key) return null;
  const list = map.get(key);
  if (!list || !list.length) return null;
  return list[list.length - 1];
}

function maybeScalePropToTargetHeight(model, folder, worldUnitsPerMeter, decorGlobalScale) {
  tmpBox.setFromObject(model);
  if (!Number.isFinite(tmpBox.min.y) || !Number.isFinite(tmpBox.max.y)) {
    return { targetMeters: 0, finalScale: 1, beforeHeight: 0 };
  }
  const beforeHeight = Math.max(tmpBox.max.y - tmpBox.min.y, 0.0001);
  const targetMeters = targetHeightMetersForProp(folder);
  const targetHeightWorld = Math.max(0.01, targetMeters * Math.max(0.01, worldUnitsPerMeter));
  const autoScale = THREE.MathUtils.clamp(targetHeightWorld / beforeHeight, 0.02, 200);
  const overrideScale = Number(PROP_SCALE_OVERRIDES[String(folder)] ?? 1);
  const finalScale = autoScale * overrideScale * decorGlobalScale;
  model.scale.multiplyScalar(finalScale);
  return { targetMeters, finalScale, beforeHeight };
}

function populateShelfWithBooks({
  shelfModel,
  bookTemplate,
  worldUnitsPerMeter,
  roomBounds,
  tableCenter
}) {
  if (!shelfModel || !bookTemplate) return [];
  const placements = [];
  const shelfBox = new THREE.Box3().setFromObject(shelfModel);
  if (!Number.isFinite(shelfBox.min.x)) return placements;
  const shelfSize = new THREE.Vector3();
  shelfBox.getSize(shelfSize);

  const levelFractions = [0.25, 0.4, 0.55, 0.7, 0.85];
  const desiredLevels = shelfSize.y > 3.2 ? 5 : (shelfSize.y > 2.1 ? 4 : 3);
  const levels = levelFractions.slice(0, desiredLevels);
  const targetBookHeight = Math.max(0.03, 0.2 * worldUnitsPerMeter);

  const shelfCenter = new THREE.Vector3();
  shelfBox.getCenter(shelfCenter);
  tmpV3A.set(tableCenter.x - shelfCenter.x, 0, tableCenter.z - shelfCenter.z);
  if (tmpV3A.lengthSq() < 0.0001) tmpV3A.set(0, 0, 1);
  tmpV3A.normalize();
  const forward = tmpV3A.clone();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();

  const spanX = Math.max(0.4, shelfSize.x * 0.74);
  const rows = Math.max(6, Math.min(14, Math.floor(spanX / Math.max(0.08, targetBookHeight * 0.52))));
  const shelfFrontInset = Math.max(0.04, shelfSize.z * 0.12);
  const maxY = shelfBox.max.y - 0.03;

  for (let levelIndex = 0; levelIndex < levels.length; levelIndex += 1) {
    const frac = levels[levelIndex];
    const shelfY = THREE.MathUtils.clamp(shelfBox.min.y + shelfSize.y * frac, shelfBox.min.y + 0.04, maxY);
    for (let i = 0; i < rows; i += 1) {
      const t = rows === 1 ? 0.5 : i / (rows - 1);
      const xOffset = (t - 0.5) * spanX;
      const zOffset = shelfFrontInset;
      const jitter = Math.sin((i + 1) * (levelIndex + 2) * 1.37) * 0.015;

      const { scene: book } = clonedModelAsset(bookTemplate);
      tuneImportedMaterials(book);
      book.position.set(
        shelfCenter.x + right.x * xOffset + forward.x * zOffset,
        shelfY,
        shelfCenter.z + right.z * xOffset + forward.z * zOffset
      );
      const yaw = Math.atan2(forward.x, forward.z) + jitter;
      book.rotation.set(0, yaw, 0);
      book.scale.setScalar(1);
      book.updateWorldMatrix(true, true);
      const bookBox = new THREE.Box3().setFromObject(book);
      const bookH = Math.max(bookBox.max.y - bookBox.min.y, 0.0001);
      const scale = THREE.MathUtils.clamp((targetBookHeight / bookH) * (0.9 + 0.15 * ((i + levelIndex) % 3)), 0.1, 8);
      book.scale.multiplyScalar(scale);
      book.updateWorldMatrix(true, true);
      snapPropBottomToY(book, shelfY, 0.0025);
      clampPropInsideRoom(book, roomBounds, 0.01);
      placements.push(book);
    }
  }
  return placements;
}

async function addEnvironmentDecor(roomRoot, environmentId, roomLayout = {}) {
  const layout = ENV_DECOR_LAYOUTS[environmentId] || [];
  const catalog = await fetchSharedPropCatalog();
  const byFolder = new Map((catalog || []).map((entry) => [String(entry.folder), entry]));
  const placedByFolder = new Map();
  decorDebugState.props = [];
  decorDebugState.failures = [];
  decorDebugState.requested = layout.length;
  const decorGlobalScale = loadDecorScaleForEnvironment(environmentId);
  const refMetrics = getDecorReferenceMetrics();
  const worldUnitsPerMeter = Math.max(0.01, Number(refMetrics.worldUnitsPerMeter) || 1);
  const roomBounds = getRoomBounds(roomLayout);
  const tableCenterLocal = new THREE.Vector3(0, Number.isFinite(tableMetrics.topY) ? tableMetrics.topY : 0.9, 0);
  const tableCenterWorld = tableCenterLocal.clone();
  roomRoot.localToWorld(tableCenterWorld);

  console.log('[decor] ref', {
    avatarH_world: Number(refMetrics.avatarHeightWorld?.toFixed?.(4) || 0),
    worldUnitsPerMeter: Number(worldUnitsPerMeter.toFixed(4)),
    tableDiameter: Number(refMetrics.tableDiameter?.toFixed?.(4) || 0),
    chairHeight: Number(refMetrics.chairHeight?.toFixed?.(4) || 0),
    avatarHeight: Number(refMetrics.avatarHeight?.toFixed?.(4) || 0)
  });
  const missingExpected = SHARED_PROP_FOLDERS.filter((folder) => !byFolder.has(folder));
  if (missingExpected.length) {
    console.warn(`[decor] missing expected prop folders: ${missingExpected.join(', ')}`);
  }

  const decorRoot = new THREE.Group();
  decorRoot.name = 'envDecorRoot';
  roomRoot.add(decorRoot);
  let spawnedShelfBooks = 0;

  let bookTemplate = null;
  const bookEntry = byFolder.get('decorative_book_set_01_4k');
  if (bookEntry?.modelUrl) {
    try {
      bookTemplate = await loadModelTemplate(bookEntry.modelUrl);
    } catch (error) {
      console.warn('[decor] shelf book template unavailable', bookEntry.modelUrl, error);
    }
  }

  for (const spec of layout) {
    const entry = byFolder.get(spec.folder);
    if (!entry?.modelUrl) {
      const message = `${spec.folder}: NO_MODEL_FOUND in props.json`;
      decorDebugState.failures.push(message);
      console.warn('[decor] missing model entry', spec.folder);
      continue;
    }
    let model = await loadDecorModelFromCatalogEntry(entry);
    if (!model) {
      const message = `${spec.folder}: failed to load ${entry.modelUrl}`;
      decorDebugState.failures.push(message);
      continue;
    }
    const modelUrl = entry.modelUrl;
    const desiredX = Number(spec.pos?.[0] || 0);
    const desiredY = FLOOR_Y + Number(spec.pos?.[1] || 0);
    // Spec coordinates are authored with +Z as "back wall"; this scene uses -Z for back wall.
    const desiredZ = -Number(spec.pos?.[2] || 0);
    model.position.set(desiredX, desiredY, desiredZ);
    model.rotation.y = Number(spec.rotY || 0);
    model.scale.setScalar(1);
    model.updateWorldMatrix(true, true);
    tmpBox.setFromObject(model);
    if (Number.isFinite(tmpBox.min.y) && Number.isFinite(tmpBox.max.y)) {
      const { targetMeters, finalScale, beforeHeight } = maybeScalePropToTargetHeight(
        model,
        spec.folder,
        worldUnitsPerMeter,
        decorGlobalScale
      );
      if (!loggedDecorScaleFolders.has(String(spec.folder))) {
        loggedDecorScaleFolders.add(String(spec.folder));
        console.log('[decor] scaled', spec.folder, {
          beforeH: Number(beforeHeight.toFixed(4)),
          targetH_m: Number(targetMeters.toFixed(3)),
          scale: Number(finalScale.toFixed(4)),
          decorScale: Number(decorGlobalScale.toFixed(4)),
          worldUnitsPerMeter: Number(worldUnitsPerMeter.toFixed(4))
        });
      }
      model.updateWorldMatrix(true, true);
      const category = getDecorCategory(spec.folder);
      const wallItem = isWallMountedDecor(spec.folder);
      const supportModel = resolveSupportProp(placedByFolder, spec.onTopOf);

      if (wallItem) {
        alignPropToBackWall(model, roomBounds.backZ, 0.02);
      } else {
        snapPropToFloor(model, FLOOR_Y, 0.01);
      }

      if (supportModel && isTabletopDecor(spec.folder)) {
        fitPropToSupportSurface(model, supportModel, desiredX, desiredZ);
      }

      if (
        category === 'shelf' ||
        category === 'bookshelf' ||
        category === 'side_table' ||
        category === 'tall_side_table' ||
        category === 'coffee_table'
      ) {
        model.rotation.y = quantizeRightAngle(model.rotation.y);
      }

      if (wallItem || isStandingFrame(spec.folder)) {
        orientYawTowardPoint(model, tableCenterWorld.x, tableCenterWorld.z);
        if (category === 'wall_frame' || category === 'standing_frame') {
          model.rotation.y += Math.PI;
        }
      }

      clampPropInsideRoom(model, roomBounds, 0.02);
      if (supportModel && isTabletopDecor(spec.folder)) {
        fitPropToSupportSurface(model, supportModel, desiredX, desiredZ);
      } else if (!wallItem) {
        snapPropToFloor(model, FLOOR_Y, 0.01);
      }
    }
    decorRoot.add(model);
    registerPlacedProp(placedByFolder, spec.folder, model);
    decorDebugState.props.push({
      name: spec.folder,
      modelUrl,
      object3d: model
    });

    if (isShelfLike(spec.folder) && bookTemplate) {
      const books = populateShelfWithBooks({
        shelfModel: model,
        bookTemplate,
        worldUnitsPerMeter,
        roomBounds,
        tableCenter: tableCenterWorld
      });
      for (const book of books) {
        decorRoot.add(book);
        decorDebugState.props.push({
          name: `${spec.folder}:books`,
          modelUrl: bookEntry?.modelUrl || '',
          object3d: book
        });
      }
      spawnedShelfBooks += books.length;
    }
  }

  updateDecorStatusText(`Decor: ${decorDebugState.props.length}/${decorDebugState.requested} loaded (${environmentId}) | scale ${decorGlobalScale.toFixed(2)} | books ${spawnedShelfBooks}`);
  if (decorDebugList) {
    const loadedLines = decorDebugState.props.map((entry) => `${entry.name} (${entry.modelUrl || 'NO_MODEL_URL'})`);
    const failedLines = decorDebugState.failures.map((line) => `FAIL ${line}`);
    decorDebugList.textContent = [...loadedLines, ...failedLines].join('\n') || 'No decor entries placed.';
  }
  refreshDecorBoundsHelpers();
}

function addCasinoTrim(roomRoot, roomWidth, roomDepth, wallHeight, material) {
  const trimHeight = 0.16;
  const trimDepth = 0.06;
  const zBack = -(roomDepth * 0.5) + (trimDepth * 0.5);
  const xLeft = -(roomWidth * 0.5) + (trimDepth * 0.5);
  const xRight = (roomWidth * 0.5) - (trimDepth * 0.5);
  const y = trimHeight * 0.5;

  const backTrimGeo = ensureUv2(new THREE.BoxGeometry(roomWidth, trimHeight, trimDepth));
  const backTrim = new THREE.Mesh(backTrimGeo, material);
  backTrim.position.set(0, y, zBack);
  backTrim.receiveShadow = true;
  backTrim.castShadow = true;
  roomRoot.add(backTrim);

  const leftTrimGeo = ensureUv2(new THREE.BoxGeometry(trimDepth, trimHeight, roomDepth));
  const leftTrim = new THREE.Mesh(leftTrimGeo, material);
  leftTrim.position.set(xLeft, y, 0);
  leftTrim.receiveShadow = true;
  leftTrim.castShadow = true;
  roomRoot.add(leftTrim);

  const rightTrim = leftTrim.clone();
  rightTrim.position.x = xRight;
  roomRoot.add(rightTrim);
}

async function buildRoomEnvironment(entry, token, environmentId) {
  const roomRoot = new THREE.Group();
  roomRoot.name = `${environmentId || 'room'}Root`;
  roomRoot.position.set(0, FLOOR_Y, 0);

  const roomWidth = 18;
  const roomDepth = 20;
  const wallHeight = 5.2;

  const floorMaterial = new THREE.MeshStandardMaterial({
    map: carpetTexture,
    color: 0xffffff,
    roughness: environmentId === 'casino_lounge' ? 0.75 : 0.55,
    metalness: 0.0
  });
  const wallMaterial = new THREE.MeshStandardMaterial({
    map: wallpaperTexture,
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0.0
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    map: woodTexture,
    color: 0xffffff,
    roughness: 0.45,
    metalness: 0.0
  });

  const floor = new THREE.Mesh(ensureUv2(new THREE.PlaneGeometry(roomWidth, roomDepth)), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  floor.castShadow = false;
  roomRoot.add(floor);

  const backWall = new THREE.Mesh(ensureUv2(new THREE.PlaneGeometry(roomWidth, wallHeight)), wallMaterial);
  backWall.position.set(0, wallHeight * 0.5, -(roomDepth * 0.5));
  backWall.receiveShadow = true;
  backWall.castShadow = false;
  roomRoot.add(backWall);

  const leftWall = new THREE.Mesh(ensureUv2(new THREE.PlaneGeometry(roomDepth, wallHeight)), wallMaterial);
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
    ensureUv2(new THREE.PlaneGeometry(roomWidth, roomDepth)),
    new THREE.MeshStandardMaterial({ color: 0x2a211b, roughness: 0.9, metalness: 0.0 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = wallHeight;
  roomRoot.add(ceiling);

  addCasinoTrim(roomRoot, roomWidth, roomDepth, wallHeight, trimMaterial);
  themeGroup.add(roomRoot);

  const textureDetail = loadTextureDetailForEnvironment(environmentId);
  const baseRepeat = getEnvironmentBaseRepeats(environmentId);
  const floorRepeat = [
    Number(baseRepeat.floor[0] * textureDetail.floorTextureScale),
    Number(baseRepeat.floor[1] * textureDetail.floorTextureScale)
  ];
  const wallRepeat = [
    Number(baseRepeat.walls[0] * textureDetail.wallTextureScale),
    Number(baseRepeat.walls[1] * textureDetail.wallTextureScale)
  ];
  const trimRepeat = [
    Number(baseRepeat.trim[0] * textureDetail.trimTextureScale),
    Number(baseRepeat.trim[1] * textureDetail.trimTextureScale)
  ];
  const envRoot = environmentRootFor(entry);
  const envStatus = {
    envId: environmentId,
    loadedMaps: {},
    missingMaps: [],
    firstFailedUrl: '',
    firstFailedReason: ''
  };
  const materialPaths = resolveMaterialPaths(envRoot, environmentId);
  const catalog = await fetchEnvironmentFiles(entry);
  if (token !== environmentApplyToken) return;
  const [
    floorBaseTex,
    floorNormalTex,
    floorRoughTex,
    floorAoTex,
    wallBaseTex,
    wallNormalTex,
    wallRoughTex,
    wallAoTex,
    trimBaseTex,
    trimNormalTex,
    trimRoughTex,
    trimAoTex
  ] = await Promise.all([
    loadTextureSafe(materialPaths.floor.baseColor, { srgb: true, repeat: floorRepeat }, envStatus, 'floor.baseColor'),
    loadTextureSafe(materialPaths.floor.normal, { srgb: false, repeat: floorRepeat }, envStatus, 'floor.normal'),
    loadTextureSafe(materialPaths.floor.roughness, { srgb: false, repeat: floorRepeat }, envStatus, 'floor.roughness'),
    loadTextureSafe(materialPaths.floor.ao, { srgb: false, repeat: floorRepeat }, envStatus, 'floor.ao'),
    loadTextureSafe(materialPaths.walls.baseColor, { srgb: true, repeat: wallRepeat }, envStatus, 'walls.baseColor'),
    loadTextureSafe(materialPaths.walls.normal, { srgb: false, repeat: wallRepeat }, envStatus, 'walls.normal'),
    loadTextureSafe(materialPaths.walls.roughness, { srgb: false, repeat: wallRepeat }, envStatus, 'walls.roughness'),
    loadTextureSafe(materialPaths.walls.ao, { srgb: false, repeat: wallRepeat }, envStatus, 'walls.ao'),
    loadTextureSafe(materialPaths.trim.baseColor, { srgb: true, repeat: trimRepeat }, envStatus, 'trim.baseColor'),
    loadTextureSafe(materialPaths.trim.normal, { srgb: false, repeat: trimRepeat }, envStatus, 'trim.normal'),
    loadTextureSafe(materialPaths.trim.roughness, { srgb: false, repeat: trimRepeat }, envStatus, 'trim.roughness'),
    loadTextureSafe(materialPaths.trim.ao, { srgb: false, repeat: trimRepeat }, envStatus, 'trim.ao')
  ]);
  if (token !== environmentApplyToken) return;

  if (floorBaseTex) floorMaterial.map = floorBaseTex;
  if (floorNormalTex) floorMaterial.normalMap = floorNormalTex;
  if (floorRoughTex) floorMaterial.roughnessMap = floorRoughTex;
  if (floorAoTex) floorMaterial.aoMap = floorAoTex;
  floorMaterial.aoMapIntensity = floorAoTex ? 0.8 : 0;
  floorMaterial.normalScale.set(0.9, 0.9);
  floorMaterial.roughness = environmentId === 'casino_lounge' ? 0.75 : 0.55;
  floorMaterial.needsUpdate = true;

  if (wallBaseTex) wallMaterial.map = wallBaseTex;
  if (wallNormalTex) wallMaterial.normalMap = wallNormalTex;
  if (wallRoughTex) wallMaterial.roughnessMap = wallRoughTex;
  if (wallAoTex) wallMaterial.aoMap = wallAoTex;
  wallMaterial.aoMapIntensity = wallAoTex ? 0.8 : 0;
  wallMaterial.normalScale.set(0.6, 0.6);
  wallMaterial.roughness = 0.85;
  wallMaterial.needsUpdate = true;

  if (trimBaseTex) trimMaterial.map = trimBaseTex;
  if (trimNormalTex) trimMaterial.normalMap = trimNormalTex;
  if (trimRoughTex) trimMaterial.roughnessMap = trimRoughTex;
  if (trimAoTex) trimMaterial.aoMap = trimAoTex;
  trimMaterial.aoMapIntensity = trimAoTex ? 0.7 : 0;
  trimMaterial.normalScale.set(0.7, 0.7);
  trimMaterial.roughness = 0.45;
  trimMaterial.needsUpdate = true;

  const hdriTex = await chooseEnvironmentHdri(envRoot, environmentId, catalog);
  if (token !== environmentApplyToken) return;
  if (hdriTex) {
    scene.environment = hdriTex;
  }
  await addEnvironmentDecor(roomRoot, environmentId, {
    width: roomWidth,
    depth: roomDepth,
    wallHeight,
    backWallZ: -(roomDepth * 0.5)
  });

  if (token !== environmentApplyToken) return;
  const floorBaseOk = !!floorBaseTex;
  const wallBaseOk = !!wallBaseTex;
  const trimBaseOk = !!trimBaseTex;
  const statusDetailParts = [
    `env=${environmentId}`,
    `floor=${floorBaseOk ? 'OK' : 'MISSING'}`,
    `walls=${wallBaseOk ? 'OK' : 'MISSING'}`,
    `trim=${trimBaseOk ? 'OK' : 'MISSING'}`,
    `hdri=${hdriTex ? 'OK' : 'optional-missing'}`,
    `decorLoaded=${decorDebugState.props.length}/${decorDebugState.requested || 0}`
  ];
  if (envStatus.missingMaps.length) {
    statusDetailParts.push(`missingMaps=${envStatus.missingMaps.join(',')}`);
  }
  if (envStatus.firstFailedUrl) {
    statusDetailParts.push(`firstFail=${envStatus.firstFailedUrl}`);
  }
  const statusDetail = statusDetailParts.join(' | ');
  if (floorBaseOk && wallBaseOk && trimBaseOk) {
    setEnvironmentLoadStatus('ok', statusDetail);
  } else {
    setEnvironmentLoadStatus('fallback', statusDetail);
  }
}

function applyEnvironment(environmentId, { force = false } = {}) {
  const fallbackEnvId = environmentById.has('casino_lounge')
    ? 'casino_lounge'
    : (environmentCatalog[0]?.id || 'casino_lounge');
  const safeId = environmentById.has(environmentId) ? environmentId : fallbackEnvId;
  if (!force && currentEnvironmentId === safeId && environmentLoadState === 'ok') return;
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

  currentFogColor = preset.fog.color;
  currentFogNear = preset.fog.near;
  currentFogFar = preset.fog.far;
  scene.fog = new THREE.Fog(currentFogColor, currentFogNear, currentFogFar);
  scene.environment = null;
  scene.background = new THREE.Color(preset.bottom);
  const envLighting = loadLightingForEnvironment(safeId);
  applyLightingState(envLighting, { persist: false });
  void buildRoomEnvironment({
    ...entry,
    root: environmentRootFor(entry)
  }, token, safeId).catch(() => {
    if (token !== environmentApplyToken) return;
    const fallbackSky = getSkyTexture(`${safeId}-fallback`, preset.top, preset.bottom);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(56, 36, 20),
      new THREE.MeshBasicMaterial({ map: fallbackSky, side: THREE.BackSide, depthWrite: false })
    );
    themeGroup.add(dome);
    setEnvironmentLoadStatus('fallback', 'missing HDR/texture');
  });
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
  const tableScale = clampValue(Number(viewSettings.tableDominoScale), 0.01, 75.0, 1.0);
  const centerY = tableMetrics.topY + Math.max(0.012, DOMINO_TILE_THICKNESS * Math.max(1, tableScale) + 0.004);
  const forwardTowardPlayer = seatBasis.forward.clone().multiplyScalar(-1);
  const anchor = new THREE.Vector3(0, centerY, 0).addScaledVector(forwardTowardPlayer, 0.15);
  const rowRight = seatBasis.right.clone().normalize();
  const dominoWidth = DOMINO_SHORT * tableScale;
  const gap = clampValue(dominoWidth * 0.35, 0.01, 0.02, 0.012);
  const spacing = Math.max(dominoWidth + gap, dominoWidth * 1.1);
  const startX = -((plays.length - 1) * spacing) * 0.5;
  const facingYaw = Math.atan2(seatBasis.forward.z, seatBasis.forward.x);
  const tiltRad = THREE.MathUtils.degToRad(clampValue(Number(viewSettings.tableDominoTiltDeg), 0, 105, 10));

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
    mesh.rotation.set(0, facingYaw + (Math.PI * 0.5), 0);
    mesh.rotateX(tiltRad);
    mesh.position.y = Math.max(mesh.position.y, tableMetrics.topY + 0.012);
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
    closeBidTray();
    closeModeTray();
    closeTrumpTray();
    chooserWaitBanner?.classList.add('hidden');
    closeChipTray();
    updateScoreboard();
    updateMarksMenu();
    updateBurnPanels();
    updateTimerControls();
    updateBettingControls();
    updateChipTotalsWidget();
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
  updateBettingControls();
  updateBidTray();
  updateChipTotalsWidget();
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
    if (bidTrayTimer) bidTrayTimer.textContent = 'TIME: --';
    return;
  }
  const remaining = currentTimerRemainingMs();
  const text = `TIME: ${formatTimerMs(remaining)}`;
  turnTimerHud.textContent = text;
  if (bidTrayTimer) bidTrayTimer.textContent = text;
}

function updateEnvironmentControls() {
  if (!environmentCatalog.length) {
    environmentSelect.innerHTML = '<option value="casino_lounge">casino_lounge</option>';
    environmentSelect.disabled = true;
    if (hdriVariantSelect) hdriVariantSelect.disabled = true;
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
  const variants = ENV_HDRI_CHOICES[safeId] || null;
  const currentVariant = getHdriVariantForEnvironment(safeId);
  if (hdriVariantSelect) {
    hdriVariantSelect.disabled = !variants;
    hdriVariantSelect.value = currentVariant;
    hdriVariantSelect.title = variants ? 'Switch environment lighting variant' : 'No HDRI variants for this environment';
  }
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

function updateLightingControlsUi() {
  if (!activeLightingState) {
    const envId = currentEnvironmentId || roomState?.environmentId || 'casino_lounge';
    activeLightingState = loadLightingForEnvironment(envId);
  }
  setLightingControlValues(activeLightingState);
}

function setupLightingControls() {
  updateLightingControlsUi();
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
      tableDominoScale: Number(viewSettings.tableDominoScale),
      tableDominoTiltDeg: Number(viewSettings.tableDominoTiltDeg)
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

  for (let i = 0; i < seatAvatarYOffsetInputs.length; i += 1) {
    const input = seatAvatarYOffsetInputs[i];
    if (!input) continue;
    input.addEventListener('input', () => {
      avatarSeatYOffsets[i] = Number(input.value);
      sanitizeAvatarSeatOffsets();
      updateSceneTuningUi();
      persistAvatarSeatOffsets();
      applySceneTuning({ rerenderHand: true });
    });
  }

  resetSceneTuningBtn?.addEventListener('click', () => {
    applyDefaultSceneTuningSettings();
    sceneTuningLoadSource = 'defaults';
    updateSceneTuningUi();
    persistSceneTuning();
    localStorage.removeItem(AVATAR_Y_OFFSETS_STORAGE_KEY);
    updateSettingsLoadedText();
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
      tableY: Number(sceneTuning.tableY),
      seatAvatarYOffset: avatarSeatYOffsets.map((value) => Number(value))
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
  const crownTeam = roomState?.lastSevenMarksWinnerTeam || null;
  const localSeat = getLocalSeat();

  for (let seatIndex = 0; seatIndex < 4; seatIndex += 1) {
    const node = document.getElementById(`nameplate-${seatIndex}`);
    const seat = roomState?.seats?.[seatIndex] || {
      seatIndex,
      name: `Seat ${seatIndex + 1}`,
      type: 'human',
      occupantClientId: null
    };

    const active = roomState?.turnSeat === seatIndex;
    const crown = crownTeam && teamForSeat(seatIndex) === crownTeam ? ' 👑' : '';
    const bidValue = roomState?.phase === PHASES.BIDDING
      ? (seatIndex === localSeat && pendingLocalBidChoice != null ? pendingLocalBidChoice : (seatBids[seatIndex] || 'PASS'))
      : seatIndex === roomState?.bidderSeat && roomState?.bidValue != null
        ? roomState.bidValue
        : '-';
    const teamTag = teamForSeat(seatIndex) === 'teamA' ? 'Team 1' : 'Team 2';
    const canEditName = localSeat === seatIndex && seat.type === 'human';
    const nameSafe = String(seat.name || `Seat ${seatIndex + 1}`).replace(/"/g, '&quot;');

    node.innerHTML = `
      <div class="dragHandle" data-drag-seat="${seatIndex}" title="Drag">MOVE</div>
      <div class="teamTag">${teamTag}</div>
      <div class="seatName">${seat.name || `Seat ${seatIndex + 1}`}${crown}</div>
      <div class="seatMeta">Bid: ${bidValue}</div>
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
        pendingSeatTypeTransformGuard = {
          seatIndex,
          before: captureSeatTypeTransformSnapshot(),
          at: Date.now()
        };
        const sent = sendAction('setSeatType', {
          seatIndex,
          type: el.value,
          cpuLevel: roomState.seats[seatIndex].cpuLevel,
          name: getStoredPlayerName()
        });
        if (!sent) {
          pendingSeatTypeTransformGuard = null;
        }
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
  updateBidTray();

  if (!roomState || roomState.phase !== PHASES.BIDDING) {
    passBtn.disabled = true;
    updateNameplates();
    updateModeTrumpTrays();
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
  updateModeTrumpTrays();
  updateBidTray();
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
  updateModeTrumpTrays();
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
  const prevRoomState = roomState;
  if (room?.localClientId) {
    localClientId = String(room.localClientId);
    localStorage.setItem(PLAYER_ID_STORAGE_KEY, localClientId);
  }
  const prevPhase = prevRoomState?.phase || null;
  const prevSevenWinner = prevRoomState?.lastSevenMarksWinnerTeam || null;
  const prevLocalSeat = lastLocalSeat;
  roomState = room;
  if (roomState?.betting?.isOpen || roomState?.phase === PHASES.BETTING) {
    pendingBettingOpenEvent = {
      handId: Number(roomState.betting?.handId || roomState.pendingBets?.handId || roomState.handNumber || 0),
      defaultBet: Number(roomState.betting?.betAmount || roomState.pendingBets?.amount || roomState.baseBetAmount || 10),
      betPot: Number(roomState.betting?.betPot || roomState.pendingBets?.pot || 0),
      betState: roomState.betting?.betState && typeof roomState.betting.betState === 'object'
        ? { ...roomState.betting.betState }
        : (roomState.pendingBets?.responses ? { ...roomState.pendingBets.responses } : {})
    };
  } else {
    pendingBettingOpenEvent = null;
  }

  const newLocalSeat = getLocalSeat();
  lastLocalSeat = newLocalSeat;
  if (prevLocalSeat !== newLocalSeat) {
    storedAvatarAppliedSeat = null;
    storedNameAppliedSeat = null;
    updateSeatTransforms();
    if (roomState.phase !== PHASES.LOBBY) {
      resetViewForLocalSeat(true);
    }
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

  if (prevSevenWinner !== roomState.lastSevenMarksWinnerTeam && roomState.lastSevenMarksWinnerTeam) {
    playPartyBlower();
  }

  applyStoredAvatarIfNeeded();
  applyStoredNameIfNeeded();
  applyEnvironment(roomState.environmentId || 'casino_lounge');
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
  updateModeTrumpTrays();
  renderHandsAndTrick();
  const avatarsChanged = !prevRoomState || !Array.isArray(prevRoomState.seats) || !Array.isArray(roomState.seats)
    || roomState.seats.some((seat, index) => {
      const prevSeat = prevRoomState.seats[index];
      return !prevSeat || prevSeat.avatarId !== seat.avatarId;
    });
  if (avatarsChanged) {
    renderAvatars();
  } else {
    updateSeatTransforms();
  }
  roomChangingAvatarOptimistic = false;
  enforceSeatTypeTransformGuard();
}

function resetRoomLocally() {
  roomState = null;
  lastLocalSeat = null;
  pendingBettingOpenEvent = null;
  clearTimeoutPenaltyEmojis();
  closeBettingModal();
  applyEnvironment('casino_lounge');
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
    let avatarChanged = false;
    if (data.avatarId != null && seat.avatarId !== data.avatarId) {
      seat.avatarId = data.avatarId;
      avatarChanged = true;
    }
    if (typeof data.name === 'string') seat.name = data.name;
    if (avatarChanged) {
      renderAvatars();
    } else {
      updateSeatTransforms();
    }
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
    applyEnvironment(roomState.environmentId || 'casino_lounge');
    updateEnvironmentControls();
    return;
  }

  if (data.type === 'betting:open') {
    pendingBettingOpenEvent = {
      handId: Number(data.handId || roomState?.handNumber || 0),
      defaultBet: Math.max(1, Number(data.defaultBet || roomState?.baseBetAmount || 10)),
      betPot: Number(data.betPot || 0),
      currentBid: Math.max(1, Number(data.currentBid || data.defaultBet || roomState?.baseBetAmount || 10)),
      betWagers: data.betWagers && typeof data.betWagers === 'object' ? { ...data.betWagers } : {},
      betState: data.betState && typeof data.betState === 'object' ? { ...data.betState } : {}
    };
    if (roomState) {
      const handId = Number(data.handId || roomState.handNumber || 0);
      roomState.betting = {
        enabled: true,
        activeThisHand: true,
        handId,
        isOpen: true,
        betAmount: Math.max(1, Number(data.defaultBet || roomState.baseBetAmount || 10)),
        betPot: Number(data.betPot || 0),
        currentBid: Math.max(1, Number(data.currentBid || data.defaultBet || roomState.baseBetAmount || 10)),
        betWagers: data.betWagers && typeof data.betWagers === 'object' ? { ...data.betWagers } : {},
        betState: data.betState && typeof data.betState === 'object' ? { ...data.betState } : {}
      };
      roomState.pendingBets = {
        amount: roomState.betting.betAmount,
        pot: roomState.betting.betPot,
        currentBid: roomState.betting.currentBid,
        wagers: { ...(roomState.betting.betWagers || {}) },
        handId,
        isOpen: true,
        openedAtTs: Date.now(),
        closesAtTs: Date.now() + 20000,
        responses: { ...roomState.betting.betState }
      };
      roomState.phase = PHASES.BETTING;
    }
    updateBettingControls();
    updateBettingModal();
    return;
  }

  if (data.type === 'betting:close') {
    pendingBettingOpenEvent = null;
    if (roomState?.betting) {
      roomState.betting.isOpen = false;
      roomState.betting.betPot = Number(data.betPot || roomState.betting.betPot || 0);
      roomState.betting.currentBid = Math.max(1, Number(data.currentBid || roomState.betting.currentBid || roomState.betting.betAmount || roomState.baseBetAmount || 10));
      roomState.betting.betWagers = data.betWagers && typeof data.betWagers === 'object'
        ? { ...data.betWagers }
        : { ...(roomState.betting.betWagers || {}) };
      roomState.betting.betState = data.betState && typeof data.betState === 'object'
        ? { ...data.betState }
        : { ...(roomState.betting.betState || {}) };
    }
    closeBettingModal();
    updateBettingControls();
    return;
  }

  if (data.type === 'snapshot') {
    applySnapshot(data.room);
    return;
  }

  if (data.type === 'error') {
    if (data.action === 'setSeatType') {
      pendingSeatTypeTransformGuard = null;
    }
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
    updateBettingControls();
    sendClientHello();
    logMessage('Connected', 1300);
  });

  socketRef.on('disconnect', (reason) => {
    pendingBettingOpenEvent = null;
    networkLastDisconnectReason = String(reason || 'disconnect');
    syncSocketInfoFromSingleton();
    updateSocketUi();
    updateTimerControls();
    updateBettingControls();
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
    playDominoThud();
    const trickState = Array.isArray(payload?.trickState) ? payload.trickState : null;
    if (trickState) {
      renderTableTrick(trickState);
    }
  });

  socketRef.on('betting:open', (payload) => {
    handleServerPacket({ type: 'betting:open', ...(payload || {}) });
  });

  socketRef.on('betting:close', (payload) => {
    handleServerPacket({ type: 'betting:close', ...(payload || {}) });
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
  return loadEnvironmentHdri(url);
}

async function initHdrEnvironment() {
  const fallbackEnv = () => {
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.05).texture;
    scene.environment = envTex;
    scene.background = null;
  };

  const hdrCandidates = [
    '/assets/environments/_shared/hdri/anniversary_lounge_4k.exr',
    '/assets/environments/_shared/hdri/wooden_lounge_4k.exr'
  ];

  for (const candidate of hdrCandidates) {
    const texture = await loadHdrTexture(candidate);
    if (!texture) continue;
    scene.environment = texture;
    scene.background = null;
    return;
  }

  console.warn('[env] No EXR found; using RoomEnvironment fallback.');
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

  bettingEnabledToggle?.addEventListener('change', () => {
    sendAction('host:bettingEnable', {
      enabled: !!bettingEnabledToggle.checked,
      baseBetAmount: Number(betAmountInput?.value || roomState?.baseBetAmount || 10)
    });
  });

  betAmountInput?.addEventListener('input', () => {
    const amount = Math.max(1, Math.min(300, Number(betAmountInput.value) || 10));
    betAmountInput.value = `${amount}`;
    if (betAmountValue) {
      betAmountValue.textContent = `${amount}`;
    }
  });

  betAmountInput?.addEventListener('change', () => {
    const amount = Math.max(1, Math.min(300, Number(betAmountInput.value) || 10));
    betAmountInput.value = `${amount}`;
    sendAction('host:setBetAmount', { amount });
  });

  muteToggle?.addEventListener('change', () => {
    setMuted(!!muteToggle.checked, { persist: true });
  });

  tableHudScaleInput?.addEventListener('input', () => {
    tableHudSettings.scale = Number(tableHudScaleInput.value);
    applyTableHudSettings({ persist: true });
  });

  hudBidDragHandle?.addEventListener('pointerdown', (event) => {
    beginHudBlockDrag('bid', event.pointerId, event.clientX, event.clientY);
    event.preventDefault();
  });

  hudTrumpDragHandle?.addEventListener('pointerdown', (event) => {
    beginHudBlockDrag('trump', event.pointerId, event.clientX, event.clientY);
    event.preventDefault();
  });

  chipTotalsDragHandle?.addEventListener('pointerdown', (event) => {
    beginChipWidgetDrag(event.pointerId, event.clientX, event.clientY);
    event.preventDefault();
  });

  for (const key of LIGHTING_ONLY_KEYS) {
    lightingInputs[key]?.addEventListener('input', () => updateLightingFromControls({ persist: true }));
  }

  lightingInputs.decorGlobalScale?.addEventListener('input', () => {
    const envId = currentEnvironmentId || roomState?.environmentId || environmentSelect.value || 'casino_lounge';
    const value = sanitizeDecorScale(lightingInputs.decorGlobalScale.value);
    persistDecorScaleForEnvironment(envId, value);
    setLightingControlValues(activeLightingState || makeDefaultLightingState(envId));
    applyEnvironment(envId, { force: true });
  });

  lightingInputs.floorTextureScale?.addEventListener('input', () => {
    const envId = currentEnvironmentId || roomState?.environmentId || environmentSelect.value || 'casino_lounge';
    const detail = loadTextureDetailForEnvironment(envId);
    detail.floorTextureScale = clampValue(Number(lightingInputs.floorTextureScale.value), 0.25, 8, 1);
    persistTextureDetailForEnvironment(envId, detail);
    setLightingControlValues(activeLightingState || makeDefaultLightingState(envId));
    applyEnvironment(envId, { force: true });
  });

  lightingInputs.wallTextureScale?.addEventListener('input', () => {
    const envId = currentEnvironmentId || roomState?.environmentId || environmentSelect.value || 'casino_lounge';
    const detail = loadTextureDetailForEnvironment(envId);
    detail.wallTextureScale = clampValue(Number(lightingInputs.wallTextureScale.value), 0.25, 8, 1);
    persistTextureDetailForEnvironment(envId, detail);
    setLightingControlValues(activeLightingState || makeDefaultLightingState(envId));
    applyEnvironment(envId, { force: true });
  });

  lightingInputs.trimTextureScale?.addEventListener('input', () => {
    const envId = currentEnvironmentId || roomState?.environmentId || environmentSelect.value || 'casino_lounge';
    const detail = loadTextureDetailForEnvironment(envId);
    detail.trimTextureScale = clampValue(Number(lightingInputs.trimTextureScale.value), 0.25, 8, 1);
    persistTextureDetailForEnvironment(envId, detail);
    setLightingControlValues(activeLightingState || makeDefaultLightingState(envId));
    applyEnvironment(envId, { force: true });
  });

  resetTextureDetailBtn?.addEventListener('click', () => {
    const envId = currentEnvironmentId || roomState?.environmentId || environmentSelect.value || 'casino_lounge';
    resetTextureDetailForEnvironment(envId);
    setLightingControlValues(activeLightingState || makeDefaultLightingState(envId));
    applyEnvironment(envId, { force: true });
  });

  resetLightingBtn?.addEventListener('click', () => {
    resetLightingForCurrentEnvironment();
  });
  copyLightingBtn?.addEventListener('click', async () => {
    await copyLightingJson();
  });

  environmentSelect.addEventListener('change', () => {
    const environmentId = environmentSelect.value;
    if (!roomState || roomState.hostClientId !== localClientId) return;
    if (!environmentById.has(environmentId)) return;
    sendAction('host:setEnvironment', { environmentId });
  });

  hdriVariantSelect?.addEventListener('change', () => {
    const envId = roomState?.environmentId || currentEnvironmentId || environmentSelect.value || 'casino_lounge';
    if (!ENV_HDRI_CHOICES[envId]) return;
    const variant = sanitizeHdriVariant(hdriVariantSelect.value);
    setHdriVariantForEnvironment(envId, variant, { persist: true });
    applyEnvironment(envId, { force: true });
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
    mesh.rotation.set(0, Math.PI * 0.5, 0);
    mesh.rotateX(THREE.MathUtils.degToRad(clampValue(Number(viewSettings.tableDominoTiltDeg), 0, 105, 10)));
    tablePlayRoot.add(mesh);
    if (showTableDominoBounds) {
      const helper = new THREE.BoxHelper(mesh, 0xffd777);
      helper.material.depthTest = false;
      tablePlayRoot.add(helper);
    }
    updateTableDominoDebugReadout(roomState?.trick?.length || 0);
  });

  decorBoundsToggle?.addEventListener('change', () => {
    showDecorBounds = !!decorBoundsToggle.checked;
    refreshDecorBoundsHelpers();
  });

  listLoadedPropsBtn?.addEventListener('click', () => {
    if (!decorDebugList) return;
    if (!decorDebugState.props.length && !decorDebugState.failures.length) {
      decorDebugList.textContent = 'No props loaded.';
      return;
    }
    const loaded = decorDebugState.props.map((entry) => `${entry.name} (${entry.modelUrl || 'NO_MODEL_URL'})`);
    const failed = decorDebugState.failures.map((line) => `FAIL ${line}`);
    decorDebugList.textContent = [...loaded, ...failed].join('\n');
  });

  decorTestSpawnBtn?.addEventListener('click', async () => {
    const catalog = await fetchSharedPropCatalog();
    const entry = catalog.find((item) => item.folder === 'side_table_01_4k') || null;
    if (!entry?.modelUrl) {
      logMessage('Decor test spawn failed: side_table_01_4k not found.', 2200);
      return;
    }
    const model = await loadDecorModelFromCatalogEntry(entry);
    if (!model) {
      logMessage('Decor test spawn failed: GLB load error.', 2200);
      return;
    }
    const decorRoot = themeGroup.getObjectByName('decorTestRoot') || new THREE.Group();
    decorRoot.name = 'decorTestRoot';
    if (!decorRoot.parent) themeGroup.add(decorRoot);
    clearGroup(decorRoot);
    model.position.set(0, FLOOR_Y, -6);
    model.scale.setScalar(1);
    decorRoot.add(model);
    const refMetrics = getDecorReferenceMetrics();
    const worldUnitsPerMeter = Math.max(0.01, Number(refMetrics.worldUnitsPerMeter) || 1);
    const boxBefore = new THREE.Box3().setFromObject(model);
    const h = Math.max(boxBefore.max.y - boxBefore.min.y, 0.0001);
    const targetHeightWorld = 0.6 * worldUnitsPerMeter;
    const scale = THREE.MathUtils.clamp(targetHeightWorld / h, 0.02, 200)
      * loadDecorScaleForEnvironment(currentEnvironmentId || 'casino_lounge');
    model.scale.multiplyScalar(scale);
    snapPropToFloor(model, FLOOR_Y, 0.01);
    const boxAfter = new THREE.Box3().setFromObject(model);
    console.log('[decor] test spawn side_table_01_4k bbox', {
      min: boxAfter.min.toArray(),
      max: boxAfter.max.toArray(),
      scale: Number(scale.toFixed(4))
    });
    logMessage('Decor test spawn: side_table_01_4k', 1800);
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

  window.addEventListener('pointermove', (event) => {
    if (!draggingHudBlock) return;
    if (hudPointerId != null && event.pointerId !== hudPointerId) return;
    updateHudBlockDrag(event.clientX, event.clientY);
  });

  window.addEventListener('pointermove', (event) => {
    if (!draggingChipWidget) return;
    if (chipWidgetPointerId != null && event.pointerId !== chipWidgetPointerId) return;
    updateChipWidgetDrag(event.clientX, event.clientY);
  });

  window.addEventListener('pointerup', (event) => {
    if (draggingPointerId != null && event.pointerId !== draggingPointerId) return;
    endNameplateDrag();
  });

  window.addEventListener('pointerup', (event) => {
    if (hudPointerId != null && event.pointerId !== hudPointerId) return;
    endHudBlockDrag();
  });

  window.addEventListener('pointerup', (event) => {
    if (chipWidgetPointerId != null && event.pointerId !== chipWidgetPointerId) return;
    endChipWidgetDrag();
  });

  window.addEventListener('pointercancel', () => {
    endNameplateDrag();
    endHudBlockDrag();
    endChipWidgetDrag();
  });

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

  window.addEventListener('pointerdown', () => {
    void unlockAudio();
  }, { passive: true });
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
  const now = performance.now();
  if (now - lastAvatarFloorClampTs > 350) {
    lastAvatarFloorClampTs = now;
    enforceAllAvatarFloorClamps();
  }
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
    const fallbackIds = ['casino_lounge', 'spooky_parlor', 'rustic_tavern', 'modern_suite', 'neon_arcade'];
    entries = fallbackIds.map((id) => ({
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
  if (!environmentById.has('default_lounge')) {
    const casinoEntry = environmentById.get('casino_lounge') || environmentCatalog[0] || null;
    if (casinoEntry) {
      environmentById.set('default_lounge', casinoEntry);
    }
  }

  updateEnvironmentControls();
  const targetEnv = roomState?.environmentId || 'casino_lounge';
  applyEnvironment(targetEnv);
}

window.addEventListener('resize', onResize);

runBootStep('ensureButtons', ensureButtons);
runBootStep('connect', connect);

runBootStep('loadStoredSceneTuning', loadStoredSceneTuning);
runBootStep('loadStoredViewSettings', loadStoredViewSettings);
runBootStep('loadStoredChairVisibility', loadStoredChairVisibility);
runBootStep('loadStoredBurnPanelOpacity', loadStoredBurnPanelOpacity);
runBootStep('loadStoredTableHudSettings', loadStoredTableHudSettings);
runBootStep('loadStoredChipWidgetSettings', loadStoredChipWidgetSettings);
runBootStep('loadStoredMuteSetting', loadStoredMuteSetting);
runBootStep('initAudioManager', initAudioManager);
runBootStep('updateSceneTuningUi', updateSceneTuningUi);
runBootStep('updateViewControlsUi', updateViewControlsUi);
runBootStep('updateLightingControlsUi', updateLightingControlsUi);
runBootStep('applyTableHudSettings', applyTableHudSettings);
runBootStep('applyChipWidgetSettings', applyChipWidgetSettings);
runBootStep('setupViewControls', setupViewControls);
runBootStep('setupSceneTuningControls', setupSceneTuningControls);
runBootStep('setupLightingControls', setupLightingControls);
runBootStep('addPointerInteraction', addPointerInteraction);
runBootStep('showSections', showSections);
runBootStep('setPanelOpen', () => setPanelOpen(true));
runBootStep('updateScoreboard', updateScoreboard);
runBootStep('updateTimerControls', updateTimerControls);
runBootStep('updateBettingControls', updateBettingControls);
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
