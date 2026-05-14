import { isScannableConnector } from './connection-manager'
import {
  isKnownScanTargetKey,
  isLocalScanTargetKey,
} from './engine/target-map'

export type ScanTargetAuthorization =
  | { ok: true; connectedExternalTargets: Set<string> }
  | { ok: false; status: number; code: string; message: string; targets?: string[] }

/**
 * Ensures external scan targets belong to the authenticated user.
 * Local scanner targets are allowed after authentication; every external
 * target must be a known scan-capable connector with an active user connection.
 */
export async function authorizeScanTargets(
  _userId: string,
  _token: string,
  targetKeys: string[]
): Promise<ScanTargetAuthorization> {
  const uniqueTargetKeys = Array.from(new Set(targetKeys.map((key) => key.trim()).filter(Boolean)))

  const unknownTargets = uniqueTargetKeys.filter((key) => !isKnownScanTargetKey(key))
  if (unknownTargets.length > 0) {
    return {
      ok: false,
      status: 400,
      code: 'UNKNOWN_TARGET',
      message: 'One or more scan targets are not supported',
      targets: unknownTargets,
    }
  }

  const externalTargets = uniqueTargetKeys.filter((key) => !isLocalScanTargetKey(key))
  const unsupportedExternalTargets = externalTargets.filter((key) => !isScannableConnector(key))

  if (unsupportedExternalTargets.length > 0) {
    return {
      ok: false,
      status: 400,
      code: 'UNSUPPORTED_EXTERNAL_TARGET',
      message: 'One or more external targets are not enabled for integration scanning',
      targets: unsupportedExternalTargets,
    }
  }

  if (externalTargets.length === 0) {
    return { ok: true, connectedExternalTargets: new Set() }
  }

  return {
    ok: false,
    status: 403,
    code: 'TARGET_AUTHORIZATION_REQUIRED',
    message: 'External connector scans require a verified read-only integration connection before scanning',
    targets: externalTargets,
  }
}
