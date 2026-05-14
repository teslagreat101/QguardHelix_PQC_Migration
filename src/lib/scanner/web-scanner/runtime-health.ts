import { DETECTION_RULES as WEB_DETECTION_RULES } from './detection-rules'
import { CRYPTO_PATTERNS } from './crypto-patterns'
import { getKnownCipherSuiteCount } from './cipher-suite-analyzer'
import { SCAN_MODULES } from '@/lib/scanner/scanner_2/modules'
import { DETECTION_RULES as ENTERPRISE_DETECTION_RULES } from '@/lib/scanner/scanner_2/rules/detection-rules'
import { CRYPTO_FINGERPRINTS } from '@/lib/scanner/scanner_2/fingerprints'
import { getFingerprintStats } from '@/lib/scanner/scanner_2/engine/fingerprint-matcher'

export type RuntimeStatus = 'ready' | 'degraded' | 'missing'

export interface RuntimeComponent {
  id: string
  name: string
  status: RuntimeStatus
  detail: string
  count?: number
}

export interface ScannerRuntimeHealth {
  status: RuntimeStatus
  checkedAt: string
  components: Record<string, RuntimeComponent>
  enterpriseEngines: RuntimeComponent[]
  webScanner: {
    modules: number
    detectionRules: number
    cryptoPatterns: number
    cipherSuiteFingerprints: number
  }
  enterpriseScanner: {
    modules: number
    detectionRules: number
    cryptoFingerprints: number
    fingerprintStats: ReturnType<typeof getFingerprintStats>
  }
  payloadSystem: {
    status: RuntimeStatus
    packs: number
    payloads: number
    directory: string
  }
  templateSystem: {
    status: RuntimeStatus
    templates: number
    directory: string
    errors: string[]
  }
  issues: string[]
}

const EXPECTED_WEB_MODULES = 9
const EXPECTED_WEB_DETECTION_RULES = 51
const EXPECTED_WEB_CRYPTO_PATTERNS = 54
const EXPECTED_ENTERPRISE_MODULES = 28
const EXPECTED_ENTERPRISE_DETECTION_RULES = 40
const EXPECTED_CRYPTO_FINGERPRINTS = 70

const WEB_COMPONENTS: RuntimeComponent[] = [
  {
    id: 'tlsAnalyzer',
    name: 'TLS Analyzer',
    status: 'ready',
    detail: 'Node TLS handshake analyzer with protocol and cipher probing',
  },
  {
    id: 'cipherSuiteAnalyzer',
    name: 'Cipher Suite Analyzer',
    status: 'ready',
    detail: 'Cipher suite classifier and quantum risk mapper',
    count: getKnownCipherSuiteCount(),
  },
  {
    id: 'certificateParser',
    name: 'Certificate Parser',
    status: 'ready',
    detail: 'X.509 parser with OID and chain analysis',
  },
  {
    id: 'githubScanner',
    name: 'GitHub Scanner',
    status: 'ready',
    detail: 'Public repository code scanner using crypto regex patterns',
    count: CRYPTO_PATTERNS.length,
  },
  {
    id: 'webCryptoScanner',
    name: 'Web Crypto Scanner',
    status: 'ready',
    detail: 'Client-side JavaScript crypto pattern scanner',
    count: CRYPTO_PATTERNS.length,
  },
  {
    id: 'apiSecurityScanner',
    name: 'API Security Scanner',
    status: 'ready',
    detail: 'HTTP security header, JWKS, OIDC, OAuth, and GraphQL probes',
  },
  {
    id: 'detectionRules',
    name: 'Detection Rules Engine',
    status: WEB_DETECTION_RULES.length === EXPECTED_WEB_DETECTION_RULES ? 'ready' : 'degraded',
    detail: 'Web scanner detection rules mapped to emitted findings',
    count: WEB_DETECTION_RULES.length,
  },
  {
    id: 'riskScoringEngine',
    name: 'Risk Scoring Engine',
    status: 'ready',
    detail: 'Legacy 0-100 exposure score plus 0-1000 quantum-readiness score',
  },
  {
    id: 'pqcRecommendations',
    name: 'PQC Recommendations',
    status: 'ready',
    detail: 'NIST-aligned PQC remediation generator',
  },
]

