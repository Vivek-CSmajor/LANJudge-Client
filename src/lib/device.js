// Stable per-installation device ID, generated once and persisted in
// localStorage. Sent on every request (X-Device-ID) as well as at login —
// the backend's device-binding check only reads it at login today, but
// every call carries it so that can be tightened later without a client change.
export function getDeviceID() {
  let id = localStorage.getItem('device_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('device_id', id)
  }
  return id
}
