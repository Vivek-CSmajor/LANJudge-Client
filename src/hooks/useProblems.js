import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'

export function useProblems() {
  const [problems, setProblems] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/problems')
      .then(r => {
        if (!r.ok) throw new Error(`Server error ${r.status}`)
        return r.json()
      })
      .then(setProblems)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return { problems, error, loading }
}