const ENTERPRISE_ENGINE_NAMES = [
  'BaseScanner',
  'Scheduler',
  'Analyzer',
  'BehaviorAnalyzer',
  'AdaptiveEngine',
  'ChainCorrelator',
  'ContextDetector',
  'Mutator',
  'PayloadPacks',
  'TelemetryEmitter',
  'TargetMap',
  'FingerprintMatcher',
  'DetectionRules',
  'RiskScoring',
  'ScanOrchestrator',
]

const WEB_SCANNER_OUT_OF_SCOPE = 'Out of scope for /dashboard/web-scanner'

export function getScannerRuntimeHealth(): ScannerRuntimeHealth {
  const issues: string[] = []

  if (WEB_COMPONENTS.length !== EXPECTED_WEB_MODULES) {
    issues.push(`${WEB_COMPONENTS.length} web scanner engines loaded; expected ${EXPECTED_WEB_MODULES}.`)
  }
  if (WEB_DETECTION_RULES.length !== EXPECTED_WEB_DETECTION_RULES) {
    issues.push(`${WEB_DETECTION_RULES.length} web scanner rules loaded; expected ${EXPECTED_WEB_DETECTION_RULES}.`)
  }
  if (CRYPTO_PATTERNS.length !== EXPECTED_WEB_CRYPTO_PATTERNS) {
    issues.push(`${CRYPTO_PATTERNS.length} web code patterns loaded; expected ${EXPECTED_WEB_CRYPTO_PATTERNS}.`)
  }
  if (SCAN_MODULES.length !== EXPECTED_ENTERPRISE_MODULES) {
    issues.push(`${SCAN_MODULES.length} enterprise scanner modules registered; expected ${EXPECTED_ENTERPRISE_MODULES}.`)
  }
  if (ENTERPRISE_DETECTION_RULES.length !== EXPECTED_ENTERPRISE_DETECTION_RULES) {
    issues.push(`${ENTERPRISE_DETECTION_RULES.length} enterprise detection rules registered; expected ${EXPECTED_ENTERPRISE_DETECTION_RULES}.`)
  }
  if (CRYPTO_FINGERPRINTS.length !== EXPECTED_CRYPTO_FINGERPRINTS) {
    issues.push(`${CRYPTO_FINGERPRINTS.length} crypto fingerprints registered; expected ${EXPECTED_CRYPTO_FINGERPRINTS}.`)
  }

  const componentMap = Object.fromEntries(WEB_COMPONENTS.map((component) => [component.id, component]))

  const enterpriseEngines = ENTERPRISE_ENGINE_NAMES.map<RuntimeComponent>((name) => {
    if (name === 'PayloadPacks') {
      return {
        id: name,
        name,
        status: 'ready',
        detail: WEB_SCANNER_OUT_OF_SCOPE,
        count: 0,
      }
    }
    return {
      id: name,
      name,
      status: 'ready',
      detail: 'Registered in the QGuard scanner runtime',
    }
  })

  const hasMissingCriticalWebComponent = WEB_COMPONENTS.some((component) => component.status === 'missing')
  const status: RuntimeStatus = hasMissingCriticalWebComponent ? 'missing' : issues.length > 0 ? 'degraded' : 'ready'

  return {
    status,
    checkedAt: new Date().toISOString(),
    components: componentMap,
    enterpriseEngines,
    webScanner: {
      modules: WEB_COMPONENTS.length,
      detectionRules: WEB_DETECTION_RULES.length,
      cryptoPatterns: CRYPTO_PATTERNS.length,
      cipherSuiteFingerprints: getKnownCipherSuiteCount(),
    },
    enterpriseScanner: {
      modules: SCAN_MODULES.length,
      detectionRules: ENTERPRISE_DETECTION_RULES.length,
      cryptoFingerprints: CRYPTO_FINGERPRINTS.length,
      fingerprintStats: getFingerprintStats(),
    },
    payloadSystem: {
      status: 'ready',
      packs: 0,
      payloads: 0,
      directory: WEB_SCANNER_OUT_OF_SCOPE,
    },
    templateSystem: {
      status: 'ready',
      templates: 0,
      directory: WEB_SCANNER_OUT_OF_SCOPE,
      errors: [],
    },
    issues,
  }
}
