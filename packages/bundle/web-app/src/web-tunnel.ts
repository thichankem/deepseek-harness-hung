/**
 * On-demand public-access controller: lets the browser ask the host to start a
 * Cloudflare quick tunnel for the loopback Web server and learn its public URL,
 * so the Remote Connection settings page can render a QR code that works from
 * any network. The tunnel lives only while the process runs and is stopped on
 * request; the caller appends the session launch token to the returned origin.
 */

import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { CloudflareTunnel } from './index.ts'

/** Construction inputs supplied by the web-app composition. */
export interface WebTunnelControllerConfig {
  /** Loopback Web server port the tunnel forwards to. */
  port: number
  /** Start a Cloudflare tunnel forwarding to `port`; test-injectable. */
  startTunnel: (port: number) => Promise<CloudflareTunnel>
  /** Append the session launch token so the returned URL opens authenticated. */
  authenticate: (url: string) => string
}

/** One public-access session as the client renders it. */
export interface WebTunnelView {
  /** Public HTTPS origin Cloudflare assigned to the tunnel. */
  url: string
}

/**
 * Host owner of the `web-tunnel` Remote namespace: starts and stops a public
 * Cloudflare tunnel on demand. The tunnel is a singleton per process; a second
 * `start` returns the already-running origin.
 */
export class WebTunnelController extends TypertRemoteService {
  private tunnel: CloudflareTunnel | undefined

  /**
   * Register the service and bind the `web-tunnel` namespace to Typert Gateway.
   * @param ctx - owning Cordis Context.
   * @param config - port and tunnel starter.
   */
  constructor(ctx: Context, private readonly config: WebTunnelControllerConfig) {
    super(ctx, 'webTunnelController', { namespace: 'web-tunnel' })
  }

  /**
   * Start (or reuse) the public tunnel and report its origin.
   * @returns the public HTTPS origin.
   */
  @Remote
  async start(): Promise<WebTunnelView> {
    if (this.tunnel !== undefined) return { url: this.config.authenticate(this.tunnel.url) }
    const tunnel = await this.config.startTunnel(this.config.port)
    this.tunnel = tunnel
    return { url: this.config.authenticate(tunnel.url) }
  }

  /**
   * Stop the public tunnel if one is running.
   * @returns whether a tunnel was running and has been stopped.
   */
  @Remote
  async stop(): Promise<{ stopped: boolean }> {
    if (this.tunnel === undefined) return { stopped: false }
    this.tunnel.dispose()
    this.tunnel = undefined
    return { stopped: true }
  }
}