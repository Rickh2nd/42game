import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import {
  CONFIG_DEFAULTS,
  MODES,
  PHASES,
  activeSeatsForMode,
  buildShuffledDeck,
  countTilePoints,
  computeChampsTeam,
  computeLegalBids,
  computeLegalPlays,
  computeTargetThisHand,
  cpuDecide,
  dealHands,
  evaluateHandOutcome,
  findTileInHand,
  forcedDealerBidState,
  getTeam,
  makeBidSummary,
  nextActiveSeat,
  nextSeat,
  otherTeam,
  resolveTrick,
  sevensRoundResult,
  tileContainsSuit,
  updateRoundWinsAndMarks
} from '../shared/fortyTwo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const AVATAR_MANIFEST_PATH = path.join(ROOT_DIR, 'client', 'assets', 'avatars', 'manifest.json');
const ENVIRONMENT_MANIFEST_PATH = path.join(ROOT_DIR, 'client', 'assets', 'environments', 'environments.json');
const FALLBACK_ENVIRONMENT_IDS = [
  'default_lounge',
  'witch_parlor',
  'zombie_graveyard',
  'pirate_cove',
  'cowboy_saloon',
  'ninja_dojo',
  'knight_castle',
  'goblin_cave',
  'elf_forest',
  'wizard_tower',
  'hospital_clinic',
  'battlefield',
  'kitchen',
  'modern_office',
  'viking_longhouse'
];

const app = express();
app.use('/assets', express.static(path.join(ROOT_DIR, 'client', 'assets'), { fallthrough: false }));
app.use(express.static(path.join(ROOT_DIR, 'client')));
app.use('/shared', express.static(path.join(ROOT_DIR, 'shared')));
app.use('/node_modules', express.static(path.join(ROOT_DIR, 'node_modules')));

app.get('/health', (_req, res) => {
  res.json({ ok: true, now: Date.now() });
});

app.use((err, req, res, next) => {
  if (req.path.startsWith('/assets/') && (err?.status === 404 || err?.code === 'ENOENT')) {
    res.status(404).type('text/plain').send('Not found');
    return;
  }
  next(err);
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'client', 'index.html'));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const rooms = new Map();
const clients = new Map();
let clientCounter = 1;

const PORT = Number(process.env.PORT || 8080);
const avatarManifestIds = loadAvatarManifestIds();
const defaultAvatarId = avatarManifestIds.values().next().value || null;
const environmentManifestIds = loadEnvironmentManifestIds();
const defaultEnvironmentId = environmentManifestIds.values().next().value || 'default_lounge';
const TURN_TIMER_DEFAULT_MS = 60000;
const TURN_TIMER_TICK_MS = 500;

function loadAvatarManifestIds() {
  try {
    const raw = fs.readFileSync(AVATAR_MANIFEST_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((entry) => entry?.id).filter(Boolean));
  } catch {
    return new Set();
  }
}

