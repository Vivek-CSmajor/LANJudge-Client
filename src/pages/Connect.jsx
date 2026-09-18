import { useState } from 'react'
import { Server, ArrowRight, Loader2, AlertCircle, Code2 } from 'lucide-react'
import { setServerUrl } from '../api/client'
import { persistServerUrl, checkServerHealth } from '../api/serverConfig'
import './Connect.css'

export default function Connect({ onConnected }) {
  const [ip, setIp] = useState(() => localStorage.getItem('server_ip') ?? '')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = ip.trim()
    if (!trimmed) {
      setError('Please enter the server IP address.')
      return
    }

    setError('')
    setChecking(true)
    const url = `http://${trimmed}:8080`

    const healthy = await checkServerHealth(url)
    if (healthy) {
      setServerUrl(url)
      await persistServerUrl(url)
      localStorage.setItem('server_ip', trimmed)
      onConnected()
    } else {
      setError('Server not found. Check the IP.')
    }
    setChecking(false)
  }

  return (
    <div className="connect-page">
      <header className="connect-topbar">
        <div className="connect-topbar-inner">
          <Code2 size={22} strokeWidth={2.5} className="connect-logo-icon" />
          <span className="connect-logo">Campus<span className="connect-logo-accent">Code</span></span>
        </div>
      </header>

      <main className="connect-main">
        <div className="connect-card">
          <div className="connect-card-header">
            <h2 className="connect-title">Connect to your contest server</h2>
            <p className="connect-subtitle">Enter the server IP address given to you by the contest organizer.</p>
          </div>

          {error && (
            <div className="connect-error">
              <AlertCircle size={16} strokeWidth={2} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="connect-form">
            <div className="connect-field">
              <label htmlFor="serverIp">Server IP Address</label>
              <div className="connect-input-wrap">
                <Server size={18} strokeWidth={2} className="connect-input-icon" />
                <input
                  id="serverIp"
                  type="text"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  placeholder="e.g. 192.168.1.42"
                  autoFocus
                />
              </div>
            </div>

            <button type="submit" className="connect-submit-btn" disabled={checking}>
              {checking
                ? <><Loader2 size={16} className="spin" /> Connecting…</>
                : <><ArrowRight size={16} /> Connect</>
              }
            </button>
          </form>

          <p className="connect-footer">Don't know the server IP? Ask your contest organizer.</p>
        </div>
      </main>
    </div>
  )
}
