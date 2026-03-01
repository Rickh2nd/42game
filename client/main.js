import * as THREE from 'three';
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
camera.position.set(0, 9.8, 9.6);
camera.lookAt(0, 0.8, 0);

const visualsGroup = new THREE.Group();
visualsGroup.name = 'visualsGroup';
scene.add(visualsGroup);

const tableRoot = new THREE.Group();
tableRoot.name = 'tableRoot';
visualsGroup.add(tableRoot);

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

const dominoGeometry = new THREE.BoxGeometry(1.16, DOMINO_THICKNESS, 0.58);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();

const gltfLoader = new GLTFLoader();
const objLoader = new OBJLoader();
const mtlLoader = new MTLLoader();

const textureCache = new Map();
const modelCache = new Map();
const activeAvatarLoadToken = new Map();
const seatMixers = new Map();
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

let ws = null;
let localClientId = null;
let roomState = null;
let panelOpen = true;
let forceClosePanel = false;
let lastPhase = null;
let lastLocalSeat = null;
let debugVisible = false;
let storedAvatarAppliedSeat = null;
let roomChangingAvatarOptimistic = false;

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

function ensureNameplateTemplate(node, seatIndex) {
  if (node.dataset.ready === '1') return;
  node.dataset.ready = '1';
  node.innerHTML = `
    <div class="dragHandle" data-drag-seat="${seatIndex}" title="Drag">MOVE</div>
    <div class="seatName"></div>
    <div class="seatMeta"></div>
  `;
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
    show.bidding = true;
  } else if (roomState.phase === PHASES.CHOOSE_MODE || roomState.phase === PHASES.CHOOSE_TRUMP) {
    show.trump = true;
  } else if (roomState.phase === PHASES.PLAYING) {
    show.marks = true;
    show.room = true;
  } else {
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

function drawPips(ctx, value, xCenter) {
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
    ctx.beginPath();
    ctx.arc(xCenter + x * 185, 128 + y * 205, 12, 0, Math.PI * 2);
    ctx.fill();
  }
}

function getDominoTexture(tile, options = {}) {
  const {
    faceUp = true,
    pipColor = '#111111',
    glowCount = false,
    magentaTrump = false
  } = options;

  const id = tile ? tile.id || tileId(tile) : 'back';
  const key = `${id}:${faceUp ? 'up' : 'down'}:${pipColor}:${glowCount ? 1 : 0}:${magentaTrump ? 1 : 0}`;
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
    ctx.fillStyle = '#f6f0e6';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#1f1f1f';
    ctx.lineWidth = 9;
    ctx.strokeRect(8, 8, c.width - 16, c.height - 16);

    if (glowCount) {
      ctx.fillStyle = 'rgba(255, 214, 97, 0.35)';
      ctx.fillRect(0, 0, c.width, c.height);
    }

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(256, 12);
    ctx.lineTo(256, 244);
    ctx.stroke();

    ctx.fillStyle = magentaTrump ? '#cf3df6' : pipColor;
    drawPips(ctx, tile.a, 128);
    drawPips(ctx, tile.b, 384);
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

  const magentaTrump = useMagentaTrump && trumpSuit != null && tileContainsSuit(tile, trumpSuit);
  const topTexture = getDominoTexture(tile, {
    faceUp,
    pipColor: '#121212',
    glowCount,
    magentaTrump
  });
  const bottomTexture = getDominoTexture(tile, {
    faceUp: false,
    pipColor: '#111',
    glowCount: false,
    magentaTrump: false
  });

  const sideMat = new THREE.MeshStandardMaterial({ color: faceUp ? 0xf2ece1 : 0x2f3f4d, roughness: 0.9, metalness: 0.06 });
  const topMat = new THREE.MeshStandardMaterial({ map: topTexture, roughness: 0.78, metalness: 0.03 });
  const bottomMat = new THREE.MeshStandardMaterial({ map: bottomTexture, roughness: 0.9, metalness: 0.03 });
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
  model.rotation.x = -0.16;
  model.scale.y *= 0.82;
  tmpBox.setFromObject(model);
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
  const existing = seatMixers.get(seatIndex);
  if (!existing) return;
  seatMixers.delete(seatIndex);
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

    const sitClip = cloned.animations.find((clip) => /sit/i.test(clip.name));
    if (sitClip) {
      const mixer = new THREE.AnimationMixer(cloned.scene);
      mixer.clipAction(sitClip).play();
      seatMixers.set(seatIndex, mixer);
    } else {
      applyStaticSeatedPose(cloned.scene);
    }
    updateSeatTransforms();
  } catch {
    applyFallback();
  }
}

