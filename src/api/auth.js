import { getServerUrl } from './client'
import { getDeviceID } from '../lib/device'

/**
 * Attempt to log in.
 * @returns {Promise<{ session_token: string }>} on success
 @throws {Errr} with a user-facing message on failure
 */
export async function login(teamName, loginCode) {
  let res
  try {
    res = await fetch(`${getServerUrl()}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-ID': getDeviceID(),
      },
      body: JSON.stringify({ name: teamName, login_code: loginCode }),
      signal: AbortSignal.timeout(10000),
    })
  } catch {
    // covers both an outright network failure and the 10s timeout aborting —
    // neither has a message a participant should ever see verbatim
    const err = new Error("Couldn't reach the contest server. Check your connection and try again.")
    err.code = 'UNKNOWN'
    throw err
  }

  if (res.ok) {
    return res.json()
  }

  if (res.status === 401) {
    const text = await res.text()
    if (text.toLowerCase().includes('device')) {
      const err = new Error('This team is already logged in on a different device. An override request has been sent to your contest admin — you can log in again once they approve it.')
      err.code = 'DEVICE_MISMATCH'
      throw err
    }
    const err = new Error('Invalid team name or login code.')
    err.code = 'INVALID_CREDENTIALS'
    throw err
  }

  const err = new Error(`Login failed (${res.status}). Please try again.`)
  err.code = 'UNKNOWN'
  throw err
}