function loadEnvironmentManifestIds() {
  try {
    const raw = fs.readFileSync(ENVIRONMENT_MANIFEST_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set(FALLBACK_ENVIRONMENT_IDS);
    const ids = parsed.map((entry) => entry?.id).filter(Boolean);
    return ids.length ? new Set(ids) : new Set(FALLBACK_ENVIRONMENT_IDS);
  } catch {
    return new Set(FALLBACK_ENVIRONMENT_IDS);
  }
}

function makeClientId() {
  const id = `c${clientCounter}`;
  clientCounter += 1;
  return id;
}

function normalizeRoomId(raw) {
  if (!raw || typeof raw !== 'string') {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10) || Math.random().toString(36).slice(2, 8).toUpperCase();
}

function makeSeat(seatIndex) {
  return {
    seatIndex,
    occupantClientId: null,
    type: 'human',
    cpuLevel: 1,
    avatarId: defaultAvatarId,
    name: `Seat ${seatIndex + 1}`
  };
}

function createRoom(roomId, hostClientId) {
  const seats = [0, 1, 2, 3].map(makeSeat);
  seats[0].type = 'human';
  seats[0].occupantClientId = hostClientId;
  seats[0].name = 'Host';

  return {
    roomId,
    hostClientId,
    clientIds: new Set([hostClientId]),
    config: { ...CONFIG_DEFAULTS },
    seats,
    phase: PHASES.LOBBY,
    dealerSeat: 0,
    turnSeat: 0,
    bidderSeat: null,
    bidValue: null,
    mode: null,
    trumpSuit: null,
    environmentId: defaultEnvironmentId,
    contract: null,
    bidHistory: [],
    bidTurnIndex: 0,
    biddingOrder: [],
    activeSeats: [0, 1, 2, 3],
    trick: [],
    trickHistory: [],
    played: [],
    pointsThisHand: { teamA: 0, teamB: 0 },
    targetThisHand: { teamA: 0, teamB: 0 },
    roundWins: { teamA: 0, teamB: 0 },
    gameMarks: { teamA: 0, teamB: 0 },
    champsTeam: null,
    burnPiles: { teamA: [], teamB: [] },
    lastBurnContributor: { teamA: 0, teamB: 1 },
    hands: { 0: [], 1: [], 2: [], 3: [] },
    handNumber: 0,
    sevensState: null,
    sevensResult: null,
    lastHandOutcome: null,
    pendingCpuTimer: null,
    trickPauseTimer: null,
    handOverTimer: null,
    turnTimerEnabled: false,
    turnTimerPaused: false,
    turnTimeLimitMs: TURN_TIMER_DEFAULT_MS,
    turnDeadlineTs: null,
    turnRemainingMs: TURN_TIMER_DEFAULT_MS,
    activeTurnId: 0,
    timeoutPenalty: null
  };
}

function send(ws, payload) {
  if (!ws || ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(payload));
}

function sendError(clientId, action, message) {
  const client = clients.get(clientId);
  if (!client) return;
  send(client.ws, {
    type: 'error',
    action,
    message
  });
}

function controlledSeatForClient(room, clientId) {
  return room.seats.filter((seat) => seat.occupantClientId === clientId).map((seat) => seat.seatIndex);
}

function humanSeatForClient(room, clientId) {
  return room.seats.find((seat) => seat.type === 'human' && seat.occupantClientId === clientId) || null;
}

function roomPublicSnapshot(room, viewerClientId) {
  const limitMs = Math.max(1000, Number(room.turnTimeLimitMs || TURN_TIMER_DEFAULT_MS));
  let remainingMs = Math.max(0, Number(room.turnRemainingMs ?? limitMs));
  if (room.turnTimerEnabled && !room.turnTimerPaused && Number.isFinite(room.turnDeadlineTs)) {
    remainingMs = Math.max(0, Number(room.turnDeadlineTs) - Date.now());
  }
  const timeoutPenalty = activeTimeoutPenalty(room);

  const handCounts = {
    0: room.hands[0]?.length || 0,
    1: room.hands[1]?.length || 0,
    2: room.hands[2]?.length || 0,
    3: room.hands[3]?.length || 0
  };

  const viewerSeats = controlledSeatForClient(room, viewerClientId);
  const hands = {};
  for (const seatIndex of viewerSeats) {
    const seat = room.seats[seatIndex];
    if (seat?.type === 'human') {
      hands[seatIndex] = (room.hands[seatIndex] || []).map((tile) => ({ ...tile }));
    }
  }

  return {
    roomId: room.roomId,
    hostClientId: room.hostClientId,
    localClientId: viewerClientId,
    seats: room.seats.map((seat) => ({ ...seat })),
    phase: room.phase,
    dealerSeat: room.dealerSeat,
    turnSeat: room.turnSeat,
    bidderSeat: room.bidderSeat,
    bidValue: room.bidValue,
    mode: room.mode,
    trumpSuit: room.trumpSuit,
    environmentId: room.environmentId || defaultEnvironmentId,
    hands,
    handCounts,
    trick: room.trick.map((play) => ({
      seatIndex: play.seatIndex,
      tile: { ...play.tile }
    })),
    played: room.played.map((play) => ({
      seatIndex: play.seatIndex,
      tile: { ...play.tile }
    })),
    pointsThisHand: { ...room.pointsThisHand },
    targetThisHand: { ...room.targetThisHand },
    roundWins: { ...room.roundWins },
    gameMarks: { ...room.gameMarks },
    champsTeam: room.champsTeam,
    burnPiles: {
      teamA: room.burnPiles.teamA.map((tile) => ({ ...tile })),
      teamB: room.burnPiles.teamB.map((tile) => ({ ...tile }))
    },
    lastBurnContributor: {
      teamA: Number.isInteger(room.lastBurnContributor?.teamA) ? room.lastBurnContributor.teamA : 0,
      teamB: Number.isInteger(room.lastBurnContributor?.teamB) ? room.lastBurnContributor.teamB : 1
    },
    bidHistory: room.bidHistory.map((entry) => ({ ...entry })),
    bidBySeat: makeBidSummary(room.bidHistory),
    sevensState: room.sevensState ? { ...room.sevensState } : null,
    contract: room.contract ? { ...room.contract } : null,
    activeSeats: [...room.activeSeats],
    handNumber: room.handNumber,
    lastHandOutcome: room.lastHandOutcome ? { ...room.lastHandOutcome } : null,
    turnTimerEnabled: !!room.turnTimerEnabled,
    turnTimerPaused: !!room.turnTimerPaused,
    turnTimeLimitMs: limitMs,
    turnDeadlineTs: room.turnDeadlineTs == null ? null : Number(room.turnDeadlineTs),
    turnRemainingMs: remainingMs,
    activeTurnId: Number(room.activeTurnId || 0),
    timeoutPenalty: timeoutPenalty ? {
      ...timeoutPenalty,
      remainingMs: Math.max(0, timeoutPenalty.expiresAtTs - Date.now())
    } : null
  };
}

function broadcastRoom(room) {
  for (const clientId of room.clientIds) {
    const client = clients.get(clientId);
    if (!client) continue;
    send(client.ws, {
      type: 'snapshot',
      room: roomPublicSnapshot(room, clientId)
    });
  }
}

function broadcastRoomEvent(room, payload) {
  for (const clientId of room.clientIds) {
    const client = clients.get(clientId);
    if (!client) continue;
    send(client.ws, payload);
  }
}

function timerEventPayload(room) {
  const limitMs = Math.max(1000, Number(room.turnTimeLimitMs || TURN_TIMER_DEFAULT_MS));
  let remainingMs = Math.max(0, Number(room.turnRemainingMs ?? limitMs));
  if (room.turnTimerEnabled && !room.turnTimerPaused && Number.isFinite(room.turnDeadlineTs)) {
    remainingMs = Math.max(0, Number(room.turnDeadlineTs) - Date.now());
  }
  return {
    type: 'game:timerUpdate',
    turnTimerEnabled: !!room.turnTimerEnabled,
    turnTimerPaused: !!room.turnTimerPaused,
    turnTimeLimitMs: limitMs,
    turnDeadlineTs: room.turnDeadlineTs == null ? null : Number(room.turnDeadlineTs),
    remainingMs,
    activePlayerSeat: Number.isInteger(room.turnSeat) ? room.turnSeat : null,
    activeTurnId: Number(room.activeTurnId || 0)
  };
}

function broadcastTurnTimer(room) {
  broadcastRoomEvent(room, timerEventPayload(room));
}

function phaseUsesTurnTimer(room) {
  return room.phase === PHASES.PLAYING && Number.isInteger(room.turnSeat);
}

function clearTurnTimer(room, { resetRemaining = true, clearPaused = false } = {}) {
  room.turnDeadlineTs = null;
  if (resetRemaining) {
    room.turnRemainingMs = Math.max(1000, Number(room.turnTimeLimitMs || TURN_TIMER_DEFAULT_MS));
  }
  if (clearPaused) {
    room.turnTimerPaused = false;
  }
}

function startTurnTimer(room, { useStoredRemaining = false } = {}) {
  if (!room.turnTimerEnabled || room.turnTimerPaused || !phaseUsesTurnTimer(room)) {
    room.turnDeadlineTs = null;
    return;
  }

  const limitMs = Math.max(1000, Number(room.turnTimeLimitMs || TURN_TIMER_DEFAULT_MS));
  let remaining = limitMs;
  if (useStoredRemaining) {
    remaining = Math.max(1, Math.min(limitMs, Number(room.turnRemainingMs || limitMs)));
  }

  room.turnRemainingMs = remaining;
  room.turnDeadlineTs = Date.now() + remaining;
  room.activeTurnId = Number(room.activeTurnId || 0) + 1;
}

function syncTurnTimerForState(room, { newTurn = false } = {}) {
  if (!room.turnTimerEnabled) {
    clearTurnTimer(room, { resetRemaining: true, clearPaused: true });
    return;
  }
  if (!phaseUsesTurnTimer(room)) {
    clearTurnTimer(room, { resetRemaining: true });
    return;
  }
  if (room.turnTimerPaused) {
    room.turnDeadlineTs = null;
    const limitMs = Math.max(1000, Number(room.turnTimeLimitMs || TURN_TIMER_DEFAULT_MS));
    if (newTurn) {
      room.turnRemainingMs = limitMs;
    } else if (!Number.isFinite(room.turnRemainingMs)) {
      room.turnRemainingMs = limitMs;
    }
    return;
  }
  if (newTurn || room.turnDeadlineTs == null) {
    startTurnTimer(room, { useStoredRemaining: false });
  }
}

function estimateWinsTrick(room, seatIndex, tile) {
  if (room.mode === MODES.SEVENS) {
    if (seatIndex !== room.bidderSeat) return false;
    const legal = computeLegalPlays(room, seatIndex);
    if (!legal.length) return false;
    const best = [...legal].sort((a, b) => {
      const da = Math.abs((a.a + a.b) - 7);
      const db = Math.abs((b.a + b.b) - 7);
      return da - db || (a.a + a.b) - (b.a + b.b) || String(a.id).localeCompare(String(b.id));
    })[0];
    return best?.id === tile.id;
  }

  const simulatedTrick = [...(room.trick || []), { seatIndex, tile }];
  const result = resolveTrick(
    {
      mode: room.mode,
      trumpSuit: room.trumpSuit,
      bidderSeat: room.bidderSeat
    },
    simulatedTrick
  );

  if (simulatedTrick.length >= room.activeSeats.length) {
    return getTeam(result.winnerSeat) === getTeam(seatIndex);
  }
  return result.winnerSeat === seatIndex;
}

function computeWorstPlayScore(room, seatIndex, tile) {
  const winsTrickEstimate = estimateWinsTrick(room, seatIndex, tile);
  const isCountTile = countTilePoints(tile) > 0;
  const pipSum = tile.a + tile.b;
  const pipSumNormalized = pipSum / 12;
  const isTrumpSide = room.mode === MODES.TRUMPS && Number.isInteger(room.trumpSuit) && tileContainsSuit(tile, room.trumpSuit);
  const trumpRank = !isTrumpSide
    ? -1
    : tile.a === tile.b
      ? 6
      : (tile.a === room.trumpSuit ? tile.b : tile.a);
  const trumpRankHigh = isTrumpSide && trumpRank >= 4;

  let playerBenefit = (winsTrickEstimate ? 10 : 0);
  playerBenefit -= isCountTile ? 8 : 0;
  playerBenefit -= trumpRankHigh ? 4 : 0;
  playerBenefit -= pipSumNormalized;

  // Make giveaway-count behavior slightly worse for deterministic timeout punishments.
  if (isCountTile && !winsTrickEstimate) {
    playerBenefit -= 2;
  }

  return {
    playerBenefit,
    giveawayPriority: isCountTile && !winsTrickEstimate ? 2 : isCountTile ? 1 : 0,
    pipSum
  };
}

function chooseWorstLegalPlay(room, seatIndex) {
  const legal = computeLegalPlays(room, seatIndex);
  if (!legal.length) return null;

  const scored = legal.map((tile) => ({
    tile,
    ...computeWorstPlayScore(room, seatIndex, tile)
  }));

  scored.sort((a, b) => {
    if (a.playerBenefit !== b.playerBenefit) return a.playerBenefit - b.playerBenefit;
    if (a.giveawayPriority !== b.giveawayPriority) return b.giveawayPriority - a.giveawayPriority;
    if (a.pipSum !== b.pipSum) return a.pipSum - b.pipSum;
    return String(a.tile.id).localeCompare(String(b.tile.id));
  });

  return scored[0].tile;
}

function clearRoomTimers(room) {
  if (room.pendingCpuTimer) {
    clearTimeout(room.pendingCpuTimer);
    room.pendingCpuTimer = null;
  }
  if (room.trickPauseTimer) {
    clearTimeout(room.trickPauseTimer);
    room.trickPauseTimer = null;
  }
  if (room.handOverTimer) {
    clearTimeout(room.handOverTimer);
    room.handOverTimer = null;
  }
}

function seatByIndex(room, seatIndex) {
  if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex > 3) return null;
  return room.seats[seatIndex];
}

