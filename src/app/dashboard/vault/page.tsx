'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/contexts/auth-context'
import QuantumVault, { type VaultCardTelemetry, type VaultHeroMetrics } from '@/components/quantum-vault/QuantumVault'
import ShareLinkModal from '@/components/quantum-vault/ShareLinkModal'
import ShareSecurityAlerts from '@/components/quantum-vault/ShareSecurityAlerts'
import VaultFolderExplorer from '@/components/quantum-vault/VaultFolderExplorer'
import MoveToModal from '@/components/quantum-vault/MoveToModal'
import VaultAlertDialog, {
  type VaultAlertAction,
  type VaultAlertVariant,
} from '@/components/quantum-vault/VaultAlertDialog'
import type { ZKMasterKeys } from '@/lib/vault/client-crypto'
import * as vaultSvc from '@/lib/vault/vault-service-enhanced'

// ─── Desktop Download Manifest ─────────────────────────────
// Local Next.js public assets for the QGuard Vault desktop app.
// Files live under qguard-app/public/downloads/qguard-vault/latest
// so http://localhost:4000/dashboard/vault can serve the current installer
// without depending on a remote storage bucket during local/demo operation.
const DESKTOP_APP_VERSION = '1.0.0'
const DESKTOP_APP_BUILD_DATE = '2026-04-25'
const DOWNLOADS_BASE = '/downloads/qguard-vault/latest'

const DESKTOP_DOWNLOADS = {
  windows: {
    url: `${DOWNLOADS_BASE}/qguard-vault-windows-x64-setup.exe`,
    filename: 'qguard-vault-windows-x64-setup.exe',
    sizeLabel: '2.8 MB',
    sha256: 'f9e1424b80734826d94d29ab6576c0e9266134fd97fde02dff4541e5b338688f',
  },
  windowsMsi: {
    url: `${DOWNLOADS_BASE}/qguard-vault-windows-x64-setup.msi`,
    filename: 'qguard-vault-windows-x64-setup.msi',
    sizeLabel: '4.0 MB',
    sha256: '64d7226e4b5f74d7e72397571aeafc1480f4989e50003f9f56b87387dc05f67b',
  },
  // macos / linux intentionally omitted until builds are published.
} as const

// ─── Types ─────────────────────────────────────────────────

interface VaultFileEntry {
  id: string
  name: string
  size: number
  original_size: number | null
  mime_type: string
  encryption_algorithm: string
  uploaded_at: string
  shared_with: string[]
  is_locked: boolean
  integrity_hash: string | null
  encrypted_content_hash: string | null
  signature: string | null
  encryption_key_id: string | null
  signing_key_id: string | null
  kem_ciphertext: string | null
  aes_nonce: string | null
  aes_auth_tag?: string | null
  envelope_meta?: Record<string, unknown> | null
  key_derivation_meta?: Record<string, unknown> | null
  aad_hash?: string | null
  folder_id?: string | null
  processing_status?: string
  encryption_status?: string
}

interface VaultKeyEntry {
  id: string
  keyType: string
  algorithm: string
  fingerprint: string
  isActive: boolean
  version: number
  expiresAt: string | null
  lastUsedAt: string | null
  createdAt: string
}

interface AuditEventEntry {
  id: string
  event_type: string
  severity: string
  resource_type: string
  resource_id: string | null
  description: string
  created_at: string
}

interface EncryptionProgress {
  stage: string
  percent: number
  message: string
}

interface VerifyResult {
  fileId: string
  fileName: string
  valid: boolean
  checks: {
    storageIntegrity: boolean
    signatureValid: boolean
    hasSignature: boolean
  }
  verifiedAt: string
}

interface SharedLinkEntry {
  id: string
  file_id: string
  original_filename: string
  original_size: number
  mime_type: string
  expires_at: string | null
  max_downloads: number | null
  download_count: number
  is_revoked: boolean
  is_password_protected: boolean
  is_destroyed: boolean
  failed_password_attempts: number
  created_at: string
  last_accessed_at: string | null
}

interface VaultTelemetryEvent {
  id: string
  event_type: string
  severity: string
  message: string
  created_at: string
}

// ─── Helpers ───────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${(bytes / 1073741824).toFixed(1)} GB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'var(--qg-red, #ef4444)'
    case 'warning': return 'var(--qg-amber, #f59e0b)'
    default: return 'var(--qg-cyan, #d4af37)'
  }
}

function eventIcon(eventType: string): string {
  const icons: Record<string, string> = {
    file_uploaded: '📤', file_downloaded: '📥', file_deleted: '🗑️',
    file_encrypted: '🔐', file_decrypted: '🔓',
    file_shared: '👥', file_unshared: '🚫',
    key_generated: '🔑', key_rotated: '🔄', key_revoked: '❌',
    integrity_verified: '✅', integrity_failed: '⚠️',
    access_denied: '🛡️', rate_limited: '⏳',
    suspicious_activity: '🚨',
  }
  return icons[eventType] || '📋'
}

// ─── Main Component ────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null
    } catch {
      return null
    }
  }
  return typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function textFromRecord(record: Record<string, unknown> | null, key: string): string {
  const value = record?.[key]
  return typeof value === 'string' ? value : ''
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function hasRequiredPqcEnvelope(file: VaultFileEntry): boolean {
  const meta = asRecord(file.envelope_meta)
  const kdfMeta = asRecord(file.key_derivation_meta)
  const algorithmText = [
    file.encryption_algorithm,
    textFromRecord(meta, 'mode'),
    textFromRecord(meta, 'kem'),
    textFromRecord(meta, 'kex'),
    textFromRecord(meta, 'symmetric'),
    textFromRecord(meta, 'kdf'),
    textFromRecord(kdfMeta, 'kdf'),
  ].join(' ')

  const hasHybridKem =
    algorithmText.includes('X25519+ML-KEM-768') &&
    textFromRecord(meta, 'mode') === 'hybrid' &&
    textFromRecord(meta, 'kem') === 'ML-KEM-768'

  const hasAesGcm =
    algorithmText.includes('AES-256-GCM') &&
    textFromRecord(meta, 'symmetric') === 'AES-256-GCM' &&
    hasText(file.aes_nonce) &&
    hasText(file.aes_auth_tag)

  const hasKeyWrap =
    textFromRecord(meta, 'kdf') === 'HKDF-SHA3-256' &&
    hasText(textFromRecord(meta, 'wrappedDataKey')) &&
    hasText(textFromRecord(meta, 'wrapNonce')) &&
    hasText(textFromRecord(meta, 'wrapSalt')) &&
    hasText(textFromRecord(meta, 'x25519EphemeralPublic')) &&
    hasText(file.kem_ciphertext)

  return Boolean(
    file.is_locked &&
    file.processing_status !== 'failed' &&
    hasHybridKem &&
    hasAesGcm &&
    hasKeyWrap,
  )
}

function hasRequiredIntegrityStack(file: VaultFileEntry): boolean {
  const meta = asRecord(file.envelope_meta)
  return Boolean(
    hasRequiredPqcEnvelope(file) &&
    textFromRecord(meta, 'signature') === 'Ed25519+ML-DSA-65' &&
    textFromRecord(meta, 'hash') === 'SHA3-256' &&
    textFromRecord(meta, 'encryptedHash') === 'SHA3-512' &&
    hasText(file.integrity_hash) &&
    hasText(file.encrypted_content_hash) &&
    hasText(file.aad_hash) &&
    hasText(textFromRecord(meta, 'aadHash')) &&
    hasText(textFromRecord(meta, 'signedMetadata')) &&
    hasText(file.signature),
  )
}

function hasZeroKnowledgeEnvelope(file: VaultFileEntry): boolean {
  return Boolean(
    hasRequiredPqcEnvelope(file) &&
    file.encryption_key_id == null &&
    file.signing_key_id == null,
  )
}

function latestIso(values: Array<string | null | undefined>): string | null {
  const latest = values
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)[0]

  return Number.isFinite(latest) ? new Date(latest).toISOString() : null
}

