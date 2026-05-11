'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Shield, Scan, RefreshCw, KeyRound, Lock, Activity, Zap,
  ChevronRight, BookOpen, Terminal, Rocket, HelpCircle,
  CheckCircle, Code, ArrowRight, ExternalLink, Menu, X,
} from 'lucide-react'

/* ─────────────────────────────────────────────
   Sidebar navigation structure
───────────────────────────────────────────── */
const NAV = [
  {
    section: 'Getting Started',
    icon: Rocket,
    items: [
      { id: 'overview',      label: 'Platform Overview'    },
      { id: 'quickstart',    label: 'Quick Start Guide'    },
      { id: 'account-setup', label: 'Account Setup'        },
      { id: 'dashboard',     label: 'Dashboard Walkthrough'},
    ],
  },
  {
    section: 'Core Features',
    icon: Shield,
    items: [
      { id: 'scanner',    label: 'Quantum Vulnerability Scanner' },
      { id: 'migration',  label: 'PQC Migration Wizard'          },
      { id: 'keygen',     label: 'Quantum Key Generator'         },
      { id: 'vault',      label: 'Quantum Vault'                 },
      { id: 'monitoring', label: 'Continuous Monitoring'         },
      { id: 'simulator',  label: 'Threat Simulator'              },
    ],
  },
  {
    section: 'QRNG Services',
    icon: Zap,
    items: [
      { id: 'otp',        label: 'OTP / Multi-Factor Auth'       },
      { id: 'pki-certs',  label: 'PKI Certificate Authority'     },
      { id: 'tokenize',   label: 'Data Tokenization'             },
      { id: 'comm',       label: 'Secure Communications'         },
      { id: 'cloud-seed', label: 'Cloud Infrastructure Seeding'  },
      { id: 'key-mgmt',   label: 'Encryption Key Management'     },
    ],
  },
  {
    section: 'Tutorials',
    icon: Terminal,
    items: [
      { id: 'tutorial-scan',      label: 'Run Your First Scan'       },
      { id: 'tutorial-migrate',   label: 'Migrate RSA to ML-KEM'     },
      { id: 'tutorial-vault',     label: 'Store Files in the Vault'  },
      { id: 'tutorial-keygen',    label: 'Generate QRNG Keys'        },
      { id: 'tutorial-otp',       label: 'Quantum OTP Setup'         },
      { id: 'tutorial-pki',       label: 'Issue PQC Certificates'    },
      { id: 'tutorial-tokenize',  label: 'Tokenize Sensitive Data'   },
      { id: 'tutorial-comm',      label: 'Secure Messaging Setup'    },
      { id: 'tutorial-cloud',     label: 'Seed Cloud Infrastructure' },
    ],
  },
  {
    section: 'Reference',
    icon: Code,
    items: [
      { id: 'algorithms',  label: 'Supported Algorithms'  },
      { id: 'q-score',     label: 'Q-Score Explained'     },
      { id: 'compliance',  label: 'NIST FIPS Compliance'  },
      { id: 'faq-docs',    label: 'FAQ'                   },
    ],
  },
  {
    section: 'Business',
    icon: HelpCircle,
    items: [
      { id: 'why-quantum',  label: 'Why Quantum Security Now'  },
      { id: 'ciso-brief',   label: 'Enterprise CISO Brief'     },
      { id: 'use-cases',    label: 'Industry Use Cases'        },
    ],
  },
  {
    section: 'Operational',
    icon: Activity,
    items: [
      { id: 'deployment',   label: 'Deployment Guide'          },
      { id: 'rate-limits',  label: 'Rate Limits & SLAs'        },
      { id: 'audit-trails', label: 'Monitoring & Audit'        },
    ],
  },
  {
    section: 'Developer',
    icon: Code,
    items: [
      { id: 'api-docs', label: 'API Documentation →' },
    ],
  },
]

