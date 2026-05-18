/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'motion/react';
import { Hero195 } from "@/components/ui/hero-195";
import {
  Activity,
  Gamepad2,
  Shield,
  Check,
  Clock,
  Cloud,
  Hourglass as HourglassIcon,
  Map,
  Database,
  KeyRound,
  Lock,
  LockKeyhole,
  AlertTriangle,
  MoveRight,
  FileCheck,
  Users,
  Search,
  SearchCheck,
  Zap,
  TrendingDown,
  Globe,
  Skull,
  Play,
  ChevronDown,
  Plus,
  RefreshCcw,
  Star,
  Twitter,
  Linkedin,
  Youtube,
  Facebook,
  Github,
  Flame,
  type LucideIcon
} from 'lucide-react';
import { CyberBackground } from '../components/CyberBackground';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { TooltipProvider } from '../components/ui/tooltip';
import hourGlassVideo from '../assets/Hour_Glass_Video.mp4';
import hourglassImage from '../assets/images/futuristic_hourglass_sand_1778137402905.png';
import roadmapImage from '../assets/images/quantum_security_roadmap_assets_1778137420732.png';

// Asset paths
const ASSETS = {
  hourglass: hourglassImage,
  hourglassVideo: hourGlassVideo,
  roadmap: roadmapImage
};

const HERO_ACCESSIBLE_TITLE = 'The Quantum Clock is Ticking';
const HERO_LINE_ONE = 'The Quantum';
const HERO_LINE_TWO_PREFIX = 'Clock is ';
const HERO_TICKING_WORD = 'TICKING';
const HERO_CHARACTER_COUNT = HERO_LINE_ONE.length + HERO_LINE_TWO_PREFIX.length + HERO_TICKING_WORD.length;
const HERO_TYPE_INTERVAL_MS = 72;
const QUANTUM_MATURITY_TARGET = new Date(2029, 8, 9, 0, 0, 0);
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;
const MS_PER_SECOND = 1000;
const ENTERPRISE_CYCLE_MS = 5000;
const USE_CASE_CYCLE_MS = 6200;

type EnterpriseProtectionFeature = {
  id: string;
  name: string;
  title: string;
  description: string;
  metric: string;
  status: string;
  image: string;
  icon: LucideIcon;
};

type QuantumUseCaseFeature = {
  id: number;
  title: string;
  description: string;
  image: string;
  icon: LucideIcon;
  useCases: string[];
  keyFeatures: string[];
};

const ENTERPRISE_PROTECTION_FEATURES: EnterpriseProtectionFeature[] = [
  {
    id: "scanner",
    name: "Scanner",
    title: "Quantum Vulnerability Scanner",
    description:
      "Comprehensive quantum-vulnerability detection across your entire attack surface. Scan your assets for cryptographic algorithms vulnerable to quantum attacks. Get your real-time Q-Score.",
    metric: "92/100 Q-Score",
    status: "Active",
    image: "/Scanner.png",
    icon: SearchCheck
  },
  {
    id: "migration",
    name: "Migration",
    title: "PQC Migration Wizard",
    description:
      "One-click migration to NIST-approved post-quantum cryptography. ML-KEM (Kyber) for encryption, ML-DSA (Dilithium) for signatures.",
    metric: "62% Ready",
    status: "PQC Ready",
    image: "/migration_wizard.png",
    icon: RefreshCcw
  },
  {
    id: "keygen",
    name: "Keygen",
    title: "Quantum Key Generator",
    description:
      "Generate true quantum-random keys using QRNG entropy sources. Far superior to classical pseudo-random number generators.",
    metric: "99.997% Entropy",
    status: "Secure",
    image: "/Encryption_key.png",
    icon: KeyRound
  },
  {
    id: "simulator",
    name: "Simulator",
    title: "Threat Simulator",
    description:
      "Watch Shor's algorithm crack weak RSA keys in real-time. Earn Quantum Shield badges and compete on leaderboards.",
    metric: "2,341 Runs",
    status: "Simulating",
    image: "/simulator.png",
    icon: Gamepad2
  },
  {
    id: "vault",
    name: "Vault",
    title: "Secure Quantum Vault",
    description:
      "PQC-encrypted secure vault for file storage and messaging, delivering end-to-end quantum-resistant protection for encrypted files, communications, and sensitive data.",
    metric: "12,580 Files",
    status: "Encrypted",
    image: "/vault.png",
    icon: LockKeyhole
  },
  {
    id: "monitor",
    name: "Monitor",
    title: "Continuous Monitoring",
    description:
      "Always-on background scanning with real-time alerts. Track your Q-Score trend and get proactive protection recommendations.",
    metric: "24.8K Events",
    status: "Real-Time",
    image: "/monitoring.png",
    icon: Activity
  },
  {
    id: "governance",
    name: "Governance",
    title: "Governance & Compliance",
    description:
      "Enterprise-grade policy enforcement and compliance reporting. Align your cryptographic posture with NIST 800-203 and CNSA 2.0 standards automatically with full audit trails.",
    metric: "100% Compliant",
    status: "Audited",
    image: "/governance.png",
    icon: FileCheck
  }
];

const QUANTUM_USE_CASES: QuantumUseCaseFeature[] = [
  {
    id: 1,
    title: "Quantum QRNG",
    description: "True random number generation using quantum mechanics for cryptographic keys and security tokens.",
    icon: Zap,
    image: "/Quantum_qrng.png",
    useCases: [
      "Real-time key generation for encryption",
      "Secure session IDs generation",
      "Quantum-based OTP generation for financial transactions",
      "Multi-factor authentication token generation",
      "Random number generation for lotteries",
      "Quantum-enhanced MFA for secure access",
      "Secure token generation",
      "Random sampling for analytics"
    ],
    keyFeatures: [
      "Quantum-based randomness",
      "High entropy generation",
      "Cryptographically secure",
      "Real-time random numbers",
      "Quantum noise source",
      "Perfect unpredictability"
    ]
  },
  {
    id: 2,
    title: "Encryption Services",
    description: "Post-quantum encryption solutions protecting data against quantum computing threats.",
    icon: KeyRound,
    image: "/Encryption_services.png",
    useCases: [
      "Secure data transmission",
      "File encryption",
      "Database encryption",
      "Secure messaging",
      "Cloud storage protection",
      "Secure API communication"
    ],
    keyFeatures: [
      "Quantum-resistant algorithms",
      "End-to-end encryption",
      "Key exchange protocols",
      "Data encryption",
      "Secure communication",
      "Hybrid encryption"
    ]
  },
  {
    id: 3,
    title: "Security Authentication",
    description: "Quantum-enhanced authentication systems for secure identity verification.",
    icon: Shield,
    image: "/Security_authentication.png",
    useCases: [
      "Multi-factor authentication",
      "Secure login",
      "Session management",
      "Access control",
      "Identity verification",
      "Secure transactions"
    ],
    keyFeatures: [
      "Quantum authentication",
      "Multi-factor authentication",
      "Biometric verification",
      "Secure session management",
      "Token-based authentication",
      "Real-time validation"
    ]
  },
  {
    id: 4,
    title: "Digital Certificates",
    description: "Quantum-secure digital certificates for trusted identity and encryption.",
    icon: FileCheck,
    image: "/Digital_certificates.png",
    useCases: [
      "SSL/TLS certificate management",
      "Code signing",
      "Document signing",
      "Identity verification",
      "Secure email",
      "IoT device authentication"
    ],
    keyFeatures: [
      "Quantum certificate authority",
      "PKI infrastructure",
      "Certificate lifecycle",
      "Certificate revocation",
      "Secure distribution",
      "Quantum signatures"
    ]
  },
  {
    id: 5,
    title: "Tokenization",
    description: "Quantum-safe tokenization for secure data representation and transmission.",
    icon: Activity,
    image: "/Tokenization.png",
    useCases: [
      "Payment tokenization",
      "PII protection",
      "Secure data sharing",
      "Compliance reporting",
      "Secure API tokens",
      "Database tokenization"
    ],
    keyFeatures: [
      "Data tokenization",
      "Token management",
      "Secure storage",
      "Token validation",
      "Quantum-resistant",
      "Compliance support"
    ]
  },
  {
    id: 6,
    title: "Secure Communications",
    description: "Quantum-safe communication protocols for secure data transfer.",
    icon: Globe,
    image: "/Secure_communication.png",
    useCases: [
      "Secure video conferencing",
      "Encrypted messaging",
      "Secure file transfer",
      "Secure API communication",
      "IoT device communication",
      "Secure remote access"
    ],
    keyFeatures: [
      "Quantum key distribution",
      "Secure messaging",
      "Encrypted channels",
      "Data integrity",
      "Secure file transfer",
      "Quantum protocols"
    ]
  },
  {
    id: 7,
    title: "Cloud Security",
    description: "Quantum-enhanced security for multi-cloud environments and infrastructure.",
    icon: Cloud,
    image: "/Cloud_security.png",
    useCases: [
      "Multi-cloud encryption",
      "Secure container management",
      "Cloud workload protection",
      "Data sovereignty compliance",
      "Secure API gateway",
      "Cloud infrastructure security"
    ],
    keyFeatures: [
      "Quantum cloud security",
      "Multi-cloud protection",
      "Infrastructure security",
      "Compliance monitoring",
      "Data protection",
      "Quantum encryption"
    ]
  }
];

const TRUSTED_LEADERS = [
  "Vercel",
  "GitHub",
  "Microsoft",
  "Apple",
  "Google",
  "Amazon",
  "Meta",
  "Claude",
  "Clerk",
  "NVIDIA",
  "Supabase",
  "OpenAI",
  "Turso"
];

const TESTIMONIALS = [
  {
    text: "QGuard detected three RSA-2048 vulnerabilities in our cloud infrastructure within minutes. The PQC migration wizard replaced them with ML-KEM in under 20 minutes with zero downtime. Incredible.",
    image: "https://randomuser.me/api/portraits/men/32.jpg",
    name: "Daniel Olsen",
    role: "CEO, FinTech Startup"
  },
  {
    text: "As a security researcher, I was skeptical. But QGuard's Q-Score dashboard gave us the clearest picture of our cryptographic risk posture I've ever seen. The entropy quality reports are genuinely impressive.",
    image: "https://randomuser.me/api/portraits/women/44.jpg",
    name: "Dr. Josephine Hazelwood",
    role: "Cybersecurity Researcher, University of Technology"
  },
  {
    text: "We migrated our entire authentication stack to ML-DSA using the QGuard wizard. The hybrid mode let us keep backward compatibility while transitioning, exactly what we needed.",
    image: "https://randomuser.me/api/portraits/men/17.jpg",
    name: "Lucas Davencork",
    role: "Senior Engineer"
  },
  {
    text: "The Quantum Vault is phenomenal. My team stores sensitive client documents with confidence knowing ML-KEM-1024 encryption means even a quantum computer can't touch them.",
    image: "https://randomuser.me/api/portraits/women/63.jpg",
    name: "Amira Jones",
    role: "VP of Compliance, GlobalTech"
  },
  {
    text: "Running the threat simulator showed our exec team exactly how Shor's algorithm would crack our legacy RSA keys. That demo alone got our quantum migration budget approved instantly.",
    image: "https://www.loremfaces.net/96/id/4.jpg",
    name: "Carlos Santorini",
    role: "CISO, Enterprise Finance"
  },
  {
    text: "The QRNG key generator produces keys with a 99.7% entropy score. We've integrated it directly into our CI/CD pipeline. Our cryptographic hygiene has never been better.",
    image: "https://www.loremfaces.net/96/id/1.jpg",
    name: "Sofia Curtis",
    role: "Security Lead"
  },
  {
    text: "QGuard flagged SHA-1 usage buried deep in a third-party library we hadn't even audited in two years. The continuous monitoring saved us from a serious vulnerability before it became a problem.",
    image: "https://randomuser.me/api/portraits/men/81.jpg",
    name: "Cyze Joe",
    role: "IT Security, AI Corp"
  },
  {
    text: "I set up vault. My parents' devices are now PQC-protected and they didn't have to do a single thing. QGuard handled everything quietly in the background.",
    image: "https://www.loremfaces.net/96/id/2.jpg",
    name: "Randy Smith",
    role: "Software Engineer"
  },
  {
    text: "The compliance reports QGuard generates for NIST FIPS 203/204 alignment are audit-ready out of the box. Cut our compliance prep time from weeks to hours.",
    image: "https://www.loremfaces.net/96/id/3.jpg",
    name: "Joseph Saintclaire",
    role: "Chief Officer Banking and Finance, SecureBank"
  }
];