function setChairModelForSeat(seatIndex, chairTemplate) {
  const group = chairSeatGroups[seatIndex];
  clearGroup(group);
  if (!chairTemplate) {
    const fallback = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.08, 0.62),
      new THREE.MeshStandardMaterial({ color: 0x363f4d, roughness: 0.72, metalness: 0.1 })
    );
    fallback.position.y = 0.42;
    fallback.castShadow = true;
    fallback.receiveShadow = true;
    group.add(fallback);
    seatRuntime[seatIndex].chairSeatY = 0.42;
    return;
  }
  const clone = clonedModelAsset(chairTemplate).scene;
  tuneImportedMaterials(clone);
  group.add(clone);
  seatRuntime[seatIndex].chairSeatY = findSeatAnchorY(clone);
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

  const prevTable = environmentGroup.getObjectByName('tableModel');
  if (prevTable) {
    environmentGroup.remove(prevTable);
    clearGroup(prevTable);
  }
  environmentGroup.add(tableNode);
  updateTableMetricsFromObject(tableNode);

  for (let seat = 0; seat < 4; seat += 1) {
    setChairModelForSeat(seat, environmentTemplates.chair);
  }

  updateSeatTransforms();
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
    let avatarBaseY = seatConfig.avatar.pos[1] + seatRuntime[seatIndex].chairSeatY + 0.03;
    avatarBaseY = clampAvatarBaseY(avatarBaseY, seatIndex);
    avatarGroup.position.set(seatConfig.avatar.pos[0], avatarBaseY, seatConfig.avatar.pos[2]);
    if (avatarBaseY >= tableMetrics.topY - 0.11) {
      avatarGroup.position.x *= 1.08;
      avatarGroup.position.z *= 1.08;
    }
    avatarGroup.rotation.y = seatConfig.avatar.rotY;
  }

  updateNameplatePositions();
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
    const spacing = 1.22;
    const startOffset = -((myHand.length - 1) * spacing) / 2;

    myHand.forEach((tile, index) => {
      const mesh = createDominoMesh(tile, {
        faceUp: true,
        glowCount: countTilePoints(tile) > 0
      });
      mesh.position.set(seatAnchor.pos[0] + startOffset + index * spacing, DOMINO_Y, seatAnchor.pos[2]);
      mesh.rotation.y = seatAnchor.rotY;
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
    mesh.position.set(pos.x, DOMINO_Y, pos.z);
    mesh.rotation.y = rel === 1 ? -Math.PI / 2 : rel === 3 ? Math.PI / 2 : rel === 2 ? Math.PI : 0;
    trickGroup.add(mesh);
  });

  renderBurnPiles();
}

function renderBurnPiles() {
  clearGroup(burnGroupA);
  clearGroup(burnGroupB);
  if (!roomState) return;

  const aTiles = roomState.burnPiles?.teamA || [];
  const bTiles = roomState.burnPiles?.teamB || [];
  const localSeat = getLocalSeat();

  const pileAnchorForTeam = (teamSeatIndexes) => {
    let sx = 0;
    let sz = 0;
    for (const seatIndex of teamSeatIndexes) {
      const rel = toRelativeSeat(seatIndex, localSeat);
      const anchor = SEATS[rel]?.handAnchor?.pos || [0, DOMINO_Y, 0];
      sx += anchor[0];
      sz += anchor[2];
    }
    const avgX = sx / teamSeatIndexes.length;
    const avgZ = sz / teamSeatIndexes.length;
    return { x: avgX * 0.74, z: avgZ * 0.74 };
  };

  const teamAAnchor = pileAnchorForTeam([0, 2]);
  const teamBAnchor = pileAnchorForTeam([1, 3]);

  const renderPile = (tiles, group, x, z, rotY) => {
    const sample = tiles.slice(-12);
    sample.forEach((tile, i) => {
      const mesh = createDominoMesh(tile, {
        faceUp: true,
        scale: 1.11,
        glowCount: countTilePoints(tile) > 0,
        trumpSuit: roomState.trumpSuit,
        useMagentaTrump: roomState.mode === MODES.TRUMPS
      });
      mesh.position.set(x + (i % 4) * 0.12, DOMINO_Y + i * 0.01, z + Math.floor(i / 4) * 0.1);
      mesh.rotation.y = rotY;
      group.add(mesh);
    });
  };

  renderPile(aTiles, burnGroupA, teamAAnchor.x, teamAAnchor.z, 0.18);
  renderPile(bTiles, burnGroupB, teamBAnchor.x, teamBAnchor.z, -0.2);
}