/* ─────────────────────────────────────────────
   Doc content sections
───────────────────────────────────────────── */
const SECTIONS: Record<string, React.ReactNode> = {

  /* ── GETTING STARTED ── */
  overview: (
    <Doc title="Platform Overview" badge="Introduction">
      <P>Qguard Helix is the world's first consumer-grade quantum cybersecurity platform. It detects cryptographic vulnerabilities that will be broken by quantum computers, automates migration to NIST-approved post-quantum algorithms, and provides ongoing protection for your digital life.</P>
      <H2>Why Quantum Security Now?</H2>
      <P>Quantum computers are advancing rapidly. Nation-state actors are already running <Strong>Harvest Now, Decrypt Later (HNDL)</Strong> attacks — capturing your encrypted data today to decrypt it once quantum computers are powerful enough. Experts estimate Q-Day (the day a quantum computer breaks RSA-2048) could arrive between 2030–2040.</P>
      <P>QGuard gives you the tools to act before it's too late.</P>
      <H2>Platform Modules</H2>
      <Grid>
        <FeatureCard icon={Scan}       color="var(--qg-cyan)"   title="Scanner"    desc="Detect RSA, ECC, SHA-1 and weak TLS across devices, files and cloud" />
        <FeatureCard icon={RefreshCw}  color="var(--qg-violet)" title="Migration"  desc="One-click migration to ML-KEM and ML-DSA with hybrid compatibility" />
        <FeatureCard icon={KeyRound}   color="var(--qg-green)"  title="Key Gen"    desc="True quantum-random key generation with ≥99.7% entropy quality" />
        <FeatureCard icon={Lock}       color="var(--qg-cyan)"   title="Vault"      desc="Zero-knowledge PQC-encrypted file storage and secure messaging" />
        <FeatureCard icon={Activity}   color="var(--qg-violet)" title="Monitoring" desc="Always-on background scanning with real-time Q-Score alerts" />
        <FeatureCard icon={Zap}        color="var(--qg-amber)"  title="Simulator"  desc="Live Shor's algorithm demo — see your RSA keys cracked in real time" />
      </Grid>
    </Doc>
  ),

  quickstart: (
    <Doc title="Quick Start Guide" badge="Getting Started">
      <P>Get quantum-safe in under 15 minutes. Follow these steps to go from zero to fully protected.</P>
      <Steps>
        <Step n={1} title="Create your account">Go to <InlineCode>/register</InlineCode> and sign up with your email. A verification link will be sent — confirm it to activate your account.</Step>
        <Step n={2} title="Run your first scan">Navigate to <strong>Dashboard → Scanner</strong>. Click <strong>Start Scan</strong>. QGuard will analyse your connected devices, files, and cloud accounts for quantum-vulnerable cryptography and generate your <strong>Q-Score</strong>.</Step>
        <Step n={3} title="Review your Q-Score">Your Q-Score (0–100) reflects your overall quantum readiness. A score below 60 means critical vulnerabilities exist. The scanner report lists every finding with severity, location, and recommended remediation.</Step>
        <Step n={4} title="Run the Migration Wizard">For each critical finding, click <strong>Migrate</strong>. The wizard replaces legacy algorithms with NIST FIPS 203/204 compliant post-quantum equivalents. Enable <strong>Hybrid Mode</strong> to maintain backward compatibility during transition.</Step>
        <Step n={5} title="Enable Continuous Monitoring">Toggle monitoring <strong>ON</strong> in Settings. QGuard runs background scans and alerts you whenever new quantum vulnerabilities are detected in your environment.</Step>
      </Steps>
      <Callout type="success">After completing these steps your Q-Score should reach 85+ and you will be protected against all known quantum attack vectors as of NIST PQC Round 3 finalists.</Callout>
    </Doc>
  ),

  'account-setup': (
    <Doc title="Account Setup" badge="Getting Started">
      <H2>Registration</H2>
      <P>Visit <InlineCode>/register</InlineCode> to create your free account. Enter your email, choose a strong password, and verify your email address. No credit card is required for the Free tier.</P>
      <H2>Profile & Security Settings</H2>
      <P>After logging in, navigate to <strong>Dashboard → Settings</strong> to configure:</P>
      <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {['Two-factor authentication (TOTP or hardware key)', 'Notification preferences for scan alerts', 'Connected cloud accounts (Google Drive, OneDrive, Dropbox)', 'Family sharing — invite up to 5 users (Pro/Elite plans)', 'Billing and plan management'].map(i => <Li key={i}>{i}</Li>)}
      </ul>
      <H2>Plans</H2>
      <Table
        heads={['Feature', 'Free', 'Pro ($10/mo)', 'Elite ($50/mo)']}
        rows={[
          ['Quantum Scans',        '5 scans',     'Unlimited',   'Unlimited'       ],
          ['PQC Migration Wizard', '—',           '✓',           '✓'               ],
          ['QRNG Keys',           '5/day',       'Unlimited',   'Unlimited'       ],
          ['Quantum Vault',       '5 GB / 1 mo', '50 GB / 2 yr','100 GB / 5 yr'  ],
          ['Family Sharing',      '—',           '2 users',     'Up to 5 users'   ],
          ['Quantum Messaging',   '—',           '✓',           '✓'               ],
          ['Priority Support',    '—',           '✓',           '✓'               ],
        ]}
      />
    </Doc>
  ),

  dashboard: (
    <Doc title="Dashboard Walkthrough" badge="Getting Started">
      <P>The QGuard dashboard is your central command for quantum security. Here's what each section does.</P>
      <H2>Overview Panel</H2>
      <P>The landing page of your dashboard shows your live <strong>Q-Score</strong>, the number of active vulnerabilities, last scan time, and a summary of each module's status. The Q-Score gauge updates automatically after every scan.</P>
      <H2>Sidebar Modules</H2>
      <Table
        heads={['Module', 'What You Can Do']}
        rows={[
          ['Scanner',       'Run on-demand scans, view scan history, export reports'   ],
          ['Migrate',       'Review migration queue, apply PQC patches, rollback'      ],
          ['Keys',          'Generate QRNG key pairs, export, revoke, push to HSM'     ],
          ['Vault',         'Upload/download files, share encrypted links, set expiry' ],
          ['Monitoring',    'View real-time alerts, configure alert rules, view trend'  ],
          ['Simulator',     'Run Shor\'s attack demo, compare classic vs PQC timing'   ],
          ['Web Scanner',   'Audit external URLs for weak TLS, expired certs, HNDL risk'],
          ['Settings',      'Account, 2FA, billing, notifications, family sharing'     ],
        ]}
      />
      <H2>Q-Score Explained</H2>
      <P>Your Q-Score is calculated from the severity and count of vulnerabilities detected. 100 = fully quantum-safe. Each unmitigated RSA/ECC key reduces your score. Migrating findings improves it in real time.</P>
    </Doc>
  ),

  /* ── CORE FEATURES ── */
  scanner: (
    <Doc title="Quantum Vulnerability Scanner" badge="Core Feature">
      <P>The Scanner is QGuard's detection engine. It identifies every cryptographic primitive in your environment that is vulnerable to quantum attack — and assigns each finding a severity level.</P>
      <H2>What It Detects</H2>
      <Table
        heads={['Algorithm', "Why It's Vulnerable", 'Severity']}
        rows={[
          ['RSA-1024 / RSA-2048', "Shor's algorithm breaks it in polynomial time", 'Critical'],
          ['ECDSA / ECDH',        "Shor's algorithm solves ECDLP exponentially faster", 'Critical'],
          ['Diffie-Hellman',      'Quantum speedup breaks key exchange',             'High'    ],
          ['SHA-1',               'Grover\'s algorithm halves effective security',   'Medium'  ],
          ['AES-128',             'Grover reduces to 64-bit effective security',     'Low'     ],
          ['MD5',                 'Already broken classically + Grover speed-up',    'Critical'],
        ]}
      />
      <H2>Running a Scan</H2>
      <Steps>
        <Step n={1} title="Select scope">Choose from: Device Files, Cloud Storage, Git Repositories, TLS/SSL Certificates, or Custom Path.</Step>
        <Step n={2} title="Start scan">Click Start Scan. The engine performs deep static analysis and certificate inspection. Average scan time: 3–5 minutes.</Step>
        <Step n={3} title="Review findings">Each finding shows: algorithm type, file/service location, severity, estimated years until breakable, and a one-click migration action.</Step>
        <Step n={4} title="Export report">Export a PDF compliance report (NIST FIPS aligned) for audit purposes from the top-right of the scan results.</Step>
      </Steps>
      <Callout type="info">The scanner runs locally first. Only anonymised metadata is sent to QGuard servers for Q-Score calculation — your actual files and data never leave your device.</Callout>
    </Doc>
  ),

  migration: (
    <Doc title="PQC Migration Wizard" badge="Core Feature">
      <P>The Migration Wizard replaces every quantum-vulnerable algorithm in your stack with a NIST-approved post-quantum equivalent — with a single click.</P>
      <H2>Supported Replacements</H2>
      <Table
        heads={['Legacy Algorithm', 'PQC Replacement', 'Standard']}
        rows={[
          ['RSA (encryption)',   'ML-KEM (Kyber)',   'NIST FIPS 203'],
          ['ECDSA (signatures)', 'ML-DSA (Dilithium)','NIST FIPS 204'],
          ['RSA-PSS',           'SPHINCS+',          'NIST FIPS 205'],
          ['ECDH',              'ML-KEM',            'NIST FIPS 203'],
          ['SHA-1 / MD5',       'SHA-3 / BLAKE3',   'NIST SP 800-185'],
        ]}
      />
      <H2>Hybrid Mode</H2>
      <P>Hybrid Mode runs your existing classical algorithm <em>alongside</em> the new PQC algorithm simultaneously. This gives you full backward compatibility during the transition window — no downtime, no breaking changes.</P>
      <Callout type="success">Hybrid Mode is recommended for all production environments. Disable it only after all consumers of your keys/certs have been updated.</Callout>
      <H2>Rollback</H2>
      <P>Every migration creates a snapshot before applying changes. If anything breaks, navigate to <strong>Migrate → Snapshots</strong> and click <strong>Restore</strong> to roll back instantly.</P>
    </Doc>
  ),

  keygen: (
    <Doc title="Quantum Key Generator" badge="Core Feature">
      <P>QGuard's Key Generator produces cryptographic key pairs seeded with genuine quantum randomness — far stronger than anything a classical PRNG can produce.</P>
      <H2>Supported Key Types</H2>
      <Table
        heads={['Type', 'Algorithm', 'Use Case']}
        rows={[
          ['Key Encapsulation', 'ML-KEM-512',    'General encryption (128-bit PQ security)' ],
          ['Key Encapsulation', 'ML-KEM-768',    'Recommended (192-bit PQ security)'        ],
          ['Key Encapsulation', 'ML-KEM-1024',   'Maximum security (256-bit PQ security)'   ],
          ['Digital Signature', 'ML-DSA-44',     'Fast signing (128-bit PQ security)'       ],
          ['Digital Signature', 'ML-DSA-65',     'Recommended signing (192-bit PQ security)'],
          ['Digital Signature', 'SPHINCS+-SHA2', 'Stateless hash-based signatures'          ],
        ]}
      />
      <H2>Entropy Source</H2>
      <P>QGuard uses a combination of hardware QRNG (via cloud quantum APIs) and OS entropy mixing. Every generated key has an <strong>entropy quality score ≥ 99.7%</strong>, verified by NIST SP 800-90B statistical tests.</P>
      <H2>Export Options</H2>
      <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {['PEM / DER file download', 'Push directly to HSM (Hardware Security Module)', 'Copy public key to clipboard', 'QR code for mobile transfer', 'Revoke at any time from the Keys dashboard'].map(i => <Li key={i}>{i}</Li>)}
      </ul>
    </Doc>
  ),

  vault: (
    <Doc title="Quantum Vault" badge="Core Feature">
      <P>The Quantum Vault is a zero-knowledge, PQC-encrypted file storage system. Every file is encrypted client-side with ML-KEM-1024 before it ever leaves your device.</P>
      <H2>Architecture</H2>
      <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {['Client-side ML-KEM-1024 encryption before upload', 'Zero-knowledge: QGuard servers never see plaintext', 'Merkle-proof file integrity verification', 'End-to-end encrypted sharing with expiry links', 'Cross-device sync with encrypted delta sync', 'Instant key revocation controls'].map(i => <Li key={i}>{i}</Li>)}
      </ul>
      <H2>Using the Vault</H2>
      <Steps>
        <Step n={1} title="Upload files">Drag and drop files into the Vault panel or click Upload. Files are encrypted locally before transfer.</Step>
        <Step n={2} title="Organise">Create folders, add tags, and search across your vault contents. All metadata is also encrypted.</Step>
        <Step n={3} title="Share securely">Right-click any file → Share → Generate encrypted link. Set an expiry time (1 hour to 30 days) and optional password.</Step>
        <Step n={4} title="Family sharing">Invite up to 5 family members (Pro/Elite). Shared folders use per-member ML-KEM key wrapping — revoking one member doesn't affect others.</Step>
      </Steps>
      <Callout type="info">Even if QGuard servers were completely compromised, an attacker would only obtain ciphertext protected by ML-KEM-1024 — computationally infeasible to break, even with a quantum computer.</Callout>
    </Doc>
  ),

  monitoring: (
    <Doc title="Continuous Monitoring" badge="Core Feature">
      <P>Continuous Monitoring runs background scans on a configurable schedule and alerts you the moment a new quantum vulnerability is detected.</P>
      <H2>How It Works</H2>
      <Steps>
        <Step n={1} title="Enable monitoring">Go to Settings → Monitoring and toggle it ON. Choose scan frequency: hourly, daily, or weekly.</Step>
        <Step n={2} title="Configure scope">Select which scopes to monitor: local files, cloud storage, TLS certificates, git repos.</Step>
        <Step n={3} title="Receive alerts">Alerts are sent via email, in-app notification, and optionally via webhook. Each alert includes severity, location, and a direct link to the finding.</Step>
        <Step n={4} title="Track your Q-Score trend">The Monitoring dashboard shows a 30-day Q-Score timeline — see exactly when new risks were introduced and when they were resolved.</Step>
      </Steps>
      <H2>Alert Severity Levels</H2>
      <Table
        heads={['Level', 'Meaning', 'Response Time']}
        rows={[
          ['Critical', 'Key breakable in <5 years by projected quantum hardware', 'Immediate'   ],
          ['High',     'Key breakable in 5–10 years',                            'Within 1 week'],
          ['Medium',   'Key weakened but not immediately breakable',             'Within 1 month'],
          ['Low',      'Best-practice deviation, low risk',                     'Next cycle'   ],
        ]}
      />
    </Doc>
  ),

  simulator: (
    <Doc title="Threat Simulator" badge="Core Feature">
      <P>The Threat Simulator gives you a live, interactive demonstration of how quantum computers break classical encryption. It's the most powerful tool for understanding your actual risk.</P>
      <H2>Shor's Algorithm Demo</H2>
      <P>Upload an RSA public key or paste an RSA-2048 modulus. The simulator visualises Shor's algorithm factoring the key — showing you exactly how many quantum operations it would take and the estimated time on projected 2030–2035 quantum hardware.</P>
      <H2>Grover's Algorithm Demo</H2>
      <P>Simulate a Grover's search attack against AES-128 and SHA-1. See the effective security reduction (AES-128 → 64-bit equivalent) in real time.</P>
      <H2>Q-Day Timeline</H2>
      <P>Based on current qubit scaling projections (IBM, Google, IonQ roadmaps), the simulator generates a personalised timeline showing when each of your detected vulnerabilities is likely to become exploitable.</P>
      <Callout type="warning">The simulator uses realistic projections based on published quantum computing roadmaps. Actual Q-Day may arrive earlier than projected — this is why migrating now is critical.</Callout>
    </Doc>
  ),

  /* ── TUTORIALS ── */
  'tutorial-scan': (
    <Doc title="Tutorial: Run Your First Scan" badge="Tutorial">
      <P>This tutorial walks you through running a complete quantum vulnerability scan from start to finish.</P>
      <Steps>
        <Step n={1} title="Log in and open the Scanner">From your dashboard sidebar, click <strong>Scanner</strong>. If this is your first scan, you'll see the Quick Start prompt.</Step>
        <Step n={2} title="Choose your scan scope">Select one or more of the available scan targets:<br /><br />
          • <strong>Device Files</strong> — scans your local filesystem for certificates, keys, and config files<br />
          • <strong>Cloud Storage</strong> — connect Google Drive, Dropbox, or OneDrive<br />
          • <strong>Git Repositories</strong> — paste a repo URL or connect GitHub/GitLab<br />
          • <strong>TLS Certificates</strong> — enter a domain to inspect its certificate chain
        </Step>
        <Step n={3} title="Start the scan">Click <strong>Start Scan</strong>. A progress bar shows the scan stages: Discovery → Analysis → Risk Scoring → Report.</Step>
        <Step n={4} title="Review the Q-Score report">Once complete, your Q-Score updates and a full findings report appears. Each row shows: file path, algorithm type, key size, severity, and years until breakable.</Step>
        <Step n={5} title="Take action">Click <strong>Migrate</strong> next to any critical finding to launch the Migration Wizard, or click <strong>Dismiss</strong> to acknowledge low-risk findings.</Step>
        <Step n={6} title="Export your compliance report">Click <strong>Export PDF</strong> in the top-right of the report to generate an audit-ready NIST FIPS compliance document.</Step>
      </Steps>
      <Callout type="success">Your first scan typically takes 3–5 minutes for a standard device. Large repositories or cloud accounts with 10,000+ files may take up to 20 minutes.</Callout>
    </Doc>
  ),

  'tutorial-migrate': (
    <Doc title="Tutorial: Migrate RSA to ML-KEM" badge="Tutorial">
      <P>This tutorial shows you how to replace an RSA-2048 key pair with a NIST FIPS 203 ML-KEM-768 key pair using the Migration Wizard.</P>
      <Steps>
        <Step n={1} title="Find the RSA finding">Run a scan (see Tutorial: Run Your First Scan). In the results, locate any finding with Algorithm: <InlineCode>RSA-2048</InlineCode>.</Step>
        <Step n={2} title="Open the Migration Wizard">Click <strong>Migrate</strong> on that finding. The wizard opens and pre-selects ML-KEM-768 as the replacement algorithm.</Step>
        <Step n={3} title="Enable Hybrid Mode">Toggle <strong>Hybrid Mode ON</strong>. This keeps your existing RSA key active while adding the new ML-KEM key — zero downtime for any services that depend on the old key.</Step>
        <Step n={4} title="Generate the new key pair">Click <strong>Generate ML-KEM-768 Key Pair</strong>. QGuard generates a quantum-random key pair and shows you the public key fingerprint.</Step>
        <Step n={5} title="Apply the migration">Click <strong>Apply Migration</strong>. QGuard updates the relevant config files, certificates, or code references and creates a rollback snapshot.</Step>
        <Step n={6} title="Verify and disable Hybrid Mode">Test your services with the new key. Once confirmed working, return to Migrate → Active Migrations and click <strong>Disable Hybrid Mode</strong> to complete the transition.</Step>
      </Steps>
      <Callout type="info">Your rollback snapshot is retained for 30 days. If anything goes wrong, go to Migrate → Snapshots and click Restore.</Callout>
    </Doc>
  ),

  'tutorial-vault': (
    <Doc title="Tutorial: Store Files in the Vault" badge="Tutorial">
      <Steps>
        <Step n={1} title="Open the Vault">Click <strong>Vault</strong> in your dashboard sidebar.</Step>
        <Step n={2} title="Upload a file">Drag and drop any file into the vault area, or click <strong>Upload File</strong>. QGuard encrypts the file locally with ML-KEM-1024 before upload. You'll see an encryption progress indicator.</Step>
        <Step n={3} title="Verify integrity">After upload, the vault displays a Merkle-proof integrity badge (✓). This confirms the file has not been tampered with in transit or at rest.</Step>
        <Step n={4} title="Share a file">Right-click the file → <strong>Share</strong>. Choose an expiry (e.g. 24 hours) and copy the encrypted share link. Only recipients with the link can decrypt the file.</Step>
        <Step n={5} title="Revoke access">To revoke a share link before it expires, right-click → <strong>Revoke Link</strong>. The link becomes immediately invalid.</Step>
      </Steps>
    </Doc>
  ),

  'tutorial-keygen': (
    <Doc title="Tutorial: Generate QRNG Keys" badge="Tutorial">
      <Steps>
        <Step n={1} title="Open Key Generator">Click <strong>Keys</strong> in your dashboard sidebar, then click <strong>Generate New Key Pair</strong>.</Step>
        <Step n={2} title="Select algorithm">Choose your algorithm: ML-KEM-768 for encryption or ML-DSA-65 for signing. For maximum security, use ML-KEM-1024.</Step>
        <Step n={3} title="Set key name and expiry">Give the key a descriptive name (e.g. "API Server Signing Key") and optionally set an expiry date.</Step>
        <Step n={4} title="Generate">Click <strong>Generate</strong>. QGuard fetches quantum entropy, generates your key pair, and displays the entropy quality score (target: ≥99.7%).</Step>
        <Step n={5} title="Export">Click <strong>Download PEM</strong> to save the private key locally (it is never stored on QGuard servers). Copy the public key to deploy to your services.</Step>
      </Steps>
      <Callout type="warning">Your private key is shown only once. Download and store it securely in a hardware security module or encrypted backup. QGuard does not retain your private key.</Callout>
    </Doc>
  ),

  /* ── REFERENCE ── */
  algorithms: (
    <Doc title="Supported Algorithms" badge="Reference">
      <H2>Post-Quantum Algorithms</H2>
      <Table
        heads={['Algorithm', 'Type', 'Standard', 'Security Level']}
        rows={[
          ['ML-KEM-512',       'Key Encapsulation', 'NIST FIPS 203', 'Category 1 (128-bit PQ)'],
          ['ML-KEM-768',       'Key Encapsulation', 'NIST FIPS 203', 'Category 3 (192-bit PQ)'],
          ['ML-KEM-1024',      'Key Encapsulation', 'NIST FIPS 203', 'Category 5 (256-bit PQ)'],
          ['ML-DSA-44',        'Digital Signature', 'NIST FIPS 204', 'Category 2 (128-bit PQ)'],
          ['ML-DSA-65',        'Digital Signature', 'NIST FIPS 204', 'Category 3 (192-bit PQ)'],
          ['ML-DSA-87',        'Digital Signature', 'NIST FIPS 204', 'Category 5 (256-bit PQ)'],
          ['SPHINCS+-SHA2-128','Digital Signature', 'NIST FIPS 205', 'Category 1 (128-bit PQ)'],
          ['SPHINCS+-SHA2-256','Digital Signature', 'NIST FIPS 205', 'Category 5 (256-bit PQ)'],
        ]}
      />
      <H2>Legacy Algorithms Detected</H2>
      <Table
        heads={['Algorithm', 'Quantum Attack', 'Recommended Replacement']}
        rows={[
          ['RSA-2048',   "Shor's", 'ML-KEM-768 + ML-DSA-65'],
          ['ECDSA P-256',"Shor's", 'ML-DSA-65'              ],
          ['ECDH P-384', "Shor's", 'ML-KEM-768'             ],
          ['SHA-1',      "Grover's",'SHA-3-256'             ],
          ['AES-128',    "Grover's",'AES-256'               ],
          ['MD5',        'Classical + Grover','SHA-3-256'   ],
        ]}
      />
    </Doc>
  ),

  'q-score': (
    <Doc title="Q-Score Explained" badge="Reference">
      <P>The Q-Score is QGuard's proprietary quantum readiness metric, ranging from 0 (fully vulnerable) to 100 (fully quantum-safe).</P>
      <H2>Score Bands</H2>
      <Table
        heads={['Score', 'Status', 'Meaning']}
        rows={[
          ['90–100', '✅ Quantum Safe',   'All cryptography meets NIST PQC standards'         ],
          ['70–89',  '⚡ Good',           'Minor vulnerabilities; low priority migration needed'],
          ['50–69',  '⚠️ At Risk',        'Significant vulnerabilities; action recommended'    ],
          ['25–49',  '🔴 Vulnerable',     'Critical vulnerabilities; immediate action required' ],
          ['0–24',   '💀 Critical',       'Severely exposed; harvesting attacks likely already occurring'],
        ]}
      />
      <H2>Score Calculation</H2>
      <P>Each vulnerability deducts points based on: severity (Critical = -15 pts, High = -8 pts, Medium = -4 pts, Low = -1 pt), the number of instances, and whether HNDL attack exposure exists. Migrating a vulnerability restores its point deduction immediately.</P>
    </Doc>
  ),

  compliance: (
    <Doc title="NIST FIPS Compliance" badge="Reference">
      <P>QGuard is built to the following NIST Post-Quantum Cryptography standards, published August 2024.</P>
      <Table
        heads={['Standard', 'Algorithm', 'Type', 'Status']}
        rows={[
          ['NIST FIPS 203', 'ML-KEM (Module-Lattice KEM)',       'Key Encapsulation', 'Final Standard ✓'],
          ['NIST FIPS 204', 'ML-DSA (Module-Lattice DSA)',       'Digital Signature', 'Final Standard ✓'],
          ['NIST FIPS 205', 'SPHINCS+ (Stateless Hash Sigs)',    'Digital Signature', 'Final Standard ✓'],
          ['NIST SP 800-90B','QRNG Entropy Validation',         'Entropy Testing',   'Compliant ✓'     ],
          ['NIST SP 800-208','Leighton-Micali Signatures (LMS)', 'Stateful Sigs',    'Supported ✓'     ],
        ]}
      />
      <Callout type="info">QGuard's migration reports include a NIST FIPS compliance attestation suitable for regulatory audits and enterprise security questionnaires.</Callout>
    </Doc>
  ),

  'faq-docs': (
    <Doc title="FAQ" badge="Reference">
      {[
        { q: 'Does QGuard perform actual quantum computations?', a: 'No. QGuard uses NIST-approved post-quantum algorithms that run on classical hardware. The QRNG Key Generator can optionally connect to real quantum hardware via cloud APIs for true quantum entropy.' },
        { q: 'Is my data safe when I use the Scanner?', a: 'Yes. All scanning is performed locally first. Only anonymised metadata (algorithm type, key size, file path hash) is sent to QGuard servers for Q-Score calculation. Your actual file contents are never transmitted.' },
        { q: 'What is Hybrid Mode in the Migration Wizard?', a: 'Hybrid Mode runs your existing classical algorithm alongside the new PQC algorithm simultaneously. This ensures zero downtime and full backward compatibility during the transition window.' },
        { q: 'Can I use QGuard for my company\'s infrastructure?', a: 'Yes. QGuard Pro and Elite plans support CI/CD pipeline integration, API key access, and compliance report generation for enterprise environments.' },
        { q: 'How often should I run a scan?', a: 'We recommend enabling Continuous Monitoring for automatic daily scans. At minimum, run a manual scan whenever you deploy new services, add new certificates, or update third-party libraries.' },
        { q: 'What happens to my data if I cancel my subscription?', a: 'Your Quantum Vault data is retained for 30 days after cancellation. You can export all your data at any time from Settings → Data Export. After 30 days, data is permanently deleted from our servers.' },
      ].map(({ q, a }) => (
        <div key={q} style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--qg-border)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 8 }}>{q}</div>
          <div style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--qg-text-secondary)' }}>{a}</div>
        </div>
      ))}
    </Doc>
  ),

  /* ── QRNG SERVICES ── */
  otp: (
    <Doc title="OTP / Multi-Factor Auth" badge="QRNG Service">
      <P>QGuard generates one-time passwords seeded with genuine quantum randomness from the AerSimulator entropy pipeline. Unlike classical PRNGs, quantum-random OTPs are provably unpredictable — eliminating seed-prediction attacks that compromise traditional TOTP/HOTP implementations.</P>
      <H2>Key Features</H2>
      <Table
        heads={['Feature', 'Description']}
        rows={[
          ['TOTP Generation',      'RFC 6238 compliant time-based OTP with quantum-random secret seeds'],
          ['HOTP Generation',      'RFC 4226 compliant counter-based OTP for offline scenarios'],
          ['Timing-Safe Validation','Constant-time comparison prevents timing side-channel attacks'],
          ['Entropy Pipeline',     'Seeds derived from Qiskit AerSimulator quantum circuit execution'],
          ['Configurable Digits',  '6, 8, or 10 digit codes with configurable time windows (30s/60s)'],
          ['Batch Generation',     'Generate up to 1,000 OTP seeds in a single API call'],
        ]}
      />
      <H2>How It Works</H2>
      <Steps>
        <Step n={1} title="Entropy harvest">QGuard executes quantum circuits on the AerSimulator backend, measuring qubits in superposition to produce true random bits.</Step>
        <Step n={2} title="Seed derivation">Raw quantum bits are conditioned through NIST SP 800-90B compliant health tests, then used to derive TOTP/HOTP secret seeds.</Step>
        <Step n={3} title="OTP generation">The quantum-random seed is combined with the current timestamp (TOTP) or counter (HOTP) via HMAC-SHA256 to produce a one-time code.</Step>
        <Step n={4} title="Timing-safe validation">When a user submits an OTP, QGuard performs constant-time comparison to prevent timing side-channel leakage.</Step>
      </Steps>
      <Callout type="info">Integrate quantum OTP into your existing MFA flow via the <Strong>/api/v1/otp/generate</Strong> and <Strong>/api/v1/otp/verify</Strong> endpoints. See API Documentation for full reference.</Callout>
      <ApiRefLink href="/docs/api/otp" service="OTP" />
    </Doc>
  ),

  'pki-certs': (
    <Doc title="PKI Certificate Authority" badge="QRNG Service">
      <P>QGuard operates a post-quantum certificate authority (CA) that issues X.509 certificates signed with ML-DSA (FIPS 204) and SPHINCS+ (FIPS 205). Certificates are quantum-resistant from day one, protecting your PKI infrastructure against Harvest Now, Decrypt Later attacks.</P>
      <H2>Key Features</H2>
      <Table
        heads={['Feature', 'Description']}
        rows={[
          ['PQC Signing Algorithms', 'ML-DSA-44, ML-DSA-65, ML-DSA-87, SPHINCS+-SHA2-128/256'],
          ['CSR Signing',            'Submit standard PKCS#10 CSRs and receive PQC-signed certificates'],
          ['Certificate Lifecycle',  'Issue, renew, revoke, and query certificate status via API'],
          ['Hybrid Certificates',    'Dual-signed certificates (RSA + ML-DSA) for backward compatibility'],
          ['CRL & OCSP',             'Certificate revocation lists and OCSP responder endpoints'],
          ['Quantum-Random Serial',  'Certificate serial numbers generated from quantum entropy'],
        ]}
      />
      <H2>How It Works</H2>
      <Steps>
        <Step n={1} title="Generate a CSR">Create a Certificate Signing Request using your preferred tool (e.g. OpenSSL). Include your subject details and public key.</Step>
        <Step n={2} title="Submit to QGuard CA">POST the CSR to the <InlineCode>/api/v1/pki/sign</InlineCode> endpoint. Select your preferred PQC algorithm (ML-DSA-65 recommended).</Step>
        <Step n={3} title="Certificate issuance">QGuard validates the CSR, generates a quantum-random serial number, signs the certificate with the selected PQC algorithm, and returns the signed X.509 certificate.</Step>
        <Step n={4} title="Deploy and monitor">Install the certificate in your infrastructure. QGuard monitors expiry and sends renewal reminders 30 days before expiration.</Step>
        <Step n={5} title="Revoke if needed">Call <InlineCode>/api/v1/pki/revoke</InlineCode> with the certificate serial number. The CRL is updated within 60 seconds.</Step>
      </Steps>
      <Callout type="success">QGuard CA certificates are compatible with all major TLS libraries that support PQC. Enable Hybrid Mode to maintain backward compatibility with legacy clients.</Callout>
      <ApiRefLink href="/docs/api/pki" service="PKI" />
    </Doc>
  ),

  tokenize: (
    <Doc title="Data Tokenization" badge="QRNG Service">
      <P>QGuard provides format-preserving encryption (FPE) using the FF3-1 algorithm for PCI-DSS compliant data tokenization. Replace sensitive values (credit card numbers, SSNs, medical record IDs) with quantum-random tokens that preserve the original format — no schema changes required.</P>
      <H2>Key Features</H2>
      <Table
        heads={['Feature', 'Description']}
        rows={[
          ['FF3-1 Algorithm',       'NIST SP 800-38G Rev 1 compliant format-preserving encryption'],
          ['PCI-DSS Ready',         'Tokenized data is out of scope for PCI-DSS audits'],
          ['HMAC Binding',          'Tokens are cryptographically bound to prevent token-swap attacks'],
          ['Batch Operations',      'Tokenize/detokenize up to 10,000 values per API call'],
          ['Format Preservation',   'Output matches input format (e.g. 16-digit card → 16-digit token)'],
          ['Quantum-Random Tweak',  'FF3-1 tweak values derived from QRNG entropy'],
        ]}
      />
      <H2>How It Works</H2>
      <Steps>
        <Step n={1} title="Define token format">Specify the alphabet and length constraints for your tokens. QGuard supports numeric, alphanumeric, and custom character sets.</Step>
        <Step n={2} title="Submit sensitive data">POST plaintext values to <InlineCode>/api/v1/tokenize</InlineCode>. Values are encrypted in-memory and never written to disk in plaintext.</Step>
        <Step n={3} title="Receive tokens">QGuard returns format-preserving tokens. Store these in your database instead of the original sensitive data.</Step>
        <Step n={4} title="Detokenize when needed">Authorized services call <InlineCode>/api/v1/detokenize</InlineCode> with valid credentials to retrieve original values. All access is logged.</Step>
      </Steps>
      <Callout type="warning">Detokenization requires elevated API credentials with the <InlineCode>tokenize:read</InlineCode> scope. All detokenization requests are logged in the audit trail for compliance.</Callout>
      <ApiRefLink href="/docs/api/tokenize" service="Tokenization" />
    </Doc>
  ),

  comm: (
    <Doc title="Secure Communications" badge="QRNG Service">
      <P>QGuard generates quantum-random session keys for end-to-end encrypted communications. Whether you need secure messaging, VPN key generation, or email encryption, QGuard provides AEAD-protected keys that are immune to quantum harvest attacks.</P>
      <H2>Key Features</H2>
      <Table
        heads={['Feature', 'Description']}
        rows={[
          ['E2E Session Keys',    'Generate ephemeral ML-KEM session keys for each conversation'],
          ['VPN Key Generation',  'Quantum-random pre-shared keys for WireGuard and IPsec tunnels'],
          ['Email Encryption',    'S/MIME and PGP key generation with quantum-random entropy'],
          ['AEAD Protection',     'AES-256-GCM and ChaCha20-Poly1305 authenticated encryption'],
          ['Forward Secrecy',     'Ephemeral key exchange ensures past sessions remain secure'],
          ['Key Derivation',      'HKDF-SHA384 with quantum-random salt for derived keys'],
        ]}
      />
      <H2>How It Works</H2>
      <Steps>
        <Step n={1} title="Initiate key exchange">Client A requests an ephemeral ML-KEM key pair from QGuard. The public key is sent to Client B.</Step>
        <Step n={2} title="Encapsulate session key">Client B encapsulates a shared secret using Client A's public key. The ciphertext is sent back to Client A.</Step>
        <Step n={3} title="Derive AEAD keys">Both clients derive symmetric encryption keys from the shared secret using HKDF with a quantum-random salt.</Step>
        <Step n={4} title="Encrypt communications">Messages are encrypted with AES-256-GCM or ChaCha20-Poly1305 using the derived keys. Each message uses a unique nonce.</Step>
        <Step n={5} title="Rotate keys">Session keys are rotated automatically after a configurable interval or message count to maintain forward secrecy.</Step>
      </Steps>
      <Callout type="info">QGuard's secure communication keys are compatible with Signal Protocol, Matrix, and custom E2E implementations. See API Documentation for integration guides.</Callout>
      <ApiRefLink href="/docs/api/comm" service="Secure Communications" />
    </Doc>
  ),

  'cloud-seed': (
    <Doc title="Cloud Infrastructure Seeding" badge="QRNG Service">
      <P>Inject quantum entropy directly into your cloud infrastructure. QGuard provides quantum-random seeds for Kubernetes secrets, AWS KMS custom key stores, HashiCorp Vault, and other cloud-native services — via real-time SSE streaming or batch API calls.</P>
      <H2>Key Features</H2>
      <Table
        heads={['Feature', 'Description']}
        rows={[
          ['Kubernetes Secrets',   'Quantum-random values injected directly into K8s Secret objects'],
          ['AWS KMS Seeding',      'Custom key material for AWS KMS external key stores'],
          ['HashiCorp Vault',      'Transit engine and auto-unseal with quantum entropy'],
          ['SSE Streaming',        'Real-time Server-Sent Events stream of quantum random bytes'],
          ['Batch API',            'Request up to 1 MB of quantum entropy per API call'],
          ['Entropy Health',       'Every batch includes NIST SP 800-90B health test results'],
        ]}
      />
      <H2>How It Works</H2>
      <Steps>
        <Step n={1} title="Configure target">Specify your cloud target (K8s namespace, AWS KMS key ID, Vault path) in the QGuard dashboard or via API.</Step>
        <Step n={2} title="Generate quantum entropy">QGuard executes quantum circuits and collects raw random bytes. Entropy is health-tested before delivery.</Step>
        <Step n={3} title="Deliver to target">Entropy is delivered via SSE stream for real-time consumption or via batch API. All delivery is TLS-protected.</Step>
        <Step n={4} title="Seed infrastructure">Your infrastructure consumes the quantum entropy to generate secrets, keys, nonces, and initialization vectors.</Step>
      </Steps>
      <Callout type="success">Use the SSE streaming endpoint <InlineCode>/api/v1/qrng/stream</InlineCode> for continuous entropy delivery to high-throughput systems. Average latency: &lt;50ms per 256-bit block.</Callout>
      <ApiRefLink href="/docs/api/cloud" service="Cloud Seeding" />
    </Doc>
  ),

  'key-mgmt': (
    <Doc title="Encryption Key Management" badge="QRNG Service">
      <P>QGuard provides comprehensive post-quantum key lifecycle management. Generate, rotate, export, and revoke ML-KEM, ML-DSA, and AES keys — all seeded with quantum randomness and managed through a unified API.</P>
      <H2>Key Features</H2>
      <Table
        heads={['Feature', 'Description']}
        rows={[
          ['ML-KEM Generation',  'ML-KEM-512/768/1024 key pairs for quantum-safe encryption'],
          ['ML-DSA Generation',  'ML-DSA-44/65/87 key pairs for quantum-safe digital signatures'],
          ['AES Key Generation', 'AES-128/192/256 symmetric keys from quantum entropy'],
          ['Key Rotation',       'Automated rotation on schedule or on-demand via API'],
          ['Export Formats',     'PEM, DER, JWK, and raw binary export formats'],
          ['Key Metadata',       'Tags, expiry, usage policies, and audit trail per key'],
        ]}
      />
      <H2>How It Works</H2>
      <Steps>
        <Step n={1} title="Request key generation">Call <InlineCode>/api/v1/keys/generate</InlineCode> with the desired algorithm, security level, and metadata (name, expiry, usage policy).</Step>
        <Step n={2} title="Quantum entropy seeding">QGuard harvests quantum random bits from the AerSimulator backend and uses them to seed the key generation algorithm.</Step>
        <Step n={3} title="Key storage">The generated key pair is encrypted with your account master key and stored in QGuard's secure key store. Private keys are never stored in plaintext.</Step>
        <Step n={4} title="Export or deploy">Export keys in PEM, DER, or JWK format. Alternatively, push keys directly to HSMs, cloud KMS, or infrastructure endpoints.</Step>
        <Step n={5} title="Rotate and revoke">Set automatic rotation schedules or manually rotate keys. Revoked keys are added to the key revocation list and cannot be used for new operations.</Step>
      </Steps>
      <Callout type="info">All key operations are logged in the immutable audit trail. Access the key audit log via <InlineCode>/api/v1/keys/audit</InlineCode> for compliance reporting.</Callout>
      <ApiRefLink href="/docs/api/keys" service="Key Management" />
    </Doc>
  ),

  /* ── TUTORIALS (QRNG Services) ── */
  'tutorial-otp': (
    <Doc title="Tutorial: Quantum OTP Setup" badge="Tutorial">
      <P>Set up quantum-random one-time passwords for your application's multi-factor authentication flow.</P>
      <Steps>
        <Step n={1} title="Generate a TOTP secret">Call <InlineCode>POST /api/v1/otp/generate</InlineCode> with <InlineCode>{`{"type":"totp","digits":6,"period":30}`}</InlineCode>. The response includes a Base32-encoded quantum-random secret and a provisioning URI.</Step>
        <Step n={2} title="Display QR code">Convert the provisioning URI into a QR code and display it to the user. They scan it with any TOTP-compatible authenticator app (Google Authenticator, Authy, etc.).</Step>
        <Step n={3} title="Store the secret">Save the secret server-side, associated with the user's account. Never expose the secret after initial setup.</Step>
        <Step n={4} title="Verify OTP on login">When the user enters a 6-digit code, call <InlineCode>POST /api/v1/otp/verify</InlineCode> with the code and secret. QGuard performs timing-safe validation and returns a boolean result.</Step>
        <Step n={5} title="Handle clock drift">QGuard accepts codes within a configurable window (default: +/- 1 period). Adjust the <InlineCode>window</InlineCode> parameter for stricter or more lenient validation.</Step>
      </Steps>
      <Callout type="success">Quantum-random TOTP secrets eliminate seed-prediction attacks. Your users' MFA is protected by provably unpredictable entropy.</Callout>
    </Doc>
  ),

  'tutorial-pki': (
    <Doc title="Tutorial: Issue PQC Certificates" badge="Tutorial">
      <P>Issue your first post-quantum X.509 certificate using QGuard's built-in certificate authority.</P>
      <Steps>
        <Step n={1} title="Generate a key pair">Use QGuard's key generator or OpenSSL to create an ML-DSA-65 key pair for your server.</Step>
        <Step n={2} title="Create a CSR">Generate a PKCS#10 Certificate Signing Request with your server's subject details and the ML-DSA-65 public key.</Step>
        <Step n={3} title="Submit the CSR">Call <InlineCode>POST /api/v1/pki/sign</InlineCode> with the PEM-encoded CSR and your desired validity period (e.g. 365 days).</Step>
        <Step n={4} title="Download the certificate">The API returns a PEM-encoded X.509 certificate signed by QGuard's PQC CA. Download and install it on your server.</Step>
        <Step n={5} title="Configure your server">Update your web server (Nginx, Apache, etc.) to use the new PQC certificate and private key. Test with <InlineCode>openssl s_client</InlineCode> to verify the certificate chain.</Step>
      </Steps>
      <Callout type="info">For production deployments, use Hybrid Mode to issue dual-signed certificates (RSA + ML-DSA) that work with both legacy and PQC-capable clients.</Callout>
    </Doc>
  ),

  'tutorial-tokenize': (
    <Doc title="Tutorial: Tokenize Sensitive Data" badge="Tutorial">
      <P>Replace credit card numbers and other sensitive data with quantum-random tokens using format-preserving encryption.</P>
      <Steps>
        <Step n={1} title="Define your token policy">Decide which fields to tokenize (e.g. card numbers, SSNs). Specify the format: <InlineCode>{`{"alphabet":"0123456789","length":16}`}</InlineCode>.</Step>
        <Step n={2} title="Tokenize data">Call <InlineCode>POST /api/v1/tokenize</InlineCode> with an array of plaintext values. QGuard returns format-preserving tokens that match the original length and character set.</Step>
        <Step n={3} title="Store tokens">Replace sensitive values in your database with the returned tokens. Your database schema requires zero changes.</Step>
        <Step n={4} title="Detokenize when needed">Authorized services call <InlineCode>POST /api/v1/detokenize</InlineCode> to retrieve original values. This requires the <InlineCode>tokenize:read</InlineCode> API scope.</Step>
        <Step n={5} title="Audit access">Review all tokenization and detokenization events in the audit trail via <InlineCode>GET /api/v1/tokenize/audit</InlineCode>.</Step>
      </Steps>
      <Callout type="warning">Never store both the token and the original value. Once tokenized, delete the plaintext from all systems except the QGuard token vault.</Callout>
    </Doc>
  ),

  'tutorial-comm': (
    <Doc title="Tutorial: Secure Messaging Setup" badge="Tutorial">
      <P>Set up end-to-end encrypted messaging between two clients using quantum-random session keys.</P>
      <Steps>
        <Step n={1} title="Generate ephemeral keys">Client A calls <InlineCode>POST /api/v1/comm/keygen</InlineCode> to generate an ephemeral ML-KEM-768 key pair. The public key is shared with Client B.</Step>
        <Step n={2} title="Encapsulate shared secret">Client B calls <InlineCode>POST /api/v1/comm/encapsulate</InlineCode> with Client A's public key. QGuard returns a ciphertext and the shared secret.</Step>
        <Step n={3} title="Decapsulate">Client A calls <InlineCode>POST /api/v1/comm/decapsulate</InlineCode> with the ciphertext and their private key to recover the same shared secret.</Step>
        <Step n={4} title="Derive encryption keys">Both clients derive AES-256-GCM keys from the shared secret using HKDF. Use a unique salt per session.</Step>
        <Step n={5} title="Send encrypted messages">Encrypt each message with AES-256-GCM using a unique nonce. The recipient decrypts using the shared derived key.</Step>
      </Steps>
      <Callout type="success">This key exchange is quantum-safe. Even if an attacker records all network traffic today, they cannot decrypt it with a future quantum computer.</Callout>
    </Doc>
  ),

  'tutorial-cloud': (
    <Doc title="Tutorial: Seed Cloud Infrastructure" badge="Tutorial">
      <P>Inject quantum entropy into your Kubernetes cluster secrets and cloud key management systems.</P>
      <Steps>
        <Step n={1} title="Connect your cluster">Configure your K8s cluster credentials in the QGuard dashboard under Settings, or provide a kubeconfig via API.</Step>
        <Step n={2} title="Request entropy batch">Call <InlineCode>GET /api/v1/qrng/stream</InlineCode> to open an SSE connection, or <InlineCode>POST /api/v1/qrng/batch</InlineCode> for a one-time entropy delivery of up to 1 MB.</Step>
        <Step n={3} title="Create K8s secrets">Use the quantum entropy to generate values for your Kubernetes Secret objects. QGuard provides a helper CLI: <InlineCode>qguard seed k8s --namespace prod</InlineCode>.</Step>
        <Step n={4} title="Seed cloud KMS">For AWS KMS, call <InlineCode>POST /api/v1/cloud-seed/aws-kms</InlineCode> with your KMS key ID to import quantum-random key material into your external key store.</Step>
        <Step n={5} title="Verify entropy quality">Check the <InlineCode>entropy_quality</InlineCode> field in the API response. All delivered entropy must pass NIST SP 800-90B health tests with a score of 99.7% or higher.</Step>
      </Steps>
      <Callout type="info">For continuous seeding, use the SSE streaming endpoint with a persistent connection. QGuard delivers fresh quantum entropy every 100ms.</Callout>
    </Doc>
  ),

  /* ── BUSINESS ── */
  'why-quantum': (
    <Doc title="Why Quantum Security Now" badge="Business">
      <P>Quantum computers pose an existential threat to modern encryption. The question is not whether they will break today's cryptography — it's when. Organizations that wait for Q-Day to act will find themselves years behind in a migration that takes years to complete.</P>
      <H2>Harvest Now, Decrypt Later (HNDL)</H2>
      <P>Nation-state actors and advanced persistent threats are already executing HNDL attacks: capturing encrypted network traffic, stored data, and key exchanges today with the intention of decrypting them once quantum computers are powerful enough. Data with a secrecy lifespan beyond 2030 is already at risk.</P>
      <H2>Q-Day Timeline</H2>
      <Table
        heads={['Year Range', 'Milestone', 'Risk Level']}
        rows={[
          ['2024–2026', 'NIST PQC standards finalized; early adopters begin migration', 'Preparation window'],
          ['2027–2030', 'Quantum computers reach 1,000+ logical qubits; HNDL attacks intensify', 'High risk for long-lived data'],
          ['2030–2035', 'Cryptographically relevant quantum computers likely operational', 'Critical — RSA-2048 breakable'],
          ['2035–2040', 'Widespread quantum capability; all classical public-key crypto at risk', 'Catastrophic if unmigrated'],
        ]}
      />
      <H2>Cost of Inaction</H2>
      <P>Organizations that delay PQC migration face: regulatory non-compliance (NIST mandates PQC by 2035), loss of sensitive data already harvested via HNDL, costly emergency migrations under time pressure, and reputational damage from quantum-enabled breaches. The average enterprise PQC migration takes 3-5 years — starting now is not early, it's on time.</P>
      <H2>Why Act Now</H2>
      <P>QGuard enables you to begin your post-quantum migration today with zero disruption. Hybrid Mode ensures backward compatibility while you transition. Every day you wait is another day your encrypted data is being harvested for future decryption.</P>
      <Callout type="warning">The U.S. Government (NSA CNSA 2.0) mandates that National Security Systems must transition to PQC by 2035. NIST recommends beginning migration immediately.</Callout>
    </Doc>
  ),

  'ciso-brief': (
    <Doc title="Enterprise CISO Brief" badge="Business">
      <P>QGuard provides enterprise-grade quantum security that maps directly to your existing risk framework. This brief summarizes the platform capabilities, compliance posture, and deployment options for security leadership evaluation.</P>
      <H2>Executive Summary</H2>
      <P>QGuard is a unified platform for post-quantum cryptographic migration. It detects quantum-vulnerable cryptography across your infrastructure, automates migration to NIST FIPS 203/204/205 standards, and provides continuous monitoring to maintain quantum readiness. Deployment options include cloud SaaS, hybrid, and on-premises.</P>
      <H2>Risk Framework (NIST CSF Mapping)</H2>
      <Table
        heads={['NIST CSF Function', 'QGuard Capability']}
        rows={[
          ['Identify',  'Quantum vulnerability scanning across all cryptographic assets'],
          ['Protect',   'PQC migration wizard with hybrid mode for zero-downtime transition'],
          ['Detect',    'Continuous monitoring with real-time Q-Score and alerting'],
          ['Respond',   'Automated remediation recommendations with one-click migration'],
          ['Recover',   'Rollback snapshots for every migration; 30-day retention'],
        ]}
      />
      <H2>Compliance Coverage</H2>
      <Table
        heads={['Framework', 'QGuard Support']}
        rows={[
          ['NIST FIPS 203/204/205', 'Full compliance — all PQC algorithms are NIST-approved finals'],
          ['SOC 2 Type II',         'Audit-ready reports; continuous monitoring evidence'],
          ['GDPR',                  'Data tokenization; encryption of personal data at rest and in transit'],
          ['HIPAA',                 'PHI encryption with PQC; audit trail for all access'],
          ['PCI-DSS',               'Format-preserving tokenization for cardholder data'],
          ['CNSA 2.0',              'Meets NSA requirements for National Security Systems'],
        ]}
      />
      <H2>Deployment Models</H2>
      <Table
        heads={['Model', 'Description', 'Best For']}
        rows={[
          ['Cloud SaaS',  'Fully managed by QGuard; zero infrastructure overhead',       'SMBs and fast-moving teams'],
          ['Hybrid',      'Control plane in QGuard cloud; data plane in your environment', 'Regulated enterprises'],
          ['On-Premises',  'Entire platform deployed in your data center or private cloud', 'Government and defense'],
        ]}
      />
      <H2>SLA Targets</H2>
      <P>QGuard Enterprise delivers 99.9% platform availability, sub-200ms API response times (p95), 24/7 dedicated support with 1-hour critical response SLA, and quarterly security review briefings with your security team.</P>
      <Callout type="success">Request a personalized threat assessment and proof-of-concept deployment by contacting your QGuard Enterprise account team.</Callout>
    </Doc>
  ),

  'use-cases': (
    <Doc title="Industry Use Cases" badge="Business">
      <P>QGuard serves organizations across regulated industries where data protection is paramount and quantum readiness is becoming a compliance requirement.</P>
      <H2>Financial Services</H2>
      <P><Strong>Scenario:</Strong> A global bank needs to protect transaction data, customer PII, and inter-bank communications from HNDL attacks while maintaining PCI-DSS compliance.</P>
      <P><Strong>Solution:</Strong> QGuard Scanner audits all cryptographic assets across the bank's infrastructure. The Migration Wizard replaces RSA and ECDSA keys with ML-KEM and ML-DSA in hybrid mode. Data Tokenization (FF3-1) protects cardholder data with format-preserving quantum-random tokens, keeping the bank out of PCI-DSS scope for tokenized fields.</P>
      <H2>Healthcare</H2>
      <P><Strong>Scenario:</Strong> A hospital network must protect patient health information (PHI) under HIPAA, with data retention requirements spanning 7+ years — well within the Q-Day window.</P>
      <P><Strong>Solution:</Strong> QGuard Vault encrypts all PHI with ML-KEM-1024. Continuous Monitoring alerts security teams to any quantum-vulnerable cryptography in medical devices, EHR systems, and network infrastructure. Audit trails provide HIPAA-compliant access logs.</P>
      <H2>Government & Defense</H2>
      <P><Strong>Scenario:</Strong> A defense agency must comply with NSA CNSA 2.0 mandates requiring PQC for all National Security Systems by 2035.</P>
      <P><Strong>Solution:</Strong> QGuard On-Premises deployment provides air-gapped quantum security. PKI Certificate Authority issues ML-DSA certificates for classified networks. Cloud Infrastructure Seeding provides quantum entropy for hardware security modules. Full CNSA 2.0 compliance reporting is built in.</P>
      <H2>Technology (Zero-Trust Architecture)</H2>
      <P><Strong>Scenario:</Strong> A SaaS platform implementing zero-trust architecture needs quantum-safe mTLS, service mesh encryption, and API authentication across microservices.</P>
      <P><Strong>Solution:</Strong> QGuard's PKI CA issues short-lived PQC certificates for mTLS. Secure Communications provides quantum-random session keys for service-to-service encryption. OTP services secure developer and operator MFA. Key Management handles automated rotation across all services.</P>
      <Callout type="info">Contact our solutions team for a tailored deployment plan for your industry. QGuard offers proof-of-concept engagements for enterprise customers.</Callout>
    </Doc>
  ),

  /* ── OPERATIONAL ── */
  deployment: (
    <Doc title="Deployment Guide" badge="Operational">
      <P>This guide covers the environment configuration required to deploy the QGuard platform, including the Next.js frontend, Supabase backend, and QRNG FastAPI service.</P>
      <H2>Environment Variables</H2>
      <Table
        heads={['Variable', 'Description', 'Example']}
        rows={[
          ['NEXT_PUBLIC_SUPABASE_URL',     'Your Supabase project URL',           'https://xyz.supabase.co'],
          ['NEXT_PUBLIC_SUPABASE_ANON_KEY','Supabase anonymous/public key',       'eyJhbGciOi...'],
          ['SUPABASE_SERVICE_ROLE_KEY',    'Supabase service role key (server only)','eyJhbGciOi...'],
          ['QRNG_API_URL',                'QRNG FastAPI service URL',             'http://localhost:8420'],
          ['NEXT_PUBLIC_APP_URL',          'Public URL of the QGuard app',        'https://app.qguard.io'],
        ]}
      />
      <H2>Database Setup (Supabase)</H2>
      <Steps>
        <Step n={1} title="Create a Supabase project">Go to supabase.com and create a new project. Note your project URL and anon key.</Step>
        <Step n={2} title="Run migrations">Apply database migrations from <InlineCode>supabase/migrations/</InlineCode> using the Supabase CLI: <InlineCode>supabase db push</InlineCode>.</Step>
        <Step n={3} title="Configure RLS">Row Level Security policies are included in the migrations. Verify they are active in the Supabase dashboard under Authentication → Policies.</Step>
        <Step n={4} title="Set environment variables">Add your Supabase URL and keys to <InlineCode>.env.local</InlineCode>. Never commit this file to version control.</Step>
      </Steps>
      <H2>QRNG Service (FastAPI)</H2>
      <Steps>
        <Step n={1} title="Install dependencies">Navigate to the QRNG service directory and run <InlineCode>pip install -r requirements.txt</InlineCode>. Python 3.10+ is required.</Step>
        <Step n={2} title="Start the service">Run <InlineCode>uvicorn main:app --host 0.0.0.0 --port 8420</InlineCode>. The QRNG service listens on port 8420 by default.</Step>
        <Step n={3} title="Verify health">Call <InlineCode>GET http://localhost:8420/health</InlineCode>. A healthy response returns <InlineCode>{`{"status":"ok","entropy_source":"aer_simulator"}`}</InlineCode>.</Step>
      </Steps>
      <Callout type="warning">Never expose <InlineCode>SUPABASE_SERVICE_ROLE_KEY</InlineCode> to the client. This key bypasses Row Level Security and must only be used in server-side code.</Callout>
    </Doc>
  ),

  'rate-limits': (
    <Doc title="Rate Limits & SLAs" badge="Operational">
      <P>QGuard enforces per-endpoint rate limits to ensure fair usage and platform stability. Limits vary by subscription tier.</P>
      <H2>Rate Limits by Tier</H2>
      <Table
        heads={['Endpoint', 'Free', 'Pro', 'Enterprise']}
        rows={[
          ['Quantum Scan',           '5/day',       '100/day',      'Unlimited'     ],
          ['Key Generation',         '5/day',       '1,000/day',    'Unlimited'     ],
          ['OTP Generate/Verify',    '50/day',      '10,000/day',   'Unlimited'     ],
          ['Tokenize/Detokenize',    '100/day',     '50,000/day',   'Unlimited'     ],
          ['PKI Certificate Sign',   '2/day',       '100/day',      '10,000/day'    ],
          ['QRNG Entropy (batch)',   '10 KB/day',   '10 MB/day',    '1 GB/day'      ],
          ['QRNG Entropy (stream)',  'Not available','1 hr/day',     'Unlimited'     ],
        ]}
      />
      <H2>Burst Handling</H2>
      <P>QGuard uses a token bucket algorithm for rate limiting. Short bursts above the per-second limit are allowed (up to 2x the per-second rate for 10 seconds) before throttling kicks in. This accommodates legitimate traffic spikes without penalizing normal usage.</P>
      <H2>429 Responses</H2>
      <P>When a rate limit is exceeded, the API returns HTTP 429 with a <InlineCode>Retry-After</InlineCode> header indicating when the next request will be accepted. Implement exponential backoff in your client to handle 429 responses gracefully.</P>
      <H2>SLA Targets</H2>
      <Table
        heads={['Metric', 'Free', 'Pro', 'Enterprise']}
        rows={[
          ['Uptime',           'Best effort', '99.5%',     '99.9%'          ],
          ['API Response (p95)','<500ms',     '<200ms',    '<100ms'         ],
          ['Support Response',  'Community',  '24hr email','1hr critical'   ],
          ['Data Durability',   '99.9%',      '99.99%',   '99.999%'        ],
        ]}
      />
      <Callout type="info">Enterprise customers can request custom rate limits and dedicated API endpoints. Contact your account team for a tailored SLA agreement.</Callout>
    </Doc>
  ),

  'audit-trails': (
    <Doc title="Monitoring & Audit" badge="Operational">
      <P>QGuard provides comprehensive health monitoring, metrics collection, and immutable audit logging for compliance and operational visibility.</P>
      <H2>Health Endpoints</H2>
      <Table
        heads={['Endpoint', 'Description', 'Response']}
        rows={[
          ['GET /health',           'Platform health check',           '{"status":"ok","version":"1.0.0"}'],
          ['GET /health/qrng',      'QRNG service health',            '{"status":"ok","entropy_source":"aer_simulator"}'],
          ['GET /health/db',        'Database connectivity check',     '{"status":"ok","latency_ms":12}'],
          ['GET /metrics',          'Prometheus-compatible metrics',    'OpenMetrics format'],
        ]}
      />
      <H2>Metrics Collection</H2>
      <P>QGuard exposes Prometheus-compatible metrics at <InlineCode>/metrics</InlineCode>. Key metrics include: API request rate, error rate, response latency (p50/p95/p99), QRNG entropy generation rate, active scan count, and key generation throughput. Configure your Prometheus or Datadog agent to scrape this endpoint.</P>
      <H2>Audit Log Access</H2>
      <P>Every API call, key operation, scan result, and authentication event is recorded in an immutable audit log. Access the audit log via <InlineCode>GET /api/v1/audit</InlineCode> with filters for date range, event type, user, and resource. Audit logs are retained for 1 year (Pro) or 7 years (Enterprise).</P>
      <H2>Logging Best Practices</H2>
      <Steps>
        <Step n={1} title="Enable structured logging">Configure your application to emit JSON-formatted logs. QGuard's API responses include a <InlineCode>x-request-id</InlineCode> header for request correlation.</Step>
        <Step n={2} title="Forward to SIEM">Export audit logs to your SIEM (Splunk, Elastic, Sentinel) using the webhook integration or the bulk export API.</Step>
        <Step n={3} title="Set up alerts">Configure alerts for: failed authentication attempts ({'>'} 5 in 1 minute), rate limit violations, entropy quality drops below 99.5%, and certificate expiry within 30 days.</Step>
        <Step n={4} title="Regular review">Schedule monthly audit log reviews. QGuard generates a compliance summary report that highlights anomalies and access patterns.</Step>
      </Steps>
      <Callout type="success">QGuard audit logs are cryptographically signed and tamper-evident. Any modification to a log entry invalidates its signature chain.</Callout>
    </Doc>
  ),
}

