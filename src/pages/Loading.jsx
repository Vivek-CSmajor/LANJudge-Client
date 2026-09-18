import { Loader2 } from 'lucide-react'
import './Loading.css'

export default function Loading() {
  return (
    <div className="loading-page">
      <span className="loading-logo">Campus<span className="loading-logo-accent">Code</span></span>
      <Loader2 size={22} className="loading-spin" />
    </div>
  )
}
