import { apiFetch } from './client'

export async function submitCode(problemId, language, code) {
  const teamId = parseInt(localStorage.getItem('team_id') ?? '0')

  const res = await apiFetch('/submit', {
    method: 'POST',
    body: JSON.stringify({ team_id: teamId, problem_id: problemId, language, code }),
  })

  if (!res.ok) throw new Error(`Submit failed (${res.status})`)
  return res.json() // { submission_id, status }
}

export async function runCode(language, code, input) {
  const res = await apiFetch('/run', {
    method: 'POST',
    body: JSON.stringify({ language, code, input }),
  })

  if (!res.ok) throw new Error(`Run failed (${res.status})`)
  return res.json() // { output, error }
}

// NEEDS BACKEND: GET /submissions/me — team-scoped via the bearer token
// (same auth as everything else here, no team_id in the URL). Optional
// ?problem_id= filters to one problem; omitted, returns every submission
// this team has made, newest first. One endpoint serves both the Problem
// page's Status tab (filtered) and Submission History (unfiltered). Shape
// matches models.Submission as already returned by GET /submission/{id}:
//   [{ id, team_id, problem_id, language, status, verdict, submitted_at }, ...]
// Doesn't exist on the backend yet.
export async function listSubmissions({ problemId } = {}) {
  const qs = problemId != null ? `?problem_id=${problemId}` : ''
  const res = await apiFetch(`/submissions/me${qs}`)
  if (!res.ok) throw new Error(`Failed to load submissions (${res.status})`)
  return res.json()
}

// NEEDS BACKEND: GET /submission/{id} already exists and already checks
// team ownership (see GetSubmissionHandler) — it just needs a `code` field
// added to the response, read from disk the same way SubmitHandler writes
// it (judge.SubmissionPathByID(id) + the language's source filename).
// Deliberately not included in the /submissions/me list above — only
// fetched on demand when a row is actually opened, so the list stays cheap.
export async function getSubmission(id) {
  const res = await apiFetch(`/submission/${id}`)
  if (!res.ok) throw new Error(`Failed to load submission (${res.status})`)
  return res.json() // { id, team_id, problem_id, language, status, verdict, submitted_at, code }
}

// A single non-ok response is treated as a hiccup and retried — but if that
// never recovers, this used to poll silently forever, leaving the UI stuck
// on "Judging…" with no way to tell "still working" from "never coming
// back." MAX_CONSECUTIVE_FAILURES caps that: enough retries to ride out a
// brief blip, but it does eventually give up and say so.
const MAX_CONSECUTIVE_FAILURES = 10

export async function pollVerdict(submissionId, { onVerdict, onError, intervalMs = 2000 }) {
  let failures = 0
  const id = setInterval(async () => {
    try {
      const res = await apiFetch(`/submission/${submissionId}`)
      if (!res.ok) {
        failures += 1
        if (failures >= MAX_CONSECUTIVE_FAILURES) {
          clearInterval(id)
          onError?.(`Couldn't get a verdict for this submission (server keeps returning ${res.status}).`)
        }
        return
      }
      failures = 0
      const data = await res.json()
      if (data.status === 'Done') {
        clearInterval(id)
        onVerdict(data)
      }
    } catch (e) {
      // true network failure (server went down, etc.)
      clearInterval(id)
      onError?.(e.message)
    }
  }, intervalMs)

  return () => clearInterval(id)
}
