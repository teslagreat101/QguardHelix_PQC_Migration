/**
 * ASSET INPUT VALIDATOR & SANITIZER
 * Validates, sanitizes, and classifies user-provided scan targets.
 */

export type AssetType = 'ipv4' | 'ipv6' | 'domain' | 'url' | 'hostname' | 'subnet' | 'unknown';

export type ValidatedAsset = {
  raw: string;
  normalized: string;
  type: AssetType;
  host: string;
  port: number | null;
  protocol: string | null;
  valid: boolean;
  error: string | null;
};

const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV4_CIDR_RE = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
const IPV6_RE = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
const DOMAIN_RE = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const HOSTNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
const URL_RE = /^(?:https?|ssh):\/\/.+/i;
const PORT_RE = /:(\d{1,5})$/;

// Dangerous patterns to reject
const BLOCKLIST = [
  /[<>{}|\\^`]/,          // shell injection chars
  /\.\.\//,               // path traversal
  /javascript:/i,         // XSS
  /data:/i,               // data URI
  /file:/i,               // local file
  /[\x00-\x1f\x7f]/,     // control characters
];

function isValidIPv4(ip: string): boolean {
  if (!IPV4_RE.test(ip)) return false;
  return ip.split('.').every(o => { const n = parseInt(o); return n >= 0 && n <= 255; });
}

function isValidCIDR(cidr: string): boolean {
  if (!IPV4_CIDR_RE.test(cidr)) return false;
  const [ip, mask] = cidr.split('/');
  if (!isValidIPv4(ip)) return false;
  const m = parseInt(mask);
  return m >= 0 && m <= 32;
}

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port > 0 && port <= 65535;
}

function sanitize(input: string): string {
  return input.trim().replace(/\s+/g, '').toLowerCase();
}

export function validateAsset(raw: string): ValidatedAsset {
  const cleaned = sanitize(raw);

  const base: ValidatedAsset = {
    raw,
    normalized: cleaned,
    type: 'unknown',
    host: '',
    port: null,
    protocol: null,
    valid: false,
    error: null,
  };

  if (!cleaned || cleaned.length === 0) {
    return { ...base, error: 'Empty input' };
  }

  if (cleaned.length > 2048) {
    return { ...base, error: 'Input exceeds maximum length (2048 chars)' };
  }

  // Check blocklist
  for (const pattern of BLOCKLIST) {
    if (pattern.test(raw)) {
      return { ...base, error: 'Input contains prohibited characters' };
    }
  }

  // URL
  if (URL_RE.test(cleaned)) {
    try {
      const url = new URL(cleaned);
      const protocol = url.protocol.replace(':', '');
      const defaultPort = protocol === 'ssh' ? 22 : protocol === 'https' ? 443 : 80;
      return {
        ...base,
        normalized: cleaned,
        type: 'url',
        host: url.hostname,
        port: url.port ? parseInt(url.port) : defaultPort,
        protocol,
        valid: true,
      };
    } catch {
      return { ...base, error: 'Invalid URL format' };
    }
  }

  // Strip optional port for host-level checks
  let hostPart = cleaned;
  let port: number | null = null;
  const portMatch = cleaned.match(PORT_RE);
  if (portMatch && !IPV6_RE.test(cleaned)) {
    port = parseInt(portMatch[1]);
    if (!isValidPort(port)) {
      return { ...base, error: `Invalid port: ${portMatch[1]}` };
    }
    hostPart = cleaned.replace(PORT_RE, '');
  }

  // IPv4 CIDR Subnet
  if (isValidCIDR(hostPart)) {
    return { ...base, type: 'subnet', host: hostPart, port, valid: true };
  }

  // IPv4
  if (isValidIPv4(hostPart)) {
    return { ...base, type: 'ipv4', host: hostPart, port: port || 443, valid: true };
  }

  // IPv6
  if (IPV6_RE.test(hostPart)) {
    return { ...base, type: 'ipv6', host: hostPart, port: port || 443, valid: true };
  }

  // Domain
  if (DOMAIN_RE.test(hostPart)) {
    return { ...base, type: 'domain', host: hostPart, port: port || 443, protocol: 'https', valid: true };
  }

  // Hostname (internal)
  if (HOSTNAME_RE.test(hostPart)) {
    return { ...base, type: 'hostname', host: hostPart, port: port || 443, valid: true };
  }

  return { ...base, error: 'Unrecognized asset format. Use IP, domain, URL, or hostname.' };
}

/**
 * Parse multi-line or comma-separated input into individual assets.
 */
export function parseAssetInput(input: string): ValidatedAsset[] {
  const lines = input
    .split(/[\n,;]+/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  return lines.map(line => validateAsset(line));
}

/**
 * Deduplicate validated assets by normalized host.
 */
export function deduplicateAssets(assets: ValidatedAsset[]): ValidatedAsset[] {
  const seen = new Set<string>();
  return assets.filter(a => {
    const key = `${a.host}:${a.port}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