function canControlSeat(room, seatIndex, clientId, internal = false) {
  const seat = seatByIndex(room, seatIndex);
  if (!seat) return false;
  if (internal) return true;
  if (seat.type === 'human') {
    return seat.occupantClientId === clientId;
  }
  if (seat.type === 'cpu') {
    return room.hostClientId === clientId;
  }
  return false;
}

function actorSeatForAction(room, action) {
  if (action === 'submitBid' || action === 'playTile') {
    return room.turnSeat;
  }
  if (action === 'chooseMode' || action === 'chooseTrump') {
    return room.bidderSeat;
  }
  return null;
}

function ensureHost(room, clientId, action) {
  if (room.hostClientId !== clientId) {
    sendError(clientId, action, 'Only host can perform this action.');
    return false;
  }
  return true;
}

function normalizeAvatarId(rawAvatarId) {
  if (rawAvatarId == null || rawAvatarId === '') {
    return defaultAvatarId;
  }
  const candidate = String(rawAvatarId).slice(0, 120);
  if (avatarManifestIds.size > 0 && !avatarManifestIds.has(candidate)) {
    return null;
  }
  return candidate;
}

function normalizeEnvironmentId(rawEnvironmentId) {
  if (rawEnvironmentId == null || rawEnvironmentId === '') {
    return defaultEnvironmentId;
  }
  const candidate = String(rawEnvironmentId).trim().toLowerCase().slice(0, 80);
  if (!environmentManifestIds.has(candidate)) {
    return null;
  }
  return candidate;
}

function activeTimeoutPenalty(room) {
  const value = room.timeoutPenalty;
  if (!value) return null;
  const expiresAtTs = Number(value.expiresAtTs || 0);
  if (!Number.isFinite(expiresAtTs) || expiresAtTs <= Date.now()) {
    room.timeoutPenalty = null;
    return null;
  }
  return {
    seat: Number(value.seat),
    playerId: value.playerId ?? null,
    activeTurnId: Number(value.activeTurnId || 0),
    emoji: value.emoji || '🤡',
    durationMs: Number(value.durationMs || 3000),
    expiresAtTs
  };
}

