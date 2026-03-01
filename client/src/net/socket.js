import { io } from '/node_modules/socket.io-client/dist/socket.io.esm.min.js';

const SOCKET_URL = (
  (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_SOCKET_URL)
  || (typeof import.meta !== 'undefined' && import.meta?.env?.REACT_APP_SOCKET_URL)
  || (typeof import.meta !== 'undefined' && import.meta?.env?.NEXT_PUBLIC_SOCKET_URL)
  || (typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : '/')
);

const SOCKET_PATH = (
  (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_SOCKET_PATH)
  || '/socket.io'
);

export const socketDebug = {
  status: 'connecting',
  lastError: '',
  lastConnect: 0,
  lastDisconnect: 0
};

const statusListeners = new Set();

export const socket = io(SOCKET_URL, {
  path: SOCKET_PATH,
  transports: ['polling', 'websocket'],
  autoConnect: true,
  reconnection: true,
  timeout: 8000
});

function notifyStatus() {
  const info = getSocketInfo();
  for (const listener of statusListeners) {
    try {
      listener(info);
    } catch {
      // ignore listener failure
    }
  }
}

socket.on('connect', () => {
  socketDebug.status = 'connected';
  socketDebug.lastConnect = Date.now();
  socketDebug.lastError = '';
  console.log('[socket] connect', {
    id: socket.id,
    url: SOCKET_URL,
    path: SOCKET_PATH,
    transport: socket.io?.engine?.transport?.name || ''
  });
  notifyStatus();
});

socket.on('disconnect', (reason) => {
  socketDebug.status = 'disconnected';
  socketDebug.lastDisconnect = Date.now();
  console.log('[socket] disconnect', reason);
  notifyStatus();
});

socket.on('connect_error', (err) => {
  socketDebug.status = 'disconnected';
  socketDebug.lastError = err?.message || String(err);
  console.log('[socket] connect_error', socketDebug.lastError, {
    url: SOCKET_URL,
    path: SOCKET_PATH
  });
  notifyStatus();
});

socket.io.on('reconnect_attempt', (attempt) => {
  socketDebug.status = 'connecting';
  console.log('[socket] reconnect_attempt', attempt);
  notifyStatus();
});

socket.io.on('reconnect', () => {
  socketDebug.status = 'connected';
  socketDebug.lastError = '';
  notifyStatus();
});

socket.io.on('error', (err) => {
  socketDebug.lastError = err?.message || String(err);
  notifyStatus();
});

export function getSocketInfo() {
  return {
    url: SOCKET_URL,
    path: SOCKET_PATH,
    connected: socket.connected,
    id: socket.id || '',
    transport: socket.io?.engine?.transport?.name || '',
    status: socketDebug.status,
    lastError: socketDebug.lastError,
    lastConnect: socketDebug.lastConnect,
    lastDisconnect: socketDebug.lastDisconnect
  };
}

export function getSocket() {
  return socket;
}

export function isConnected() {
  return socket.connected;
}

export function emitSafe(event, payload = {}, { requireConnected = true } = {}) {
  if (requireConnected && !socket.connected) {
    return false;
  }
  socket.emit(event, payload);
  return true;
}

export function onStatusChange(cb) {
  if (typeof cb !== 'function') {
    return () => {};
  }
  statusListeners.add(cb);
  cb(getSocketInfo());
  return () => {
    statusListeners.delete(cb);
  };
}

export async function probeHealth(timeoutMs = 3500) {
  const info = getSocketInfo();
  const url = new URL('/health', info.url).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      url,
      body: text
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url,
      body: String(error?.message || error || 'health check failed')
    };
  } finally {
    clearTimeout(timer);
  }
}
