import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const DEFAULT_BASE_URL = 'http://localhost:4173'

function argument(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

function chromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean)
  const executable = candidates.find(candidate => existsSync(candidate))
  if (!executable) throw new Error('No se encontró Chrome. Define CHROME_PATH con la ruta del ejecutable.')
  return executable
}

function pause(milliseconds) {
  return new Promise(resolvePause => setTimeout(resolvePause, milliseconds))
}

async function reachable(url) {
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(1500),
    })
    return response.status < 500
  } catch {
    return false
  }
}

async function startLocalServer(baseUrl) {
  if (await reachable(baseUrl)) return undefined

  const parsedUrl = new URL(baseUrl)
  const port = parsedUrl.port || '4173'
  const nextCli = resolve('node_modules/next/dist/bin/next')
  if (!existsSync(nextCli)) {
    throw new Error('No se encontró Next.js. Ejecuta npm install antes de generar publicaciones.')
  }

  const server = spawn(process.execPath, [nextCli, 'dev', '-p', port], {
    cwd: process.cwd(),
    stdio: 'ignore',
  })
  let startupError
  server.once('error', error => {
    startupError = error
  })

  const deadline = Date.now() + 40_000
  while (Date.now() < deadline) {
    if (startupError) throw startupError
    if (server.exitCode != null) {
      throw new Error(`Next.js terminó durante el arranque (código ${server.exitCode}).`)
    }
    if (await reachable(baseUrl)) return server
    await pause(300)
  }

  server.kill('SIGTERM')
  throw new Error('Next.js no estuvo disponible después de 40 segundos.')
}

async function stopLocalServer(server) {
  if (!server || server.exitCode != null) return

  server.kill('SIGTERM')
  await Promise.race([
    new Promise(resolveExit => server.once('exit', resolveExit)),
    pause(2000),
  ])
  if (server.exitCode == null) server.kill('SIGKILL')
}

function captureScreenshot(executable, args, output) {
  rmSync(output, { force: true })

  return new Promise((resolveCapture, rejectCapture) => {
    const chrome = spawn(executable, args, { stdio: 'ignore' })
    let screenshotReady = false
    let hardKillTimer

    const poll = setInterval(() => {
      if (screenshotReady) return
      if (!existsSync(output) || statSync(output).size < 10_000) return
      screenshotReady = true
      chrome.kill('SIGTERM')
      hardKillTimer = setTimeout(() => chrome.kill('SIGKILL'), 1000)
    }, 100)

    const deadline = setTimeout(() => {
      chrome.kill('SIGKILL')
    }, 20_000)

    chrome.once('error', error => {
      clearInterval(poll)
      clearTimeout(deadline)
      clearTimeout(hardKillTimer)
      rejectCapture(error)
    })

    chrome.once('exit', code => {
      clearInterval(poll)
      clearTimeout(deadline)
      clearTimeout(hardKillTimer)
      if (screenshotReady || (existsSync(output) && statSync(output).size >= 10_000)) {
        resolveCapture()
        return
      }
      rejectCapture(new Error(`Chrome terminó sin generar la publicación (código ${code ?? 'desconocido'}).`))
    })
  })
}

const explicitBaseUrl = argument('base-url')
const baseUrl = (explicitBaseUrl || DEFAULT_BASE_URL).replace(/\/$/, '')
const slug = argument('slug')
const requestedUrl = slug ? `${baseUrl}/ig-post/${encodeURIComponent(slug)}` : `${baseUrl}/ig-post`
const output = resolve(argument('output') || `public/ig-output/${slug || 'producto-aleatorio'}.png`)
mkdirSync(dirname(output), { recursive: true })
const profileDir = mkdtempSync(join(tmpdir(), 'reski-ig-post-'))
let ownedServer

try {
  if (explicitBaseUrl) {
    if (!(await reachable(baseUrl))) {
      throw new Error(`No se pudo acceder al entorno indicado en ${baseUrl}.`)
    }
  } else {
    ownedServer = await startLocalServer(baseUrl)
    if (ownedServer) console.log(`Servidor temporal iniciado en ${baseUrl}`)
  }

  const response = await fetch(requestedUrl, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(`La publicación respondió ${response.status}.`)
  }

  await captureScreenshot(chromeExecutable(), [
    '--headless=new',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-gpu',
    '--disable-sync',
    '--hide-scrollbars',
    '--metrics-recording-only',
    '--no-first-run',
    '--force-device-scale-factor=1',
    '--window-size=1080,1920',
    '--virtual-time-budget=10000',
    `--user-data-dir=${profileDir}`,
    `--screenshot=${output}`,
    response.url,
  ], output)
  console.log(`Publicación generada: ${output}`)
  console.log(`Producto: ${response.url}`)
} finally {
  rmSync(profileDir, { recursive: true, force: true })
  await stopLocalServer(ownedServer)
}