function handIsFinished(room) {
  if (room.mode === MODES.SEVENS && room.sevensResult) return true;
  return room.activeSeats.every((seat) => (room.hands[seat] || []).length === 0);
}

function prepareSeatsForGame(room) {
  for (const seat of room.seats) {
    if (seat.type === 'human' && !seat.occupantClientId) {
      seat.type = 'cpu';
      seat.cpuLevel = Number.isInteger(seat.cpuLevel) ? seat.cpuLevel : 1;
      if (!seat.name || seat.name.startsWith('Seat ')) {
        seat.name = `CPU ${seat.seatIndex + 1}`;
      }
    }

    if (seat.type === 'cpu') {
      seat.occupantClientId = null;
      seat.cpuLevel = Math.max(0, Math.min(4, Number(seat.cpuLevel) || 1));
      if (!seat.name || seat.name.startsWith('Seat ')) {
        seat.name = `CPU ${seat.seatIndex + 1}`;
      }
    }
  }
}

function startNewHand(room, { resetMarks = false } = {}) {
  clearRoomTimers(room);

  if (resetMarks) {
    room.roundWins = { teamA: 0, teamB: 0 };
    room.gameMarks = { teamA: 0, teamB: 0 };
    room.champsTeam = null;
    room.handNumber = 0;
  }

  prepareSeatsForGame(room);

  const deck = buildShuffledDeck();
  room.hands = dealHands(deck, [0, 1, 2, 3], 7);

  room.phase = PHASES.BIDDING;
  room.bidderSeat = null;
  room.bidValue = null;
  room.mode = null;
  room.trumpSuit = null;
  room.contract = null;
  room.bidHistory = [];
  room.trick = [];
  room.trickHistory = [];
  room.played = [];
  room.pointsThisHand = { teamA: 0, teamB: 0 };
  room.targetThisHand = { teamA: 0, teamB: 0 };
  room.burnPiles = { teamA: [], teamB: [] };
  room.lastBurnContributor = { teamA: 0, teamB: 1 };
  room.activeSeats = [0, 1, 2, 3];
  room.sevensState = null;
  room.sevensResult = null;
  room.lastHandOutcome = null;
  room.timeoutPenalty = null;

  const first = nextSeat(room.dealerSeat);
  room.biddingOrder = [first, nextSeat(first), nextSeat(nextSeat(first)), room.dealerSeat];
  room.bidTurnIndex = 0;
  room.turnSeat = room.biddingOrder[0];
  room.handNumber += 1;
  syncTurnTimerForState(room, { newTurn: true });
}

function finalizeBidding(room) {
  const numericBids = room.bidHistory.filter((entry) => Number.isInteger(entry.bid));

  if (numericBids.length === 0) {
    const forced = forcedDealerBidState(room, room.config);
    room.bidderSeat = forced.bidderSeat;
    room.bidValue = forced.bidValue;
    room.mode = MODES.TRUMPS;
    room.trumpSuit = null;
    room.contract = {
      bidderSeat: room.bidderSeat,
      bidValue: room.bidValue,
      mode: MODES.TRUMPS,
      trumpSuit: null
    };
    room.targetThisHand = computeTargetThisHand(room.bidderSeat, room.bidValue);
    room.phase = PHASES.CHOOSE_TRUMP;
    room.turnSeat = room.bidderSeat;
    return;
  }

  numericBids.sort((a, b) => b.bid - a.bid);
  const top = numericBids[0];

  room.bidderSeat = top.seatIndex;
  room.bidValue = top.bid;
  room.mode = null;
  room.trumpSuit = null;
  room.contract = {
    bidderSeat: room.bidderSeat,
    bidValue: room.bidValue,
    mode: null,
    trumpSuit: null
  };
  room.targetThisHand = computeTargetThisHand(room.bidderSeat, room.bidValue);
  room.phase = PHASES.CHOOSE_MODE;
  room.turnSeat = room.bidderSeat;
}

function enterPlayingPhase(room) {
  room.activeSeats = activeSeatsForMode(room.mode, room.bidderSeat);
  room.trick = [];
  room.trickHistory = [];
  room.played = [];
  room.pointsThisHand = { teamA: 0, teamB: 0 };
  room.burnPiles = { teamA: [], teamB: [] };
  room.lastBurnContributor = { teamA: 0, teamB: 1 };
  room.phase = PHASES.PLAYING;

  if (room.mode === MODES.SEVENS) {
    room.sevensState = {
      comparisons: 0,
      allStrictCloser: true,
      immediateLoss: false,
      soloSeat: room.bidderSeat
    };
    room.turnSeat = room.bidderSeat;
  } else {
    room.sevensState = null;
    room.turnSeat = room.bidderSeat;
  }

  room.contract = {
    bidderSeat: room.bidderSeat,
    bidValue: room.bidValue,
    mode: room.mode,
    trumpSuit: room.trumpSuit ?? null
  };
  room.targetThisHand = computeTargetThisHand(room.bidderSeat, room.bidValue);
  syncTurnTimerForState(room, { newTurn: true });
}

function finishHand(room) {
  const outcome = evaluateHandOutcome(room, room.config);
  const nextScores = updateRoundWinsAndMarks(room.roundWins, room.gameMarks, outcome.winnerTeam, room.config);

  room.roundWins = nextScores.roundWins;
  room.gameMarks = nextScores.gameMarks;
  room.champsTeam = nextScores.champsTeam;
  room.lastHandOutcome = {
    ...outcome,
    at: Date.now()
  };
  room.phase = PHASES.HAND_OVER;
  syncTurnTimerForState(room, { newTurn: true });

  room.handOverTimer = setTimeout(() => {
    room.handOverTimer = null;
    room.dealerSeat = nextSeat(room.dealerSeat);
    startNewHand(room, { resetMarks: false });
    broadcastRoom(room);
    scheduleCpuIfNeeded(room);
  }, 5000);
}

