import { spawn } from 'node:child_process'

const vite = spawn('npx', ['vite'], { stdio: 'inherit', shell: true })

const electronTimer = setTimeout(() => {
  const electron = spawn('npx', ['electron', '.'], { stdio: 'inherit', shell: true })
  electron.on('close', () => {
    vite.kill()
    process.exit()
  })
}, 2000) // give Vite a head start; main.js also retries on its own if this isn't enough

function shutdown() {
  clearTimeout(electronTimer)
  vite.kill()
  process.exit()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
