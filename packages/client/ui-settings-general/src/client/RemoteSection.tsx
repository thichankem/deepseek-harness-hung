/**
 * Remote Connection settings page: the address the current session is served
 * at, rendered as a scannable QR code plus a copyable URL. Scanning the QR on
 * a phone opens the same authenticated session from any network. When the page
 * is only reachable on loopback, a "Start public access" action asks the host
 * to open a Cloudflare tunnel and re-renders the QR for that public origin.
 */
import { useEffect, useState } from 'react'
import { toDataURL } from 'qrcode/lib/browser.js'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './RemoteSection.module.css'

/** Registration-side face used by the page. */
export interface RemoteSectionInjected {
  /**
   * Ask the host to start (or reuse) a public Cloudflare tunnel.
   * @returns the public HTTPS origin Cloudflare assigned to the tunnel.
   */
  startPublicAccess: () => Promise<string>
  /**
   * Append the session launch token to an origin so a scanned QR opens the
   * session already authenticated. The browser strips the token from its own
   * address after login, so the host (which owns the token) supplies it.
   * @param origin - base origin to authenticate.
   * @returns the origin carrying the launch token.
   */
  authenticateUrl: (origin: string) => Promise<string>
  /**
   * Report the configured phone-reachable origin (for example a Tailscale URL)
   * with the launch token appended, or an empty string when none is configured.
   * @returns the authenticated public origin, or '' when unset.
   */
  getPublicUrl: () => Promise<string>
}

/** Full component props assembled by the Settings slot renderer. */
export type RemoteSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings'>
  & InjectFace<RemoteSectionInjected>

/** Loopback origins that a phone can never reach. */
const LOOPBACK_RE = /^https?:\/\/(?:localhost|127\.\d+\.\d+\.\d+|\[::1\]|0\.0\.0\.0)(?::\d+)?(?:\/|$)/iu

/**
 * Render the Remote Connection page.
 * @param props - composed slot props (see {@link RemoteSectionProps}).
 * @returns the settings page element tree.
 */
export function RemoteSection({ t, startPublicAccess, authenticateUrl, getPublicUrl }: RemoteSectionProps) {
  const currentUrl = window.location.href
  const [qr, setQr] = useState<string | undefined>(undefined)
  const [copied, setCopied] = useState(false)
  const [tunnelUrl, setTunnelUrl] = useState<string | undefined>(undefined)
  const [remoteUrl, setRemoteUrl] = useState<string | undefined>(undefined)
  const [authUrl, setAuthUrl] = useState<string | undefined>(undefined)
  const [starting, setStarting] = useState(false)
  const [failed, setFailed] = useState(false)
  const [failReason, setFailReason] = useState<string | undefined>(undefined)
  const loopbackOnly = LOOPBACK_RE.test(currentUrl)
  const displayUrl = tunnelUrl ?? remoteUrl ?? authUrl ?? currentUrl

  useEffect(() => {
    let cancelled = false
    void authenticateUrl(currentUrl).then((url) => {
      if (!cancelled) setAuthUrl(url)
    }).catch(() => { /* keep the plain current URL if the host cannot authenticate it */ })
    return () => { cancelled = true }
  }, [authenticateUrl, currentUrl])

  useEffect(() => {
    let cancelled = false
    void getPublicUrl().then((url) => {
      if (!cancelled && url !== '') setRemoteUrl(url)
    }).catch(() => { /* fall back to the current URL when no public origin is configured */ })
    return () => { cancelled = true }
  }, [getPublicUrl])

  useEffect(() => {
    let cancelled = false
    toDataURL(displayUrl, { margin: 1, width: 260, errorCorrectionLevel: 'M' }).then((dataUrl) => {
      if (!cancelled) setQr(dataUrl)
    }).catch(() => { /* a QR render failure leaves the placeholder visible */ })
    return () => { cancelled = true }
  }, [displayUrl])

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(displayUrl)
      setCopied(true)
      window.setTimeout(() => { setCopied(false) }, 2_000)
    } catch { /* clipboard unavailable; the URL stays visible to copy by hand */ }
  }

  const startPublic = async (): Promise<void> => {
    setStarting(true)
    setFailed(false)
    setFailReason(undefined)
    try {
      const origin = await startPublicAccess()
      setTunnelUrl(origin)
    } catch (error) {
      setFailed(true)
      setFailReason(error instanceof Error ? error.message : String(error))
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className={css.section}>
      <p className={css.description}>{t('remote.description')}</p>
      {loopbackOnly && tunnelUrl === undefined && remoteUrl === undefined
        ? <p className={css.notice}>{t('remote.notPublic')}</p>
        : null}
      {failed ? (
        <p className={css.notice}>
          {t('remote.startFailed')}
          {failReason !== undefined && failReason !== '' ? ` ${failReason}` : ''}
        </p>
      ) : null}
      <div className={css.card}>
        {qr !== undefined
          ? <img className={css.qr} src={qr} alt={t('remote.qrHint')} />
          : <div className={css.qrPlaceholder} aria-hidden="true" />}
        <p className={css.qrHint}>{t('remote.qrHint')}</p>
      </div>
      {loopbackOnly && tunnelUrl === undefined && remoteUrl === undefined ? (
        <button
          type="button"
          className={css.start}
          onClick={() => { void startPublic() }}
          disabled={starting}
        >
          {starting ? t('remote.starting') : t('remote.startPublic')}
        </button>
      ) : null}
      <div className={css.urlRow}>
        <span className={css.urlLabel}>{t('remote.urlLabel')}</span>
        <code className={css.url}>{displayUrl}</code>
        <button type="button" className={css.copy} onClick={() => { void copy() }}>
          {copied ? t('remote.copied') : t('remote.copy')}
        </button>
      </div>
    </div>
  )
}