function enterTrickPause(room, handDone) {
  room.phase = PHASES.TRICK_PAUSE;
  syncTurnTimerForState(room, { newTurn: true });
  room.trickPauseTimer = setTimeout(() => {
    room.trickPauseTimer = null;

    if (handDone) {
      finishHand(room);
      broadcastRoom(room);
      return;
    }

    room.trick = [];
    room.phase = PHASES.PLAYING;
    if (room.mode === MODES.SEVENS) {
      room.turnSeat = room.bidderSeat;
    }
    syncTurnTimerForState(room, { newTurn: true });

    broadcastRoom(room);
    broadcastTurnTimer(room);
    scheduleCpuIfNeeded(room);
  }, 2200);
}

function completeTrick(room) {
  if (room.mode === MODES.SEVENS) {
    room.trickHistory.push({
      trick: room.trick.map((play) => ({ seatIndex: play.seatIndex, tile: { ...play.tile } })),
      mode: room.mode,
      trumpSuit: room.trumpSuit,
      ledSuit: null,
      winnerSeat: null,
      points: 0
    });

    const round = sevensRoundResult(room, room.trick);

    room.sevensState.comparisons += 1;
    if (!round.strictSoloWin) {
      room.sevensState.allStrictCloser = false;
    }

    if (round.immediateLoss) {
      room.sevensState.immediateLoss = true;
      room.sevensResult = {
        winnerTeam: otherTeam(getTeam(room.bidderSeat)),
        reason: round.reason
      };
      enterTrickPause(room, true);
      return;
    }

    const soloHandEmpty = (room.hands[room.bidderSeat] || []).length === 0;
    if (soloHandEmpty || room.sevensState.comparisons >= 7) {
      const success = room.sevensState.allStrictCloser && room.sevensState.comparisons >= 7;
      room.sevensResult = {
        winnerTeam: success ? getTeam(room.bidderSeat) : otherTeam(getTeam(room.bidderSeat)),
        reason: success ? 'allSevenCloser' : 'notAllSevenCloser'
      };
      enterTrickPause(room, true);
      return;
    }

    room.turnSeat = room.bidderSeat;
    enterTrickPause(room, false);
    return;
  }

  const result = resolveTrick(room, room.trick);
  const winnerTeam = getTeam(result.winnerSeat);

  room.pointsThisHand[winnerTeam] += result.points;
  room.burnPiles[winnerTeam].push(...room.trick.map((play) => ({ ...play.tile })));
  room.lastBurnContributor[winnerTeam] = result.winnerSeat;
  room.turnSeat = result.winnerSeat;

  room.trickHistory.push({
    trick: room.trick.map((play) => ({ seatIndex: play.seatIndex, tile: { ...play.tile } })),
    mode: room.mode,
    trumpSuit: room.trumpSuit,
    ledSuit: result.ledSuit,
    winnerSeat: result.winnerSeat,
    points: result.points
  });

  const targetForWinner = Number(room.targetThisHand?.[winnerTeam] || 0);
  const winnerReachedTarget = targetForWinner > 0 && Number(room.pointsThisHand?.[winnerTeam] || 0) >= targetForWinner;
  if (winnerReachedTarget) {
    enterTrickPause(room, true);
    return;
  }

  enterTrickPause(room, handIsFinished(room));
}

function expectedActorSeat(room) {
  if (room.phase === PHASES.BIDDING || room.phase === PHASES.PLAYING) {
    return room.turnSeat;
  }
  if (room.phase === PHASES.CHOOSE_MODE || room.phase === PHASES.CHOOSE_TRUMP) {
    return room.bidderSeat;
  }
  return null;
}

function projectCpuState(room) {
  return {
    phase: room.phase,
    dealerSeat: room.dealerSeat,
    turnSeat: room.turnSeat,
    bidderSeat: room.bidderSeat,
    bidValue: room.bidValue,
    mode: room.mode,
    trumpSuit: room.trumpSuit,
    hands: room.hands,
    trick: room.trick,
    played: room.played,
    pointsThisHand: room.pointsThisHand,
    activeSeats: room.activeSeats,
    bidHistory: room.bidHistory,
    trickHistory: room.trickHistory
  };
}

function scheduleCpuIfNeeded(room) {
  if (![PHASES.BIDDING, PHASES.CHOOSE_MODE, PHASES.CHOOSE_TRUMP, PHASES.PLAYING].includes(room.phase)) {
    return;
  }

  const seatIndex = expectedActorSeat(room);
  if (!Number.isInteger(seatIndex)) return;

  const seat = seatByIndex(room, seatIndex);
  if (!seat || seat.type !== 'cpu') return;

  if (room.pendingCpuTimer) return;

  const delay = 300 + Math.floor(Math.random() * 600);
  room.pendingCpuTimer = setTimeout(() => {
    room.pendingCpuTimer = null;

    const activeSeat = expectedActorSeat(room);
    if (activeSeat !== seatIndex) return;
    const currentSeat = seatByIndex(room, seatIndex);
    if (!currentSeat || currentSeat.type !== 'cpu') return;

    const decision = cpuDecide(projectCpuState(room), seatIndex, currentSeat.cpuLevel || 0, room.config);
    if (!decision || !decision.type) return;

    handleRoomAction(room, null, decision.type, decision.payload || {}, { internal: true, forcedSeat: seatIndex });
  }, delay);
}

function removeClientFromRoom(clientId, reason = 'left') {
  const client = clients.get(clientId);
  if (!client?.roomId) return;
  const room = rooms.get(client.roomId);
  if (!room) {
    client.roomId = null;
    return;
  }

  room.clientIds.delete(clientId);

  for (const seat of room.seats) {
    if (seat.occupantClientId === clientId) {
      seat.occupantClientId = null;
      if (room.phase === PHASES.LOBBY) {
        seat.name = `Seat ${seat.seatIndex + 1}`;
      } else {
        seat.type = 'cpu';
        seat.cpuLevel = Math.max(1, seat.cpuLevel || 1);
        if (!seat.name || seat.name.startsWith('Seat ')) {
          seat.name = `CPU ${seat.seatIndex + 1}`;
        }
      }
    }
  }

  if (room.hostClientId === clientId) {
    const [nextHost] = room.clientIds;
    room.hostClientId = nextHost || null;
  }

  client.roomId = null;

  if (room.clientIds.size === 0) {
    clearRoomTimers(room);
    rooms.delete(room.roomId);
    return;
  }

  broadcastRoom(room);
  scheduleCpuIfNeeded(room);

  if (reason === 'disconnect') {
    for (const otherClientId of room.clientIds) {
      const other = clients.get(otherClientId);
      if (!other) continue;
      send(other.ws, {
        type: 'info',
        message: `Client ${clientId} disconnected.`
      });
    }
  }
}

