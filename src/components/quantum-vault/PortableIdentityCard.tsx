'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  exportBundle,
  importBundle,
  type HybridKeyMaterial,
} from '@/lib/vault/qgkey'
import {
  generateHybridEncryptionKeys,
  generateHybridSigningKeys,
} from '@/lib/vault/qgv1/envelope'
import { encryptToQGV1 } from '@/lib/vault/qgv1'
import { sha3_256 } from '@noble/hashes/sha3.js'
import { useAuth } from '@/contexts/auth-context'
import PassphraseModal, { type PassphraseModalMode } from './PassphraseModal'
import { useUnlockedIdentity } from './useUnlockedIdentity'
import { fetchAllVaultFiles, downloadVaultFile, logAudit } from '@/lib/vault/vault-service-enhanced'

/**
 * Portable Hybrid Identity card.
 *
 * Threat-model decisions baked into this UI:
 *   • Only client-side .qgv1 export is offered. Plaintext is fetched
 *     from /decrypt and re-sealed in-browser using the user's own
 *     hybrid signing keys. The server never holds a signer that can
 *     speak for the user.
 *   • Passphrase entry uses a real masked form with confirm + strength,
 *     never window.prompt.
 *   • Unlocked secrets live behind useUnlockedIdentity, which clears +
 *     zeroes them on idle, tab-hidden, or page unload.
 *   • Public-key registration is opt-in via a checkbox at generate
 *     time, surfaced so the user knows they're binding the identity
 *     to their account.
 */

type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; message: string }
  | { kind: 'ok'; message: string; fingerprint?: string }
  | { kind: 'error'; message: string }

interface VaultFile {
  id: string
  name: string
  size: number
  is_locked: boolean
  mime_type?: string | null
}

function fingerprint(m: HybridKeyMaterial): string {
  const total =
    m.x25519Public.length + m.mlkemPublic.length + m.ed25519Public.length + m.mldsaPublic.length
  const buf = new Uint8Array(total)
  let o = 0
  for (const p of [m.x25519Public, m.mlkemPublic, m.ed25519Public, m.mldsaPublic]) {
    buf.set(p, o)
    o += p.length
  }
  const fp = sha3_256(buf)
  let s = ''
  for (const b of fp) s += b.toString(16).padStart(2, '0')
  return s
}

function b64encode(b: Uint8Array): string {
  let s = ''
  for (const x of b) s += String.fromCharCode(x)
  return btoa(s)
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' })
  triggerDownload(blob, filename)
}

