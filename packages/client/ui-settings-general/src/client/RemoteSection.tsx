/**
 * Remote Connection settings page: the address the current session is served
 * at, rendered as a scannable QR code plus a copyable URL. Scanning the QR on
 * a phone opens the same authenticated session, so the page is most useful
 * when the GUI is reached through a public Cloudflare tunnel (`--tunnel`).
 */
import { useEffect, useState } from 'react'
import { toDataURL } from 'qrcode/lib/browser.js'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import css from './RemoteSection.module.css'

/** Full component props assembled by the Settings slot renderer. */
export type RemoteSectionProps = PropsLocale<'settings'>

/** Loopback origins that a phone can never reach. */
const LOOPBACK_RE = /^https?:\/\/(?:localhost|127\.\d+\.\d+\.\d+|\[::1\]|0\.0\.0\.0)(?::\d+)?(?:\/|$)/iu

/**
 * Render the Remote Connection page.
 * @param props - composed slot props (see {@link RemoteSectionProps}).
 * @returns the settings page element tree.
 */
export function RemoteSection({ t }: RemoteSectionProps) {
  const url = window.location.href
  const [qr, setQr] = useState<string | undefined>(undefined)
  const [copied, setCopied] = useState(false)
  const loopbackOnly = LOOPBACK_RE.test(url)

  useEffect(() => {
    let cancelled = false
    toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: 'M' }).then((dataUrl) => {
      if (!cancelled) setQr(dataUrl)
    }).catch(() => { /* a QR render failure leaves the placeholder visible */ })
    return () => { cancelled = true }
  }, [url])

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => { setCopied(false) }, 2_000)
    } catch { /* clipboard unavailable; the URL stays visible to copy by hand */ }
  }

  return (
    <div className={css.section}>
      <p className={css.description}>{t('remote.description')}</p>
      {loopbackOnly ? <p className={css.notice}>{t('remote.notPublic')}</p> : null}
      <div className={css.card}>
        {qr !== undefined
          ? <img className={css.qr} src={qr} alt={t('remote.qrHint')} />
          : <div className={css.qrPlaceholder} aria-hidden="true" />}
        <p className={css.qrHint}>{t('remote.qrHint')}</p>
      </div>
      <div className={css.urlRow}>
        <span className={css.urlLabel}>{t('remote.urlLabel')}</span>
        <code className={css.url}>{url}</code>
        <button type="button" className={css.copy} onClick={() => { void copy() }}>
          {copied ? t('remote.copied') : t('remote.copy')}
        </button>
      </div>
    </div>
  )
}