function updateHud() {
  if (!roomState) {
    hudBidValue.textContent = '-';
    hudTrumpValue.textContent = '-';
    updateScoreboard();
    updateMarksMenu();
    return;
  }

  hudBidValue.textContent = roomState.bidValue == null ? '-' : String(roomState.bidValue);
  hudTrumpValue.textContent = currentTrumpLabel();

  updateScoreboard();
  updateMarksMenu();
}

function updateNameplates() {
  const seatBids = roomState?.bidBySeat || { 0: '-', 1: '-', 2: '-', 3: '-' };
  const marks = roomState?.gameMarks || { teamA: 0, teamB: 0 };
  const maxMarks = Math.max(marks.teamA || 0, marks.teamB || 0);
  const tied = (marks.teamA || 0) === (marks.teamB || 0);
  const crownTeam = maxMarks > 0 && !tied ? (marks.teamA > marks.teamB ? 'teamA' : 'teamB') : null;

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
    const bidText = roomState?.phase === PHASES.BIDDING ? ` | Bid: ${seatBids[seatIndex] || 'PASS'}` : '';

    ensureNameplateTemplate(node, seatIndex);
    const seatNameEl = node.querySelector('.seatName');
    const seatMetaEl = node.querySelector('.seatMeta');
    if (seatNameEl) seatNameEl.textContent = `${seat.name}${crown}`;
    if (seatMetaEl) seatMetaEl.textContent = `${role}${bidText}`;

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
      <div class="smallText">${seat.occupantClientId ? `Client ${seat.occupantClientId}` : (seat.type === 'cpu' ? 'CPU seat' : 'Unclaimed')}</div>
    `;

    seatControls.appendChild(card);
  });

  seatControls.querySelectorAll('[data-action]').forEach((el) => {
    const action = el.dataset.action;
    const seatIndex = Number(el.dataset.seat);

    if (action === 'claim') {
      el.addEventListener('click', () => {
        sendAction('claimSeat', { seatIndex, name: `Player ${seatIndex + 1}` });
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
          name: `Player ${seatIndex + 1}`
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

  if (!roomState || roomState.phase !== PHASES.BIDDING) {
    passBtn.disabled = true;
    return;
  }

  const canBid = localTurnToBid();
  passBtn.disabled = !canBid;

  const highBid = getCurrentHighBid();
  for (let bid = 30; bid <= 42; bid += 1) {
    const btn = document.createElement('button');
    btn.textContent = String(bid);
    btn.disabled = !canBid || bid <= highBid;
    btn.addEventListener('click', () => {
      sendAction('submitBid', { bid });
      forceClosePanel = true;
      updatePanelAutoBehavior();
    });
    bidButtonsWrap.appendChild(btn);
  }

  passBtn.onclick = () => {
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

function applySnapshot(room) {
  const prevLocalSeat = lastLocalSeat;
  roomState = room;

  const newLocalSeat = getLocalSeat();
  lastLocalSeat = newLocalSeat;
  if (prevLocalSeat !== newLocalSeat) {
    storedAvatarAppliedSeat = null;
    updateSeatTransforms();
  }

  applyStoredAvatarIfNeeded();
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
    updateHud();
    showSections();
    setPanelOpen(true);
    renderHandsAndTrick();
    updateNameplates();
    renderAvatars();
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
      seat.avatarId = data.avatarId;
      renderAvatars();
      renderSeatControls();
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
    showSections();
    renderHandsAndTrick();
    updateNameplates();
    renderAvatars();
  });

  document.getElementById('startGameBtn').addEventListener('click', () => {
    sendAction('startGame');
  });

  document.getElementById('restartGameBtn').addEventListener('click', () => {
    sendAction('restartGame');
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
  canvas.addEventListener('pointerdown', (event) => {
    if (!roomState || !isMyTurnToPlay()) return;

    const localSeat = getLocalSeat();
    if (localSeat == null || roomState.turnSeat !== localSeat) return;

    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(handGroup.children, true);
    const selected = intersects.find((hit) => hit.object?.userData?.clickable);
    if (!selected) return;

    const pickedId = selected.object.userData.tileId;
    if (!pickedId) return;
    sendAction('playTile', { tileId: pickedId });
  });
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  for (const mixer of seatMixers.values()) {
    mixer.update(dt);
  }
  updateNameplatePositions();
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

window.addEventListener('resize', onResize);

initHdrEnvironment();
ensureButtons();
addPointerInteraction();
showSections();
setPanelOpen(true);
updateScoreboard();
connect();

Promise.all([loadAvatarManifest(), loadEnvironmentModels()])
  .then(() => {
    renderSeatControls();
    renderAvatars();
  })
  .catch(() => {
    // Keep running with runtime fallbacks.
  });

updateNameplates();
animate();
