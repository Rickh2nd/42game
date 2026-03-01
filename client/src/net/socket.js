import { io } from '/node_modules/socket.io-client/dist/socket.io.esm.min.js';

const STATUS_CONNECTING = 'connecting';
const STATUS_CONNECTED = 'connected';
const STATUS_DISCONNECTED = 'disconnected';

const statusListeners = new Set();
const SOCKET_URL = resolveSocketUrl();

let socketInstance = null;
let currentStatus = STATUS_CONNECTING;
let lastError = '';

function safeReadEnv(name) {
  try {
    if (typeof import.meta !== 'undefined' && import.meta?.env?.[name]) {
      const value = String(import.meta.env[name]).trim();
      if (value) return value;
    }
  } catch {
    // no-op
  }

  if (typeof window !== 'undefined') {
    const direct = window[name];
    if (typeof direct === 'string' && direct.trim()) {
      return direct.trim();
    }

    const envBag = window.__ENV__;
    if (envBag && typeof envBag[name] === 'string' && envBag[name].trim()) {
      return envBag[name].trim();
    }
  }

  if (typeof document !== 'undefined') {
    const metaTag = document.querySelector(`meta[name="${name}"]`);
    const content = metaTag?.getAttribute('content');
    if (content && content.trim()) {
      return content.trim();
    }
  }

  return '';
}

function resolveSocketUrl() {
  const candidate = (
    safeReadEnv('VITE_SOCKET_URL')
    || safeReadEnv('NEXT_PUBLIC_SOCKET_URL')
    || safeReadEnv('REACT_APP_SOCKET_URL')
  );

  if (candidate) {
    return candidate;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return '/';
}

function notifyStatus(force = false) {
  const payload = {
    status: currentStatus,
    socketUrl: SOCKET_URL,
    lastError,
    connected: !!socketInstance?.connected
  };

  for (const cb of statusListeners) {
    try {
      cb(payload, { force });
    } catch {
      // ignore listener exceptions
    }
  }
}

function setStatus(nextStatus, { error = null, force = false } = {}) {
  let changed = force;

  if (nextStatus && nextStatus !== currentStatus) {
    currentStatus = nextStatus;
    changed = true;
  }

  if (error != null) {
    const msg = String(error || '');
    if (msg !== lastError) {
      lastError = msg;
      changed = true;
    }
  } else if (error === null && lastError) {
    lastError = '';
    changed = true;
  }

  if (changed) {
    notifyStatus(force);
  }
}

function ensureSocket() {
  if (socketInstance) {
    return socketInstance;
  }

  socketInstance = io(SOCKET_URL, {
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    timeout: 8000
  });

  setStatus(STATUS_CONNECTING, { force: true });

  socketInstance.on('connect', () => {
    setStatus(STATUS_CONNECTED, { error: null });
  });

  socketInstance.on('disconnect', (reason) => {
    setStatus(STATUS_DISCONNECTED, { error: reason || 'disconnect' });
  });

  socketInstance.on('connect_error', (error) => {
    const message = error?.message || 'unknown error';
    console.warn(`socket connect_error: ${message} ${SOCKET_URL}`);
    setStatus(STATUS_DISCONNECTED, { error: message });
  });

  if (socketInstance.io) {
    socketInstance.io.on('reconnect_attempt', () => {
      setStatus(STATUS_CONNECTING, { error: null });
    });

    socketInstance.io.on('reconnect', () => {
      setStatus(STATUS_CONNECTED, { error: null });
    });
  }

  return socketInstance;
}

export function getSocket() {
  return ensureSocket();
}

export function isConnected() {
  return !!ensureSocket().connected;
}

export function onStatusChange(cb) {
  if (typeof cb !== 'function') {
    return () => {};
  }

  statusListeners.add(cb);
  cb({
    status: currentStatus,
    socketUrl: SOCKET_URL,
    lastError,
    connected: !!socketInstance?.connected
  }, { force: true });

  return () => {
    statusListeners.delete(cb);
  };
}

export function emitSafe(event, payload = {}, { requireConnected = true } = {}) {
  const socket = ensureSocket();
  if (requireConnected && !socket.connected) {
    return false;
  }
  socket.emit(event, payload);
  return true;
}