function latestEventIso(
  events: Array<{ event_type: string; created_at: string }>,
  eventTypes: string[],
): string | null {
  const wanted = new Set(eventTypes)
  return latestIso(events.filter((event) => wanted.has(event.event_type)).map((event) => event.created_at))
}

function recentFailedEvent(
  events: Array<{ event_type: string; severity: string; created_at: string }>,
  eventTypes: string[],
): boolean {
  const wanted = new Set(eventTypes)
  const latestFailure = latestIso(
    events
      .filter((event) => wanted.has(event.event_type) && event.severity === 'critical')
      .map((event) => event.created_at),
  )
  if (!latestFailure) return false

  const latestRecovery = latestEventIso(events, [
    'file_integrity_verified',
    'signature_verification_passed',
    'encryption_completed',
    'vault_health_updated',
  ])

  return !latestRecovery || new Date(latestFailure) > new Date(latestRecovery)
}

function resolveTelemetryState({
  fetchError,
  sessionToken,
  realtimeConnected,
  busy,
}: {
  fetchError: string | null
  sessionToken?: string
  realtimeConnected: boolean
  busy: boolean
}): VaultCardTelemetry {
  if (fetchError) return 'error'
  if (busy) return 'updating'
  if (realtimeConnected) return 'connected'
  return sessionToken ? 'standby' : 'offline'
}

function hexToBytes(hex: string): Uint8Array {
  const pairs = hex.match(/.{1,2}/g) || []
  return new Uint8Array(pairs.map((byte) => parseInt(byte, 16)))
}

