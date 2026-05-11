import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Audit service for the Quantum Vault.
 * Records security-sensitive operations and rate-limiting events.
 */

export async function logFileUpload(userId: string, fileId: string, fileName: string, ip: string | undefined, client: SupabaseClient) {
  return client.from('vault_audit_logs').insert({
    user_id: userId,
    event_type: 'file_uploaded',
    severity: 'info',
    resource_type: 'file',
    resource_id: fileId,
    description: `Uploaded file: ${fileName}`,
    ip_address: ip
  })
}

export async function logFileEncrypted(userId: string, fileId: string, fileName: string, keyId: string, ip: string | undefined, client: SupabaseClient) {
  return client.from('vault_audit_logs').insert({
    user_id: userId,
    event_type: 'file_encrypted',
    severity: 'info',
    resource_type: 'file',
    resource_id: fileId,
    description: `Encrypted file: ${fileName} with key ${keyId}`,
    ip_address: ip
  })
}

export async function logFileDecrypted(userId: string, fileId: string, fileName: string, ip: string | undefined, client: SupabaseClient) {
  return client.from('vault_audit_logs').insert({
    user_id: userId,
    event_type: 'file_decrypted',
    severity: 'info',
    resource_type: 'file',
    resource_id: fileId,
    description: `Decrypted file: ${fileName}`,
    ip_address: ip
  })
}

export async function logFileDeleted(userId: string, fileId: string, fileName: string, ip: string | undefined, client: SupabaseClient) {
  return client.from('vault_audit_logs').insert({
    user_id: userId,
    event_type: 'file_deleted',
    severity: 'warning',
    resource_type: 'file',
    resource_id: fileId,
    description: `Deleted file: ${fileName}`,
    ip_address: ip
  })
}

export async function logKeyGenerated(userId: string, keyId: string, keyType: string, algorithm: string, ip: string | undefined, client: SupabaseClient) {
  return client.from('vault_audit_logs').insert({
    user_id: userId,
    event_type: 'key_generated',
    severity: 'info',
    resource_type: 'key',
    resource_id: keyId,
    description: `Generated ${keyType} key using ${algorithm}`,
    ip_address: ip
  })
}

export async function logIntegrityFailure(userId: string, fileId: string, fileName: string, ip: string | undefined, client: SupabaseClient) {
  return client.from('vault_audit_logs').insert({
    user_id: userId,
    event_type: 'integrity_failed',
    severity: 'critical',
    resource_type: 'file',
    resource_id: fileId,
    description: `CRITICAL: Integrity check failed for file: ${fileName}`,
    ip_address: ip
  })
}

export async function logAccessDenied(userId: string, action: string, reason: string, ip: string | undefined, client: SupabaseClient) {
  return client.from('vault_audit_logs').insert({
    user_id: userId,
    event_type: 'access_denied',
    severity: 'warning',
    resource_type: 'system',
    description: `Access denied for ${action}: ${reason}`,
    ip_address: ip
  })
}

export async function logRateLimited(userId: string, action: string, ip: string | undefined, client: SupabaseClient) {
  return client.from('vault_audit_logs').insert({
    user_id: userId,
    event_type: 'rate_limited',
    severity: 'warning',
    resource_type: 'system',
    description: `Rate limit exceeded for action: ${action}`,
    ip_address: ip
  })
}

/**
 * Basic rate limiting check.
 * In production, this would use Redis or a similar fast cache.
 */
export async function checkRateLimit(userId: string, action: string, client: SupabaseClient): Promise<boolean> {
  // Simple check: count events of the same type in the last minute
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString()
  
  const { count, error } = await client
    .from('vault_audit_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('event_type', action === 'upload' ? 'file_uploaded' : action === 'decrypt' ? 'file_decrypted' : 'rate_limited')
    .gt('created_at', oneMinuteAgo)

  if (error) return true // Fail open on DB error
  
  const limit = action === 'upload' ? 10 : 30
  return (count || 0) < limit
}