/* ─────────────────────────────────────────────
   Reusable sub-components
───────────────────────────────────────────── */
function Doc({ title, badge, children }: { title: string; badge: string; children: React.ReactNode }) {
  return (
    <article>
      <div style={{ marginBottom: 32 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-cyan)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{badge}</span>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, marginTop: 8, marginBottom: 0, letterSpacing: '-0.02em', color: 'var(--qg-text-primary)' }}>{title}</h1>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
    </article>
  )
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--qg-text-primary)', marginTop: 24, marginBottom: 4, paddingTop: 24, borderTop: '1px solid var(--qg-border)' }}>{children}</h2>
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--qg-text-secondary)' }}>{children}</p>
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: 'var(--qg-text-primary)', fontWeight: 600 }}>{children}</strong>
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 4, padding: '1px 6px', color: 'var(--qg-cyan)' }}>{children}</code>
}

function Li({ children }: { children: React.ReactNode }) {
  return <li style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--qg-text-secondary)', listStyleType: 'disc' }}>{children}</li>
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 8 }}>{children}</div>
}

function FeatureCard({ icon: Icon, color, title, desc }: { icon: React.ElementType<{ size?: number; style?: React.CSSProperties }>; color: string; title: string; desc: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--qg-border)', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon size={16} style={{ color }} />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: 'var(--qg-text-primary)' }}>{title}</span>
      </div>
      <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--qg-text-secondary)', margin: 0 }}>{desc}</p>
    </div>
  )
}

