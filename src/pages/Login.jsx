import { useState } from 'react'
import { login } from '../api/auth'
import { Users, KeyRound, AlertCircle, ShieldAlert, Code2, Loader2 } from 'lucide-react'
import './Login.css'

export default function Login(props) {
  const [form, setForm] = useState({ teamName: '', loginCode: '' })
  const [error, setError] = useState(null) // { code, message } | null
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.teamName.trim() || !form.loginCode.trim()) {
      setError({ code: 'MISSING_FIELDS', message: 'Please fill in all fields.' })
      return
    }
    setError(null)
    setLoading(true)
    try {
      const data = await login(form.teamName.trim(), form.loginCode.trim())
      localStorage.setItem('session_token', data.session_token)
      localStorage.setItem('team_id', String(data.team_id))
      props.onSuccess(form.teamName.trim())
    } catch (err) {
      setError({ code: err.code ?? 'UNKNOWN', message: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <header className="topbar">
        <div className="topbar-inner">
          <Code2 size={22} strokeWidth={2.5} className="logo-icon" />
          <span className="logo">Campus<span className="logo-accent">Code</span></span>
        </div>
      </header>

      <main className="login-main">
        <div className="login-card">
          <div className="login-card-header">
            <h2 className="login-title">Sign in to your team</h2>
            <p className="login-subtitle">Enter the credentials given to you by the contest organizer.</p>
          </div>

          {error && error.code === 'DEVICE_MISMATCH' && (
            <div className="login-notice login-notice--device">
              <ShieldAlert size={16} strokeWidth={2} />
              <div>
                <strong>Device mismatch</strong>
                <p>{error.message}</p>
              </div>
            </div>
          )}

          {error && error.code !== 'DEVICE_MISMATCH' && (
            <div className="login-notice login-notice--error">
              <AlertCircle size={16} strokeWidth={2} />
              <div>
                <strong>Login failed</strong>
                <p>{error.message}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label htmlFor="teamName">Team Name</label>
              <div className="login-input-wrap">
                <Users size={18} strokeWidth={2} className="login-input-icon" />
                <input
                  id="teamName"
                  name="teamName"
                  type="text"
                  value={form.teamName}
                  onChange={handleChange}
                  placeholder="Enter your team name"
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="loginCode">Login Code</label>
              <div className="login-input-wrap">
                <KeyRound size={18} strokeWidth={2} className="login-input-icon" />
                <input
                  id="loginCode"
                  name="loginCode"
                  type="text"
                  value={form.loginCode}
                  onChange={handleChange}
                  placeholder="Enter your login code"
                />
              </div>
            </div>

            <button type="submit" className="login-submit-btn" disabled={loading}>
              {loading
                ? <><Loader2 size={16} className="spin" /> Signing in…</>
                : 'Login'
              }
            </button>
          </form>

          <p className="login-footer">Having trouble? Ask your contest organizer for help.</p>
        </div>
      </main>
    </div>
  )
}
