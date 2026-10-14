import { app, BrowserWindow, globalShortcut, ipcMain, Menu, dialog } from 'electron'
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
// tested without relaunching the app. Only ever registered in dev builds
// (see app.whenReady() below) — a working escape hatch in a packaged build
// would defeat the entire point of lockdown for an exam.
const DEV_MODE_SHORTCUT = 'CommandOrControl+Shift+D'

// Starting state: locked whenever this is a packaged build. A double-clicked
// packaged app has no NODE_ENV set at all, so that used to evaluate to
// "unlocked" for every real user launch — app.isPackaged is Electron's own
// signal for this and can't be left unset by a normal launch. This is
// "isDev" — every security measure below only applies when this is false,
// checked dynamically inside each handler (not just at startup) so the dev
// toggle shortcut (dev builds only, see below) flips everything live without
// recreating the window.
let devModeEnabled = !app.isPackaged

// Debugging/remote-inspection launch flags (--inspect, --remote-debugging-port,
// etc.) are consumed by Node/Chromium during process bootstrap — often before
// this file's first line even runs — so a CDP/inspector listener may already
// be active by the time we can inspect argv. Stripping the switch below is a
// best-effort defense (it can still prevent Chromium's remote-debugging
// server from starting, since that's initialized later, during
// app.whenReady()); it cannot reliably un-bind a Node inspector that may
// already be listening. The real defense is refusing to continue at all —
// enforced in app.whenReady() below, before any window is created.
const DEBUG_FLAG_PATTERN = /^--(remote-debugging-port|remote-debugging-address|inspect|inspect-brk|inspect-port)(=|$)/
const debugFlags = app.isPackaged
  ? process.argv.filter((arg) => DEBUG_FLAG_PATTERN.test(arg))
  : []
for (const flag of debugFlags) {
  app.commandLine.removeSwitch(flag.replace(/^--/, '').split('=')[0])
}

// Removes the default Electron application menu — and with it, the
// built-in "Toggle Developer Tools" (Cmd+Option+I / Ctrl+Shift+I) and
// "Toggle Full Screen" (Ctrl+Cmd+F) menu accelerators. Menu accelerators
// fire through a separate native pipeline from webContents'
// before-input-event, so the keyboard-shortcut blocking below does not
// intercept them — this is the only thing that does. Only packaged builds
// need this; dev builds keep the default menu for convenience.
if (app.isPackaged) {
  Menu.setApplicationMenu(null)
}

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
  // Checked here (rather than only at module load) so the dialog is
  // guaranteed to actually render: showErrorBox before the ready event can
  // silently degrade to a stderr print with no GUI on some platforms.
  // Refusing to continue here also means no window, shortcut, or menu is
  // ever created for a debug-flagged packaged launch.
  if (debugFlags.length > 0) {
    dialog.showErrorBox(
      'LANJudge cannot start',
      `LANJudge was launched with debugging/remote-inspection flags (${debugFlags.join(', ')}), ` +
      'which are not permitted during an exam. Close this window and relaunch LANJudge normally.'
    )
    app.exit(1)
    return
  }

  const win = createWindow()

  // The dev-mode toggle only exists in dev builds at all — not just
  // disabled, entirely unregistered — so a packaged build has no keyboard
  // path to lockdown, ever, under any circumstance.
  if (!app.isPackaged) {
    const registered = globalShortcut.register(DEV_MODE_SHORTCUT, () => toggleDevMode(win))
    if (!registered) {
      console.warn(`[dev-mode] failed to register shortcut ${DEV_MODE_SHORTCUT}`)
    }
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