function Steps({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>{children}</div>
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 16, padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--qg-border)', borderRadius: 12 }}>
      <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--qg-cyan), var(--qg-violet))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 800, color: 'var(--qg-black)' }}>{n}</div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--qg-text-primary)', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--qg-text-secondary)' }}>{children}</div>
      </div>
    </div>
  )
}

function Callout({ type, children }: { type: 'info' | 'success' | 'warning'; children: React.ReactNode }) {
  const colors = { info: 'var(--qg-cyan)', success: 'var(--qg-green)', warning: 'var(--qg-amber)' }
  const color = colors[type]
  return (
    <div style={{ padding: '14px 18px', borderRadius: 10, borderTop: `1px solid ${color}33`, borderRight: `1px solid ${color}33`, borderBottom: `1px solid ${color}33`, borderLeft: `3px solid ${color}`, background: `${color}0d` }}>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--qg-text-secondary)', margin: 0 }}>{children}</p>
    </div>
  )
}

function ApiRefLink({ href, service }: { href: string; service: string }) {
  return (
    <div style={{
      marginTop: 24, padding: '14px 18px', borderRadius: 10,
      border: '1px solid rgba(0,212,255,0.3)',
      background: 'rgba(0,212,255,0.04)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <span style={{ fontSize: 13, color: 'var(--qg-text-secondary)' }}>
        Ready to integrate? View the complete {service} API reference with interactive playground.
      </span>
      <a href={href} style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
        color: 'var(--qg-cyan)', textDecoration: 'none',
        display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
      }}>
        API Docs →
      </a>
    </div>
  )
}