function handleRoomAction(room, clientId, action, payload, options = {}) {
  const { internal = false, forcedSeat = null, expectedTurnId = null } = options;

  const reject = (message) => {
    if (!internal && clientId) {
      sendError(clientId, action, message);
    }
    return false;
  };

  if (['submitBid', 'chooseMode', 'chooseTrump', 'playTile'].includes(action)) {
    const actorSeat = forcedSeat ?? actorSeatForAction(room, action);
    if (!Number.isInteger(actorSeat)) {
      return reject('No active seat for this action right now.');
    }
    if (!canControlSeat(room, actorSeat, clientId, internal)) {
      return reject('You cannot control this seat for that action.');
    }
  }

  if (action === 'claimSeat') {
    if (room.phase !== PHASES.LOBBY) {
      return reject('Cannot claim seats after game has started.');
    }
    const seat = seatByIndex(room, Number(payload.seatIndex));
    if (!seat) return reject('Invalid seat index.');
    if (seat.occupantClientId) return reject('Seat already occupied.');

    seat.type = 'human';
    seat.occupantClientId = clientId;
    seat.name = (payload.name || `Player ${seat.seatIndex + 1}`).toString().slice(0, 24);
    if (!seat.avatarId) {
      seat.avatarId = defaultAvatarId;
    }
    broadcastRoom(room);
    return true;
  }

  if (action === 'releaseSeat') {
    if (room.phase !== PHASES.LOBBY) {
      return reject('Cannot release seats after game has started.');
    }
    const seat = seatByIndex(room, Number(payload.seatIndex));
    if (!seat) return reject('Invalid seat index.');

    const isOwner = seat.occupantClientId === clientId;
    const isHost = room.hostClientId === clientId;
    if (!isOwner && !isHost) {
      return reject('Only seat owner or host can release this seat.');
    }

    seat.occupantClientId = null;
    if (seat.type === 'human') {
      seat.name = `Seat ${seat.seatIndex + 1}`;
    }
    broadcastRoom(room);
    return true;
  }

  if (action === 'setSeatType') {
    if (room.phase !== PHASES.LOBBY) return reject('Seat types can only be changed in lobby.');
    if (!ensureHost(room, clientId, action)) return false;

    const seat = seatByIndex(room, Number(payload.seatIndex));
    if (!seat) return reject('Invalid seat index.');

    const nextType = payload.type === 'cpu' ? 'cpu' : 'human';
    seat.type = nextType;

    if (nextType === 'cpu') {
      seat.occupantClientId = null;
      seat.cpuLevel = Math.max(0, Math.min(4, Number(payload.cpuLevel) || seat.cpuLevel || 1));
      seat.name = (payload.name || seat.name || `CPU ${seat.seatIndex + 1}`).toString().slice(0, 24);
      if (!seat.avatarId) {
        seat.avatarId = defaultAvatarId;
      }
      if (!seat.name || seat.name.startsWith('Seat ')) {
        seat.name = `CPU ${seat.seatIndex + 1}`;
      }
    } else {
      seat.cpuLevel = Math.max(0, Math.min(4, Number(payload.cpuLevel) || seat.cpuLevel || 1));
      if (payload.claimForSelf && !seat.occupantClientId) {
        seat.occupantClientId = clientId;
        seat.name = (payload.name || `Player ${seat.seatIndex + 1}`).toString().slice(0, 24);
      } else if (!seat.occupantClientId) {
        seat.name = `Seat ${seat.seatIndex + 1}`;
      }
      if (!seat.avatarId) {
        seat.avatarId = defaultAvatarId;
      }
    }

    broadcastRoom(room);
    return true;
  }

  if (action === 'setSeatAvatar') {
    const seat = seatByIndex(room, Number(payload.seatIndex));
    if (!seat) return reject('Invalid seat index.');

    if (seat.type === 'human') {
      if (seat.occupantClientId !== clientId) {
        return reject('Only the occupied human seat client can change this avatar.');
      }
    } else if (seat.type === 'cpu') {
      if (room.hostClientId !== clientId) {
        return reject('Only host can change CPU avatars.');
      }
    }

    const avatarId = normalizeAvatarId(payload.avatarId);
    if (avatarId === null) {
      return reject('Invalid avatarId.');
    }

    seat.avatarId = avatarId;
    if (seat.occupantClientId) {
      broadcastRoomEvent(room, {
        type: 'player:update',
        playerId: seat.occupantClientId,
        seatIndex: seat.seatIndex,
        avatarId: seat.avatarId
      });
    }
    broadcastRoom(room);
    return true;
  }

  if (action === 'player:setAvatar') {
    const humanSeat = humanSeatForClient(room, clientId);
    if (!humanSeat) {
      return reject('Claim a human seat before choosing an avatar.');
    }

    const avatarId = normalizeAvatarId(payload.avatarId);
    if (avatarId === null) {
      return reject('Invalid avatarId.');
    }

    humanSeat.avatarId = avatarId;
    broadcastRoomEvent(room, {
      type: 'player:update',
      playerId: clientId,
      seatIndex: humanSeat.seatIndex,
      avatarId: humanSeat.avatarId
    });
    broadcastRoom(room);
    return true;
  }

  if (action === 'setSeatName') {
    const seat = seatByIndex(room, Number(payload.seatIndex));
    if (!seat) return reject('Invalid seat index.');

    const nextName = String(payload.name || '').trim().slice(0, 24);
    if (!nextName) {
      return reject('Name is required.');
    }

    if (seat.type === 'human') {
      if (!internal && seat.occupantClientId !== clientId) {
        return reject('Only the occupied human seat client can change this name.');
      }
    } else if (seat.type === 'cpu') {
      if (!internal && room.hostClientId !== clientId) {
        return reject('Only host can change CPU names.');
      }
    }

    seat.name = nextName;
    broadcastRoomEvent(room, {
      type: 'player:update',
      playerId: seat.occupantClientId || null,
      seatIndex: seat.seatIndex,
      name: seat.name
    });
    broadcastRoom(room);
    return true;
  }

  if (action === 'host:timerEnable') {
    if (!ensureHost(room, clientId, action)) return false;

    const enabled = !!payload.enabled;
    const limitMs = Math.max(1000, Number(room.turnTimeLimitMs || TURN_TIMER_DEFAULT_MS));
    room.turnTimeLimitMs = limitMs;
    room.turnTimerEnabled = enabled;

    if (!enabled) {
      clearTurnTimer(room, { resetRemaining: true, clearPaused: true });
    } else {
      room.turnTimerPaused = false;
      room.turnRemainingMs = limitMs;
      if (phaseUsesTurnTimer(room)) {
        startTurnTimer(room, { useStoredRemaining: false });
      } else {
        room.turnDeadlineTs = null;
      }
    }

    broadcastRoom(room);
    broadcastTurnTimer(room);
    return true;
  }

  if (action === 'host:timerPause') {
    if (!ensureHost(room, clientId, action)) return false;
    if (!room.turnTimerEnabled) {
      return reject('Turn timer is disabled.');
    }

    const paused = !!payload.paused;
    const limitMs = Math.max(1000, Number(room.turnTimeLimitMs || TURN_TIMER_DEFAULT_MS));
    room.turnTimeLimitMs = limitMs;

    if (paused) {
      if (!room.turnTimerPaused) {
        const remaining = room.turnDeadlineTs == null
          ? Math.max(0, Number(room.turnRemainingMs || limitMs))
          : Math.max(0, Number(room.turnDeadlineTs) - Date.now());
        room.turnRemainingMs = remaining;
      }
      room.turnTimerPaused = true;
      room.turnDeadlineTs = null;
    } else {
      room.turnTimerPaused = false;
      if (phaseUsesTurnTimer(room)) {
        const remaining = Math.max(1, Number(room.turnRemainingMs || limitMs));
        room.turnRemainingMs = remaining;
        room.turnDeadlineTs = Date.now() + remaining;
      } else {
        room.turnDeadlineTs = null;
        room.turnRemainingMs = limitMs;
      }
    }

    broadcastRoom(room);
    broadcastTurnTimer(room);
    return true;
  }

  if (action === 'host:setEnvironment') {
    if (!ensureHost(room, clientId, action)) return false;
    const environmentId = normalizeEnvironmentId(payload.environmentId);
    if (!environmentId) {
      return reject('Invalid environmentId.');
    }
    if (room.environmentId === environmentId) {
      return true;
    }

    room.environmentId = environmentId;
    broadcastRoomEvent(room, {
      type: 'game:environmentChanged',
      environmentId
    });
    broadcastRoom(room);
    return true;
  }

  if (action === 'startGame') {
    if (!ensureHost(room, clientId, action)) return false;
    if (room.phase !== PHASES.LOBBY) return reject('Game already started.');

    startNewHand(room, { resetMarks: true });
    broadcastRoom(room);
    broadcastTurnTimer(room);
    scheduleCpuIfNeeded(room);
    return true;
  }

  if (action === 'restartGame') {
    if (!ensureHost(room, clientId, action)) return false;
    room.dealerSeat = 0;
    startNewHand(room, { resetMarks: true });
    broadcastRoom(room);
    broadcastTurnTimer(room);
    scheduleCpuIfNeeded(room);
    return true;
  }

  if (action === 'submitBid') {
    if (room.phase !== PHASES.BIDDING) return reject('submitBid is only valid during bidding.');

    const seatIndex = forcedSeat ?? room.turnSeat;
    const legal = computeLegalBids(room, seatIndex, room.config);
    if (!legal.length) return reject('No legal bids for this seat now.');

    let bid = null;
    if (payload.bid != null && payload.bid !== 'pass') {
      bid = Number(payload.bid);
      if (!Number.isInteger(bid)) return reject('Bid must be integer or pass.');
    }

    if (!legal.includes(bid)) {
      return reject('Illegal bid.');
    }

    room.bidHistory.push({ seatIndex, bid, at: Date.now() });
    room.bidTurnIndex += 1;

    if (room.bidTurnIndex >= room.biddingOrder.length) {
      finalizeBidding(room);
    } else {
      room.turnSeat = room.biddingOrder[room.bidTurnIndex];
    }
    syncTurnTimerForState(room, { newTurn: true });

    broadcastRoom(room);
    broadcastTurnTimer(room);
    scheduleCpuIfNeeded(room);
    return true;
  }

  if (action === 'chooseMode') {
    if (room.phase !== PHASES.CHOOSE_MODE) return reject('chooseMode is only valid during chooseMode phase.');
    const seatIndex = forcedSeat ?? room.bidderSeat;
    if (seatIndex !== room.bidderSeat) return reject('Only bidder can choose mode.');

    const mode = payload.mode;
    if (![MODES.TRUMPS, MODES.FOLLOW_ME, MODES.SEVENS].includes(mode)) {
      return reject('Invalid mode.');
    }
    if (mode === MODES.SEVENS && Number(room.bidValue) < Number(room.config.sevensBidThreshold)) {
      return reject(`Sevens requires bid >= ${room.config.sevensBidThreshold}.`);
    }

    room.mode = mode;
    room.contract = {
      bidderSeat: room.bidderSeat,
      bidValue: room.bidValue,
      mode,
      trumpSuit: mode === MODES.TRUMPS ? null : null
    };

    if (mode === MODES.TRUMPS) {
      room.phase = PHASES.CHOOSE_TRUMP;
      room.turnSeat = room.bidderSeat;
      syncTurnTimerForState(room, { newTurn: true });
    } else {
      room.trumpSuit = null;
      enterPlayingPhase(room);
    }

    broadcastRoom(room);
    broadcastTurnTimer(room);
    scheduleCpuIfNeeded(room);
    return true;
  }

  if (action === 'chooseTrump') {
    if (room.phase !== PHASES.CHOOSE_TRUMP) return reject('chooseTrump is only valid during chooseTrump phase.');
    if (room.mode !== MODES.TRUMPS) return reject('Trump can only be selected when mode is trumps.');

    const seatIndex = forcedSeat ?? room.bidderSeat;
    if (seatIndex !== room.bidderSeat) return reject('Only bidder can choose trump.');

    const trumpSuit = Number(payload.trumpSuit);
    if (!Number.isInteger(trumpSuit) || trumpSuit < 0 || trumpSuit > 6) {
      return reject('Trump suit must be an integer 0..6.');
    }

    room.trumpSuit = trumpSuit;
    room.contract = {
      bidderSeat: room.bidderSeat,
      bidValue: room.bidValue,
      mode: room.mode,
      trumpSuit
    };

    enterPlayingPhase(room);
    broadcastRoom(room);
    broadcastTurnTimer(room);
    scheduleCpuIfNeeded(room);
    return true;
  }

  if (action === 'playTile') {
    if (room.phase !== PHASES.PLAYING) return reject('playTile is only valid during playing phase.');
    if (expectedTurnId != null && Number(room.activeTurnId || 0) !== Number(expectedTurnId)) {
      return reject('Stale turn action rejected.');
    }

    const seatIndex = forcedSeat ?? room.turnSeat;
    if (seatIndex !== room.turnSeat) return reject('Not this seat\'s turn.');

    const hand = room.hands[seatIndex] || [];
    const tileId = payload.tileId;
    if (!tileId || typeof tileId !== 'string') return reject('tileId is required.');

    const legal = computeLegalPlays(room, seatIndex);
    const legalIds = new Set(legal.map((tile) => tile.id));
    if (!legalIds.has(tileId)) {
      return reject('Illegal play rejected by server rules.');
    }

    const idx = findTileInHand(hand, tileId);
    if (idx < 0) return reject('Tile not found in hand.');

    const [tile] = hand.splice(idx, 1);
    room.trick.push({ seatIndex, tile: { ...tile } });
    room.played.push({ seatIndex, tile: { ...tile } });

    if (room.trick.length < room.activeSeats.length) {
      room.turnSeat = nextActiveSeat(room.activeSeats, seatIndex);
      syncTurnTimerForState(room, { newTurn: true });
      broadcastRoom(room);
      broadcastTurnTimer(room);
      scheduleCpuIfNeeded(room);
      return true;
    }

    completeTrick(room);
    broadcastRoom(room);
    broadcastTurnTimer(room);
    return true;
  }

  return reject('Unknown action.');
}

