import { getDeviceID } from '../lib/device'

let SERVER_URL = null

export function setServerUrl(url) {
  SERVER_URL = url
}

export function getServerUrl() {
  return SERVER_URL
}

export function apiFetch(path, options = {}) {
  const sessionToken = localStorage.getItem('session_token') ?? ''
  return fetch(`${SERVER_URL}${path}`, {
    ...options,
    // Without this, a server that's gone unreachable (crashed, unplugged,
    // wrong IP) hangs the calling fetch forever — every "infinite spinner"
    // gap this pass found traces back to this one missing line.
    signal: options.signal ?? AbortSignal.timeout(20000),
    headers: {
      'Content-Type': 'application/json',
      // Authorization is what RequireAuth actually validates server-side.
      // X-Session-Token carries the same value alongside it — the backend
      // doesn't read it yet (only Authorization), but CORS already allows it
      // and it's cheap to send now rather than wire up later.
      'Authorization': `Bearer ${sessionToken}`,
      'X-Session-Token': sessionToken,
      'X-Device-ID': getDeviceID(),
      ...options.headers,
    },
  }).then((res) => {
    if (res.status === 401) {
      window.dispatchEvent(new Event('auth:unauthorized'))
    }
    return res
  }, () => {
    // A raw network failure or the timeout above both reject with a
    // DOMException whose .message ("Failed to fetch", "signal timed out",
    // etc.) is not something to show a participant — every caller in this
    // app surfaces error.message directly, so normalize it here once.
    throw new Error("Couldn't reach the contest server. Check your connection.")
  })
}
