import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron'
import Store from 'electron-store'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const store = new Store()

ipcMain.handle('get-server-url', () => store.get('serverUrl') ?? null)
ipcMain.handle('set-server-url', (event, url) => {
  store.set('serverUrl', url)
  return true
})

// Vite's default dev server port. If something else is already bound to
// 5173 (e.g. the admin dashboard's own dev server), Vite will pick the next
// free port instead — bump this to match if that happens.
const DEV_SERVER_URL = 'http://localhost:5173'

// Shortcut to flip kiosk/lockdown on and off at runtime, so lockdown can be
// tested without relaunching the app. REMOVE this before a real deployment —
// a working escape hatch defeats the entire point of lockdown for an exam.
const DEV_MODE_SHORTCUT = 'CommandOrControl+Shift+D'

// Starting state: unlocked unless NODE_ENV=production is explicitly set.
// This is "isDev" — every security measure below only applies when this is
// false, checked dynamically inside each handler (not just at startup) so
// the toggle shortcut flips everything live without recreating the window.
let devModeEnabled = process.env.NODE_ENV !== 'production'

// webPreferences.devTools (the setting that fully disables the devtools
// mechanism at the Chromium level) can only be set at window-creation time,
// not toggled after — so it stays enabled here, and lockdown is enforced
// dynamically instead: block the keyboard shortcuts that open it, and close
// it immediately if it ever opens some other way (e.g. a remote debugger).
function applyLockdown(win, locked) {
  win.setKiosk(locked)
  win.setMinimizable(!locked)
  win.setResizable(!locked)
  if (locked) {
    win.webContents.closeDevTools()
  }
}

function toggleDevMode(win) {
  devModeEnabled = !devModeEnabled
  applyLockdown(win, !devModeEnabled)
  if (devModeEnabled) {
    win.webContents.openDevTools()
  }
  console.log(`[dev-mode] ${devModeEnabled ? 'ON — kiosk/lockdown disabled' : 'OFF — kiosk/lockdown active'}`)
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    kiosk: !devModeEnabled,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  applyLockdown(win, !devModeEnabled)

  // Block the keyboard shortcuts that open devtools before they're
  // dispatched to the page at all. (Quitting the app — close / Alt+F4 — is
  // intentionally left alone; people can quit if they want to.)
  win.webContents.on('before-input-event', (event, input) => {
    if (devModeEnabled) return

    const key = input.key?.toLowerCase()
    const isF12 = key === 'f12'
    const isCtrlShiftI = input.control && input.shift && key === 'i'
    const isCtrlShiftJ = input.control && input.shift && key === 'j'

    if (isF12 || isCtrlShiftI || isCtrlShiftJ) {
      event.preventDefault()
    }
  })

  // Backstop: if devtools opens some other way (context menu, remote
  // debugger attach), close it immediately.
  win.webContents.on('devtools-opened', () => {
    if (!devModeEnabled) {
      win.webContents.closeDevTools()
    }
  })

  // Block all renderer-initiated navigation while locked. This is a SPA —
  // switching "pages" is internal React state, never a real browser
  // navigation — so any will-navigate firing at all is something external
  // (a link, a redirect) and safe to block outright. The initial
  // loadURL/loadFile call below does NOT trigger this event, so the app's
  // own first load is unaffected.
  win.webContents.on('will-navigate', (event) => {
    if (!devModeEnabled) {
      event.preventDefault()
    }
  })

  // Block new windows (target="_blank" links, window.open, etc.) — this and
  // will-navigate together are what "block external links" means in
  // practice: same-frame attempts are caught above, new-window attempts here.
  win.webContents.setWindowOpenHandler(() => {
    return devModeEnabled ? { action: 'allow' } : { action: 'deny' }
  })

  if (!app.isPackaged) {
    const loadDevServer = () => {
      win.loadURL(DEV_SERVER_URL).catch(() => {
        setTimeout(loadDevServer, 500) // Vite may not be ready yet — keep retrying
      })
    }
    loadDevServer()
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  if (devModeEnabled) {
    win.webContents.openDevTools()
  }

  return win
}

app.whenReady().then(() => {
  const win = createWindow()

  const registered = globalShortcut.register(DEV_MODE_SHORTCUT, () => toggleDevMode(win))
  if (!registered) {
    console.warn(`[dev-mode] failed to register shortcut ${DEV_MODE_SHORTCUT}`)
  }

  // Alt+Tab (window switching) is reserved by the OS window manager on
  // Windows/Linux, same as Cmd+Tab on macOS — mainstream operating systems
  // deliberately do not let any application intercept it, precisely so a
  // frozen or rogue app can never trap a user. This will very likely fail
  // below, and that's expected: real Alt+Tab prevention needs OS-level
  // kiosk configuration (Windows Assigned Access, macOS Guided Access),
  // which is outside anything this app's own code can control.
  const altTabBlocked = globalShortcut.register('Alt+Tab', () => {})
  console.log(`[lockdown] Alt+Tab global shortcut registration: ${altTabBlocked ? 'succeeded' : 'failed (expected — OS-reserved)'}`)
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