function handleAction(clientId, action, payload) {
  const client = clients.get(clientId);
  if (!client) return;

  if (action === 'createRoom') {
    if (client.roomId) {
      removeClientFromRoom(clientId, 'switch-room');
    }

    const roomId = normalizeRoomId(payload?.roomId);
    if (rooms.has(roomId)) {
      sendError(clientId, action, 'Room already exists.');
      return;
    }

    const room = createRoom(roomId, clientId);
    rooms.set(roomId, room);
    client.roomId = roomId;

    send(client.ws, {
      type: 'roomCreated',
      roomId
    });
    broadcastRoom(room);
    return;
  }

  if (action === 'joinRoom') {
    const roomId = normalizeRoomId(payload?.roomId);
    const room = rooms.get(roomId);
    if (!room) {
      sendError(clientId, action, 'Room not found.');
      return;
    }

    if (client.roomId && client.roomId !== roomId) {
      removeClientFromRoom(clientId, 'switch-room');
    }

    room.clientIds.add(clientId);
    client.roomId = roomId;
    broadcastRoom(room);
    return;
  }

  if (action === 'leaveRoom') {
    removeClientFromRoom(clientId, 'left');
    return;
  }

  const roomId = client.roomId;
  if (!roomId) {
    sendError(clientId, action, 'Join or create a room first.');
    return;
  }

  const room = rooms.get(roomId);
  if (!room) {
    sendError(clientId, action, 'Room no longer exists.');
    client.roomId = null;
    return;
  }

  handleRoomAction(room, clientId, action, payload || {});
}