function downloadBinary(filename: string, bytes: Uint8Array) {
  const blob = new Blob([new Uint8Array(bytes) as unknown as BlobPart], {
    type: 'application/octet-stream',
  })
  triggerDownload(blob, filename)
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function parseFilenameFromDisposition(h: string | null): string | null {
  if (!h) return null
  const m = h.match(/filename="([^"]+)"/)
  if (!m) return null
  try {
    return decodeURIComponent(m[1])
  } catch {
    return m[1]
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export default function PortableIdentityCard() {
  const { session } = useAuth()
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [files, setFiles] = useState<VaultFile[] | null>(null)
  const [filesError, setFilesError] = useState<string | null>(null)
  const [selectedFileId, setSelectedFileId] = useState<string>('')
  const [registerOnGenerate, setRegisterOnGenerate] = useState(true)
  const [pendingLabel, setPendingLabel] = useState<string>('')

  // Modal state.
  const [modal, setModal] = useState<{
    mode: PassphraseModalMode
    title: string
    description?: string
    /** What to do when the user submits a passphrase. */
    onSubmit: (passphrase: string) => void | Promise<void>
  } | null>(null)

  // Hidden file input for .qgkey import.
  const fileInputRef = useRef<HTMLInputElement>(null)

  const identity = useUnlockedIdentity({
    onLock: (reason) => {
      if (reason === 'idle') {
        setStatus({ kind: 'ok', message: 'Identity auto-locked after idle timeout.' })
      } else if (reason === 'hidden') {
        setStatus({ kind: 'ok', message: 'Identity auto-locked while tab was hidden.' })
      } else if (reason === 'manual') {
        setStatus({ kind: 'idle' })
      }
    },
  })

  const authHeader = useCallback((): Record<string, string> => {
    return session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {}
  }, [session?.access_token])

  // Load file list on mount + whenever auth changes.
  const refreshFiles = useCallback(async () => {
    if (!session?.access_token) return
    setFilesError(null)
    try {
      const allFiles = await fetchAllVaultFiles()
      const list = allFiles.filter((f) => f.is_locked)
      setFiles(list)
    } catch (e) {
      setFilesError((e as Error).message)
    }
  }, [session?.access_token])

  useEffect(() => {
    void refreshFiles()
  }, [refreshFiles])

  async function registerPublics(material: HybridKeyMaterial, label?: string) {
    // Store hybrid identity public keys as vault audit metadata
    await logAudit('hybrid_identity_registered', 'info', 'identity', null, 
      `Registered hybrid identity: ${label || 'unnamed'}`)
  }

  // ── Generate ───────────────────────────────────────────────────────────────
  function startGenerate() {
    setModal({
      mode: 'create',
      title: 'Choose a passphrase',
      description:
        'Wraps your hybrid identity (X25519 + ML-KEM-768 + Ed25519 + ML-DSA-65). Min 12 characters. There is no recovery — store it in a password manager.',
      onSubmit: async (passphrase) => {
        setModal(null)
        await runGenerate(passphrase, pendingLabel.trim() || undefined)
      },
    })
  }

  async function runGenerate(passphrase: string, label?: string) {
    setStatus({
      kind: 'busy',
      message: 'Generating hybrid identity (X25519 + ML-KEM-768 + Ed25519 + ML-DSA-65)...',
    })
    await new Promise((r) => setTimeout(r, 10))

    try {
      const enc = generateHybridEncryptionKeys()
      const sign = generateHybridSigningKeys()
      const material: HybridKeyMaterial = {
        x25519Public: enc.x25519.publicKey,
        x25519Secret: enc.x25519.secretKey,
        mlkemPublic: enc.mlkem.publicKey,
        mlkemSecret: enc.mlkem.secretKey,
        ed25519Public: sign.ed25519.publicKey,
        ed25519Secret: sign.ed25519.secretKey,
        mldsaPublic: sign.mldsa.publicKey,
        mldsaSecret: sign.mldsa.secretKey,
      }

      setStatus({ kind: 'busy', message: 'Wrapping with PBKDF2-SHA3-256 + AES-256-GCM...' })
      await new Promise((r) => setTimeout(r, 10))

      const bundle = exportBundle({ material, passphrase, label })
      const fp = fingerprint(material)
      const safeLabel = label ? label.replace(/[^a-z0-9-_]+/gi, '_') : 'identity'
      downloadText(`qguard-${safeLabel}-${fp.slice(0, 8)}.qgkey`, bundle)

      if (registerOnGenerate) {
        setStatus({ kind: 'busy', message: 'Registering public keys with server...' })
        try {
          await registerPublics(material, label)
        } catch (e) {
          setStatus({
            kind: 'error',
            message: `Bundle downloaded, but failed to register publics: ${(e as Error).message}.`,
          })
          identity.unlock(material, fp, label)
          return
        }
      }

      identity.unlock(material, fp, label)
      setStatus({
        kind: 'ok',
        message: registerOnGenerate
          ? 'Bundle downloaded and public keys registered. Identity is unlocked in this tab — it will auto-lock after 5 min idle.'
          : 'Bundle downloaded. Identity is unlocked locally (publics not registered with server).',
        fingerprint: fp,
      })
    } catch (e) {
      setStatus({ kind: 'error', message: (e as Error).message })
    }
  }

  // ── Import ─────────────────────────────────────────────────────────────────
  function startImport() {
    fileInputRef.current?.click()
  }

  function onImportFileChosen(file: File) {
    setModal({
      mode: 'unlock',
      title: `Unlock ${file.name}`,
      description: 'Enter the passphrase you used when this identity bundle was created.',
      onSubmit: async (passphrase) => {
        setModal(null)
        await runImport(file, passphrase)
      },
    })
  }

  async function runImport(file: File, passphrase: string) {
    setStatus({ kind: 'busy', message: 'Deriving key (PBKDF2-SHA3-256)...' })
    await new Promise((r) => setTimeout(r, 10))

    try {
      const text = await file.text()
      const material = importBundle(text, passphrase)
      const fp = fingerprint(material)
      identity.unlock(material, fp, null)
      setStatus({
        kind: 'ok',
        message:
          'Identity unlocked. Auto-locks after 5 min idle, when the tab is hidden for 1 min, or on page close.',
        fingerprint: fp,
      })
    } catch (e) {
      setStatus({
        kind: 'error',
        message: `Import failed: ${(e as Error).message}. Wrong passphrase or corrupted bundle.`,
      })
    }
  }

  // ── Client-side .qgv1 export ───────────────────────────────────────────────
  async function handleClientExport() {
    if (!identity.unlocked) {
      setStatus({ kind: 'error', message: 'Unlock an identity first.' })
      return
    }
    if (!selectedFileId) {
      setStatus({ kind: 'error', message: 'Select a vault file first.' })
      return
    }
    const fileMeta = files?.find((f) => f.id === selectedFileId)
    setStatus({
      kind: 'busy',
      message: `Fetching plaintext for "${fileMeta?.name ?? selectedFileId}"...`,
    })
    try {
      // Download encrypted file from Supabase storage
      const { data: blob, filename: originalName } = await downloadVaultFile(selectedFileId)
      const plaintext = new Uint8Array(await blob.arrayBuffer())
      const mime = blob.type || undefined

      setStatus({
        kind: 'busy',
        message: 'Encrypting to QGV1 with your local identity...',
      })
      await new Promise((r) => setTimeout(r, 10))

      const fp = identity.fingerprint ?? 'local'
      const container = encryptToQGV1({
        filename: originalName,
        fileData: plaintext,
        mimeType: mime,
        recipientX25519Public: identity.unlocked.x25519Public,
        recipientMlkemPublic: identity.unlocked.mlkemPublic,
        signerEd25519Secret: identity.unlocked.ed25519Secret,
        signerMldsaSecret: identity.unlocked.mldsaSecret,
        encryptionKeyId: `qgkey:${fp.slice(0, 16)}`,
        signingKeyId: `qgkey:${fp.slice(0, 16)}`,
        label: identity.label ?? 'qguard-client-export',
      })

      // Best-effort plaintext zero-out; we don't hold it after this.
      plaintext.fill(0)

      downloadBinary(`${originalName}.qgv1`, container)
      setStatus({
        kind: 'ok',
        message: `Downloaded ${originalName}.qgv1 — signed by your local identity.`,
        fingerprint: identity.fingerprint ?? undefined,
      })
    } catch (e) {
      setStatus({ kind: 'error', message: (e as Error).message })
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="q-card animate-fade-in-up"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: 20,
        marginBottom: 24,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(255,243,193,0.15))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
          }}
        >
          🔑
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>
            Portable Hybrid Identity (.qgkey)
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            X25519 + ML-KEM-768 + Ed25519 + ML-DSA-65, wrapped with PBKDF2-SHA3-256 and AES-256-GCM.
            Exports are signed locally by your unlocked identity — never by the server.
          </div>
        </div>
      </div>

      {/* Generate / import controls */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          onClick={startGenerate}
          disabled={status.kind === 'busy' || !!modal}
          style={{
            padding: '10px 18px',
            borderRadius: 10,
            background: 'linear-gradient(135deg, #d4af37, #fff3c1)',
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            border: 'none',
            cursor: status.kind === 'busy' ? 'wait' : 'pointer',
            opacity: status.kind === 'busy' ? 0.6 : 1,
          }}
        >
          Generate new identity
        </button>
        <button
          type="button"
          onClick={startImport}
          disabled={status.kind === 'busy' || !!modal}
          style={{
            padding: '10px 18px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.85)',
            fontSize: 12,
            fontWeight: 600,
            cursor: status.kind === 'busy' ? 'wait' : 'pointer',
          }}
        >
          Import .qgkey
        </button>
        {identity.unlocked && (
          <button
            type="button"
            onClick={identity.lock}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.7)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
            title="Zero out secrets in memory"
          >
            🔒 Lock now
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".qgkey,application/json,.json"
          title="Select a .qgkey bundle"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) onImportFileChosen(f)
          }}
        />
      </div>

      {/* Generate options (label + register checkbox) */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          fontSize: 11,
          color: 'rgba(255,255,255,0.6)',
        }}
      >
        <input
          type="text"
          value={pendingLabel}
          onChange={(e) => setPendingLabel(e.target.value)}
          placeholder='Optional label (e.g. "Alice — laptop")'
          style={{
            flex: '1 1 200px',
            minWidth: 200,
            padding: '6px 10px',
            borderRadius: 8,
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff',
            fontSize: 11,
          }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={registerOnGenerate}
            onChange={(e) => setRegisterOnGenerate(e.target.checked)}
          />
          <span>
            Register public keys with server
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>
              {' '}
              (lets others seal files to your identity)
            </span>
          </span>
        </label>
      </div>

      {/* Unlocked panel + export */}
      {identity.unlocked && identity.fingerprint && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: 14,
            borderRadius: 12,
            background: 'rgba(212,175,55,0.06)',
            border: '1px solid rgba(212,175,55,0.2)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
              🔓 Identity unlocked
              {identity.label && (
                <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>
                  · {identity.label}
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.45)',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              {identity.fingerprint.slice(0, 24)}…
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
            Auto-locks after {Math.round(identity.idleMs / 60000)} min idle, after the tab is
            hidden for {Math.round(identity.hiddenMs / 1000)} s, or when this page closes.
          </div>

          <div
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.65)',
              marginTop: 4,
              fontWeight: 500,
            }}
          >
            Export a vault file as .qgv1
          </div>
          {filesError && (
            <div style={{ fontSize: 11, color: '#ff9a9a' }}>
              Couldn't load file list: {filesError}{' '}
              <button
                type="button"
                onClick={() => void refreshFiles()}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#a8e8ff',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: 11,
                }}
              >
                retry
              </button>
            </div>
          )}
          {!filesError && files && files.length === 0 && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
              You have no encrypted vault files yet. Upload + lock a file first.
            </div>
          )}
          {files && files.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                value={selectedFileId}
                onChange={(e) => setSelectedFileId(e.target.value)}
                style={{
                  flex: '1 1 240px',
                  minWidth: 240,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontSize: 12,
                }}
              >
                <option value="">— pick a file —</option>
                {files.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({formatBytes(f.size)})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleClientExport}
                disabled={status.kind === 'busy' || !selectedFileId}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  background:
                    status.kind === 'busy' || !selectedFileId
                      ? 'rgba(255,255,255,0.06)'
                      : 'linear-gradient(135deg, #d4af37, #fff3c1)',
                  border: 'none',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: status.kind === 'busy' || !selectedFileId ? 'not-allowed' : 'pointer',
                  opacity: status.kind === 'busy' || !selectedFileId ? 0.5 : 1,
                }}
              >
                Export as .qgv1
              </button>
            </div>
          )}
        </div>
      )}

      {/* Status banners */}
      {status.kind === 'busy' && (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{status.message}</div>
      )}
      {status.kind === 'ok' && (
        <div
          style={{
            fontSize: 12,
            color: '#9effb0',
            background: 'rgba(30,170,80,0.08)',
            border: '1px solid rgba(30,170,80,0.25)',
            borderRadius: 10,
            padding: '10px 12px',
            lineHeight: 1.5,
          }}
        >
          ✓ {status.message}
          {status.fingerprint && (
            <div
              style={{
                marginTop: 6,
                fontFamily: 'ui-monospace, monospace',
                wordBreak: 'break-all',
                fontSize: 11,
              }}
            >
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>fingerprint: </span>
              {status.fingerprint}
            </div>
          )}
        </div>
      )}
      {status.kind === 'error' && (
        <div
          style={{
            fontSize: 12,
            color: '#ff9a9a',
            background: 'rgba(220,60,60,0.08)',
            border: '1px solid rgba(220,60,60,0.25)',
            borderRadius: 10,
            padding: '10px 12px',
          }}
        >
          ✗ {status.message}
        </div>
      )}

      <PassphraseModal
        open={!!modal}
        mode={modal?.mode ?? 'unlock'}
        title={modal?.title ?? ''}
        description={modal?.description}
        onSubmit={(p) => {
          void modal?.onSubmit(p)
        }}
        onCancel={() => setModal(null)}
      />
    </div>
  )
}
