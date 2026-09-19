/**
 * The Cloudflare quick-tunnel launcher: it resolves the public URL a fake
 * `cloudflared` prints on stdout, and rejects with an install hint when the
 * binary is missing from PATH.
 */

import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { internals } from '../src/index.ts'

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/**
 * Install a fake `cloudflared` that prints `line` and exits. Prepending its
 * directory to PATH lets the launcher resolve it without a real binary.
 * @param line - the line the fake prints, a quick-tunnel URL by default.
 * @returns the directory to prepend to PATH.
 */
function installFakeCloudflared(line = 'https://hung-lab-123.trycloudflare.com'): string {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-web-tunnel-'))
  tempDirs.push(dir)
  if (process.platform === 'win32') {
    writeFileSync(join(dir, 'cloudflared.cmd'), `@echo off\r\necho ${line}\r\n`)
  } else {
    const sh = join(dir, 'cloudflared')
    writeFileSync(sh, `#!/usr/bin/env sh\necho ${line}\n`)
    chmodSync(sh, 0o755)
  }
  return dir
}

/** Run `fn` with `dir` prepended to PATH, restoring PATH afterwards. */
async function withPath(dir: string, fn: () => Promise<void>): Promise<void> {
  const originalPath = process.env.PATH
  process.env.PATH = `${dir}${delimiter}${originalPath}`
  try {
    await fn()
  } finally {
    process.env.PATH = originalPath
  }
}

describe('web-app Cloudflare tunnel launcher', () => {
  // Node's spawn on Windows resolves executables by bare name only through
  // PATHEXT .exe, not .cmd/.bat, so a fake .cmd cannot stand in for cloudflared
  // there; production is unaffected because the real cloudflared is a native
  // executable. POSIX CI covers the URL-resolution branches.
  it.skipIf(process.platform === 'win32')('resolves the public URL a cloudflared child prints', async () => {
    const dir = installFakeCloudflared()
    await withPath(dir, async () => {
      const tunnel = await internals.startCloudflareTunnel(3080)
      expect(tunnel.url).toBe('https://hung-lab-123.trycloudflare.com')
      tunnel.dispose()
    })
  })

  it.skipIf(process.platform === 'win32')('resolves a named tunnel hostname once cloudflared connects', async () => {
    const dir = installFakeCloudflared('Registered tunnel connection')
    await withPath(dir, async () => {
      const tunnel = await internals.startCloudflareTunnel(3080, { name: 'my-tunnel', hostname: 'dsh.example.com' })
      expect(tunnel.url).toBe('https://dsh.example.com')
      tunnel.dispose()
    })
  })

  it('rejects with an install hint when cloudflared is absent from PATH', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-web-tunnel-empty-'))
    tempDirs.push(dir)
    const originalPath = process.env.PATH
    const originalResolver = internals.resolveCloudflaredBinary
    // Force the PATH-only fallback so the empty PATH yields ENOENT even when a
    // known install location holds the binary.
    internals.resolveCloudflaredBinary = () => 'cloudflared'
    process.env.PATH = dir
    try {
      await expect(internals.startCloudflareTunnel(3080)).rejects.toThrow(/cloudflared is not installed/)
    } finally {
      process.env.PATH = originalPath
      internals.resolveCloudflaredBinary = originalResolver
    }
  })
})