wss.on('connection', (ws) => {
  const clientId = makeClientId();
  clients.set(clientId, {
    clientId,
    ws,
    roomId: null
  });

  send(ws, {
    type: 'welcome',
    clientId,
    now: Date.now()
  });

  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(String(raw));
    } catch {
      sendError(clientId, 'parse', 'Invalid JSON payload.');
      return;
    }

    const action = data?.action;
    if (!action || typeof action !== 'string') {
      sendError(clientId, 'unknown', 'Missing action.');
      return;
    }

    handleAction(clientId, action, data.payload || {});
  });

  ws.on('close', () => {
    removeClientFromRoom(clientId, 'disconnect');
    clients.delete(clientId);
  });
});

server.listen(PORT, () => {
  console.log(`Texas 42 server listening on http://localhost:${PORT}`);
});

setInterval(() => {
  for (const room of rooms.values()) {
    if (room.timeoutPenalty && Number(room.timeoutPenalty.expiresAtTs || 0) <= Date.now()) {
      room.timeoutPenalty = null;
      broadcastRoom(room);
    }

    if (!room.turnTimerEnabled || room.turnTimerPaused || room.turnDeadlineTs == null) continue;
    if (!phaseUsesTurnTimer(room)) {
      syncTurnTimerForState(room, { newTurn: false });
      continue;
    }

    if (Date.now() < Number(room.turnDeadlineTs)) continue;

    const timeoutTurnId = Number(room.activeTurnId || 0);
    const seatIndex = room.turnSeat;
    if (!Number.isInteger(seatIndex)) {
      syncTurnTimerForState(room, { newTurn: false });
      broadcastTurnTimer(room);
      continue;
    }

    room.turnDeadlineTs = null;
    room.turnRemainingMs = 0;
    const worstTile = chooseWorstLegalPlay(room, seatIndex);
    if (!worstTile) {
      syncTurnTimerForState(room, { newTurn: false });
      broadcastTurnTimer(room);
      continue;
    }

    broadcastRoomEvent(room, {
      type: 'game:autoMove',
      seat: seatIndex,
      reason: 'timeout',
      move: { tileId: worstTile.id, tile: { ...worstTile } },
      activeTurnId: timeoutTurnId
    });

    const timeoutDurationMs = 3000;
    const playerId = seatByIndex(room, seatIndex)?.occupantClientId || null;
    room.timeoutPenalty = {
      seat: seatIndex,
      playerId,
      activeTurnId: timeoutTurnId,
      emoji: '🤡',
      durationMs: timeoutDurationMs,
      expiresAtTs: Date.now() + timeoutDurationMs
    };
    broadcastRoomEvent(room, {
      type: 'game:timeoutPenalty',
      seat: seatIndex,
      playerId,
      activeTurnId: timeoutTurnId,
      emoji: '🤡',
      durationMs: timeoutDurationMs
    });

    handleRoomAction(
      room,
      null,
      'playTile',
      { tileId: worstTile.id },
      { internal: true, forcedSeat: seatIndex, expectedTurnId: timeoutTurnId }
    );
  }
}, TURN_TIMER_TICK_MS);