function Table({ heads, rows }: { heads: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--qg-border)', marginTop: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'rgba(0,212,255,0.06)' }}>
            {heads.map(h => <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--qg-cyan)', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--qg-border)', whiteSpace: 'nowrap' }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
              {row.map((cell, j) => <td key={j} style={{ padding: '10px 16px', color: j === 0 ? 'var(--qg-text-primary)' : 'var(--qg-text-secondary)', verticalAlign: 'top' }}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Main Docs Page
───────────────────────────────────────────── */
export default function DocsPage() {
  const [active, setActive] = useState('overview')
  const [mobileOpen, setMobileOpen] = useState(false)

  const content = SECTIONS[active] ?? SECTIONS['overview']

  return (
    <div style={{ background: 'var(--qg-black)', minHeight: '100vh', color: 'var(--qg-text-primary)' }}>

      {/* Top bar */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(3,3,8,0.92)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--qg-border)',
        height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => setMobileOpen(o => !o)}
            style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--qg-text-secondary)', padding: 4 }}
            className="lg:hidden"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <BookOpen size={18} style={{ color: 'var(--qg-cyan)' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, background: 'linear-gradient(135deg, var(--qg-cyan), var(--qg-violet))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              QGuard Docs
            </span>
          </Link>
          <span style={{ width: 1, height: 16, background: 'var(--qg-border)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-text-muted)', letterSpacing: '0.08em' }}>v1.0 · NIST FIPS 203/204</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--qg-cyan)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--qg-text-secondary)'}
          >
            ← Back to Home
          </Link>
          <Link href="/login" style={{
            fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
            padding: '6px 16px', borderRadius: 8, textDecoration: 'none',
            background: 'linear-gradient(135deg, var(--qg-cyan), var(--qg-violet))',
            color: 'var(--qg-black)', letterSpacing: '0.06em',
          }}>
            Get Started Free
          </Link>
        </div>
      </header>

      <div style={{ display: 'flex', paddingTop: 60, minHeight: '100vh' }}>

        {/* Sidebar */}
        <aside style={{
          width: 260, flexShrink: 0, position: 'fixed', top: 60, bottom: 0,
          overflowY: 'auto', borderRight: '1px solid var(--qg-border)',
          background: 'rgba(10,10,26,0.8)', backdropFilter: 'blur(12px)',
          padding: '24px 0',
          zIndex: 40,
          transform: mobileOpen ? 'translateX(0)' : undefined,
        }}
        >
          {NAV.map(({ section, icon: SectionIcon, items }) => (
            <div key={section} style={{ marginBottom: 28 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0 20px', marginBottom: 8,
                fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                color: 'var(--qg-text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase',
              }}>
                <SectionIcon size={12} />
                {section}
              </div>
              {items.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => id === 'api-docs' ? window.location.href = '/docs/api' : setActive(id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '7px 20px', textAlign: 'left',
                    background: active === id ? 'rgba(0,212,255,0.08)' : 'none',
                    borderTop: 'none', borderRight: 'none', borderBottom: 'none',
                    borderLeft: active === id ? '2px solid var(--qg-cyan)' : '2px solid transparent',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)', fontSize: 13,
                    fontWeight: active === id ? 600 : 400,
                    color: active === id ? 'var(--qg-cyan)' : 'var(--qg-text-secondary)',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (active !== id) { e.currentTarget.style.color = 'var(--qg-text-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' } }}
                  onMouseLeave={e => { if (active !== id) { e.currentTarget.style.color = 'var(--qg-text-secondary)'; e.currentTarget.style.background = 'none' } }}
                >
                  <ChevronRight size={12} style={{ opacity: active === id ? 1 : 0, color: 'var(--qg-cyan)', flexShrink: 0 }} />
                  {label}
                </button>
              ))}
            </div>
          ))}
        </aside>

        {/* Main content */}
        <main style={{
          flex: 1,
          marginLeft: 260,
          padding: '48px 48px',
          maxWidth: 'calc(100% - 260px)',
          minWidth: 0,
        }}>
          {content}

          {/* Bottom nav */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 64, paddingTop: 32, borderTop: '1px solid var(--qg-border)',
          }}>
            {(() => {
              const allItems = NAV.flatMap(s => s.items)
              const idx = allItems.findIndex(i => i.id === active)
              const prev = allItems[idx - 1]
              const next = allItems[idx + 1]
              return (
                <>
                  {prev ? (
                    <button onClick={() => setActive(prev.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: '1px solid var(--qg-border)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', color: 'var(--qg-text-secondary)', fontSize: 13, transition: 'all 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--qg-cyan)'; e.currentTarget.style.color = 'var(--qg-cyan)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--qg-border)'; e.currentTarget.style.color = 'var(--qg-text-secondary)' }}
                    >
                      ← {prev.label}
                    </button>
                  ) : <div />}
                  {next && (
                    <button onClick={() => setActive(next.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, rgba(0,212,255,0.1), rgba(139,92,246,0.1))', border: '1px solid rgba(0,212,255,0.3)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', color: 'var(--qg-cyan)', fontSize: 13, transition: 'all 0.2s' }}>
                      {next.label} <ArrowRight size={14} />
                    </button>
                  )}
                </>
              )
            })()}
          </div>
        </main>
      </div>
    </div>
  )
}
