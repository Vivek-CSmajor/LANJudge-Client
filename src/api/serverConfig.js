export async function loadStoredServerUrl() {
  if (window.electronAPI?.getServerUrl) {
    return window.electronAPI.getServerUrl()
  }
  return localStorage.getItem('server_url')
}

export async function persistServerUrl(url) {
  if (window.electronAPI?.setServerUrl) {
    return window.electronAPI.setServerUrl(url)
  }
  localStorage.setItem('server_url', url)
}

// A cached server URL has no TTL and is trusted forever once saved — this is
// the one liveness check standing between that and silently launching into
// Login/Waiting against a dead address (stale IP, server not started yet,
// LAN changed). Shared by Connect.jsx's own check and App.jsx's startup gate.
export async function checkServerHealth(url) {
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(8000) })
    return res.ok
  } catch {
    return false
  }
}
