import { createRoot } from 'react-dom/client'
// Self-hosted (no CDN, no network at runtime) — required since this app has
// to work fully offline during a LAN contest. Only the weights actually used
// across the app's CSS (400/500/600/700).
import '@fontsource/fira-code/400.css'
import '@fontsource/fira-code/500.css'
import '@fontsource/fira-code/600.css'
import '@fontsource/fira-code/700.css'
import './index.css'
import './darkMode.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(<App />)