export default function VaultPage() {
  const { session } = useAuth()

  const authHeaders = useMemo(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
    return headers
  }, [session?.access_token])

  const [activeTab, setActiveTab] = useState<'files' | 'keys' | 'audit' | 'shared'>('files')
  const [files, setFiles] = useState<VaultFileEntry[]>([])
  const [keys, setKeys] = useState<VaultKeyEntry[]>([])
  const [auditEvents, setAuditEvents] = useState<AuditEventEntry[]>([])
  const [uploading, setUploading] = useState(false)
  const [encrypting, setEncrypting] = useState<string | null>(null)
  const [encryptProgress, setEncryptProgress] = useState<EncryptionProgress | null>(null)
  const [zkKeys, setZkKeys] = useState<ZKMasterKeys | null>(null)
  const [decrypting, setDecrypting] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [verifying, setVerifying] = useState<string | null>(null)
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)
  const [sharedLinks, setSharedLinks] = useState<SharedLinkEntry[]>([])
  const [shareModalFile, setShareModalFile] = useState<{ id: string; name: string } | null>(null)
  const [revokingLink, setRevokingLink] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [telemetryEvents, setTelemetryEvents] = useState<VaultTelemetryEvent[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [moveModalTarget, setMoveModalTarget] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null)
  const [vaultStats, setVaultStats] = useState<vaultSvc.VaultStats | null>(null)

  // ─── Alert dialog (replaces native alert() for a professional UX) ───
  interface AlertState {
    title: string
    description: string
    variant?: VaultAlertVariant
    actions?: VaultAlertAction[]
  }
  const [alertState, setAlertState] = useState<AlertState | null>(null)
  const showAlert = useCallback((s: AlertState) => setAlertState(s), [])
  const closeAlert = useCallback(() => setAlertState(null), [])

  // Refs that always point at the latest values so stable callbacks (e.g. the
  // memoized `handleFileAction` consumed by VaultFolderExplorer) never read
  // stale closures. Without this, unlocking the passphrase wouldn't propagate
  // to the decrypt button — it would still see zkKeys = null.
  const zkKeysRef = useRef<ZKMasterKeys | null>(null)
  const filesRef = useRef<VaultFileEntry[]>([])

  // Real storage metrics from the user's vault profile
  const usedStorage = vaultStats?.storageUsed ?? files.reduce((sum, f) => sum + f.size, 0)
  const maxStorage = vaultStats?.storageQuota ?? 10737418240 // 10GB default from profile

  // Keep refs synced with the latest state for stable callbacks below.
  useEffect(() => { zkKeysRef.current = zkKeys }, [zkKeys])
  useEffect(() => { filesRef.current = files }, [files])

  const pushTelemetry = useCallback((eventType: string, message: string, severity = 'info') => {
    setTelemetryEvents((prev) => [
      {
        id: `${eventType}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        event_type: eventType,
        severity,
        message,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ].slice(0, 24))
  }, [])

  // ─── Data Fetching (Supabase direct) ───────────────────

  const fetchFiles = useCallback(async () => {
    try {
      // Use fetchVaultFilesWithHealth so we get the envelope metadata
      // (algorithm labels, integrity hashes, signature status) required
      // by the dashboard health checks (ML-KEM, ML-DSA, ZK cards).
      const allFiles = await vaultSvc.fetchVaultFilesWithHealth()
      setFetchError(null)
      setFiles(allFiles)
    } catch (err) {
      console.error('Failed to fetch files:', err)
      const msg = err instanceof Error ? err.message : 'Unknown error'
      if (msg.toLowerCase().includes('auth') || msg.toLowerCase().includes('jwt')) {
        setFetchError('Authentication failed. Please sign out and back in to access your vault.')
      } else {
        setFetchError('Could not load vault files. Check your connection and try again.')
      }
    }
  }, [])

  const fetchKeys = useCallback(async () => {
    try {
      const vaultKeys = await vaultSvc.fetchVaultKeys()
      setKeys(vaultKeys)
    } catch (err) {
      console.error('Failed to fetch keys:', err)
    }
  }, [])

  const fetchAudit = useCallback(async () => {
    try {
      const events = await vaultSvc.fetchAuditLogs(50)
      setAuditEvents(events)
    } catch (err) {
      console.error('Failed to fetch audit events:', err)
    }
  }, [])

  const fetchSharedLinks = useCallback(async () => {
    try {
      const links = await vaultSvc.fetchSharedLinks()
      setSharedLinks(links)
    } catch (err) {
      console.error('Failed to fetch shared links:', err)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const stats = await vaultSvc.fetchVaultStats()
      setVaultStats(stats)
    } catch (err) {
      console.error('Failed to fetch vault stats:', err)
    }
  }, [])

  useEffect(() => {
    if (session?.access_token) {
      fetchFiles()
      fetchKeys()
      fetchAudit()
      fetchSharedLinks()
      fetchStats()
    }
  }, [fetchFiles, fetchKeys, fetchAudit, fetchSharedLinks, fetchStats, session?.access_token])

  useEffect(() => {
    if (!session?.access_token) return
    if (activeTab === 'keys') fetchKeys()
    if (activeTab === 'audit') fetchAudit()
    if (activeTab === 'shared') fetchSharedLinks()
  }, [activeTab, fetchKeys, fetchAudit, fetchSharedLinks, session?.access_token])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return

    const filesChannel = vaultSvc.subscribeToVaultFiles(({ event, file }) => {
      pushTelemetry(
        event === 'INSERT' ? 'file_upload_completed' : 'vault_health_updated',
        event === 'INSERT'
          ? `File sealed in vault: ${file.name}`
          : `Vault file state updated: ${file.name}`,
      )
      fetchFiles()
    }, userId)

    const auditChannel = vaultSvc.subscribeToVaultAuditLogs(({ audit }) => {
      setAuditEvents((prev) => [audit, ...prev.filter((item) => item.id !== audit.id)].slice(0, 50))
      pushTelemetry(audit.event_type, audit.description || audit.event_type, audit.severity)
    }, userId)

    setRealtimeConnected(true)
    return () => {
      setRealtimeConnected(false)
      void filesChannel.unsubscribe()
      void auditChannel.unsubscribe()
    }
  }, [fetchFiles, pushTelemetry, session?.user?.id])

  // ─── Upload (plain, no encryption) ────────────────────

  const handleFileUpload = async (e: { target: { files?: FileList | null; value?: string } }) => {
    const file = e.target.files?.[0]
    if (!file) return

    const currentZkKeys = zkKeysRef.current
    if (!currentZkKeys) {
      showAlert({
        variant: 'warning',
        title: 'Open the vault first',
        description: 'Files must be encrypted before storage. Open the Quantum Vault and unlock your passphrase before uploading.',
      })
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploading(true)
    pushTelemetry('file_upload_started', `File upload started: ${file.name}`)
    try {
      const fileData = new Uint8Array(await file.arrayBuffer())
      const { encryptFileLocal, signData } = await import('@/lib/vault/client-crypto')
      const result = encryptFileLocal(fileData, currentZkKeys.encPublicKey, currentZkKeys.x25519Public)
      const signedMetadata = JSON.stringify({
        fileName: file.name,
        fileSize: result.originalSize,
        integrityHash: result.integrityHash,
        encryptedIntegrityHash: result.encryptedIntegrityHash,
        encryptionAlgorithm: result.algorithm,
        envelope: result.envelopeMeta,
        timestamp: new Date().toISOString(),
      })
      const signature = signData(new TextEncoder().encode(signedMetadata), currentZkKeys.signSecretKey, currentZkKeys.ed25519Secret)

      const uploaded = await vaultSvc.uploadVaultFile(file, {
        folderId: currentFolderId,
        encryptionData: {
          encryptedData: result.encryptedData,
          kemCiphertext: result.kemCiphertext,
          aesNonce: result.aesNonce,
          aesAuthTag: result.aesAuthTag,
          contentHash: result.integrityHash,
          encryptedContentHash: result.encryptedIntegrityHash,
          aadHash: result.aadHash,
          envelopeMeta: { ...result.envelopeMeta, signedMetadata },
          keyDerivationMeta: { kdf: 'HKDF-SHA3-256', hash: 'SHA3-256' },
          algorithm: result.algorithm,
          signature,
        },
      })
      fileData.fill(0)
      setFiles((prev) => [uploaded, ...prev])
      pushTelemetry('file_upload_completed', `File upload completed: ${file.name}`)
    } catch (err) {
      console.error('Upload failed:', err)
      showAlert({
        variant: 'error',
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'The encrypted upload could not be completed.',
      })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ─── Encrypt an uploaded file ─────────────────────────

  const handleEncrypt = async (fileId: string) => {
    setEncrypting(fileId)
    setEncryptProgress({ stage: 'preparing', percent: 0, message: 'Preparing encryption...' })
    let fileData: Uint8Array | null = null

    try {
      // Client-side encryption: download a legacy pending blob, seal it in-browser, re-upload.
      setEncryptProgress({ stage: 'downloading', percent: 10, message: 'Downloading plaintext from vault...' })
      const fileMeta = filesRef.current.find((file) => file.id === fileId)
      pushTelemetry('encryption_started', `Encryption started: ${fileMeta?.name || fileId}`)
      await vaultSvc.logAudit('encryption_started', 'info', 'file', fileId, `Encryption started: ${fileMeta?.name || fileId}`)

      const { data: blob, filename, mimeType } = await vaultSvc.downloadVaultFile(fileId)
      fileData = new Uint8Array(await blob.arrayBuffer())

      setEncryptProgress({ stage: 'encrypting', percent: 30, message: 'Loading post-quantum crypto engine...' })
      const currentZkKeys = zkKeysRef.current
      if (!currentZkKeys) {
        setEncryptProgress({ stage: 'error', percent: 0, message: 'Vault passphrase required — unlock your vault first' })
        return
      }

      const { encryptFileLocal, signData } = await import('@/lib/vault/client-crypto')
      setEncryptProgress({ stage: 'encrypting', percent: 50, message: 'Encrypting with X25519 + ML-KEM-768 + AES-256-GCM...' })
      const result = encryptFileLocal(fileData, currentZkKeys.encPublicKey, currentZkKeys.x25519Public)
      const signedMetadata = JSON.stringify({
        fileName: filename,
        fileSize: result.originalSize,
        integrityHash: result.integrityHash,
        encryptedIntegrityHash: result.encryptedIntegrityHash,
        encryptionAlgorithm: result.algorithm,
        envelope: result.envelopeMeta,
        timestamp: new Date().toISOString(),
      })
      const signature = signData(new TextEncoder().encode(signedMetadata), currentZkKeys.signSecretKey, currentZkKeys.ed25519Secret)
      pushTelemetry('key_wrapping_completed', `Key wrapping completed: ${filename}`)

      setEncryptProgress({ stage: 'uploading', percent: 70, message: 'Uploading encrypted file...' })
      // Soft-delete the legacy pending blob and upload the sealed replacement.
      await vaultSvc.deleteVaultFile(fileId)
      const originalFile = new File([fileData], filename, { type: mimeType })
      const uploaded = await vaultSvc.uploadVaultFile(originalFile, {
        folderId: fileMeta?.folder_id || currentFolderId,
        encryptionData: {
          encryptedData: result.encryptedData,
          kemCiphertext: result.kemCiphertext,
          aesNonce: result.aesNonce,
          aesAuthTag: result.aesAuthTag,
          contentHash: result.integrityHash,
          encryptedContentHash: result.encryptedIntegrityHash,
          aadHash: result.aadHash,
          envelopeMeta: { ...result.envelopeMeta, signedMetadata },
          keyDerivationMeta: { kdf: 'HKDF-SHA3-256', hash: 'SHA3-256' },
          algorithm: result.algorithm,
          signature,
        }
      })

      setFiles((prev) => [uploaded, ...prev.filter((f) => f.id !== fileId)])
      setEncryptProgress({ stage: 'complete', percent: 100, message: 'File encrypted with X25519 + ML-KEM-768 + AES-256-GCM' })
      pushTelemetry('encryption_completed', `Encryption completed: ${filename}`)
      await vaultSvc.logAudit('encryption_completed', 'info', 'file', uploaded.id, `Encryption completed: ${filename}`)
    } catch (err) {
      console.error('Encrypt failed:', err)
      setEncryptProgress({ stage: 'error', percent: 0, message: (err as Error).message || 'Encryption failed' })
      pushTelemetry('encryption_failed', `Encryption failed: ${err instanceof Error ? err.message : fileId}`, 'critical')
    } finally {
      fileData?.fill(0)
      setTimeout(() => {
        setEncrypting(null)
        setEncryptProgress(null)
      }, 3000)
    }
  }

  // ─── Decrypt & Download ───────────────────────────────

  const handleDecrypt = async (fileId: string) => {
    setDecrypting(fileId)

    // Read via refs — this function may be invoked from a stable/memoized
    // parent callback and must see the current vault state.
    const currentFiles = filesRef.current
    const currentZkKeys = zkKeysRef.current
    const file = currentFiles.find(f => f.id === fileId)
    // A file needs client-side (ZK) decryption when the server doesn't hold the key.
    // Prefer `encryption_key_id === null` as the authoritative signal; fall back to
    // the algorithm prefix for forward compatibility.
    const needsClientDecrypt =
      !!file && file.is_locked && (file.encryption_key_id == null || file.encryption_algorithm?.startsWith('ZK-'))

    try {
      pushTelemetry('decryption_started', `Decryption started: ${file?.name || fileId}`)
      await vaultSvc.logAudit('decryption_started', 'info', 'file', fileId, `Decryption started: ${file?.name || fileId}`)
      if (needsClientDecrypt && currentZkKeys && file) {
        // ── ZK Client-Side Decrypt ──────────────────────────
        const { data: encryptedBlob } = await vaultSvc.downloadVaultFile(fileId)
        const encryptedData = new Uint8Array(await encryptedBlob.arrayBuffer())

        const { decryptFileLocal } = await import('@/lib/vault/client-crypto')
        const decrypted = decryptFileLocal(
          encryptedData,
          file.kem_ciphertext!,
          file.aes_nonce!,
          currentZkKeys.encSecretKey,
          file.integrity_hash || undefined,
          file.envelope_meta,
          currentZkKeys.x25519Secret,
        )

        const blob = new Blob([decrypted.buffer as ArrayBuffer], { type: file.mime_type || 'application/octet-stream' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        a.click()
        URL.revokeObjectURL(url)
        decrypted.fill(0)
        pushTelemetry('decryption_completed', `Decryption completed: ${file.name}`)
        await vaultSvc.logAudit('decryption_completed', 'info', 'file', fileId, `Decryption completed: ${file.name}`)
      } else if (needsClientDecrypt && !currentZkKeys) {
        showAlert({
          variant: 'warning',
          title: 'Passphrase required',
          description:
            'This file is zero-knowledge encrypted, so only your passphrase can unlock it. Open the Quantum Vault above, enter your passphrase, then try the decrypt action again.',
          actions: [{ label: 'Got it', onClick: closeAlert, variant: 'primary', autoFocus: true }],
        })
        return
      } else {
        // Download and save directly
        const { data: blob, filename } = await vaultSvc.downloadVaultFile(fileId)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
        pushTelemetry('download_started', `Download started: ${filename}`)
      }
    } catch (err) {
      console.error('Decrypt failed:', err)
      const msg = (err as Error).message
      if (msg?.includes('INTEGRITY_CHECK_FAILED')) {
        showAlert({
          variant: 'error',
          title: 'Integrity check failed',
          description:
            'This file no longer matches its original signature and may have been tampered with. Decryption was aborted to protect your data.',
        })
      } else {
        showAlert({
          variant: 'error',
          title: 'Decryption failed',
          description: 'We could not decrypt this file. Please verify your passphrase and try again.',
        })
      }
    } finally {
      setDecrypting(null)
    }
  }

  // ─── Download Encrypted File ─────────────────────────

  const handleDownloadEncrypted = async (fileId: string, fileName: string) => {
    setDownloading(fileId)
    try {
      pushTelemetry('download_started', `Encrypted download started: ${fileName}`)
      await vaultSvc.logAudit('download_started', 'info', 'file', fileId, `Encrypted download started: ${fileName}`)
      const { data: blob } = await vaultSvc.downloadVaultFile(fileId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${fileName}.qguard.enc`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
      alert('Download failed')
    } finally {
      setDownloading(null)
    }
  }

  // ─── Verify Integrity ────────────────────────────────

  const handleVerify = async (fileId: string, clickedFile?: VaultFileEntry) => {
    setVerifying(fileId)
    setVerifyResult(null)
    try {
      let file = filesRef.current.find(f => f.id === fileId) || clickedFile
      if (!file) {
        const latestFiles = await vaultSvc.fetchVaultFilesWithHealth()
        setFiles(latestFiles)
        filesRef.current = latestFiles
        file = latestFiles.find(f => f.id === fileId)
      }
      if (!file) throw new Error('File not found in your vault. Refresh the folder and try again.')

      pushTelemetry('file_verification_running', `File verification running: ${file.name}`)
      await vaultSvc.logAudit('file_verification_running', 'info', 'file', fileId, `File verification running: ${file.name}`)

      const { data: blob } = await vaultSvc.downloadVaultFile(fileId)
      const data = new Uint8Array(await blob.arrayBuffer())

      const { computeEncryptedHash, computeHash, verifyHybridSignature } = await import('@/lib/vault/client-crypto')
      const storageHash = file.encrypted_content_hash ? computeEncryptedHash(data) : computeHash(data)
      const expectedHash = file.encrypted_content_hash || file.integrity_hash
      const storageIntegrity = expectedHash ? storageHash === expectedHash : data.length === file.size

      const signedMetadata = file.envelope_meta?.signedMetadata
      let signatureValid = false
      const hasSignature = !!file.signature
      if (hasSignature && typeof signedMetadata === 'string') {
        let signPublicKey = zkKeysRef.current?.signPublicKey
        if (!signPublicKey) {
          const userKeys = await vaultSvc.fetchUserKeys()
          if (userKeys?.sign_public_key) signPublicKey = hexToBytes(userKeys.sign_public_key)
        }
        if (signPublicKey) {
          signatureValid = verifyHybridSignature(
            new TextEncoder().encode(signedMetadata),
            file.signature!,
            signPublicKey,
            zkKeysRef.current?.ed25519Public,
          )
        }
      }

      const valid = storageIntegrity && (!hasSignature || signatureValid)
      setVerifyResult({
        fileId,
        fileName: file.name,
        valid,
        checks: {
          storageIntegrity,
          signatureValid,
          hasSignature,
        },
        verifiedAt: new Date().toISOString(),
      })

      pushTelemetry(
        valid ? 'file_integrity_verified' : 'signature_verification_failed',
        valid ? `File integrity verified: ${file.name}` : `Verification failed: ${file.name}`,
        valid ? 'info' : 'critical',
      )
      await vaultSvc.logAudit(
        valid ? 'file_integrity_verified' : 'signature_verification_failed',
        valid ? 'info' : 'critical',
        'file',
        fileId,
        valid ? `File integrity verified: ${file.name}` : `Verification failed: ${file.name}`,
      )
    } catch (err) {
      console.error('Verify failed:', err)
      const message = err instanceof Error ? err.message : 'Verification failed'
      pushTelemetry('file_verification_failed', `File verification failed: ${message}`, 'critical')
      showAlert({
        variant: 'error',
        title: 'File verification failed',
        description: message,
      })
    } finally {
      setVerifying(null)
    }
  }

  // ─── Delete ───────────────────────────────────────────

  const handleDelete = async (fileId: string) => {
    if (!confirm('Are you sure you want to permanently delete this file?')) return
    try {
      await vaultSvc.deleteVaultFile(fileId)
      setFiles((prev) => prev.filter((f) => f.id !== fileId))
      pushTelemetry('delete_completed', `Delete completed: ${fileId.slice(0, 8)}`)
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  // ─── Secure Sharing ─────────────────────────────────

  /**
   * Get plaintext file data for sharing.
   * For encrypted files: download + decrypt locally.
   * For legacy pending files: download raw.
   */
  const getPlaintextForSharing = (fileId: string): (() => Promise<Uint8Array>) => {
    return async () => {
      const file = files.find(f => f.id === fileId)
      if (!file) throw new Error('File not found')

      const isEncrypted = file.is_locked
      const needsClient = isEncrypted && (file.encryption_key_id == null || file.encryption_algorithm?.startsWith('ZK-'))

      const { data: blob } = await vaultSvc.downloadVaultFile(fileId)
      const rawData = new Uint8Array(await blob.arrayBuffer())

      if (needsClient && zkKeys) {
        const { decryptFileLocal } = await import('@/lib/vault/client-crypto')
        return decryptFileLocal(
          rawData, file.kem_ciphertext!, file.aes_nonce!,
          zkKeys.encSecretKey, file.integrity_hash || undefined,
          file.envelope_meta,
          zkKeys.x25519Secret,
        )
      }

      return rawData
    }
  }

  const handleRevokeLink = async (linkId: string) => {
    if (!confirm('Revoke this share link? It will become permanently inaccessible.')) return
    setRevokingLink(linkId)
    try {
      await vaultSvc.revokeSharedLink(linkId)
      setSharedLinks(prev => prev.map(l => l.id === linkId ? { ...l, is_revoked: true } : l))
    } catch (err) {
      console.error('Revoke failed:', err)
    } finally {
      setRevokingLink(null)
    }
  }

  const handleDeleteLink = async (linkId: string) => {
    if (!confirm('Permanently delete this share link and its encrypted data?')) return
    try {
      await vaultSvc.deleteSharedLink(linkId)
      setSharedLinks(prev => prev.filter(l => l.id !== linkId))
    } catch (err) {
      console.error('Delete link failed:', err)
    }
  }

  // ─── Folder Explorer Handlers ───────────────────────────

  const handleFileAction = useCallback((action: string, file: VaultFileEntry) => {
    switch (action) {
      case 'encrypt': handleEncrypt(file.id); break
      case 'decrypt': handleDecrypt(file.id); break
      case 'download': handleDownloadEncrypted(file.id, file.name); break
      case 'verify': handleVerify(file.id, file); break
      case 'share': setShareModalFile({ id: file.id, name: file.name }); break
      case 'delete': handleDelete(file.id); break
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleMoveFile = useCallback((fileId: string, fileName: string) => {
    setMoveModalTarget({ id: fileId, name: fileName, type: 'file' })
  }, [])

  const handleMoveConfirm = async (targetFolderId: string | null) => {
    if (!moveModalTarget) return
    try {
      await vaultSvc.moveVaultFile(moveModalTarget.id, targetFolderId)
      const refresh = (window as unknown as Record<string, unknown>).__vaultFolderRefresh as (() => void) | undefined
      if (refresh) refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Move failed'
      alert(msg)
    } finally {
      setMoveModalTarget(null)
    }
  }

  const handleFolderFilesChanged = useCallback(() => {
    fetchFiles()
  }, [fetchFiles])

  // ─── Key Management ──────────────────────────────────

  const [keyActionLoading, setKeyActionLoading] = useState<string | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<{
    action: string
    keyType?: string
    keyId?: string
    message: string
  } | null>(null)

  const handleKeyAction = async (action: string, keyType?: string, keyId?: string) => {
    const loadingId = keyId || keyType || action
    setKeyActionLoading(loadingId)
    setPendingConfirm(null)
    try {
      if (action === 'revoke' && keyId) {
        await vaultSvc.revokeVaultKey(keyId)
      } else if (action === 'rotate' && keyType) {
        // Generate a fingerprint for the new key
        const fp = Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map(b => b.toString(16).padStart(2, '0')).join(':')
        await vaultSvc.createVaultKey({
          keyType,
          algorithm: keyType === 'encryption' ? 'ML-KEM-768' : 'ML-DSA-65',
          fingerprint: fp,
        })
      }
      await Promise.all([fetchKeys(), fetchAudit()])
    } catch (err) {
      console.error('Key action failed:', err)
      alert(`Key ${action} failed — check connection`)
    } finally {
      setKeyActionLoading(null)
    }
  }

  const requestConfirm = (action: string, message: string, keyType?: string, keyId?: string) => {
    setPendingConfirm({ action, keyType, keyId, message })
  }

  const handleKeysUnlocked = useCallback((keys: ZKMasterKeys) => {
    setZkKeys(keys)
    pushTelemetry('vault_initialized', 'Vault initialized and master keys unwrapped')
    void vaultSvc.logAudit('vault_initialized', 'info', 'profile', null, 'Vault initialized and master keys unwrapped')
  }, [pushTelemetry])

  const heroMetrics: VaultHeroMetrics = useMemo(() => {
    const encryptedFileCount = files.filter((file) => file.is_locked).length
    const requiredEnvelopeCount = files.filter(hasRequiredPqcEnvelope).length
    const requiredIntegrityCount = files.filter(hasRequiredIntegrityStack).length
    const zeroKnowledgeEnvelopeCount = files.filter(hasZeroKnowledgeEnvelope).length
    const missingEncryptionCount = Math.max(0, files.length - requiredEnvelopeCount)
    const encryptedMissingIntegrityCount = Math.max(0, encryptedFileCount - requiredIntegrityCount)
    const zeroKnowledgeRiskCount = Math.max(0, files.length - zeroKnowledgeEnvelopeCount)
    const activeShareCount = sharedLinks.filter((link) =>
      !link.is_revoked && !link.is_destroyed && (!link.expires_at || new Date(link.expires_at) > new Date())
    ).length
    const quantumResistance = files.length === 0 ? 0 : Math.round((requiredEnvelopeCount / files.length) * 100)
    const zeroKnowledgeScore = files.length === 0 ? 0 : Math.round((zeroKnowledgeEnvelopeCount / files.length) * 100)
    const integrityScore = encryptedFileCount === 0 ? 0 : Math.round((requiredIntegrityCount / encryptedFileCount) * 100)
    const vaultBusy = uploading || !!encrypting || !!verifying || !!downloading || !!decrypting
    const telemetryState = resolveTelemetryState({
      fetchError,
      sessionToken: session?.access_token,
      realtimeConnected,
      busy: vaultBusy,
    })
    const activityEvents = [...telemetryEvents, ...auditEvents]
    const latestVaultActivity = latestIso([
      ...telemetryEvents.map((event) => event.created_at),
      ...auditEvents.map((event) => event.created_at),
      ...files.map((file) => file.uploaded_at),
      verifyResult?.verifiedAt,
    ])
    const latestEncryptionActivity = latestIso([
      latestEventIso(activityEvents, ['encryption_completed', 'file_uploaded', 'file_upload_completed', 'key_wrapping_completed']),
      ...files.filter(hasRequiredPqcEnvelope).map((file) => file.uploaded_at),
    ])
    const latestIntegrityActivity = latestIso([
      verifyResult?.verifiedAt,
      latestEventIso(activityEvents, ['file_integrity_verified', 'signature_verification_passed']),
      ...files.filter(hasRequiredIntegrityStack).map((file) => file.uploaded_at),
    ])
    const latestArchitectureActivity = latestIso([
      latestEventIso(activityEvents, ['vault_initialized', 'vault_health_updated']),
      ...files.filter(hasZeroKnowledgeEnvelope).map((file) => file.uploaded_at),
    ])
    const encryptionFailure = recentFailedEvent(activityEvents, ['encryption_failed'])
    const integrityFailure = Boolean(verifyResult && !verifyResult.valid) || recentFailedEvent(activityEvents, [
      'signature_verification_failed',
      'file_verification_failed',
      'integrity_failed',
    ])
    const vaultHealthy = Boolean(session?.access_token && realtimeConnected && !fetchError)
    const encryptionHealthy = files.length > 0 && missingEncryptionCount === 0 && !encryptionFailure
    const integrityHealthy = encryptedFileCount > 0 && encryptedMissingIntegrityCount === 0 && !integrityFailure
    const architectureHealthy = files.length > 0 && zeroKnowledgeRiskCount === 0 && (zeroKnowledgeEnvelopeCount > 0 || !!zkKeys)
    const recentActivity = [
      ...telemetryEvents.map((event) => event.message),
      ...auditEvents.map((event) => event.description),
    ].filter(Boolean).slice(0, 4)

    return {
      fileCount: files.length,
      encryptedFileCount,
      activeKeyCount: keys.filter((key) => key.isActive).length,
      activeShareCount,
      storageLabel: `${formatFileSize(usedStorage)} / ${formatFileSize(maxStorage)}`,
      storagePercent: Math.min(100, (usedStorage / maxStorage) * 100),
      integrityScore,
      quantumResistance,
      zeroKnowledgeScore,
      systemHealth: vaultHealthy && encryptionHealthy && integrityHealthy && architectureHealthy
        ? 'optimal'
        : session?.access_token
          ? 'degraded'
          : 'offline',
      telemetryConnected: realtimeConnected,
      recentActivity,
      statusCards: {
        vault: {
          healthy: vaultHealthy,
          state: vaultHealthy ? 'Secured' : fetchError ? 'Degraded' : 'Offline',
          description: fetchError
            ? fetchError
            : realtimeConnected
              ? 'Vault service online and live telemetry connected'
              : 'Realtime channel not connected',
          lastVerifiedAt: latestVaultActivity,
          telemetry: telemetryState,
        },
        encryption: {
          healthy: encryptionHealthy,
          headline: 'ML-KEM-768',
          state: encryptionHealthy ? 'Fully Applied' : files.length === 0 ? 'No Files Sealed' : 'Not Fully Applied',
          description: encryptionHealthy
            ? `${requiredEnvelopeCount}/${files.length} files use X25519 + ML-KEM-768 + AES-256-GCM`
            : files.length === 0
              ? 'No user files have been sealed yet'
              : `${missingEncryptionCount} files missing required hybrid PQC envelope`,
          lastVerifiedAt: latestEncryptionActivity,
          telemetry: telemetryState,
        },
        integrity: {
          healthy: integrityHealthy,
          headline: 'ML-DSA-65',
          state: integrityHealthy ? 'Verified' : integrityFailure ? 'Verification Failed' : 'Incomplete',
          description: integrityFailure && verifyResult
            ? `Latest verification failed for ${verifyResult.fileName}`
            : integrityHealthy
              ? `${requiredIntegrityCount}/${encryptedFileCount} encrypted files have ML-DSA-65, Ed25519, SHA3 metadata`
              : encryptedFileCount === 0
                ? 'No encrypted files available for integrity verification'
                : `${encryptedMissingIntegrityCount} encrypted files missing signature or SHA3 metadata`,
          lastVerifiedAt: latestIntegrityActivity,
          telemetry: telemetryState,
        },
        architecture: {
          healthy: architectureHealthy,
          headline: 'ZERO-KNOWLEDGE',
          state: architectureHealthy ? 'Zero-Knowledge' : 'Needs Review',
          description: architectureHealthy
            ? `${zeroKnowledgeEnvelopeCount}/${files.length} files use per-file keys with no server-side plaintext key`
            : files.length === 0
              ? 'Zero-knowledge posture will activate after the first sealed file'
              : `${zeroKnowledgeRiskCount} files need zero-knowledge envelope review`,
          lastVerifiedAt: latestArchitectureActivity,
          telemetry: telemetryState,
        },
      },
    }
  }, [
    auditEvents,
    decrypting,
    downloading,
    encrypting,
    fetchError,
    files,
    keys,
    maxStorage,
    realtimeConnected,
    session?.access_token,
    sharedLinks,
    telemetryEvents,
    uploading,
    usedStorage,
    verifying,
    verifyResult,
    zkKeys,
  ])

  return (
    <div>
      {/* Real-time security alerts for share link password attempts */}
      <ShareSecurityAlerts onLinkDestroyed={fetchSharedLinks} />
      <QuantumVault
        sessionToken={session?.access_token}
        metrics={heroMetrics}
        onFileUploaded={() => {
          fetchFiles()
          fetchAudit()
        }}
        onKeysUnlocked={handleKeysUnlocked}
      />

      {/* ── Desktop App Download Banner ───────── */}
      <div className="q-card animate-fade-in-up delay-150" style={{
        marginBottom: 24,
        background: 'linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(255,243,193,0.08) 100%)',
        border: '1px solid rgba(212,175,55,0.2)',
        borderRadius: 16,
        padding: '20px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(255,243,193,0.15))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24,
          }}>
            🖥️
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 4 }}>
              QGuard Vault Desktop App
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
              Offline post-quantum encryption with hardware-level security. Windows installers are available now.
            </div>
            <div style={{ fontSize: 11, color: 'rgba(212,175,55,0.72)', marginTop: 4 }}>
              Latest local build: v{DESKTOP_APP_VERSION} / Windows x64 / {DESKTOP_APP_BUILD_DATE}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <a
            href={DESKTOP_DOWNLOADS.windows.url}
            download={DESKTOP_DOWNLOADS.windows.filename}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, #d4af37, #fff3c1)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
            title={`Windows x64 installer — NSIS .exe (${DESKTOP_DOWNLOADS.windows.sizeLabel})`}
          >
            ⬇ Windows (.exe)
          </a>
          <a
            href={DESKTOP_DOWNLOADS.windowsMsi.url}
            download={DESKTOP_DOWNLOADS.windowsMsi.filename}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(212,175,55,0.25)',
              color: 'rgba(255,255,255,0.9)',
              fontSize: 12,
              fontWeight: 600,
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
            title={`Windows x64 installer — MSI for enterprise / Group Policy deployment (${DESKTOP_DOWNLOADS.windowsMsi.sizeLabel})`}
          >
            ⬇ Windows (.msi)
          </a>
          <button
            type="button"
            disabled
            onClick={() => alert('The macOS build is not yet available. Windows is ready to download today; macOS and Linux will follow once code-signed builds are published.')}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.5)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'not-allowed',
              transition: 'all 0.2s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
            title="macOS build coming soon"
          >
            ⬇ macOS · Soon
          </button>
          <button
            type="button"
            disabled
            onClick={() => alert('The Linux AppImage is not yet available. Windows is ready to download today; macOS and Linux will follow once builds are published.')}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.5)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'not-allowed',
              transition: 'all 0.2s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
            title="Linux build coming soon"
          >
            ⬇ Linux · Soon
          </button>
        </div>
      </div>

      {/* ── Quantum Vault Cinematic Upload Component ───────── */}
      {/* Hidden file input (for quick upload in files tab) */}
      <input ref={fileInputRef} type="file" title="Upload file to vault" style={{ display: 'none' }} onChange={handleFileUpload} />

      {/* Enterprise alert dialog — replaces native alert() for vault actions */}
      <VaultAlertDialog
        open={!!alertState}
        title={alertState?.title ?? ''}
        description={alertState?.description ?? ''}
        variant={alertState?.variant}
        actions={alertState?.actions}
        onClose={closeAlert}
      />

      <div className="q-card animate-fade-in-up" style={{ marginBottom: 24, padding: '18px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff3c1', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Live Vault Activity
            </div>
            <div style={{ fontSize: 11, color: 'var(--qg-text-muted)', marginTop: 3 }}>
              Supabase realtime plus client-side crypto operation telemetry
            </div>
          </div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 10,
            color: realtimeConnected ? 'var(--qg-green, #10b981)' : 'var(--qg-amber, #f59e0b)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: realtimeConnected ? 'var(--qg-green, #10b981)' : 'var(--qg-amber, #f59e0b)',
              boxShadow: realtimeConnected ? '0 0 10px rgba(16,185,129,0.8)' : '0 0 10px rgba(245,158,11,0.75)',
            }} />
            {realtimeConnected ? 'Connected' : 'Standby'}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
          {(telemetryEvents.length > 0 ? telemetryEvents.slice(0, 4) : auditEvents.slice(0, 4).map((event) => ({
            id: event.id,
            event_type: event.event_type,
            severity: event.severity,
            message: event.description,
            created_at: event.created_at,
          }))).map((event) => (
            <div key={event.id} style={{
              minHeight: 58,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid rgba(212,175,55,0.16)',
              background: 'rgba(212,175,55,0.035)',
            }}>
              <div style={{ fontSize: 10, color: severityColor(event.severity), fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                {event.event_type.replace(/_/g, ' ')}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', lineHeight: 1.4 }}>
                {event.message || 'Vault health updated'}
              </div>
            </div>
          ))}
          {telemetryEvents.length === 0 && auditEvents.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>
              Live events will appear here as vault operations run.
            </div>
          )}
        </div>
      </div>

      {/* Storage Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="q-card stat-card animate-fade-in-up delay-200">
          <div className="stat-label">Storage Used</div>
          <div className="stat-value" style={{ color: 'var(--qg-cyan)', fontSize: 24 }}>
            {formatFileSize(usedStorage)}
          </div>
          <div className="q-progress" style={{ marginTop: 8 }}>
            <div className="q-progress-bar" style={{ width: `${Math.min(100, (usedStorage / maxStorage) * 100)}%` }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--qg-text-muted)', marginTop: 4 }}>
            {formatFileSize(maxStorage)} total (Free Tier)
          </div>
        </div>
        <div className="q-card stat-card animate-fade-in-up delay-300">
          <div className="stat-label">Total Files</div>
          <div className="stat-value" style={{ color: 'var(--qg-violet)' }}>{files.length}</div>
          <div style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>
            {files.filter(f => f.is_locked).length} encrypted
          </div>
        </div>
        <div className="q-card stat-card animate-fade-in-up delay-300">
          <div className="stat-label">Vault Keys</div>
          <div className="stat-value" style={{ color: 'var(--qg-green)' }}>{keys.filter(k => k.isActive).length}</div>
          <div style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>Active PQC keys</div>
        </div>
        <div className="q-card stat-card animate-fade-in-up delay-400">
          <div className="stat-label">Shared</div>
          <div className="stat-value" style={{ color: 'var(--qg-violet, #fff3c1)' }}>
            {sharedLinks.filter(l => !l.is_revoked && !l.is_destroyed && (!l.expires_at || new Date(l.expires_at) > new Date())).length}
          </div>
          <div style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>Active share links</div>
        </div>
        <div className="q-card stat-card animate-fade-in-up delay-400">
          <div className="stat-label">Encryption</div>
          <div className="stat-value" style={{ color: 'var(--qg-green)', fontSize: 14 }}>ML-KEM-768</div>
          <div style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>FIPS 203 + AES-256-GCM</div>
        </div>
      </div>

      {/* Encryption Progress Banner */}
      {encryptProgress && (
        <div className="q-card animate-fade-in-up" style={{
          marginBottom: 24,
          borderColor: encryptProgress.stage === 'error' ? 'var(--qg-red, #ef4444)'
            : encryptProgress.stage === 'complete' ? 'var(--qg-green)'
            : 'var(--qg-cyan)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: encryptProgress.stage === 'complete' ? 'var(--qg-green)'
                : encryptProgress.stage === 'error' ? 'var(--qg-red, #ef4444)'
                : 'var(--qg-cyan)',
              animation: encryptProgress.stage !== 'complete' && encryptProgress.stage !== 'error' ? 'pulse 1s infinite' : 'none',
            }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {encryptProgress.stage === 'complete' ? '🔐 Encryption Complete' :
               encryptProgress.stage === 'error' ? '❌ Encryption Failed' :
               '🔄 Encrypting File...'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--qg-text-muted)', marginLeft: 'auto' }}>
              {encryptProgress.percent}%
            </span>
          </div>
          <div className="q-progress" style={{ marginBottom: 8 }}>
            <div className="q-progress-bar" style={{
              width: `${encryptProgress.percent}%`,
              background: encryptProgress.stage === 'error' ? 'var(--qg-red, #ef4444)'
                : encryptProgress.stage === 'complete' ? 'var(--qg-green)' : undefined,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>
            {encryptProgress.message}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { id: 'files' as const, label: 'Files', icon: '📁' },
          { id: 'shared' as const, label: 'Shared Links', icon: '🔗' },
          { id: 'keys' as const, label: 'Key Vault', icon: '🔑' },
          { id: 'audit' as const, label: 'Audit Log', icon: '📋' },
        ].map((tab) => (
          <button key={tab.id}
            className={`q-btn ${activeTab === tab.id ? 'q-btn-primary' : 'q-btn-ghost'}`}
            style={{ padding: '8px 20px', fontSize: 12 }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Fetch Error Banner ───────────────────────────── */}
      {fetchError && (
        <div className="q-card animate-fade-in-up" style={{
          marginBottom: 16,
          padding: '12px 16px',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--qg-red, #ef4444)', fontWeight: 600, marginBottom: 2 }}>
              Vault Access Error
            </div>
            <div style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>{fetchError}</div>
          </div>
          <button
            type="button"
            onClick={() => { setFetchError(null); fetchFiles() }}
            className="q-btn q-btn-ghost"
            style={{ fontSize: 11, padding: '6px 12px', flexShrink: 0 }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Files Tab ────────────────────────────────────── */}
      {activeTab === 'files' && (
        <>
          {/* Verify Result Banner */}
          {verifyResult && (
            <div className="q-card animate-fade-in-up" style={{
              marginBottom: 16,
              background: verifyResult.valid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${verifyResult.valid ? 'var(--qg-green)' : 'var(--qg-red, #ef4444)'}`,
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                {verifyResult.valid ? '✅ Integrity Verified' : '⚠️ Integrity Check Failed'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>
                {verifyResult.fileName} — Storage: {verifyResult.checks.storageIntegrity ? 'OK' : 'FAIL'}
                {verifyResult.checks.hasSignature && ` | Signature: ${verifyResult.checks.signatureValid ? 'Valid' : 'INVALID'}`}
                {' | '}Verified at {formatDate(verifyResult.verifiedAt)}
              </div>
              <button className="q-btn q-btn-ghost" style={{ padding: '2px 8px', fontSize: 10, marginTop: 8 }}
                onClick={() => setVerifyResult(null)}>Dismiss</button>
            </div>
          )}

          <VaultFolderExplorer
            authHeaders={authHeaders}
            onFileAction={handleFileAction}
            onMoveFile={handleMoveFile}
            encrypting={encrypting}
            decrypting={decrypting}
            downloading={downloading}
            verifying={verifying}
            onFilesChanged={handleFolderFilesChanged}
            onFolderChanged={setCurrentFolderId}
          />
        </>
      )}

      {/* ── Keys Tab ─────────────────────────────────────── */}
      {activeTab === 'keys' && (
        <div className="q-card animate-fade-in-up">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16 }}>Key Vault</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="q-btn q-btn-secondary" style={{ padding: '8px 16px', fontSize: 11 }}
                disabled={!!keyActionLoading}
                onClick={() => requestConfirm(
                  'rotate',
                  'Generate a new ML-KEM-768 encryption key? The current active key will be deactivated. Existing encrypted files will still use their original keys.',
                  'encryption',
                )}>
                {keyActionLoading === 'encryption' ? '⏳ Rotating...' : '🔄 Rotate Encryption Key'}
              </button>
              <button className="q-btn q-btn-secondary" style={{ padding: '8px 16px', fontSize: 11 }}
                disabled={!!keyActionLoading}
                onClick={() => requestConfirm(
                  'rotate',
                  'Generate a new ML-DSA-65 signing key? The current active key will be deactivated.',
                  'signing',
                )}>
                {keyActionLoading === 'signing' ? '⏳ Rotating...' : '🔄 Rotate Signing Key'}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(212, 175, 55, 0.05)', border: '1px solid var(--qg-border)' }}>
            <div style={{ fontSize: 12, color: 'var(--qg-text-muted)', marginBottom: 4 }}>Key Rotation Policy</div>
            <div style={{ fontSize: 13 }}>Keys are automatically rotated every <strong>90 days</strong>. Private keys are encrypted at rest with per-user HKDF derivation.</div>
          </div>

          {/* Inline confirmation banner */}
          {pendingConfirm && (
            <div style={{
              marginBottom: 16,
              padding: '14px 18px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--qg-amber, #f59e0b)', marginBottom: 6 }}>
                    Confirm {pendingConfirm.action === 'rotate' ? 'Key Rotation' : 'Key Revocation'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--qg-text-muted)', lineHeight: 1.5, marginBottom: 12 }}>
                    {pendingConfirm.message}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="q-btn q-btn-primary"
                      style={{
                        padding: '7px 20px',
                        fontSize: 11,
                        letterSpacing: '0.08em',
                        background: pendingConfirm.action === 'revoke'
                          ? 'linear-gradient(135deg, #7f1d1d, #991b1b)'
                          : undefined,
                      }}
                      disabled={!!keyActionLoading}
                      onClick={() => handleKeyAction(
                        pendingConfirm.action,
                        pendingConfirm.keyType,
                        pendingConfirm.keyId,
                      )}
                    >
                      {keyActionLoading
                        ? `⏳ ${pendingConfirm.action === 'rotate' ? 'Rotating' : 'Revoking'}...`
                        : `✓ ${pendingConfirm.action === 'rotate' ? 'Rotate Key' : 'Revoke Key'}`}
                    </button>
                    <button
                      className="q-btn q-btn-ghost"
                      style={{ padding: '7px 16px', fontSize: 11 }}
                      disabled={!!keyActionLoading}
                      onClick={() => setPendingConfirm(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {keys.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--qg-text-muted)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔑</div>
              <div style={{ fontSize: 14 }}>No keys yet. Keys are generated when you encrypt your first file.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {keys.map((key) => (
                <div key={key.id} style={{
                  padding: '14px 16px', borderRadius: 'var(--radius-md)',
                  border: `1px solid ${key.isActive ? 'var(--qg-cyan)' : 'var(--qg-border)'}`,
                  background: key.isActive ? 'rgba(212, 175, 55, 0.03)' : 'transparent',
                  opacity: key.isActive ? 1 : 0.6,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 20 }}>{key.keyType === 'encryption' ? '🔐' : '✍️'}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {key.algorithm} — v{key.version}
                          {key.isActive && (
                            <span style={{ fontSize: 10, marginLeft: 8, color: 'var(--qg-green)', fontWeight: 400 }}>ACTIVE</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-text-muted)', marginTop: 2 }}>
                          {key.fingerprint}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--qg-text-muted)' }}>
                        {key.keyType === 'encryption' ? 'Encryption' : 'Signing'} Key
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--qg-text-muted)' }}>
                        Created: {formatDate(key.createdAt)}
                      </div>
                      {key.expiresAt && (
                        <div style={{ fontSize: 10, color: new Date(key.expiresAt) < new Date() ? 'var(--qg-red, #ef4444)' : 'var(--qg-text-muted)' }}>
                          Expires: {formatDate(key.expiresAt)}
                        </div>
                      )}
                    </div>
                  </div>
                  {key.isActive && (
                    <div style={{ marginTop: 8 }}>
                      <button className="q-btn q-btn-ghost" style={{ padding: '3px 10px', fontSize: 10 }}
                        disabled={!!keyActionLoading}
                        onClick={() => requestConfirm(
                          'revoke',
                          `Revoke this ${key.keyType} key (${key.algorithm})? This cannot be undone. Files encrypted with this key can still be decrypted, but no new files will use it.`,
                          undefined,
                          key.id,
                        )}>
                        {keyActionLoading === key.id ? '⏳ Revoking...' : 'Revoke'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Audit Tab ────────────────────────────────────── */}
      {activeTab === 'audit' && (
        <div className="q-card animate-fade-in-up">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16 }}>Security Audit Log</h3>
            <button className="q-btn q-btn-ghost" style={{ padding: '8px 16px', fontSize: 11 }}
              onClick={fetchAudit}>
              🔄 Refresh
            </button>
          </div>

          <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(212, 175, 55, 0.05)', border: '1px solid var(--qg-border)', fontSize: 12, color: 'var(--qg-text-muted)' }}>
            All vault operations generate immutable, hash-chained audit events for tamper detection.
          </div>

          {auditEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--qg-text-muted)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 14 }}>No audit events yet.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {auditEvents.map((event) => (
                <div key={event.id} style={{
                  padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--qg-border)',
                  borderLeftWidth: 3,
                  borderLeftColor: severityColor(event.severity),
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{eventIcon(event.event_type)}</span>
                    <span style={{ fontSize: 13, flex: 1 }}>{event.description}</span>
                    <span style={{
                      fontSize: 9, padding: '2px 6px', borderRadius: 4,
                      background: `${severityColor(event.severity)}22`,
                      color: severityColor(event.severity),
                      textTransform: 'uppercase',
                      fontWeight: 600,
                    }}>
                      {event.severity}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--qg-text-muted)', marginTop: 4, marginLeft: 26 }}>
                    {event.event_type.replace(/_/g, ' ')} | {event.resource_type}
                    {event.resource_id && ` | ${event.resource_id.slice(0, 8)}...`}
                    {' | '}{formatDate(event.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Shared Links Tab ───────────────────────────────── */}
      {activeTab === 'shared' && (
        <div className="q-card animate-fade-in-up">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16 }}>Shared Links</h3>
            <button className="q-btn q-btn-ghost" style={{ padding: '8px 16px', fontSize: 11 }}
              onClick={fetchSharedLinks}>
              🔄 Refresh
            </button>
          </div>

          <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(255, 243, 193, 0.05)', border: '1px solid var(--qg-border)', fontSize: 12, color: 'var(--qg-text-muted)' }}>
            Zero-knowledge share links. Decryption keys are embedded in the URL fragment and never stored on our servers.
          </div>

          {sharedLinks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--qg-text-muted)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔗</div>
              <div style={{ fontSize: 14 }}>No shared links yet.</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Use the Share button on any file to create a secure link.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sharedLinks.map((link) => {
                const isExpired = link.expires_at && new Date(link.expires_at) < new Date()
                const isLimitReached = link.max_downloads !== null && link.download_count >= link.max_downloads
                const isDestroyed = link.is_destroyed
                const isActive = !link.is_revoked && !isExpired && !isLimitReached && !isDestroyed

                return (
                  <div key={link.id} style={{
                    padding: '14px 16px', borderRadius: 'var(--radius-md)',
                    border: `1px solid ${isDestroyed ? 'rgba(239, 68, 68, 0.3)' : isActive ? 'var(--qg-violet, #fff3c1)' : 'var(--qg-border)'}`,
                    background: isDestroyed ? 'rgba(239, 68, 68, 0.03)' : isActive ? 'rgba(255, 243, 193, 0.03)' : 'transparent',
                    opacity: isActive ? 1 : 0.6,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 14 }}>{isDestroyed ? '💀' : '📄'}</span>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{link.original_filename}</span>
                          {link.is_password_protected && (
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(245, 158, 11, 0.15)', color: 'var(--qg-amber, #f59e0b)' }}>
                              Password
                            </span>
                          )}
                          {isDestroyed && (
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(239, 68, 68, 0.2)', color: 'var(--qg-red, #ef4444)', fontWeight: 700 }}>
                              Destroyed (3 failed attempts)
                            </span>
                          )}
                          {link.is_revoked && !isDestroyed && (
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(239, 68, 68, 0.15)', color: 'var(--qg-red, #ef4444)' }}>
                              Revoked
                            </span>
                          )}
                          {isExpired && !link.is_revoked && !isDestroyed && (
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(245, 158, 11, 0.15)', color: 'var(--qg-amber, #f59e0b)' }}>
                              Expired
                            </span>
                          )}
                          {isLimitReached && !link.is_revoked && !isExpired && !isDestroyed && (
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(245, 158, 11, 0.15)', color: 'var(--qg-amber, #f59e0b)' }}>
                              Limit Reached
                            </span>
                          )}
                          {isActive && (
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.15)', color: 'var(--qg-green, #10b981)' }}>
                              Active
                            </span>
                          )}
                          {/* Password attempt indicator for active password-protected links */}
                          {link.is_password_protected && !isDestroyed && link.failed_password_attempts > 0 && (
                            <span style={{
                              fontSize: 9, padding: '2px 6px', borderRadius: 4,
                              background: link.failed_password_attempts >= 2 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: link.failed_password_attempts >= 2 ? 'var(--qg-red, #ef4444)' : 'var(--qg-amber, #f59e0b)',
                            }}>
                              {link.failed_password_attempts}/3 failed
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--qg-text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <span>{formatFileSize(link.original_size)}</span>
                          <span>Downloads: {link.download_count}{link.max_downloads !== null ? `/${link.max_downloads}` : ''}</span>
                          {link.expires_at && (
                            <span>Expires: {formatDate(link.expires_at)}</span>
                          )}
                          <span>Created: {formatDate(link.created_at)}</span>
                          {link.last_accessed_at && (
                            <span>Last access: {formatDate(link.last_accessed_at)}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginLeft: 12, flexShrink: 0 }}>
                        {isActive && (
                          <button
                            className="q-btn q-btn-ghost"
                            style={{ padding: '4px 10px', fontSize: 10, color: 'var(--qg-amber, #f59e0b)' }}
                            onClick={() => handleRevokeLink(link.id)}
                            disabled={revokingLink === link.id}
                          >
                            {revokingLink === link.id ? '⏳' : '🚫'} Revoke
                          </button>
                        )}
                        <button
                          className="q-btn q-btn-ghost"
                          style={{ padding: '4px 10px', fontSize: 10, color: 'var(--qg-red, #ef4444)' }}
                          onClick={() => handleDeleteLink(link.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Share Link Modal ───────────────────────────────── */}
      {shareModalFile && (
        <ShareLinkModal
          fileId={shareModalFile.id}
          fileName={shareModalFile.name}
          isOpen={true}
          onClose={() => setShareModalFile(null)}
          onShareCreated={() => {
            if (activeTab === 'shared') fetchSharedLinks()
          }}
          authHeaders={authHeaders}
          getFileData={getPlaintextForSharing(shareModalFile.id)}
        />
      )}

      {/* ── Move To Modal ──────────────────────────────────── */}
      {moveModalTarget && (
        <MoveToModal
          authHeaders={authHeaders}
          itemName={moveModalTarget.name}
          itemType={moveModalTarget.type}
          currentFolderId={currentFolderId}
          onMove={handleMoveConfirm}
          onCancel={() => setMoveModalTarget(null)}
        />
      )}
    </div>
  )
}
