/**
 * Shared no-shell `execFile` runner for host-native OS integrations.
 * @module @deepseek-ai/dsh-native-command/runner
 */

import { execFile } from 'node:child_process'

/** Runner options beyond the command line. */
export interface NativeCommandOptions {
  /**
   * Route the command through the platform shell (cmd on Windows, sh on Unix)
   * instead of CreateProcess. Reserved for commands that only honor their
   * arguments when the shell hands them off via ShellExecute, notably
   * `explorer.exe /select,<path>` on Windows.
   */
  readonly shell?: boolean
}

/** Testable command boundary; native implementations normally avoid a shell. */
export type NativeCommandRunner = (
  command: string,
  args: readonly string[],
  signal: AbortSignal,
  options?: NativeCommandOptions,
) => Promise<{ stdout: string; stderr: string }>

/**
 * Run a host command with utf8 stdio, abort propagation, and Windows hide.
 * @param command - executable path or PATH name.
 * @param args - argv (never a shell string).
 * @param signal - caller/connection lifetime; abort terminates the child.
 * @returns captured stdout/stderr on exit 0.
 */
export const runNativeCommand: NativeCommandRunner = (command, args, signal, options = {}) =>
  new Promise((resolve, reject) => {
    execFile(
      command,
      [...args],
      { encoding: 'utf8', signal, windowsHide: true, shell: options.shell === true },
      (error, stdout, stderr) => {
        if (error !== null) {
          const failure = Object.assign(new Error(error.message, { cause: error }), {
            code: error.code,
            stdout,
            stderr,
          })
          reject(failure)
          return
        }
        resolve({ stdout, stderr })
      },
    )
  })
