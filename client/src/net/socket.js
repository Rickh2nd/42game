import { io } from '/node_modules/socket.io-client/dist/socket.io.esm.min.js';

const STATUS_CONNECTING = 'connecting';
const STATUS_CONNECTED = 'connected';
const STATUS_DISCONNECTED = 'disconnected';

const statusListeners = new Set();

const SOCKET_URL = resolveSocketUrl();
const SOCKET_PATH = resolveSocketPath();

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
    // ignore
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
  const envUrl = (
    safeReadEnv('VITE_SOCKET_URL')
    || safeReadEnv('REACT_APP_SOCKET_URL')
    || safeReadEnv('NEXT_PUBLIC_SOCKET_URL')
  );

  if (envUrl) {
    return envUrl;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return '/';
}

function resolveSocketPath() {
  const envPath = safeReadEnv('VITE_SOCKET_PATH') || safeReadEnv('SOCKET_PATH');
  if (!envPath) return '/socket.io';
  return envPath.startsWith('/') ? envPath : `/${envPath}`;
}

function getTransportName() {
  return socketInstance?.io?.engine?.transport?.name || null;
}

function notifyStatus(force = false) {
  const payload = {
    status: currentStatus,
    connected: !!socketInstance?.connected,
    socketUrl: SOCKET_URL,
    socketPath: SOCKET_PATH,
    socketId: socketInstance?.id || null,
    transport: getTransportName(),
    lastError
  };

  for (const cb of statusListeners) {
    try {
      cb(payload, { force });
    } catch {
      // ignore listener exceptions
    }
  }
}

function setStatus(nextStatus, { error = undefined, force = false } = {}) {
  let changed = force;

  if (nextStatus && nextStatus !== currentStatus) {
    currentStatus = nextStatus;
    changed = true;
  }

  if (error !== undefined) {
    const msg = String(error || '');
    if (msg !== lastError) {
      lastError = msg;
      changed = true;
    }
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
    path: SOCKET_PATH,
    transports: ['websocket', 'polling'],
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    timeout: 8000
  });

  setStatus(STATUS_CONNECTING, { force: true });

  socketInstance.on('connect', () => {
    setStatus(STATUS_CONNECTED, { error: '' });
    console.log('[socket] connect', getSocketStatus());
  });

  socketInstance.on('disconnect', (reason) => {
    setStatus(STATUS_DISCONNECTED, { error: reason || 'disconnect' });
    console.log('[socket] disconnect', reason, getSocketStatus());
  });

  socketInstance.on('connect_error', (error) => {
    const message = error?.message || 'unknown error';
    setStatus(STATUS_DISCONNECTED, { error: message });
    console.log('[socket] connect_error', message, getSocketStatus());
  });

  if (socketInstance.io) {
    socketInstance.io.on('reconnect_attempt', (attempt) => {
      setStatus(STATUS_CONNECTING, { error: '' });
      console.log('[socket] reconnect_attempt', attempt, getSocketStatus());
    });

    socketInstance.io.on('reconnect', () => {
      setStatus(STATUS_CONNECTED, { error: '' });
      console.log('[socket] reconnect', getSocketStatus());
    });

    socketInstance.io.on('error', (err) => {
      const message = err?.message || String(err || 'io error');
      setStatus(STATUS_DISCONNECTED, { error: message });
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

export function getSocketStatus() {
  const socket = ensureSocket();
  return {
    connected: !!socket.connected,
    id: socket.id || null,
    url: SOCKET_URL,
    path: SOCKET_PATH,
    transport: getTransportName(),
    status: currentStatus,
    lastError
  };
}

export function onStatusChange(cb) {
  if (typeof cb !== 'function') {
    return () => {};
  }

  statusListeners.add(cb);
  cb({
    status: currentStatus,
    connected: !!socketInstance?.connected,
    socketUrl: SOCKET_URL,
    socketPath: SOCKET_PATH,
    socketId: socketInstance?.id || null,
    transport: getTransportName(),
    lastError
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

export async function probeHealth(timeoutMs = 4000) {
  const url = new URL('/health', SOCKET_URL).toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      signal: controller.signal
    });
    const text = await response.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }

    return {
      ok: response.ok,
      status: response.status,
      url,
      body: parsed
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url,
      body: String(error?.message || error || 'health check failed')
    };
  } finally {
    clearTimeout(timeout);
  }
}