const PRICING_PLANS = [
  {
    name: "Starter Plan",
    price: "5",
    yearlyPrice: "3",
    period: "month",
    features: [
      "10 quantum vulnerability scans per month",
      "Q-Score dashboard",
      "Threat simulator (basic)",
      "5 QRNG keys per month",
      "5 GB Quantum Vault"
    ],
    description: "Get started with quantum security at no cost",
    buttonText: "Start Free",
    isPopular: false
  },
  {
    name: "Pro",
    price: "10",
    yearlyPrice: "8",
    period: "month",
    features: [
      "Unlimited deep scans",
      "Full PQC migration wizard",
      "Advanced threat simulator",
      "Unlimited QRNG keys",
      "20 GB Quantum Vault with 2 years data retention",
      "Quantum Messaging",
      "Advanced QML detection",
      "Priority support"
    ],
    description: "Ideal for individuals and small teams",
    buttonText: "Go Pro",
    isPopular: true
  },
  {
    name: "Elite",
    price: "50",
    yearlyPrice: "40",
    period: "month",
    features: [
      "Unlimited deep scans",
      "Full PQC migration wizard",
      "Advanced threat simulator",
      "Unlimited QRNG keys",
      "50 GB Quantum Vault",
      "Quantum Messaging",
      "Advanced QML detection",
      "Priority support"
    ],
    description: "Maximum protection for families and power users",
    buttonText: "Go Elite",
    isPopular: false
  }
];

const FAQ_CATEGORIES = [
  { key: "q-day", label: "Q-Day & Threats" },
  { key: "migration", label: "PQC Migration" },
  { key: "vault", label: "Quantum Vault" },
  { key: "keygen", label: "Key Generation" }
] as const;

const FAQ_DATA = {
  "q-day": [
    {
      question: "What is Q-Day?",
      answer: "Q-Day is the anticipated moment when quantum computers become powerful enough to break widely-used public-key cryptography, specifically RSA and ECC. Experts estimate this could arrive between 2030 and 2040, but some projections place it sooner given the rapid pace of qubit development."
    },
    {
      question: "What is a \"Harvest Now, Decrypt Later\" (HNDL) attack?",
      answer: "Nation-state actors are already intercepting and archiving encrypted internet traffic today. They plan to decrypt it once quantum computers can crack RSA/ECC. This means data encrypted right now, including health records, financial data, and private communications, is already at risk of future exposure."
    },
    {
      question: "How does Shor's algorithm threaten my encryption?",
      answer: "Shor's algorithm is a quantum algorithm that can factor large integers and solve discrete logarithm problems in polynomial time, tasks that take classical computers billions of years. This directly breaks RSA-2048 and ECDSA, the foundations of TLS, SSH, and most digital signatures in use today."
    },
    {
      question: "What is Grover's algorithm and why does it matter for symmetric encryption?",
      answer: "Grover's algorithm provides a quadratic speedup for unstructured search problems. For symmetric ciphers like AES-128, this effectively halves the security level to 64 bits, making it vulnerable. AES-256 reduces to 128-bit effective security, which remains acceptable. QGuard flags AES-128 usage as a medium-severity finding."
    },
    {
      question: "Is the quantum threat real today or just theoretical?",
      answer: "The threat is real today via HNDL attacks. Adversaries do not need a quantum computer yet. They only need to harvest your data now and wait. IBM, Google, and various nation-state programs have demonstrated exponential qubit scaling. NIST finalized post-quantum standards FIPS 203, 204, and 205 in 2024 precisely because this threat is imminent."
    }
  ],
  migration: [
    {
      question: "What is Post-Quantum Cryptography (PQC)?",
      answer: "PQC refers to cryptographic algorithms designed to be secure against both classical and quantum computers. NIST standardized three algorithms in 2024: ML-KEM for key encapsulation, ML-DSA for digital signatures, and SPHINCS+ as a stateless hash-based signature scheme."
    },
    {
      question: "How does the QGuard PQC Migration Wizard work?",
      answer: "The wizard scans your codebase, certificates, and infrastructure for legacy cryptographic primitives including RSA, ECDSA, Diffie-Hellman, and SHA-1. It then generates a migration plan and applies NIST-approved replacements, ML-KEM for encryption and ML-DSA for signatures, using liboqs-based templates. The entire process typically takes under 20 minutes with zero downtime."
    },
    {
      question: "What is hybrid mode migration?",
      answer: "Hybrid mode runs ML-KEM alongside your existing RSA/ECC simultaneously during the transition window. This ensures backward compatibility with clients that have not yet migrated, while still protecting against quantum-capable adversaries. QGuard automatically manages the hybrid handshake negotiation."
    },
    {
      question: "Will PQC migration break my existing systems?",
      answer: "QGuard uses rollback-safe migration snapshots before applying any changes. Hybrid mode ensures backward compatibility throughout. You can also run the migration in a staging environment first. Our compliance report generation gives you full audit trails for every change made."
    },
    {
      question: "Does QGuard support CI/CD pipeline integration?",
      answer: "Yes. QGuard provides a GitHub Actions integration, a Docker-based CLI scanner, and a REST API for embedding PQC compliance checks directly into your pipeline. Failed scans can be configured to block merges, ensuring no quantum-vulnerable code reaches production."
    }
  ],
  vault: [
    {
      question: "What is the Quantum Vault?",
      answer: "Quantum Vault is a zero-knowledge, PQC-encrypted file storage system. Every file is wrapped in ML-KEM-1024 encryption before it leaves your device. The vault server never sees your plaintext, only ciphertext arrives at rest. Even a full server breach exposes nothing readable."
    },
    {
      question: "What encryption does the Quantum Vault use?",
      answer: "The vault uses ML-KEM-1024, NIST FIPS 203 security level 5, for key encapsulation and AES-256-GCM for symmetric file encryption. File integrity is verified using Merkle proofs. This combination is designed to remain secure beyond 2050 even with quantum hardware."
    },
    {
      question: "How does family sharing work in the Quantum Vault?",
      answer: "Invited members receive their own ML-KEM key pair. Shared folders use per-member key wrapping, so each member decrypts with their own private key. Revoking one member instantly invalidates only their key wrap, leaving all other members unaffected and the underlying data unchanged."
    },
    {
      question: "Is the Quantum Vault available offline?",
      answer: "Files synced to your device are accessible offline. Encryption and decryption happen locally using your private key, which never leaves your device. Cross-device sync occurs over an end-to-end encrypted channel when you reconnect."
    },
    {
      question: "What happens to my files if QGuard is shut down?",
      answer: "Your vault key pair is generated and stored locally on your device. QGuard provides an export feature that bundles your encrypted files and your key pair into a portable archive. You can decrypt your files independently using any liboqs-compatible tool."
    }
  ],
  keygen: [
    {
      question: "What is QRNG and why is it better than classical random number generators?",
      answer: "QRNG, or Quantum Random Number Generator, derives entropy from quantum physical processes such as photon arrival times, vacuum fluctuations, or radioactive decay, which are fundamentally non-deterministic. Classical PRNGs are seeded algorithms: if an attacker learns the seed or state, they can predict all future outputs. Quantum entropy has no seed, so it is physically impossible to predict."
    },
    {
      question: "What key types can QGuard generate?",
      answer: "QGuard generates ML-KEM-512, ML-KEM-768, and ML-KEM-1024 key pairs for encryption, ML-DSA-44, ML-DSA-65, and ML-DSA-87 signing key pairs, and SPHINCS+-SHAKE-256 stateless hash-based signature keys. All keys are seeded with QRNG entropy."
    },
    {
      question: "What entropy quality score does QGuard produce?",
      answer: "QGuard keys achieve a minimum entropy quality score of 99.7% as measured by NIST SP 800-90B statistical test suites. The entropy scoring dashboard shows the randomness health of each generated key in real time."
    },
    {
      question: "Can I export keys to an HSM or external system?",
      answer: "Yes. QGuard supports secure export in PKCS#8 and JWK formats. For enterprise customers, direct HSM push is available via PKCS#11 interface for compatible hardware security modules including Thales, Yubico, and AWS CloudHSM. Keys are never transmitted in plaintext during export."
    },
    {
      question: "How do I integrate QRNG key generation into my CI/CD pipeline?",
      answer: "QGuard exposes a REST API endpoint for programmatic key generation. Your pipeline calls the endpoint, receives the key pair, and the private key is immediately encrypted with your vault master key before storage. Public keys are automatically pushed to your configured certificate store or key management system."
    }
  ]
};

function padNumber(value: number, size: number) {
  return String(Math.max(0, value)).padStart(size, '0');
}

function getQuantumCountdown(now: Date) {
  if (now >= QUANTUM_MATURITY_TARGET) {
    return [
      { label: 'Years', value: '00' },
      { label: 'Days', value: '000' },
      { label: 'Hours', value: '00' },
      { label: 'Minutes', value: '00' },
      { label: 'Seconds', value: '00' }
    ];
  }

  let years = QUANTUM_MATURITY_TARGET.getFullYear() - now.getFullYear();
  const yearAnchor = new Date(now);
  yearAnchor.setFullYear(now.getFullYear() + years);

  if (yearAnchor > QUANTUM_MATURITY_TARGET) {
    years -= 1;
    yearAnchor.setFullYear(now.getFullYear() + years);
  }

  let remaining = QUANTUM_MATURITY_TARGET.getTime() - yearAnchor.getTime();
  const days = Math.floor(remaining / MS_PER_DAY);
  remaining -= days * MS_PER_DAY;
  const hours = Math.floor(remaining / MS_PER_HOUR);
  remaining -= hours * MS_PER_HOUR;
  const minutes = Math.floor(remaining / MS_PER_MINUTE);
  remaining -= minutes * MS_PER_MINUTE;
  const seconds = Math.floor(remaining / MS_PER_SECOND);

  return [
    { label: 'Years', value: padNumber(years, 2) },
    { label: 'Days', value: padNumber(days, 3) },
    { label: 'Hours', value: padNumber(hours, 2) },
    { label: 'Minutes', value: padNumber(minutes, 2) },
    { label: 'Seconds', value: padNumber(seconds, 2) }
  ];
}

function EnterpriseProtectionShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeFeature = ENTERPRISE_PROTECTION_FEATURES[activeIndex];
  const ActiveIcon = activeFeature.icon;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % ENTERPRISE_PROTECTION_FEATURES.length);
    }, ENTERPRISE_CYCLE_MS);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.75 }}
      viewport={{ once: true, amount: 0.18 }}
      className="mt-24"
    >
      <div className="mb-10 text-center md:mb-14">
        <h3 className="text-4xl font-black leading-tight tracking-[0.08em] text-white md:text-6xl">
          Enterprise-Grade <span className="block text-gold gold-glow md:inline">Protection</span>
        </h3>
        <p className="mt-4 text-sm leading-7 text-muted-foreground md:text-base">
          Everything you need to survive the quantum computing revolution.
        </p>
      </div>

      <div className="group relative overflow-hidden rounded-2xl border border-gold/25 bg-cyber-navy/35 shadow-[0_32px_120px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-all duration-500 hover:border-gold/55 hover:shadow-[0_0_46px_rgba(212,175,55,0.24),0_32px_120px_rgba(0,0,0,0.55)]">
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(212,175,55,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(212,175,55,0.08)_1px,transparent_1px)] [background-size:38px_38px]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(212,175,55,0.18),transparent_38%),radial-gradient(circle_at_78%_58%,rgba(255,243,193,0.08),transparent_36%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.1),transparent_30%,rgba(212,175,55,0.08)_100%)] opacity-60" />

        <div className="relative z-10 grid min-h-[620px] gap-8 p-6 md:min-h-[560px] md:p-10 lg:grid-cols-[0.9fr_1.1fr] lg:p-12">
          <motion.div
            key={activeFeature.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42 }}
            className="relative flex h-full min-h-[360px] flex-col justify-between overflow-hidden rounded-2xl border border-gold/15 bg-black/30 p-7 shadow-[0_18px_70px_rgba(0,0,0,0.36)] backdrop-blur-xl transition-all duration-500 group-hover:border-gold/35 md:p-8"
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),transparent_32%,rgba(212,175,55,0.1))]" />
            <div className="relative z-10">
              <div className="mb-8 flex items-center justify-between gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold shadow-[0_0_28px_rgba(212,175,55,0.2)] transition-all duration-500 group-hover:scale-105 group-hover:shadow-[0_0_34px_rgba(212,175,55,0.4)]">
                  <ActiveIcon className="h-8 w-8" />
                </div>
                <span className="rounded-full border border-gold/25 bg-gold/10 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-gold">
                  {activeFeature.status}
                </span>
              </div>

              <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                {activeFeature.name}
              </span>
              <h4 className="mt-6 max-w-xl text-3xl font-black leading-tight tracking-normal text-white md:text-4xl">
                {activeFeature.title}
              </h4>
              <p className="mt-6 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base md:leading-8">
                {activeFeature.description}
              </p>
            </div>

            <div className="relative z-10 mt-8 grid gap-3 sm:grid-cols-[minmax(110px,auto)_minmax(170px,auto)]">
              <span className="inline-flex min-h-10 items-center justify-center rounded-full border border-gold/25 bg-gold/10 px-5 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-gold">
                {activeFeature.status}
              </span>
              <span className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-5 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-white/75">
                {activeFeature.metric}
              </span>
            </div>
          </motion.div>

          <div className="relative min-h-[310px] overflow-hidden rounded-2xl border border-gold/15 bg-black/25 shadow-2xl md:min-h-[420px]">
            <motion.img
              key={activeFeature.image}
              src={activeFeature.image}
              alt={`${activeFeature.title} preview`}
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 h-full w-full object-cover opacity-75 saturate-75 transition-all duration-700 group-hover:opacity-90 group-hover:saturate-100"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-cyber-black/82 via-cyber-black/28 to-cyber-black/42" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_20%,rgba(0,2,5,0.78)_100%)]" />
            <div className="absolute bottom-6 left-6 right-6 flex flex-col gap-3 rounded-xl border border-gold/15 bg-cyber-black/58 px-5 py-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">
                Enterprise module {activeIndex + 1}/{ENTERPRISE_PROTECTION_FEATURES.length}
              </span>
              <span className="h-2.5 w-2.5 rounded-full bg-gold shadow-[0_0_18px_rgba(212,175,55,0.85)]" />
            </div>
          </div>
        </div>
      </div>

      <nav aria-label="Enterprise protection modules" className="mt-8 flex justify-center px-2">
        <ol className="flex flex-wrap items-center justify-center gap-2">
          {ENTERPRISE_PROTECTION_FEATURES.map((feature, index) => {
            const isCurrent = activeIndex === index;

            return (
              <li key={feature.id}>
                <button
                  type="button"
                  aria-label={feature.title}
                  title={feature.title}
                  onClick={() => setActiveIndex(index)}
                  className={`group flex min-h-9 items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] transition-all duration-300 ${isCurrent
                    ? 'border-gold bg-gold text-cyber-black shadow-[0_0_28px_rgba(212,175,55,0.36)]'
                    : 'border-gold/15 bg-white/[0.04] text-white/60 hover:border-gold/45 hover:bg-gold/10 hover:text-gold'
                    }`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${isCurrent ? 'bg-cyber-black text-gold' : 'bg-white/10 text-white/65 group-hover:bg-gold/20 group-hover:text-gold'
                    }`}>
                    {index + 1}
                  </span>
                  <span className="hidden sm:inline">{feature.name}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </motion.div>
  );
}

function QuantumSecurityUseCasesSection() {
  const [activeIndex, setActiveIndex] = useState(2);
  const [progress, setProgress] = useState(0);
  const activeFeature = QUANTUM_USE_CASES[activeIndex];
  const ActiveIcon = activeFeature.icon;

  useEffect(() => {
    setProgress(0);
  }, [activeIndex]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress((current) => Math.min(100, current + 2));
    }, USE_CASE_CYCLE_MS / 50);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % QUANTUM_USE_CASES.length);
    }, USE_CASE_CYCLE_MS);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <motion.section
      id="use-cases"
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.75 }}
      viewport={{ once: true, amount: 0.15 }}
      className="relative mt-24 scroll-mt-24 overflow-hidden rounded-2xl border border-gold/18 bg-cyber-navy/25 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.46)] backdrop-blur-2xl sm:p-10"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_16%,rgba(212,175,55,0.14),transparent_32%),radial-gradient(circle_at_82%_24%,rgba(255,243,193,0.08),transparent_34%),linear-gradient(180deg,rgba(212,175,55,0.04),transparent_48%,rgba(212,175,55,0.03))]" />
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(circle,rgba(212,175,55,0.24)_1px,transparent_1px)] [background-size:32px_32px]" />

      <div className="relative z-10">
        <header className="mx-auto mb-12 max-w-5xl text-center md:mb-16">
          <div className="mb-5 flex items-center justify-center gap-4">
            <span className="h-px w-24 bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
            <span className="rounded-full border border-gold/25 bg-gold/10 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
              Applied Quantum Defense
            </span>
            <span className="h-px w-24 bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
          </div>
          <h3 className="text-4xl font-black uppercase leading-[1.02] tracking-[0.08em] text-white md:text-6xl">
            Quantum Security
            <span className="mt-2 block text-gold gold-glow">Use Cases</span>
          </h3>
          <div className="mx-auto mt-6 flex w-full max-w-xl items-center justify-center gap-3">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/55 to-transparent" />
            <span className="h-3 w-3 rotate-45 rounded-[3px] border border-gold/75 shadow-[0_0_18px_rgba(212,175,55,0.65)]" />
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/55 to-transparent" />
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
            Harnessing quantum mechanics to build the next generation of unbreakable security.
          </p>
        </header>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(300px,380px)_1fr] lg:gap-10">
          <div className="flex gap-4 overflow-x-auto pb-3 lg:flex-col lg:gap-3 lg:overflow-visible lg:pb-0">
            {QUANTUM_USE_CASES.map((feature, index) => {
              const Icon = feature.icon;
              const isActive = activeIndex === index;

              return (
                <button
                  key={feature.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`group min-w-[280px] rounded-lg border p-4 text-left shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all duration-500 lg:min-w-0 ${isActive
                    ? 'border-gold/75 bg-gold/[0.08] shadow-[0_0_34px_rgba(212,175,55,0.24),0_18px_70px_rgba(0,0,0,0.32)]'
                    : 'border-white/10 bg-white/[0.035] hover:border-gold/40 hover:bg-gold/[0.05] hover:shadow-[0_0_28px_rgba(212,175,55,0.15)]'
                    }`}
                >
                  <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-3">
                    <span className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-500 ${isActive
                      ? 'border-gold/60 bg-gold text-cyber-black shadow-[0_0_24px_rgba(212,175,55,0.42)]'
                      : 'border-gold/20 bg-gold/10 text-gold group-hover:border-gold/45'
                      }`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className={`block font-bold uppercase tracking-wide ${isActive ? 'text-white' : 'text-white/70 group-hover:text-gold'}`}>
                        {feature.title}
                      </span>
                      <span className="mt-1.5 block text-xs leading-5 text-muted-foreground">
                        {feature.description}
                      </span>
                      <span className="mt-3 block h-1 overflow-hidden rounded-full bg-white/10">
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-gold via-yellow-200 to-gold transition-[width] duration-150"
                          style={{ width: isActive ? `${progress}%` : '0%' }}
                        />
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <motion.article
            key={activeFeature.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="overflow-hidden rounded-xl border border-gold/22 bg-white/[0.045] shadow-[0_26px_96px_rgba(0,0,0,0.45),0_0_40px_rgba(212,175,55,0.14)] backdrop-blur-2xl"
          >
            <div className="relative h-72 overflow-hidden md:h-[380px]">
              <img
                src={activeFeature.image}
                alt={activeFeature.title}
                className="h-full w-full object-cover opacity-82 saturate-75 transition-all duration-700 hover:opacity-95 hover:saturate-100"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-cyber-black via-cyber-black/28 to-transparent" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_28%,transparent_16%,rgba(0,2,5,0.28)_58%,rgba(0,2,5,0.78)_100%)]" />
              <div className="absolute left-6 top-6 flex h-14 w-14 items-center justify-center rounded-xl border border-gold/35 bg-cyber-black/62 text-gold shadow-[0_0_24px_rgba(212,175,55,0.28)] backdrop-blur-xl">
                <ActiveIcon className="h-7 w-7" />
              </div>
              <div className="absolute bottom-7 left-7 right-7">
                <h4 className="text-3xl font-black leading-none text-white md:text-4xl">
                  {activeFeature.title}
                </h4>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/78 md:text-base">
                  {activeFeature.description}
                </p>
              </div>
            </div>

            <div className="grid gap-8 border-t border-gold/12 bg-cyber-black/38 p-7 md:grid-cols-2 md:p-9">
              {[
                { heading: "Real World Use Cases", items: activeFeature.useCases },
                { heading: "Key Features", items: activeFeature.keyFeatures }
              ].map((column) => (
                <div key={column.heading}>
                  <h5 className="mb-5 text-xl font-black leading-tight text-white md:text-2xl">
                    {column.heading}
                  </h5>
                  <ul className="space-y-3">
                    {column.items.map((item) => (
                      <li key={item} className="grid grid-cols-[12px_minmax(0,1fr)] gap-3 text-sm leading-6 text-muted-foreground">
                        <span className="mt-2.5 h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_12px_rgba(212,175,55,0.78)]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.article>
        </div>
      </div>
    </motion.section>
  );
}

function TrustedLeadersSection() {
  const marqueeLogos = [...TRUSTED_LEADERS, ...TRUSTED_LEADERS];

  return (
    <section className="relative overflow-hidden border-y border-gold/10 bg-cyber-black py-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(212,175,55,0.12),transparent_42%),linear-gradient(180deg,rgba(212,175,55,0.035),transparent)]" />
      <div className="relative z-10 mx-auto max-w-6xl px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65 }}
          viewport={{ once: true, amount: 0.45 }}
          className="mb-8 text-3xl font-bold leading-tight tracking-[0.08em] text-white/70 md:text-4xl"
        >
          <span className="block font-medium text-muted-foreground">
            The Future Trusted Quantum Security Platform of
          </span>
          <span className="mt-3 block text-gold gold-glow">
            Industry Leaders
          </span>
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.1 }}
          viewport={{ once: true, amount: 0.35 }}
          className="relative mx-auto max-w-5xl overflow-hidden rounded-lg border border-gold/15 bg-white/[0.035] py-6 shadow-[0_18px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl"
        >
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-28 bg-gradient-to-r from-cyber-black via-cyber-black/80 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-28 bg-gradient-to-l from-cyber-black via-cyber-black/80 to-transparent" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_35%,rgba(212,175,55,0.08))] opacity-55 pointer-events-none" />

          <motion.div
            className="flex w-max items-center gap-14 px-8"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 36, repeat: Infinity, ease: "linear" }}
          >
            {marqueeLogos.map((leader, index) => (
              <div
                key={`${leader}-${index}`}
                className="group flex min-w-[118px] items-center justify-center gap-2 text-white/78 transition-all duration-300 hover:text-gold"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-gold/60 shadow-[0_0_12px_rgba(212,175,55,0.8)] transition-transform duration-300 group-hover:scale-125" />
                <span className="font-bold tracking-normal">
                  {leader}
                </span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function TestimonialsColumn({
  testimonials,
  duration = 20,
  className = ""
}: {
  testimonials: typeof TESTIMONIALS;
  duration?: number;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden ${className}`}>
      <motion.div
        animate={{ y: "-50%" }}
        transition={{
          duration,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop"
        }}
        className="flex flex-col gap-5 pb-5"
      >
        {[...testimonials, ...testimonials].map((testimonial, index) => (
          <div
            key={`${testimonial.name}-${index}`}
            className="group w-full max-w-[330px] rounded-xl border border-gold/14 bg-white/[0.045] p-6 shadow-[0_18px_70px_rgba(0,0,0,0.32)] backdrop-blur-xl transition-all duration-500 hover:border-gold/55 hover:bg-gold/[0.07] hover:shadow-[0_0_34px_rgba(212,175,55,0.22),0_22px_80px_rgba(0,0,0,0.44)]"
          >
            <div className="mb-3 font-serif text-5xl leading-none text-gold/55 transition-colors group-hover:text-gold">
              &ldquo;
            </div>
            <p className="text-sm leading-7 text-muted-foreground transition-colors group-hover:text-white/78">
              {testimonial.text}
            </p>
            <div className="mt-6 flex items-center gap-3 border-t border-gold/10 pt-4">
              <img
                src={testimonial.image}
                alt={testimonial.name}
                className="h-11 w-11 shrink-0 rounded-full border border-gold/25 object-cover shadow-[0_0_18px_rgba(212,175,55,0.14)]"
                loading="lazy"
              />
              <div className="min-w-0">
                <div className="font-bold text-white">
                  {testimonial.name}
                </div>
                <div className="mt-1 font-mono text-[11px] leading-5 text-muted-foreground">
                  {testimonial.role}
                </div>
              </div>
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function TestimonialsSection() {
  const firstColumn = TESTIMONIALS.slice(0, 3);
  const secondColumn = TESTIMONIALS.slice(3, 6);
  const thirdColumn = TESTIMONIALS.slice(6, 9);

  return (
    <motion.section
      id="testimonials"
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.75 }}
      viewport={{ once: true, amount: 0.15 }}
      className="relative mt-24 scroll-mt-24 overflow-hidden rounded-2xl border border-gold/15 bg-cyber-navy/20 px-6 py-24 shadow-[0_30px_120px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:px-10"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_52%_at_50%_45%,rgba(212,175,55,0.13),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(circle,rgba(212,175,55,0.2)_1px,transparent_1px)] [background-size:34px_34px]" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <header className="mx-auto mb-14 max-w-2xl text-center">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/10 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
            <span className="h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_12px_rgba(212,175,55,0.85)]" />
            Testimonials
          </span>
          <h3 className="text-4xl font-black leading-tight tracking-[0.04em] text-white md:text-5xl">
            Trusted by Security
            <span className="block text-gold gold-glow">Professionals</span>
          </h3>
          <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-muted-foreground md:text-base">
            See what CTOs, CISOs, and engineers say about protecting their systems with QGuard.
          </p>
        </header>

        <div className="mx-auto flex max-h-[760px] justify-center gap-5 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)]">
          <TestimonialsColumn testimonials={firstColumn} duration={18} />
          <TestimonialsColumn testimonials={secondColumn} duration={22} className="hidden md:block" />
          <TestimonialsColumn testimonials={thirdColumn} duration={20} className="hidden lg:block" />
        </div>
      </div>
    </motion.section>
  );
}

function PricingSection() {
  const [isMonthly, setIsMonthly] = useState(true);

  return (
    <motion.section
      id="pricing"
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.75 }}
      viewport={{ once: true, amount: 0.14 }}
      className="relative mt-24 scroll-mt-24 overflow-hidden rounded-2xl border border-gold/15 bg-cyber-navy/20 px-6 py-24 shadow-[0_30px_120px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:px-10"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(212,175,55,0.16),transparent_36%),radial-gradient(circle_at_82%_70%,rgba(255,243,193,0.08),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(circle,rgba(212,175,55,0.22)_1px,transparent_1px)] [background-size:34px_34px]" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <header className="mx-auto mb-12 max-w-3xl text-center">
          <h3 className="text-4xl font-black leading-tight tracking-[0.04em] text-white md:text-5xl">
            Simple, Transparent <span className="text-gold gold-glow">Pricing</span>
          </h3>
          <p className="mt-5 text-sm leading-7 text-muted-foreground md:text-base">
            Quantum protection at every budget level
          </p>
        </header>

        <div className="mb-12 flex items-center justify-center gap-3">
          <span className={`font-mono text-sm font-bold transition-colors ${isMonthly ? 'text-white' : 'text-muted-foreground'}`}>
            Monthly
          </span>
          <button
            type="button"
            aria-label="Toggle annual billing"
            aria-pressed={!isMonthly}
            onClick={() => setIsMonthly((current) => !current)}
            className={`relative h-7 w-14 rounded-full border transition-all duration-300 ${isMonthly
              ? 'border-gold/20 bg-white/10'
              : 'border-gold/70 bg-gold/25 shadow-[0_0_24px_rgba(212,175,55,0.24)]'
              }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-gold shadow-[0_0_14px_rgba(212,175,55,0.55)] transition-all duration-300 ${isMonthly ? 'left-1' : 'left-8'
                }`}
            />
          </button>
          <span className={`font-mono text-sm font-bold transition-colors ${!isMonthly ? 'text-white' : 'text-muted-foreground'}`}>
            Annual <span className="text-gold">(Save 20%)</span>
          </span>
        </div>

        <div className="grid items-end gap-6 lg:grid-cols-3">
          {PRICING_PLANS.map((plan, index) => {
            const displayedPrice = isMonthly ? plan.price : plan.yearlyPrice;

            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: plan.isPopular ? -12 : 0 }}
                transition={{ delay: index * 0.12, duration: 0.55 }}
                viewport={{ once: true, amount: 0.24 }}
                whileHover={{ y: plan.isPopular ? -18 : -8 }}
                className={`group relative flex min-h-[560px] flex-col overflow-hidden rounded-2xl p-7 shadow-[0_22px_90px_rgba(0,0,0,0.38)] backdrop-blur-2xl transition-all duration-500 ${plan.isPopular
                  ? 'border-2 border-gold/80 bg-gold/[0.075] shadow-[0_0_45px_rgba(212,175,55,0.24),0_28px_100px_rgba(0,0,0,0.45)]'
                  : 'border border-gold/14 bg-white/[0.045] hover:border-gold/45 hover:bg-gold/[0.055]'
                  }`}
              >
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.12),transparent_34%,rgba(212,175,55,0.1))] opacity-45 transition-opacity duration-500 group-hover:opacity-70" />

                {plan.isPopular && (
                  <div className="absolute right-0 top-0 flex items-center gap-1 rounded-bl-xl bg-gold px-4 py-2 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-cyber-black">
                    <Star className="h-3 w-3 fill-current" />
                    Popular
                  </div>
                )}

                <div className="relative z-10 flex h-full flex-col">
                  <p className={`mb-8 font-mono text-xs font-black uppercase tracking-[0.2em] ${plan.isPopular ? 'text-gold' : 'text-white/55'}`}>
                    {plan.name}
                  </p>

                  <div className="mb-3 flex items-end justify-center gap-2">
                    <span className="text-6xl font-black leading-none tracking-tight text-white md:text-7xl">
                      ${displayedPrice}
                    </span>
                    {Number(plan.price) > 0 && (
                      <span className="mb-3 font-mono text-sm text-muted-foreground">
                        / {plan.period}
                      </span>
                    )}
                  </div>

                  <p className="mb-8 text-center font-mono text-xs tracking-[0.08em] text-muted-foreground">
                    {isMonthly ? "billed monthly" : "billed annually"}
                  </p>

                  <ul className="mb-8 flex-1 space-y-0">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-3 border-b border-white/5 py-3 text-sm leading-6 text-muted-foreground">
                        <Check className="mt-1 h-4 w-4 shrink-0 text-gold" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <a href="/auth" className="no-underline mt-auto">
                    <button
                      type="button"
                      className={`w-full min-h-12 rounded-xl border px-5 font-bold uppercase tracking-[0.12em] transition-all duration-300 ${plan.isPopular
                        ? 'border-gold bg-gold text-cyber-black shadow-[0_0_26px_rgba(212,175,55,0.32)] hover:bg-white hover:shadow-[0_0_38px_rgba(212,175,55,0.45)]'
                        : 'border-gold/24 bg-white/[0.035] text-white hover:border-gold/65 hover:text-gold hover:shadow-[0_0_24px_rgba(212,175,55,0.2)]'
                        }`}
                    >
                      {plan.buttonText}
                    </button>
                  </a>

                  <p className="mt-5 text-center font-mono text-xs leading-5 text-muted-foreground">
                    {plan.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}

function FaqAndCtaSection() {
  type FAQCategoryKey = (typeof FAQ_CATEGORIES)[number]["key"];
  const [selectedCategory, setSelectedCategory] = useState<FAQCategoryKey>("q-day");
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const activeFaqs = FAQ_DATA[selectedCategory];

  const handleCategoryChange = (category: FAQCategoryKey) => {
    setSelectedCategory(category);
    setOpenIndex(null);
  };

  return (
    <motion.section
      id="faq"
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.75 }}
      viewport={{ once: true, amount: 0.14 }}
      className="relative mt-24 scroll-mt-24 overflow-hidden rounded-2xl border border-gold/15 bg-cyber-navy/20 px-6 py-24 shadow-[0_30px_120px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:px-10"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_6%,rgba(212,175,55,0.15),transparent_34%),linear-gradient(180deg,transparent_45%,rgba(212,175,55,0.06))]" />
      <div className="pointer-events-none absolute inset-0 opacity-32 [background-image:radial-gradient(circle,rgba(212,175,55,0.22)_1px,transparent_1px)] [background-size:34px_34px]" />

      <div className="relative z-10 mx-auto max-w-5xl">
        <header className="mx-auto mb-8 max-w-3xl text-center">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/10 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
            <span className="h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_12px_rgba(212,175,55,0.85)]" />
            Got Questions?
          </span>
          <h3 className="text-4xl font-black leading-tight tracking-[0.04em] text-white md:text-5xl">
            Frequently Asked <span className="text-gold gold-glow">Questions</span>
          </h3>
        </header>

        <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
          {FAQ_CATEGORIES.map((category) => {
            const isSelected = selectedCategory === category.key;

            return (
              <button
                key={category.key}
                type="button"
                onClick={() => handleCategoryChange(category.key)}
                className={`min-h-10 rounded-lg border px-5 font-mono text-xs font-bold tracking-[0.08em] transition-all duration-300 ${isSelected
                  ? 'border-gold bg-gold text-cyber-black shadow-[0_0_26px_rgba(212,175,55,0.36)]'
                  : 'border-gold/18 bg-white/[0.035] text-muted-foreground hover:border-gold/50 hover:bg-gold/10 hover:text-gold'
                  }`}
              >
                {category.label}
              </button>
            );
          })}
        </div>

        <motion.div
          key={selectedCategory}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mx-auto flex max-w-4xl flex-col gap-3"
        >
          {activeFaqs.map((faq, index) => {
            const isOpen = openIndex === index;

            return (
              <div
                key={faq.question}
                className={`overflow-hidden rounded-xl border backdrop-blur-xl transition-all duration-300 ${isOpen
                  ? 'border-gold/55 bg-gold/[0.07] shadow-[0_0_28px_rgba(212,175,55,0.18)]'
                  : 'border-gold/14 bg-white/[0.045] hover:border-gold/38 hover:bg-gold/[0.045]'
                  }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between gap-5 px-6 py-5 text-left"
                >
                  <span className={`text-sm font-bold leading-6 md:text-base ${isOpen ? 'text-white' : 'text-muted-foreground'}`}>
                    {faq.question}
                  </span>
                  <motion.span
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.2 }}
                    className={`shrink-0 ${isOpen ? 'text-gold' : 'text-muted-foreground'}`}
                  >
                    <Plus className="h-5 w-5" />
                  </motion.span>
                </button>
                <motion.div
                  initial={false}
                  animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <p className="px-6 pb-6 text-sm leading-7 text-muted-foreground">
                    {faq.answer}
                  </p>
                </motion.div>
              </div>
            );
          })}
        </motion.div>

        <div className="mx-auto mt-28 max-w-3xl text-center">
          <h3 className="text-4xl font-black leading-tight tracking-[0.04em] text-white md:text-5xl">
            Ready for <span className="text-gold gold-glow">Quantum Safety?</span>
          </h3>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-muted-foreground md:text-base">
            Create your free account and start your quantum vulnerability scan today.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a href="/auth" className="no-underline">
              <Button className="h-14 rounded-lg bg-gold px-8 font-black uppercase tracking-[0.14em] text-cyber-black shadow-[0_0_28px_rgba(212,175,55,0.32)] transition-all hover:bg-white hover:shadow-[0_0_42px_rgba(212,175,55,0.45)]">
                <Users className="mr-2 h-4 w-4" />
                Create Free Account
              </Button>
            </a>
            <Button
              variant="outline"
              className="h-14 rounded-lg border-gold/55 px-8 font-black uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold/10 hover:text-gold hover:shadow-[0_0_28px_rgba(212,175,55,0.2)]"
            >
              Learn More
            </Button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

const InactionCard = ({ risk, i }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useTransform(mouseY, [-0.5, 0.5], [10, -10]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [-10, 10]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const x = (e.clientX - rect.left) / width - 0.5;
    const y = (e.clientY - rect.top) / height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      transition={{ delay: i * 0.1 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        mouseX.set(0);
        mouseY.set(0);
      }}
      onMouseMove={handleMouseMove}
      style={{
        rotateX: rotateX,
        rotateY: rotateY,
        perspective: 1000,
      }}
      className="relative group cursor-default"
    >
      <motion.div
        animate={{
          backgroundColor: isHovered ? "rgba(220, 38, 38, 0.15)" : "rgba(255, 255, 255, 0.045)",
          borderColor: isHovered ? "rgba(220, 38, 38, 0.6)" : "rgba(212, 175, 55, 0.15)",
          boxShadow: isHovered
            ? "0 0 50px rgba(220, 38, 38, 0.4), inset 0 0 20px rgba(220, 38, 38, 0.2)"
            : "0 20px 70px rgba(0,0,0,0.35)",
          scale: isHovered ? 1.05 : 1,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="relative overflow-hidden rounded-2xl border p-8 backdrop-blur-2xl transition-all duration-500 z-10 h-full"
      >
        {/* Holographic Reflections */}
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.1),transparent_40%,rgba(212,175,55,0.05))] opacity-40 group-hover:opacity-0 transition-opacity pointer-events-none" />

        {/* Red Corruption Overlay */}
        <motion.div
          animate={{ opacity: isHovered ? 1 : 0 }}
          className="absolute inset-0 bg-radial-gradient from-red-600/20 via-transparent to-transparent pointer-events-none z-0"
        />

        {/* Inner Content */}
        <div className="relative z-20">
          <motion.div
            animate={{
              color: isHovered ? "#ef4444" : "#D4AF37",
              filter: isHovered ? "drop-shadow(0 0 15px rgba(239, 68, 68, 0.8))" : "none",
              scale: isHovered ? 1.2 : 1,
              rotate: isHovered ? [0, -5, 5, -5, 0] : 0
            }}
            transition={{ rotate: { repeat: Infinity, duration: 0.2 } }}
          >
            <risk.icon className="w-12 h-12 mb-6 transition-transform" />
          </motion.div>

          <h3 className={`text-xl font-black uppercase tracking-[0.2em] mb-2 transition-colors duration-300 ${isHovered ? 'text-red-100' : 'text-white'}`}>
            {risk.title}
          </h3>

          <motion.div
            animate={{ color: isHovered ? "#f87171" : "#D4AF37" }}
            className="text-4xl font-black mb-4 font-mono tracking-tighter drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]"
          >
            {risk.val}
          </motion.div>

          <p className={`text-xs leading-relaxed uppercase font-bold tracking-wider transition-colors duration-300 ${isHovered ? 'text-red-200/80' : 'text-muted-foreground'}`}>
            {risk.desc}
          </p>

          {/* Emotional Subtext */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            className="mt-6 pt-4 border-t border-red-500/20 text-[10px] text-red-400/80 font-mono uppercase tracking-[0.2em]"
          >
            "Status: Critical Compromise"
          </motion.div>
        </div>

        {/* Fire Particles (Simulated with simple spans) */}
        {isHovered && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(12)].map((_, idx) => (
              <motion.span
                key={idx}
                initial={{
                  opacity: 0,
                  scale: 0,
                  x: Math.random() * 300 - 150,
                  y: 200
                }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1.5, 0.5],
                  y: [-20, -150 - Math.random() * 100],
                  x: (Math.random() * 200 - 100) + (idx % 2 === 0 ? 50 : -50)
                }}
                transition={{
                  duration: 1.5 + Math.random(),
                  repeat: Infinity,
                  delay: Math.random() * 2
                }}
                className="absolute left-1/2 bottom-0 w-1.5 h-1.5 rounded-full bg-red-500 blur-[2px] shadow-[0_0_8px_#ef4444]"
              />
            ))}
          </div>
        )}

        {/* Danger Vibration Animation */}
        <motion.div
          animate={isHovered ? {
            x: [0, -1, 1, -1, 1, 0],
            y: [0, 1, -1, 1, -1, 0]
          } : {}}
          transition={{ repeat: Infinity, duration: 0.15 }}
          className="absolute inset-0 border-2 border-transparent group-hover:border-red-500/30 rounded-2xl pointer-events-none"
        />
      </motion.div>

      {/* Outer Glow */}
      <motion.div
        animate={{
          opacity: isHovered ? 0.6 : 0.2,
          scale: isHovered ? 1.1 : 1,
          backgroundColor: isHovered ? "rgba(220, 38, 38, 0.3)" : "rgba(212, 175, 55, 0.1)"
        }}
        className="absolute -inset-4 blur-[40px] rounded-full -z-10 pointer-events-none"
      />
    </motion.div>
  );
};

const slideModules = import.meta.glob('/public/slideshow/*.{png,jpg,jpeg,gif,webp}', { eager: true, query: '?url', import: 'default' });
const QUANTUM_THREAT_SLIDES = Object.keys(slideModules)
  .map(key => key.replace('/public', ''))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

function QuantumThreatSlideshow() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % QUANTUM_THREAT_SLIDES.length);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] lg:aspect-video overflow-hidden bg-transparent group">
      <AnimatePresence mode="wait">
        <motion.img
          key={currentIndex}
          src={QUANTUM_THREAT_SLIDES[currentIndex]}
          initial={{ opacity: 0, scale: 1.02, filter: "blur(8px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 w-full h-full object-contain drop-shadow-[0_0_24px_rgba(212,175,55,0.15)]"
        />
      </AnimatePresence>
      <div className="absolute inset-x-0 bottom-6 flex justify-center gap-4 z-20">
        {QUANTUM_THREAT_SLIDES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`transition-all duration-500 h-1.5 rounded-full ${
              idx === currentIndex ? "w-10 bg-gold shadow-[0_0_16px_rgba(212,175,55,0.9)]" : "w-3 bg-white/30 hover:bg-white/60 hover:shadow-[0_0_10px_rgba(255,255,255,0.5)]"
            }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}


export default function App() {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());
  const [expandedNistPhase, setExpandedNistPhase] = useState<number | null>(null);
  const [heroTypedLength, setHeroTypedLength] = useState(0);
  const [navScrolled, setNavScrolled] = useState(false);
  const countdownUnits = useMemo(() => getQuantumCountdown(now), [now]);
  const typedLineOne = HERO_LINE_ONE.slice(0, heroTypedLength);
  const typedLineTwoLength = Math.max(0, heroTypedLength - HERO_LINE_ONE.length);
  const typedLineTwoPrefix = HERO_LINE_TWO_PREFIX.slice(0, typedLineTwoLength);
  const typedTicking = HERO_TICKING_WORD.slice(
    0,
    Math.max(0, typedLineTwoLength - HERO_LINE_TWO_PREFIX.length)
  );
  const isTypingSecondLine = heroTypedLength > HERO_LINE_ONE.length;
  const isHeroTypewriterComplete = heroTypedLength >= HERO_CHARACTER_COUNT;

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setHeroTypedLength(HERO_CHARACTER_COUNT);
      return;
    }

    const timer = window.setInterval(() => {
      setHeroTypedLength((currentLength) => {
        const nextLength = Math.min(currentLength + 1, HERO_CHARACTER_COUNT);

        if (nextLength >= HERO_CHARACTER_COUNT) {
          window.clearInterval(timer);
        }

        return nextLength;
      });
    }, HERO_TYPE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleScroll = () => setNavScrolled(window.scrollY > 24);

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-transparent text-foreground selection:bg-quantum-blue/30 overflow-x-hidden">
        <CyberBackground />

        {/* Navigation Bar */}
        <header className={`fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-2xl transition-all duration-300 ${navScrolled
          ? 'border-gold/24 bg-cyber-black/92 shadow-[0_12px_40px_rgba(0,0,0,0.35),0_0_24px_rgba(212,175,55,0.08)]'
          : 'border-gold/12 bg-cyber-black/82'
          }`}>
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
            <a href="#hero" className="group flex min-w-0 items-center gap-3 no-underline">
              <img
                src="/NEW_LOGO.png"
                alt="Qguard Helix logo"
                className="h-16 w-auto shrink-0 object-contain drop-shadow-[0_0_18px_rgba(212,175,55,0.18)]"
              />
              <span className="hidden min-w-0 flex-col leading-none lg:flex">
                <span className="whitespace-nowrap text-lg font-black tracking-[0.03em] text-gold gold-glow transition-colors group-hover:text-white">
                  Qguard Helix
                </span>
                <span className="mt-1 whitespace-nowrap bg-gradient-to-r from-gold via-white to-gold bg-clip-text font-mono text-[10px] font-black uppercase tracking-[0.32em] text-transparent drop-shadow-[0_0_10px_rgba(212,175,55,0.55)]">
                  Quantum Defense
                </span>
              </span>
            </a>

            <nav className="hidden items-center gap-6 lg:flex">
              {[
                { label: 'Home', href: '#hero' },
                { label: 'Features', href: '#features' },
                { label: 'Pricing', href: '#pricing' },
                { label: 'Testimonials', href: '#testimonials' },
                { label: 'FAQ', href: '#faq' },
                { label: 'Docs', href: '/docs' }
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-sm font-semibold text-muted-foreground no-underline transition-colors hover:text-gold"
                >
                  {item.label}
                </a>
              ))}
              <div className="h-6 w-px bg-gold/20" />
              <a
                href="/auth"
                className="rounded-lg px-4 py-2 text-sm font-bold text-white no-underline transition-all hover:bg-gold/10 hover:text-gold"
              >
                Sign In
              </a>
              <a
                href="/auth"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-gold px-6 font-black uppercase tracking-[0.12em] text-cyber-black no-underline shadow-[0_0_24px_rgba(212,175,55,0.28)] transition-all hover:bg-white hover:shadow-[0_0_38px_rgba(212,175,55,0.45)]"
              >
                <Users className="h-4 w-4" />
                Get Started Free
              </a>
            </nav>

            <a
              href="/auth"
              className="inline-flex h-10 items-center rounded-lg bg-gold px-4 text-xs font-black uppercase tracking-[0.1em] text-cyber-black no-underline shadow-[0_0_20px_rgba(212,175,55,0.24)] transition-all hover:bg-white lg:hidden"
            >
              Start Free
            </a>
          </div>
        </header>

        {/* Hero Section */}
        <section id="hero" className="relative pt-32 pb-20 px-6 min-h-screen flex flex-col justify-center">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column: Text & Atmosphere */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="relative z-10"
            >
              <Badge className="bg-quantum-blue/10 text-quantum-blue border-quantum-blue/20 px-3 py-1 mb-6 uppercase tracking-[0.3em] font-mono animate-pulse">
                Critical Threat Warning: Y2Q Approaching
              </Badge>
              <h1 className="hero-title text-6xl md:text-8xl font-bold leading-[0.9] tracking-normal mb-8 uppercase" aria-label={HERO_ACCESSIBLE_TITLE}>
                <span className="hero-title__ghost" aria-hidden="true">
                  <span className="hero-title__line">
                    <span className="hero-title__gradient">The Quantum</span>
                  </span>
                  <span className="hero-title__line">
                    <span className="hero-title__gradient">Clock is </span>
                    <span className="hero-title__gradient hero-title__ticking">TICKING</span>
                  </span>
                </span>
                <span className="hero-title__typed" aria-hidden="true">
                  <span className="hero-title__line">
                    <span className="hero-title__gradient">{typedLineOne}</span>
                    {!isTypingSecondLine && !isHeroTypewriterComplete && (
                      <span className="hero-title__cursor" />
                    )}
                  </span>
                  <span className="hero-title__line">
                    <span className="hero-title__gradient">{typedLineTwoPrefix}</span>
                    <span className={`hero-title__gradient hero-title__ticking ${isHeroTypewriterComplete ? 'hero-title__ticking--armed' : ''}`}>
                      {typedTicking}
                    </span>
                    {isTypingSecondLine && !isHeroTypewriterComplete && (
                      <span className="hero-title__cursor" />
                    )}
                  </span>
                </span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-xl leading-relaxed">
                Quantum computing advances exponentially. Today's encryption won't survive tomorrow's algorithms.
                The time to migrate to Post-Quantum Cryptography (PQC) is <span className="text-quantum-blue font-bold">NOW</span>.
              </p>

              <div className="flex flex-wrap gap-4">
                <a href="/auth" className="no-underline">
                  <Button size="lg" className="bg-gold hover:bg-gold/80 text-cyber-black px-8 rounded-none uppercase font-bold tracking-widest shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all hover:scale-105 group h-14">
                    Start Migration Strategy
                    <MoveRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </a>
              </div>

              {/* Info Snippet */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                whileHover={{ y: -5, scale: 1.02, boxShadow: "0 0 40px rgba(212, 175, 55, 0.25)" }}
                transition={{ duration: 0.4 }}
                className="mt-16 p-6 rounded-xl border border-gold/20 bg-white/[0.03] backdrop-blur-md border-l-4 border-l-gold relative overflow-hidden group cursor-default transition-all shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:border-gold/40 hover:bg-white/[0.05]"
              >
                <div className="flex items-start gap-4 relative z-10">
                  <div className="w-12 h-12 rounded-full border border-gold/30 flex items-center justify-center bg-gold/10 shrink-0 shadow-[0_0_15px_rgba(212,175,55,0.1)] group-hover:shadow-[0_0_25px_rgba(212,175,55,0.3)] transition-all">
                    <AlertTriangle className="w-6 h-6 text-gold animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-gold font-bold uppercase tracking-[0.2em] text-sm mb-2 drop-shadow-[0_0_10px_rgba(212,175,55,0.5)]">Security Alert</h4>
                    <p className="text-white/90 text-sm leading-relaxed font-medium">
                      "Harvest Now, Decrypt Later" programs are active. Your encrypted data is being captured today to be decrypted once quantum rigs mature.
                    </p>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-gold/10 blur-[60px] pointer-events-none transition-all group-hover:bg-gold/20" />
                <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            </motion.div>

            {/* Right Column: Video Intelligence Panel */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.85, delay: 0.1 }}
              viewport={{ once: true, amount: 0.35 }}
              className="relative z-10 flex items-center justify-center lg:justify-end"
            >
              <div className="absolute -inset-8 bg-[radial-gradient(circle_at_50%_40%,rgba(0,243,255,0.14),transparent_54%),radial-gradient(circle_at_78%_82%,rgba(212,175,55,0.13),transparent_42%)] blur-2xl pointer-events-none" />

              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                className="relative w-full max-w-[590px] group rounded-xl p-[2px]"
              >
                {/* Soft Neon Gradient Beam behind */}
                <div className="absolute inset-0 rounded-xl bg-[conic-gradient(from_var(--border-angle),#00F3FF,#22c55e,#D4AF37,#f97316,#ef4444,#00F3FF)] animate-border-beam pointer-events-none" />
                <div className="absolute inset-0 rounded-xl bg-[conic-gradient(from_var(--border-angle),#00F3FF,#22c55e,#D4AF37,#f97316,#ef4444,#00F3FF)] animate-border-beam blur-[8px] opacity-70 pointer-events-none transition-opacity duration-500 group-hover:opacity-100" />

                <div className="relative overflow-hidden rounded-xl bg-cyber-navy/95 shadow-[0_35px_100px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                  <div className="absolute inset-0 z-10 pointer-events-none bg-[linear-gradient(135deg,rgba(255,255,255,0.16)_0%,transparent_28%,transparent_70%,rgba(0,243,255,0.12)_100%)]" />
                  <div className="quantum-countdown relative z-20">
                    <div className="quantum-countdown__title-row">
                      <span className="quantum-countdown__rail" />
                      <h2 className="quantum-countdown__title">Projected PQC Migration Urgency Timeline</h2>
                      <span className="quantum-countdown__rail" />
                    </div>
                    <p className="quantum-countdown__subtitle">
                      Industry migration timelines are accelerating as quantum research,<br />
                      regulatory mandates, and cryptographic risk exposure continue to evolve.
                    </p>

                    <div className="quantum-countdown__panel" aria-label="Time remaining until large-scale quantum threat maturity">
                      {countdownUnits.map((unit) => (
                        <div className="quantum-countdown__cell" key={unit.label}>
                          <div className="quantum-countdown__label">{unit.label}</div>
                          <div className="quantum-countdown__value">{unit.value}</div>
                        </div>
                      ))}
                    </div>

                    <div className="quantum-countdown__footer">
                      Time remaining until large-scale quantum threat maturity
                    </div>
                    <div className="quantum-countdown__corner quantum-countdown__corner--left" />
                    <div className="quantum-countdown__corner quantum-countdown__corner--right" />
                  </div>

                  <div className="relative aspect-[16/10] min-h-[300px] overflow-hidden bg-cyber-black sm:min-h-[340px]">
                    <video
                      src={ASSETS.hourglassVideo}
                      aria-label="Quantum hourglass countdown video"
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      poster={ASSETS.hourglass}
                      className="h-full w-full object-cover opacity-95 contrast-125 saturate-125"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-cyber-black/40 via-transparent to-cyber-black/15 pointer-events-none" />
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:48px_48px] opacity-25 pointer-events-none" />
                  </div>

                  <div className="grid grid-cols-3 border-t border-white/10 bg-cyber-black/55">
                    {[
                      { label: "Threat", value: "CRQC" },
                      { label: "Priority", value: "PQC" },
                      { label: "Timeline", value: "Now" }
                    ].map((metric) => (
                      <div key={metric.label} className="border-r border-white/10 px-4 py-4 last:border-r-0">
                        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">{metric.label}</p>
                        <p className="mt-1 text-lg font-bold uppercase tracking-[0.16em] text-white">{metric.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        <TrustedLeadersSection />

        {/* Why It Matters / Hourglass Section */}
        <section className="py-32 relative overflow-hidden bg-cyber-navy/20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-24">
              <h2 className="text-4xl md:text-6xl font-bold uppercase mb-4 italic tracking-widest text-gold">Why it Matters</h2>
              <div className="w-24 h-1 bg-gradient-to-r from-transparent via-gold to-transparent mx-auto" />
            </div>

            <div className="grid lg:grid-cols-2 gap-20 items-center">
              <motion.div
                initial={{ opacity: 0, rotateY: 30 }}
                whileInView={{ opacity: 1, rotateY: 0 }}
                className="relative perspective-1000"
              >
                <div className="aspect-[4/5] relative rounded-3xl overflow-hidden glass-panel p-8">
                  <img
                    src="/HNDL.png"
                    alt="Harvest Now, Decrypt Later"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyber-navy/10 to-cyber-black/80" />

                </div>
              </motion.div>

              <div className="space-y-12">
                {[
                  { icon: Skull, title: "Harvest now, Decrypt later", text: "State actors are siphoning your data and traffic now. They don't need to break it today; they just need to store it until CRQC (Cryptographically Relevant Quantum Computers) arrive." },
                  { icon: HourglassIcon, title: "The Window is Closing", text: "The transition to PQC takes years. Starting now is the only way to ensure data longevity. You have less than a decade to re-architect your entire stack." },
                  { icon: Zap, title: "Act Before Maturity", text: "Organizations that wait until NIST completes all standards will find themselves in a 'Digital Dust' scenario, where their entire historical archive becomes public domain." }
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.2 }}
                    className="flex gap-6 group"
                  >
                    <div className="w-16 h-16 rounded-xl border border-white/5 bg-white/5 flex items-center justify-center shrink-0 group-hover:border-gold/50 transition-colors">
                      <item.icon className="w-8 h-8 text-gold group-hover:scale-110 transition-transform" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold uppercase tracking-wide mb-3 text-gold transition-colors">{item.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {item.text}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Harvest Now, Decrypt Later Infographic Section */}
        <section className="py-20 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center mb-16 relative"
            >
              {/* Background Glow */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-24 bg-gold/10 blur-[60px] rounded-full pointer-events-none" />

              <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#FFF3D0] via-[#D4AF37] to-[#8A6D3B] drop-shadow-[0_0_30px_rgba(212,175,55,0.55)]">
                They’re Harvesting Your Data <span className="text-white gold-glow italic">Right Now</span>
              </h2>

              <motion.div
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="mt-6 flex justify-center items-center gap-6"
              >
                <div className="h-px w-24 bg-gradient-to-r from-transparent via-gold to-transparent" />
                <span className="text-gold font-mono text-xs font-bold uppercase tracking-[0.4em] drop-shadow-[0_0_8px_rgba(212,175,55,0.8)]">
                  Ongoing Cyber Siphoning
                </span>
                <div className="h-px w-24 bg-gradient-to-r from-transparent via-gold to-transparent" />
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="relative group"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-gold/20 via-gold/40 to-gold/20 rounded-[2rem] blur-xl opacity-50 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
              <div className="relative rounded-[2rem] overflow-hidden border border-gold/20 bg-black shadow-[0_0_50px_rgba(212,175,55,0.15)]">
                <img
                  src="/HarvestNow.png"
                  alt="Harvest Now, Decrypt Later Infographic"
                  className="w-full h-auto object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
              </div>
            </motion.div>
          </div>
        </section>

        {/* The Road Ahead - Roadmap Cards */}
        <section id="roadmap" className="py-32 px-6 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(212,175,55,0.08),transparent_38%)]" />
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-end mb-20 border-b border-white/10 pb-8">
              <div>
                <span className="text-gold font-mono text-sm uppercase tracking-widest">Phase 01-04</span>
                <h2 className="text-5xl font-bold uppercase tracking-normal mt-2 text-gold gold-glow">The Road <span className="italic">Ahead</span></h2>
              </div>
              <div className="hidden md:block text-right max-w-xs">
                <p className="text-xs text-white/70 leading-relaxed">
                  Strategic roadmap for enterprise quantum readiness integration.
                  Derived from NIST PQC guidelines and NSA directives.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { step: "01", title: "The New Gold Standards", desc: "NIST has finalized ML-KEM, ML-DSA, and SLH-DSA for immediate global adoption.", icon: FileCheck, image: "/nist.png" },
                { step: "02", title: "Harvest Now, Decrypt Later", desc: "Understand why data captured today is the biggest liability for national security.", icon: Skull, image: "/harvest.png" },
                { step: "03", title: "A Ten-Year Countdown", desc: "Experts predict quantum superiority over RSA-2048 within the next decade.", icon: Clock, image: "/countdown.png" },
                { step: "04", title: "End Denial, Start Inventory", desc: "Identify every cryptographic endpoint in your infrastructure today.", icon: Database, image: "/inventory.png" }
              ].map((card, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -10 }}
                  className="relative group h-full"
                >
                  <Card className="relative h-full overflow-hidden rounded-lg border border-gold/14 bg-white/[0.045] shadow-[0_20px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl transition-all duration-500 flex flex-col hover:border-gold/65 hover:bg-gold/[0.075] hover:shadow-[0_0_42px_rgba(212,175,55,0.30),0_26px_90px_rgba(0,0,0,0.5)]">
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.13),transparent_30%,rgba(212,175,55,0.1))] opacity-45 transition-opacity duration-500 group-hover:opacity-75" />
                    <CardHeader className="relative z-10">
                      <span className="text-5xl font-black text-gold/12 absolute top-2 right-4 -z-10 group-hover:text-gold/28 transition-colors">{card.step}</span>
                      <div className="w-12 h-12 rounded-lg bg-gold/10 border border-gold/25 flex items-center justify-center mb-4 shadow-[0_0_24px_rgba(212,175,55,0.18)] transition-all duration-500 group-hover:scale-110 group-hover:shadow-[0_0_34px_rgba(212,175,55,0.42)]">
                        <card.icon className="w-6 h-6 text-gold" />
                      </div>
                      <CardTitle className="text-xl uppercase tracking-wide font-black text-white group-hover:text-gold transition-colors">{card.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10 flex-grow">
                      <p className="text-white/78 text-sm leading-7 mb-6 group-hover:text-white/90 transition-colors">
                        {card.desc}
                      </p>
                      <img
                        src={card.image}
                        alt={card.title}
                        className="w-full h-32 object-cover opacity-35 grayscale contrast-125 group-hover:opacity-75 group-hover:grayscale-0 transition-all duration-700 rounded-lg scale-110 group-hover:scale-100"
                        referrerPolicy="no-referrer"
                      />
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Action Section */}
        <section id="intelligence" className="py-32 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(212,175,55,0.11),transparent_38%)] pointer-events-none" />
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-4xl font-black uppercase text-center mb-20 tracking-[0.2em] text-white">What you can <span className="text-gold gold-glow">do now</span></h2>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {[
                {
                  icon: Search,
                  label: "Inventory",
                  front: "Discover every PQC-vulnerable key.",
                  back: "Identify cryptographic assets across your entire infrastructure, including RSA, ECC, TLS certificates, VPN tunnels, SSH keys, databases, APIs, cloud workloads, IoT devices, and legacy applications. Build a real-time quantum exposure inventory with automated asset classification and cryptographic fingerprinting."
                },
                {
                  icon: Shield,
                  label: "Assess Risk",
                  front: "Rank systems by crypto-urgency.",
                  back: "Analyze which systems are most vulnerable to Harvest Now, Decrypt Later attacks. Prioritize assets using quantum risk scoring, business criticality, data sensitivity, compliance impact, and cryptographic weakness analysis to accelerate remediation planning."
                },
                {
                  icon: Map,
                  label: "Roadmap",
                  front: "Define phased migration steps.",
                  back: "Generate a structured PQC migration strategy aligned with NIST standards. Create phased upgrade plans for hybrid cryptography adoption, infrastructure modernization, certificate replacement, application compatibility testing, and long-term crypto agility."
                },
                {
                  icon: Lock,
                  label: "Implement",
                  front: "Deploy hybrid cryptographic stacks.",
                  back: "Seamlessly deploy ML-KEM, ML-DSA, SLH-DSA, and hybrid cryptographic infrastructures across enterprise environments. Automate certificate rotation, secure key exchange modernization, PQ-TLS deployment, and cryptographic policy enforcement with real-time telemetry."
                },
                {
                  icon: Users,
                  label: "Educate",
                  front: "Train your security teams on PQC.",
                  back: "Provide interactive learning modules, migration playbooks, threat simulations, compliance guidance, and hands-on quantum security training for security teams, engineers, executives, and infrastructure administrators to accelerate enterprise-wide PQC readiness."
                }
              ].map((item, i) => (
                <div key={i} className="group h-[320px] perspective-1000">
                  <div className="relative h-full w-full transition-all duration-700 preserve-3d group-hover:rotate-y-180">
                    {/* Front Face */}
                    <div className="absolute inset-0 backface-hidden rounded-xl border border-gold/14 bg-white/[0.045] p-8 text-center shadow-[0_20px_80px_rgba(0,0,0,0.36)] backdrop-blur-xl transition-all duration-500 group-hover:border-gold/65 flex flex-col items-center justify-center">
                      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.12),transparent_32%,rgba(212,175,55,0.1))] opacity-45" />
                      <div className="relative z-10 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-gold/25 bg-gold/10 text-gold shadow-[0_0_28px_rgba(212,175,55,0.22)]">
                        <item.icon className="w-8 h-8" />
                      </div>
                      <h4 className="relative z-10 font-black uppercase tracking-widest text-sm mb-3 text-white group-hover:text-gold transition-colors">{item.label}</h4>
                      <p className="relative z-10 text-[11px] leading-5 text-white/68 uppercase tracking-wider">{item.front}</p>

                      {/* Flip Hint */}
                      <div className="absolute bottom-4 right-4 text-gold/30 text-[10px] font-mono uppercase tracking-widest group-hover:opacity-0 transition-opacity">
                        Hover to Flip
                      </div>
                    </div>

                    {/* Back Face */}
                    <div className="absolute inset-0 backface-hidden rounded-xl border border-gold/40 bg-gold/[0.08] p-6 shadow-[0_0_42px_rgba(212,175,55,0.25)] backdrop-blur-xl rotate-y-180 flex flex-col items-center justify-center">
                      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(212,175,55,0.1),transparent_32%)] opacity-30" />
                      <div className="relative z-10 w-full">
                        <h4 className="font-black uppercase tracking-widest text-xs mb-4 text-gold text-center border-b border-gold/20 pb-2">{item.label} Details</h4>
                        <p className="text-[10px] leading-relaxed text-white/90 text-left font-medium">
                          {item.back}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* NIST Migration Strategy Section */}
        <section id="nist-strategy" className="py-32 border-t border-gold/10 relative bg-cyber-navy/10 overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(212,175,55,0.1),transparent_36%),linear-gradient(180deg,rgba(212,175,55,0.035),transparent)]" />
          <div className="max-w-7xl mx-auto px-6">
            <div className="mb-20 max-w-2xl text-center md:text-left">
              <h2 className="text-5xl font-black uppercase tracking-normal text-gold gold-glow"><span>NIST Migration</span> <br /><span className="tracking-widest">Strategy</span></h2>
              <p className="text-white/70 mt-4 font-mono text-sm max-w-md">The unified standard for Post-Quantum Transitioning.</p>
            </div>

            <div className="relative rounded-2xl border border-gold/14 bg-white/[0.035] p-8 pt-16 shadow-[0_26px_96px_rgba(0,0,0,0.36)] backdrop-blur-xl">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.1),transparent_34%,rgba(212,175,55,0.08))] opacity-50" />


              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                {[
                  {
                    phase: "Prepare",
                    sub: "(Now)",
                    icon: Database,
                    details: "Establish the foundation for post-quantum readiness across the organization. Identify critical systems, sensitive data, cryptographic dependencies, compliance requirements, and long-term security objectives. Build governance policies, executive awareness, and quantum migration task forces aligned with NIST PQC guidance.",
                    actions: ["Create crypto governance framework", "Identify critical business assets", "Define quantum readiness objectives", "Establish PQC migration teams", "Review compliance and regulatory impact"]
                  },
                  {
                    phase: "Assess",
                    sub: "(Now-1 Yr)",
                    icon: Search,
                    details: "Perform enterprise-wide cryptographic discovery and quantum risk analysis. Detect vulnerable algorithms such as RSA, ECC, DH, and weak PKI implementations across infrastructure, applications, APIs, cloud workloads, and communication systems.",
                    actions: ["Inventory cryptographic assets", "Detect PQ-vulnerable algorithms", "Analyze TLS, VPN, SSH, PKI exposure", "Rank systems by risk and urgency", "Assess Harvest Now, Decrypt Later exposure"]
                  },
                  {
                    phase: "Plan",
                    sub: "(1-2 Yrs)",
                    icon: Map,
                    details: "Design a phased migration roadmap for transitioning to NIST-approved post-quantum cryptography. Define hybrid cryptographic architectures, upgrade timelines, vendor dependencies, interoperability testing, and crypto-agility strategies for long-term resilience.",
                    actions: ["Build phased migration roadmap", "Select NIST-approved PQC algorithms", "Define hybrid crypto architectures", "Identify application dependencies", "Develop rollback and testing procedures"]
                  },
                  {
                    phase: "Implement",
                    sub: "(2-4 Yrs)",
                    icon: Zap,
                    details: "Deploy post-quantum cryptographic controls across enterprise environments using hybrid classical + PQC architectures. Integrate ML-KEM, ML-DSA, and SLH-DSA into certificates, communication channels, authentication systems, APIs, and secure storage infrastructures.",
                    actions: ["Deploy hybrid PQ-TLS environments", "Rotate vulnerable certificates and keys", "Integrate ML-KEM and ML-DSA", "Upgrade VPN, SSH, and PKI systems", "Enable real-time migration telemetry"]
                  },
                  {
                    phase: "Transition",
                    sub: "(4-6 Yrs)",
                    icon: Globe,
                    details: "Gradually phase out legacy cryptographic systems while validating interoperability, performance, and operational stability. Transition production workloads fully into quantum-resistant environments with continuous monitoring and policy enforcement.",
                    actions: ["Decommission legacy cryptography", "Validate interoperability and compatibility", "Enforce PQC security policies", "Monitor migration health and coverage", "Harden enterprise-wide PQ infrastructures"]
                  },
                  {
                    phase: "Optimize",
                    sub: "(6+ Yrs)",
                    icon: TrendingDown,
                    details: "Continuously improve crypto-agility, operational resilience, and future quantum readiness. Monitor evolving NIST standards, emerging threats, cryptographic performance, and infrastructure scalability to maintain long-term protection against future quantum capabilities.",
                    actions: ["Continuously monitor PQC posture", "Update algorithms and cryptographic policies", "Optimize performance and scalability", "Maintain crypto-agility frameworks", "Prepare for future NIST PQC revisions"]
                  }
                ].map((step, i) => (
                  <div key={i} className="flex flex-col">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      onClick={() => setExpandedNistPhase(expandedNistPhase === i ? null : i)}
                      className={`relative group z-10 rounded-xl border ${expandedNistPhase === i ? 'border-gold bg-gold/[0.08]' : 'border-gold/10 bg-cyber-black/28'} px-4 pb-6 pt-16 backdrop-blur-xl transition-all duration-500 cursor-pointer hover:border-gold/55 hover:bg-gold/[0.06] hover:shadow-[0_0_32px_rgba(212,175,55,0.22)]`}
                    >
                      <div className="-mt-12 flex flex-col items-center">
                        <span className={`text-4xl font-black ${expandedNistPhase === i ? 'text-gold/40' : 'text-gold/16'} group-hover:text-gold/38 transition-colors mb-6`}>{i + 1}</span>
                        <div className={`w-12 h-12 rounded-full border border-gold/25 ${expandedNistPhase === i ? 'bg-gold/20' : 'bg-gold/10'} text-gold shadow-[0_0_24px_rgba(212,175,55,0.2)] flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-[0_0_34px_rgba(212,175,55,0.45)] transition-all`}>
                          <step.icon className="w-5 h-5" />
                        </div>
                      </div>
                      <div className="text-center">
                        <h4 className="font-black uppercase tracking-[0.2em] mb-2 text-white group-hover:text-gold transition-colors">{step.phase}</h4>
                        <p className="text-[10px] font-mono text-white/60 uppercase group-hover:text-white/78 transition-colors">{step.sub}</p>

                        <div className="mt-4 flex justify-center">
                          <motion.div
                            animate={{ rotate: expandedNistPhase === i ? 180 : 0 }}
                            className="text-gold/40 group-hover:text-gold"
                          >
                            <ChevronDown size={16} />
                          </motion.div>
                        </div>
                      </div>
                    </motion.div>

                    <AnimatePresence>
                      {expandedNistPhase === i && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.4, ease: "easeInOut" }}
                          className="overflow-hidden z-0"
                        >
                          <div className="mt-4 p-6 rounded-xl border border-gold/30 bg-gold/[0.04] backdrop-blur-md shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
                            <h5 className="text-gold font-bold uppercase tracking-widest text-[10px] mb-3 border-b border-gold/20 pb-2">Phase Details</h5>
                            <p className="text-xs leading-relaxed text-white/90 mb-6 italic">
                              {step.details}
                            </p>

                            <h5 className="text-gold font-bold uppercase tracking-widest text-[10px] mb-3 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
                              Key Actions
                            </h5>
                            <ul className="space-y-2">
                              {step.actions.map((action, actionIdx) => (
                                <li key={actionIdx} className="flex items-center gap-3 text-[10px] text-white/70 group/item">
                                  <div className="w-1 h-1 rounded-full bg-gold/50 group-hover/item:bg-gold transition-colors" />
                                  <span className="group-hover/item:text-white transition-colors">{action}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Post-Quantum Cryptography Visual Section */}
        <section className="py-20 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.06),transparent_45%)]" />
          <div className="max-w-6xl mx-auto px-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-[0.08em] text-white">
                QGuard Helix — <span className="text-gold gold-glow">Quantum Threat Intelligence</span>
              </h2>
              <p className="mt-4 text-sm md:text-base text-muted-foreground tracking-widest font-mono uppercase">
                Preparing Enterprises for the Post-Quantum Era
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              viewport={{ once: true, amount: 0.2 }}
              className="relative group"
            >
              {/* Outer Glow Ring */}
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-gold/25 via-gold/10 to-gold/25 blur-xl opacity-40 group-hover:opacity-80 transition-opacity duration-700 pointer-events-none" />

              {/* Image Container (Frame Removed) */}
              <div className="relative w-full transition-all duration-700">
                <QuantumThreatSlideshow />
              </div>
            </motion.div>
          </div>
        </section>

        {/* Impact of Inaction Section */}
        <section className="py-40 relative overflow-hidden">
          {/* Section Darkening Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black pointer-events-none z-0"
          />

          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              className="text-center mb-32"
            >
              <motion.h2
                animate={{
                  textShadow: [
                    "0 0 20px rgba(212, 175, 55, 0.5)",
                    "0 0 40px rgba(212, 175, 55, 0.8)",
                    "0 0 20px rgba(212, 175, 55, 0.5)"
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="text-4xl md:text-7xl font-black uppercase tracking-[0.3em] text-gold italic relative"
              >
                The Impact of <br />
                <span className="text-white not-italic opacity-90 drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]">Inaction</span>
              </motion.h2>
              <div className="mt-8 flex flex-col items-center gap-2">
                <p className="text-red-500/80 font-mono text-xs uppercase tracking-[0.5em] animate-pulse">Critical Vulnerability Detected</p>
                <div className="h-1 w-48 bg-gradient-to-r from-transparent via-red-600/50 to-transparent" />
                <p className="mt-4 text-white/60 font-medium uppercase tracking-widest max-w-2xl mx-auto leading-relaxed">
                  “If you delay PQC migration, everything encrypted today becomes compromised tomorrow.”
                </p>
              </div>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10">
              {[
                { title: "Data Breaches", icon: Skull, val: "100%", desc: "All historically captured encrypted data becomes readable.", color: "text-gold" },
                { title: "Financial Loss", icon: TrendingDown, val: "$4.3T", desc: "Estimated global cost of quantum crypto collapse.", color: "text-gold" },
                { title: "National Risk", icon: Globe, val: "Critical", desc: "Military and government secrets exposed instantly.", color: "text-gold" },
                { title: "Loss of Trust", icon: AlertTriangle, val: "Total", desc: "Digital trust ecosystem dismantled completely.", color: "text-gold" }
              ].map((risk, i) => (
                <InactionCard key={i} risk={risk} i={i} />
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6">
            <motion.div
              id="features"
              initial={{ opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75 }}
              viewport={{ once: true, amount: 0.2 }}
              className="scroll-mt-24 rounded-lg border border-gold/15 bg-cyber-navy/25 p-6 shadow-[0_28px_100px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-10"
            >
              <div className="text-center mb-14">
                <h3 className="text-3xl md:text-5xl font-bold tracking-[0.12em] text-white">
                  How QGuard Helix <span className="text-gold gold-glow">Protects You</span>
                </h3>
                <p className="mt-4 text-sm md:text-base text-muted-foreground tracking-wide">
                  Three steps to quantum-safe digital life
                </p>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                {[
                  {
                    step: "Step 01",
                    title: "Scan",
                    icon: Search,
                    desc: "Detect quantum-vulnerable cryptographic assets across your environment, including RSA, ECC, SHA-1, weak TLS configurations, and other legacy algorithms. Gain full visibility into exposure across applications, infrastructure, and data flows."
                  },
                  {
                    step: "Step 02",
                    title: "Migrate",
                    icon: RefreshCcw,
                    desc: "Easy transition to quantum-safe cryptography using ML-KEM (Kyber) and ML-DSA (Dilithium), with hybrid compatibility modes to ensure secure interoperability with existing systems and minimize operational disruption."
                  },
                  {
                    step: "Step 03",
                    title: "Protect",
                    icon: Shield,
                    desc: "Maintain ongoing security with real-time threat monitoring, Quantum Vault-backed secure storage, and intelligent alerting. Stay protected as quantum threats evolve with continuous assessment and adaptive defense mechanisms."
                  }
                ].map((step, i) => (
                  <motion.div
                    key={step.title}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.12 }}
                    whileHover={{ y: -10 }}
                    className="group relative min-h-[350px] overflow-hidden rounded-lg border border-gold/15 bg-white/[0.045] px-8 py-10 text-center shadow-[0_20px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl transition-all duration-500 hover:border-gold/65 hover:bg-gold/[0.075] hover:shadow-[0_0_42px_rgba(212,175,55,0.32),0_26px_90px_rgba(0,0,0,0.5)]"
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.13),transparent_28%,rgba(212,175,55,0.1)_100%)] opacity-45 transition-opacity duration-500 group-hover:opacity-70 pointer-events-none" />
                    <div className="relative z-10 flex h-full flex-col items-center">
                      <span className="font-mono text-[11px] uppercase tracking-[0.36em] text-gold">{step.step}</span>
                      <div className="mt-9 mb-8 flex h-16 w-16 items-center justify-center rounded-lg border border-gold/25 bg-gold/10 text-gold shadow-[0_0_24px_rgba(212,175,55,0.2)] transition-all duration-500 group-hover:scale-110 group-hover:shadow-[0_0_32px_rgba(212,175,55,0.45)]">
                        <step.icon className="h-8 w-8" />
                      </div>
                      <h4 className="mb-4 text-2xl font-bold uppercase tracking-wide text-white transition-colors group-hover:text-gold">
                        {step.title}
                      </h4>
                      <p className="text-sm leading-7 text-muted-foreground transition-colors group-hover:text-white/78">
                        {step.desc}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <EnterpriseProtectionShowcase />
            <div className="h-32 w-full" />
            <Hero195 />
            <div className="h-32 w-full" />
            <QuantumSecurityUseCasesSection />
            <TestimonialsSection />
            <PricingSection />
            <FaqAndCtaSection />
          </div>
        </section>

        {/* Footer / CTA Final */}
        <footer className="pt-32 pb-16 bg-transparent border-t border-gold/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-gold to-transparent" />

          <div className="max-w-6xl mx-auto px-6 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex flex-col items-center text-center space-y-10"
            >
              <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-[0.85]">
                <span className="text-gold">The Future is</span> <br />
                <span className="text-white italic underline decoration-gold/50 decoration-wavy underline-offset-8">Quantum.</span>
              </h2>
              <p className="text-xl text-white/70 uppercase tracking-widest font-light max-w-2xl">
                Secure your organization's legacy today with military-grade PQC infrastructure.
              </p>

              <div className="flex flex-col sm:flex-row justify-center gap-6 pt-6">
                <Button
                  onClick={() => navigate('/auth')}
                  size="lg"
                  className="bg-gold text-black hover:bg-yellow-400 px-12 rounded-xl h-14 font-black uppercase tracking-[0.15em] transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:shadow-[0_0_35px_rgba(212,175,55,0.5)] hover:scale-105"
                >
                  Request PQC Audit
                </Button>
              </div>

              {/* Status Modules */}
              <div className="pt-20 w-full grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "AES-256", status: "Endangered", border: "border-red-500/30", bg: "bg-red-500/5", text: "text-red-400" },
                  { label: "RSA-2048", status: "Deprecated", border: "border-orange-500/30", bg: "bg-orange-500/5", text: "text-orange-400" },
                  { label: "PQC Migration", status: "V1.0 Ready", border: "border-green-500/30", bg: "bg-green-500/5", text: "text-green-400" },
                  { label: "NIST 800-203", status: "Compliant", border: "border-cyan-500/30", bg: "bg-cyan-500/5", text: "text-cyan-400" }
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    whileHover={{ scale: 1.05, y: -5 }}
                    className={`p-4 rounded-xl border ${item.border} ${item.bg} flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/50">{item.label}</span>
                    <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${item.text}`}>{item.status}</span>
                  </motion.div>
                ))}
              </div>

              <div className="w-full border-t border-white/10 mt-16 pt-16 flex flex-col md:flex-row items-center justify-between gap-8">
                {/* Logo + Copyright */}
                <div className="flex flex-col items-center md:items-start gap-4">
                  <img
                    src="/NEW_LOGO.png"
                    alt="Qguard Helix logo"
                    className="h-28 w-auto object-contain drop-shadow-[0_0_24px_rgba(212,175,55,0.25)]"
                  />
                  <div className="text-[10px] font-mono text-white/60 uppercase tracking-[0.3em]">
                    &copy; {new Date().getFullYear()} Qguard Helix Defense // Secure // Modernize // Future-Proof
                  </div>
                </div>

                {/* Social Icons */}
                <div className="flex items-center gap-4">
                  {[
                    { icon: Twitter, href: "#", name: "X (Twitter)" },
                    { icon: Linkedin, href: "#", name: "LinkedIn" },
                    { icon: Github, href: "#", name: "GitHub" },
                    { icon: Youtube, href: "#", name: "YouTube" },
                    { icon: Facebook, href: "#", name: "Facebook" }
                  ].map((social, i) => (
                    <motion.a
                      key={i}
                      href={social.href}
                      whileHover={{ y: -5, scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      className="h-10 w-10 rounded-lg border border-gold/20 bg-black/50 flex items-center justify-center text-white/50 hover:text-gold hover:border-gold hover:bg-gold/10 transition-all shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                      aria-label={social.name}
                    >
                      <social.icon className="h-4 w-4" />
                    </motion.a>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Subtle Deep Background Details */}
          <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gold/10 blur-[150px] rounded-full pointer-events-none" />
        </footer>
      </div>
    </TooltipProvider>
  );
}

// Custom Cursor or other small details can be added here



