import { PauseCircle } from 'lucide-react'
import './PauseOverlay.css'

export default function PauseOverlay({ paused }) {
  if (!paused) return null

  return (
    <div className="pause-overlay">
      <div className="pause-overlay-content">
        <div className="pause-icon">
          <PauseCircle size={32} />
        </div>
        <h2>Contest Paused</h2>
        <p>The admin has paused the contest. This screen will unlock automatically when it resumes.</p>
      </div>
    </div>
  )
}
