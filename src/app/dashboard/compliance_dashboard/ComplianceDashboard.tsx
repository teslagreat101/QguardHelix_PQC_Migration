import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Building2,
  Check,
  ChevronDown,
  ClipboardCheck,
  Eye,
  FileCheck2,
  FileText,
  Gauge,
  Info,
  KeyRound,
  Landmark,
  LineChart,
  ListChecks,
  LockKeyhole,
  Radar,
  ScrollText,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  UserCog,
  X,
} from 'lucide-react';

type Tone = 'gold' | 'green' | 'red' | 'muted';

type MetricCard = {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: Tone;
};

type CertificateRow = {
  algorithm: string;
  issuedTo: string;
  issuedOn: string;
  expiresOn: string;
  status: 'Active' | 'Expired' | 'Expiring Soon';
};

type PolicyRow = {
  name: string;
  category: string;
  status: 'Compliant' | 'Review';
  lastReviewed: string;
};

type FrameworkAlignment = {
  name: string;
  score: number;
};

type MaturityLevel = {
  label: string;
  value: number;
  color: string;
};

type PolicyTrendPoint = {
  label: string;
  value: number;
};

type GovernancePolicyRow = {
  name: string;
  category: string;
  status: 'Enforced' | 'Draft';
  coverage: number;
  updated: string;
};

type PolicyViolation = {
  title: string;
  detail: string;
  severity: 'High' | 'Medium' | 'Low';
  time: string;
  type: 'warning' | 'info';
};

type RequirementBreakdown = {
  label: string;
  value: number;
  color: string;
};

type CapabilityHighlight = {
  label: string;
  detail: string;
  icon: LucideIcon;
};

type ComplianceModalKey = 'frameworks' | 'maturity' | 'trend' | 'policies' | 'violations' | 'evidence';

type ComplianceModalContent = {
  title: string;
  eyebrow: string;
  summary: string;
  icon: LucideIcon;
  metrics: Array<{ label: string; value: string; tone: Tone }>;
  bullets: string[];
};

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

const metrics: MetricCard[] = [
  {
    title: 'NIST PQC Compliance',
    value: '96%',
    detail: 'Validated by NIST PQC Draft SP 800-208',
    icon: ShieldCheck,
    tone: 'gold',
  },
  {
    title: 'Certificate Status',
    value: '98% Active',
    detail: '45 Active | 2 Expired',
    icon: FileCheck2,
    tone: 'green',
  },
  {
    title: 'Policy Adherence',
    value: '91% Met',
    detail: '15 of 16 Policies',
    icon: ClipboardCheck,
    tone: 'green',
  },
  {
    title: 'Threat Intelligence',
    value: 'Low Risk',
    detail: '3 Active Events',
    icon: Radar,
    tone: 'green',
  },
  {
    title: 'System Audits',
    value: 'Completed',
    detail: '03/10/2024',
    icon: ScrollText,
    tone: 'green',
  },
  {
    title: 'Key Management',
    value: 'Secure',
    detail: '128 Keys',
    icon: KeyRound,
    tone: 'green',
  },
];

const checklist = [
  { label: 'Q-Ready Algorithm Adoption', complete: true },
  { label: 'NIST SP 800-208 Compliance', complete: true },
  { label: 'Certificate Validity Checks', complete: true },
  { label: 'Key Rotation Schedule', complete: true },
  { label: 'Threat Vector Analysis', complete: true },
  { label: 'Audit Trail Integrity', complete: true },
  { label: 'Post-Quantum Migration Plan', complete: false },
];

const certificates: CertificateRow[] = [
  { algorithm: 'ML-DSA-87', issuedTo: 'Ado Seam', issuedOn: '03/10/2024', expiresOn: '03/10/2025', status: 'Active' },
  { algorithm: 'ML-KEM-768', issuedTo: 'Ascure Aarnox', issuedOn: '03/10/2024', expiresOn: '03/10/2025', status: 'Active' },
  { algorithm: 'Falcon-512', issuedTo: 'Ascure Aarnox', issuedOn: '03/10/2024', expiresOn: '03/10/2025', status: 'Expired' },
  { algorithm: 'SPHINCS+-128s', issuedTo: 'Post-Quantum ECC', issuedOn: '03/10/2024', expiresOn: '03/10/2025', status: 'Active' },
  { algorithm: 'ML-DSA-65', issuedTo: 'Ascure Aerrox', issuedOn: '03/10/2024', expiresOn: '03/10/2025', status: 'Active' },
  { algorithm: 'Falcon-512', issuedTo: 'RSA 3072 Legacy', issuedOn: '03/10/2024', expiresOn: '12/10/2024', status: 'Expiring Soon' },
];

const policies: PolicyRow[] = [
  { name: 'Q-Cryptography Standard', category: 'Cryptography', status: 'Compliant', lastReviewed: '03/09/2024' },
  { name: 'Audit Compliance', category: 'Governance', status: 'Compliant', lastReviewed: '03/08/2024' },
  { name: 'Certificate Lifecycle', category: 'Identity', status: 'Compliant', lastReviewed: '03/07/2024' },
  { name: 'Q-Cryptography Standard (PQC)', category: 'Cryptography', status: 'Compliant', lastReviewed: '03/06/2024' },
  { name: 'Certifi Compliance', category: 'Compliance', status: 'Compliant', lastReviewed: '03/05/2024' },
  { name: 'Audit Compliance', category: 'Governance', status: 'Compliant', lastReviewed: '03/04/2024' },
];

const frameworkAlignment: FrameworkAlignment[] = [
  { name: 'NIST SP 800-208', score: 98 },
  { name: 'NIST SP 800-57', score: 95 },
  { name: 'ISO/IEC 27001', score: 94 },
  { name: 'ISO/IEC 27002', score: 92 },
  { name: 'NIST CSF 2.0', score: 90 },
  { name: 'CIS Controls v8', score: 88 },
];

const maturityLevels: MaturityLevel[] = [
  { label: 'Level 5 - Optimized', value: 18, color: '#FFD36B' },
  { label: 'Level 4 - Managed', value: 42, color: '#D49B18' },
  { label: 'Level 3 - Defined', value: 28, color: '#8F6B19' },
  { label: 'Level 2 - Repeatable', value: 8, color: '#4D3910' },
  { label: 'Level 1 - Initial', value: 4, color: '#2B210B' },
];

const policyTrend: PolicyTrendPoint[] = [
  { label: 'May 9', value: 35 },
  { label: 'May 10', value: 46 },
  { label: 'May 11', value: 62 },
  { label: 'May 12', value: 67 },
  { label: 'May 13', value: 76 },
  { label: 'May 14', value: 86 },
  { label: 'May 15', value: 96 },
];

const governancePolicyMatrix: GovernancePolicyRow[] = [
  { name: 'Post-Quantum Cryptography Policy', category: 'Cryptography', status: 'Enforced', coverage: 98, updated: 'May 15, 2026' },
  { name: 'Cryptographic Algorithm Policy', category: 'Algorithms', status: 'Enforced', coverage: 96, updated: 'May 14, 2026' },
  { name: 'Key Management Policy', category: 'Key Management', status: 'Enforced', coverage: 94, updated: 'May 13, 2026' },
  { name: 'Certificate Lifecycle Policy', category: 'Certificates', status: 'Enforced', coverage: 92, updated: 'May 13, 2026' },
  { name: 'Access Control Policy', category: 'Access Control', status: 'Enforced', coverage: 90, updated: 'May 12, 2026' },
  { name: 'Data Protection Policy', category: 'Data Security', status: 'Enforced', coverage: 88, updated: 'May 11, 2026' },
  { name: 'Vendor & Third-Party Policy', category: 'Third Party', status: 'Enforced', coverage: 85, updated: 'May 11, 2026' },
  { name: 'Compliance & Audit Policy', category: 'Compliance', status: 'Draft', coverage: 60, updated: 'May 10, 2026' },
];

const policyViolations: PolicyViolation[] = [
  { title: 'Weak Algorithm Usage', detail: 'RSA-1024 detected in 3 assets', severity: 'High', time: '5m ago', type: 'warning' },
  { title: 'Expired Certificate', detail: '1 certificate expired', severity: 'Medium', time: '15m ago', type: 'warning' },
  { title: 'PQC Unsupported Service', detail: '2 services not PQC ready', severity: 'Medium', time: '27m ago', type: 'warning' },
  { title: 'Policy Drift Detected', detail: 'Key rotation policy drift in 1 asset', severity: 'Low', time: '45m ago', type: 'info' },
  { title: 'New Asset Onboarded', detail: '10.0.50.23 added to scope', severity: 'Low', time: '1h ago', type: 'info' },
];

const requirementBreakdown: RequirementBreakdown[] = [
  { label: 'Compliant', value: 230, color: '#42D95B' },
  { label: 'Partially Compliant', value: 45, color: '#FFCF33' },
  { label: 'Non-Compliant', value: 17, color: '#FF5D52' },
  { label: 'Not Applicable', value: 10, color: '#B8B8B8' },
];

const capabilityHighlights: CapabilityHighlight[] = [
  { label: 'Policy Enforcement', detail: 'Active across 1,248 assets', icon: ShieldCheck },
  { label: 'Audit Trail', detail: 'All actions logged & immutable', icon: ScrollText },
  { label: 'Automated Compliance', detail: 'Continuous monitoring enabled', icon: BadgeCheck },
  { label: 'Risk Based Approach', detail: 'Prioritize critical risks', icon: Target },
  { label: 'Reporting', detail: 'Real-time compliance reports', icon: ClipboardCheck },
  { label: 'Data Residency', detail: 'Regional data governance', icon: Building2 },
];

const complianceModalContent: Record<ComplianceModalKey, ComplianceModalContent> = {
  frameworks: {
    title: 'Policy Framework Alignment',
    eyebrow: 'Control Mapping',
    summary: 'Framework coverage is mapped to cryptographic controls, certificate lifecycle evidence, and migration readiness signals.',
    icon: Landmark,
    metrics: [
      { label: 'Average Alignment', value: '93%', tone: 'gold' },
      { label: 'Mapped Controls', value: '302', tone: 'green' },
      { label: 'Open Gaps', value: '7', tone: 'red' },
    ],
    bullets: [
      'NIST and ISO controls are continuously reconciled with policy evidence.',
      'Coverage gaps are routed to governance owners with asset-level context.',
      'Evidence snapshots are audit-ready for security questionnaires and regulators.',
    ],
  },
  maturity: {
    title: 'Policy Maturity Model',
    eyebrow: 'Operating Model',
    summary: 'The current policy program is in Level 4 Managed with automated enforcement and measurable performance indicators.',
    icon: Gauge,
    metrics: [
      { label: 'Current Level', value: '4', tone: 'gold' },
      { label: 'Managed Coverage', value: '42%', tone: 'green' },
      { label: 'Next Level Gap', value: '18%', tone: 'muted' },
    ],
    bullets: [
      'Managed controls have assigned owners, target thresholds, and review cadences.',
      'Optimization work focuses on predictive drift prevention and vendor evidence.',
      'Repeatable policy reviews reduce exceptions before quarterly audit windows.',
    ],
  },
  trend: {
    title: 'Policy Compliance Over Time',
    eyebrow: 'Seven-Day Trend',
    summary: 'Compliance improved from 35% to 96% during the current measurement window ending May 15, 2026.',
    icon: LineChart,
    metrics: [
      { label: 'This Week', value: '96%', tone: 'gold' },
      { label: 'Last Week', value: '87%', tone: 'muted' },
      { label: 'Change', value: '+9%', tone: 'green' },
    ],
    bullets: [
      'Policy automation and certificate remediation are the main drivers of the gain.',
      'Residual variance is concentrated in third-party and legacy algorithm controls.',
      'Trend evidence is retained with timestamped control snapshots.',
    ],
  },
  policies: {
    title: 'Governance Policy Matrix',
    eyebrow: 'Policy Registry',
    summary: 'Governance policies are categorized by cryptographic domain, enforcement state, and coverage across monitored assets.',
    icon: ListChecks,
    metrics: [
      { label: 'Enforced', value: '7', tone: 'green' },
      { label: 'Draft', value: '1', tone: 'gold' },
      { label: 'Avg Coverage', value: '88%', tone: 'muted' },
    ],
    bullets: [
      'Policy coverage is measured against active assets and certificate inventories.',
      'Draft policies remain visible so reviewers can track governance debt.',
      'Each policy action is tied to immutable audit evidence.',
    ],
  },
  violations: {
    title: 'Policy Violations',
    eyebrow: 'Exception Queue',
    summary: 'Violations are grouped by severity and business risk so remediation teams can address critical exposure first.',
    icon: AlertTriangle,
    metrics: [
      { label: 'High', value: '1', tone: 'red' },
      { label: 'Medium', value: '2', tone: 'gold' },
      { label: 'Low', value: '2', tone: 'green' },
    ],
    bullets: [
      'Weak algorithm usage is the only high-severity active exception.',
      'Certificate exceptions are eligible for automated renewal workflow routing.',
      'Low-severity onboarding and drift signals are retained for audit traceability.',
    ],
  },
  evidence: {
    title: 'Compliance Requirements Evidence',
    eyebrow: 'Evidence Vault',
    summary: 'Requirement evidence combines policy state, asset scope, certificate health, and audit trail completeness.',
    icon: FileCheck2,
    metrics: [
      { label: 'Overall Compliance', value: '96%', tone: 'green' },
      { label: 'Evidence Items', value: '302', tone: 'gold' },
      { label: 'Non-Compliant', value: '17', tone: 'red' },
    ],
    bullets: [
      'Compliant evidence covers 230 mapped requirements across the current scope.',
      'Partially compliant requirements are staged for control owner review.',
      'Non-compliant findings link back to policy violations and remediation owners.',
    ],
  },
};

const particles = Array.from({ length: 36 }, (_, index) => ({
  left: `${(index * 17 + 8) % 100}%`,
  top: `${(index * 29 + 13) % 94}%`,
  delay: (index % 9) * 0.28,
  duration: 6 + (index % 6),
  size: index % 5 === 0 ? 3 : 2,
}));

const toneClasses: Record<Tone, string> = {
  gold: 'text-[#FFD36B] drop-shadow-[0_0_8px_rgba(255,211,107,0.34)]',
  green: 'text-[#4DFF88] drop-shadow-[0_0_8px_rgba(77,255,136,0.28)]',
  red: 'text-[#FF4D5A] drop-shadow-[0_0_8px_rgba(255,77,90,0.28)]',
  muted: 'text-white/64 drop-shadow-[0_0_8px_rgba(255,255,255,0.10)]',
};

function GlassPanel({
  children,
  className,
  delay = 0,
  as = 'section',
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: 'section' | 'div';
}) {
  const Component = motion[as];

  return (
    <Component
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: 'easeOut' }}
      whileHover={{ y: -2, borderColor: 'rgba(255, 211, 107, 0.34)' }}
      className={cx(
        'group relative overflow-hidden rounded-lg border border-[#FFD36B]/20 bg-[#0f1428]/45 p-5 text-white',
        'backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-24px_60px_rgba(255,211,107,0.03),0_0_40px_rgba(255,211,107,0.14)]',
        'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#FFF4C0]/70 before:to-transparent',
        'after:pointer-events-none after:absolute after:-right-24 after:-top-24 after:h-48 after:w-48 after:rounded-full after:bg-[#FFD36B]/10 after:blur-3xl after:transition-opacity after:duration-500 group-hover:after:opacity-90',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_28%,rgba(255,211,107,0.04)_58%,transparent)] opacity-60" />
      <div className="relative z-10">{children}</div>
    </Component>
  );
}

function PanelTitle({ icon: Icon, title, action }: { icon?: LucideIcon; title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {Icon && (
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[#FFD36B]/25 bg-[#FFD36B]/10 text-[#FFD36B] shadow-[0_0_18px_rgba(255,211,107,0.18)]">
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
        <h2 className="truncate text-sm font-black uppercase text-[#FFE8A8]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function GoldShieldBadge({
  showMetric = true,
  compact = false,
  className,
}: {
  showMetric?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'relative mx-auto aspect-[1509/1042] shrink-0 overflow-hidden',
        compact ? 'w-24 max-w-full' : 'w-full max-w-[260px]',
        className,
      )}
    >
      <div className="absolute inset-0 rounded-full bg-[#FFD36B]/12 blur-2xl" />
      <img
        src="/Gold_Shield.png"
        alt="Gold compliance shield"
        className="relative z-10 h-full w-full object-contain drop-shadow-[0_0_24px_rgba(255,179,0,0.28)]"
        loading="eager"
      />
      <div className="absolute inset-0 z-20 grid place-items-center">
        {showMetric ? (
          <div className="translate-y-[3%] text-center">
            <div className="font-mono text-4xl font-black leading-none text-white drop-shadow-[0_0_16px_rgba(255,211,107,0.75)]">100%</div>
            <div className="mt-1 text-xs font-black uppercase text-[#FFE8A8] drop-shadow-[0_0_10px_rgba(255,211,107,0.6)]">Compliant</div>
            <Check className="mx-auto mt-2 h-7 w-7 text-[#FFD36B] drop-shadow-[0_0_12px_rgba(255,211,107,0.9)]" />
          </div>
        ) : (
          <Check className="h-9 w-9 translate-y-[4%] text-[#FFD36B] drop-shadow-[0_0_12px_rgba(255,211,107,0.8)]" />
        )}
      </div>
    </div>
  );
}

function MiniAnalyticsGraph() {
  const points = '4,54 34,40 63,47 93,28 122,35 151,20 181,27 210,8';

  return (
    <div className="relative h-24 min-w-[210px] overflow-hidden rounded-lg border border-[#FFD36B]/10 bg-[#0f1428]/15 p-3">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,211,107,0.08),transparent)]" />
      <svg className="relative h-full w-full" viewBox="0 0 220 72" aria-label="Policy trend graph">
        {[24, 48, 72, 96, 120, 144, 168, 192].map((x) => (
          <line key={x} x1={x} y1="14" x2={x} y2="68" stroke="rgba(255,211,107,0.08)" />
        ))}
        <polyline points={points} fill="none" stroke="#FFD36B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={`${points} 210,72 4,72`} fill="rgba(255,211,107,0.10)" stroke="none" />
        {points.split(' ').map((point) => {
          const [cxPoint, cyPoint] = point.split(',');
          return <circle key={point} cx={cxPoint} cy={cyPoint} r="3" fill="#FFE8A8" stroke="#FFB300" strokeWidth="1.4" />;
        })}
      </svg>
    </div>
  );
}

function OverviewCard() {
  return (
    <GlassPanel delay={0.08} className="min-h-[260px]">
      <PanelTitle icon={Shield} title="Quantum Compliance Overview" />
      <div className="grid gap-5 xl:grid-cols-[240px_1fr]">
        <div className="flex min-w-0 items-center justify-center rounded-lg border border-[#FFD36B]/10 bg-[#0f1428]/10 px-2 py-3">
          <GoldShieldBadge />
        </div>

        <div className="flex min-w-0 flex-col justify-between gap-5">
          <div className="grid gap-4 md:grid-cols-[1fr_230px]">
            <div className="flex items-center gap-4 rounded-lg border border-[#FFD36B]/10 bg-white/[0.03] p-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-[#FFD36B]/25 bg-[#FFD36B]/10 text-[#FFD36B]">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase text-white/70">Total Policies</div>
                <div className="font-mono text-5xl font-black leading-none text-white">210</div>
              </div>
            </div>
            <MiniAnalyticsGraph />
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: 'Compliant', value: '197', tone: 'green' as Tone },
              { label: 'Violations', value: '13', tone: 'red' as Tone },
              { label: 'Pending', value: '0', tone: 'muted' as Tone },
              { label: 'Total Policies', value: '210', tone: 'gold' as Tone },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-[#FFD36B]/10 bg-[#0f1428]/20 p-3 text-center">
                <div className="text-[11px] font-bold uppercase text-white/60">{item.label}</div>
                <div className={cx('mt-2 font-mono text-3xl font-black', toneClasses[item.tone])}>{item.value}</div>
                <div
                  className={cx(
                    'mx-auto mt-2 h-1 w-14 rounded-full',
                    item.tone === 'green' && 'bg-[#4DFF88] shadow-[0_0_12px_rgba(77,255,136,0.8)]',
                    item.tone === 'red' && 'bg-[#FF4D5A] shadow-[0_0_12px_rgba(255,77,90,0.8)]',
                    item.tone === 'gold' && 'bg-[#FFD36B] shadow-[0_0_12px_rgba(255,211,107,0.9)]',
                    item.tone === 'muted' && 'bg-white/45',
                  )}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

function SecurityStatusCard() {
  return (
    <GlassPanel delay={0.14} className="min-h-[260px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-black uppercase text-[#FFD36B]">Q-Security Status: Optimal</div>
          <div className="mt-4 font-mono text-xl text-[#FFE8A8]">100% Compliance</div>
        </div>
        <div className="mr-1 shrink-0 self-start rounded-lg border border-[#FFD36B]/12 bg-[#0f1428]/10 p-1.5">
          <GoldShieldBadge compact showMetric={false} />
        </div>
      </div>

      <div className="mt-5">
        <div className="h-5 overflow-hidden rounded-full border border-[#FFD36B]/30 bg-[#0f1428]/35 p-0.5 shadow-[inset_0_0_16px_rgba(0,0,0,0.65)]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.1, delay: 0.3, ease: 'easeOut' }}
            className="relative h-full rounded-full bg-[linear-gradient(90deg,#FFB300,#FFF0B3,#FFD36B,#FFB300)] shadow-[0_0_22px_rgba(255,179,0,0.7)]"
          >
            <span className="absolute inset-0 compliance-shimmer rounded-full" />
          </motion.div>
        </div>
      </div>

      <div className="my-5 h-px bg-gradient-to-r from-transparent via-[#FFD36B]/22 to-transparent" />

      <div className="space-y-3">
        {[
          'System posture is optimal. All critical controls are active.',
          'Quantum-secure badge verified across production clusters.',
          'Policy evidence synchronized with immutable audit trail.',
        ].map((item) => (
          <div key={item} className="flex items-center gap-3 text-sm text-white/72">
            <span className="h-2.5 w-2.5 rounded-full bg-[#4DFF88] shadow-[0_0_14px_rgba(77,255,136,0.82)]" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}

function MetricTile({ metric, index }: { metric: MetricCard; index: number }) {
  const Icon = metric.icon;

  return (
    <GlassPanel as="div" delay={0.18 + index * 0.04} className="min-h-[132px] p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#FFD36B]/24 bg-[#FFD36B]/9 text-[#FFD36B] shadow-[0_0_22px_rgba(255,211,107,0.12)]">
          <Icon className="h-[22px] w-[22px]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="max-w-[12rem] text-[13px] font-black uppercase leading-tight text-white/88">{metric.title}</div>
          <div className={cx('mt-1.5 whitespace-nowrap font-mono text-[clamp(1rem,1.45vw,1.25rem)] font-black leading-none', toneClasses[metric.tone])}>
            {metric.value}
          </div>
          <div className="mt-2 max-w-[11rem] text-xs leading-snug text-white/62">{metric.detail}</div>
        </div>
      </div>
    </GlassPanel>
  );
}

function ChecklistPanel() {
  return (
    <GlassPanel delay={0.2} className="min-h-[350px]">
      <PanelTitle
        icon={ClipboardCheck}
        title="Compliance Checklist"
        action={<span className="font-mono text-xs font-black text-[#FFD36B]">6 / 7 COMPLETE</span>}
      />

      <div className="grid items-center gap-6 xl:grid-cols-[minmax(320px,0.95fr)_minmax(360px,1.05fr)]">
        <div className="relative min-w-0">
          <div className="relative mx-auto aspect-[1484/1060] w-full max-w-[460px] overflow-hidden rounded-lg border border-[#FFD36B]/18 bg-[#0f1428]/18 p-2 shadow-[inset_0_0_28px_rgba(255,211,107,0.05),0_0_28px_rgba(255,211,107,0.10)]">
            <div className="pointer-events-none absolute inset-0 rounded-lg bg-[radial-gradient(circle_at_50%_74%,rgba(255,211,107,0.14),transparent_58%)]" />
            <img
              src="/compliance.png"
              alt="Quantum compliance verification shield"
              className="relative z-10 h-full w-full rounded-md object-contain"
              loading="eager"
            />
            <div className="pointer-events-none absolute inset-x-8 bottom-4 h-px bg-gradient-to-r from-transparent via-[#FFD36B]/45 to-transparent" />
          </div>
        </div>

        <div className="rounded-lg border border-[#FFD36B]/10 bg-[#0f1428]/18 p-3">
          {checklist.map((item) => (
            <div
              key={item.label}
              className="group/check flex items-center gap-3 border-b border-[#FFD36B]/10 px-2 py-3 last:border-b-0 hover:bg-[#FFD36B]/6"
            >
              <span
                className={cx(
                  'grid h-5 w-5 shrink-0 place-items-center rounded-full border',
                  item.complete
                    ? 'border-[#4DFF88]/70 bg-[#4DFF88]/10 text-[#4DFF88] shadow-[0_0_12px_rgba(77,255,136,0.24)]'
                    : 'border-[#FFD36B]/55 bg-[#FFD36B]/5 text-[#FFD36B]',
                )}
              >
                {item.complete ? <Check className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full border border-current" />}
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold text-white/78 group-hover/check:text-white">{item.label}</span>
              {item.complete ? <Check className="h-4 w-4 text-[#4DFF88]" /> : <AlertTriangle className="h-4 w-4 text-[#FFD36B]" />}
            </div>
          ))}
        </div>
      </div>
    </GlassPanel>
  );
}

function StatusPill({ status }: { status: CertificateRow['status'] }) {
  const config = {
    Active: 'border-[#4DFF88]/25 bg-[#4DFF88]/12 text-[#4DFF88]',
    Expired: 'border-[#FF4D5A]/25 bg-[#FF4D5A]/12 text-[#FF4D5A]',
    'Expiring Soon': 'border-[#FFD36B]/28 bg-[#FFD36B]/12 text-[#FFD36B]',
  }[status];

  return <span className={cx('inline-flex rounded-md border px-2.5 py-1 text-xs font-bold', config)}>{status}</span>;
}

function EnterpriseTable({
  title,
  icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <GlassPanel delay={0.28} className="p-0">
      <div className="px-5 pt-4">
        <PanelTitle
          icon={icon}
          title={title}
          action={
            <button
              type="button"
              title={`View all ${title.toLowerCase()}`}
              className="inline-flex items-center gap-2 rounded-md border border-[#FFD36B]/24 bg-[#FFD36B]/8 px-3 py-1.5 text-xs font-bold text-[#FFD36B] transition hover:bg-[#FFD36B]/14"
            >
              View All
              <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
            </button>
          }
        />
      </div>
      <div className="overflow-x-auto px-5 pb-4">{children}</div>
    </GlassPanel>
  );
}

function CertificateTable() {
  return (
    <EnterpriseTable title="Digital Certificate Status" icon={BadgeCheck}>
      <table className="w-full min-w-[620px] border-collapse text-left">
        <thead>
          <tr className="border-y border-[#FFD36B]/16 bg-[#FFD36B]/8">
            {['Algorithm', 'Issued To', 'Issued On', 'Expires On', 'Status'].map((header) => (
              <th key={header} className="px-3 py-2.5 text-xs font-black uppercase text-[#FFE8A8]">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {certificates.map((cert) => (
            <tr key={`${cert.algorithm}-${cert.issuedTo}-${cert.status}`} className="border-b border-[#FFD36B]/8 transition hover:bg-[#FFD36B]/7">
              <td className="px-3 py-2.5 font-mono text-xs text-white/82">{cert.algorithm}</td>
              <td className="px-3 py-2.5 text-xs text-white/70">{cert.issuedTo}</td>
              <td className="px-3 py-2.5 font-mono text-xs text-white/68">{cert.issuedOn}</td>
              <td className="px-3 py-2.5 font-mono text-xs text-white/68">{cert.expiresOn}</td>
              <td className="px-3 py-2.5">
                <StatusPill status={cert.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </EnterpriseTable>
  );
}

function PolicyTable() {
  return (
    <EnterpriseTable title="Governance Policies" icon={ShieldCheck}>
      <table className="w-full min-w-[620px] border-collapse text-left">
        <thead>
          <tr className="border-y border-[#FFD36B]/16 bg-[#FFD36B]/8">
            {['Policy Name', 'Category', 'Status', 'Last Reviewed'].map((header) => (
              <th key={header} className="px-3 py-2.5 text-xs font-black uppercase text-[#FFE8A8]">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {policies.map((policy, index) => (
            <tr key={`${policy.name}-${index}`} className="border-b border-[#FFD36B]/8 transition hover:bg-[#FFD36B]/7">
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-white/82">
                  <FileText className="h-3.5 w-3.5 text-[#FFD36B]" />
                  {policy.name}
                </div>
              </td>
              <td className="px-3 py-2.5 text-xs text-white/68">{policy.category}</td>
              <td className="px-3 py-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-[#4DFF88]/20 bg-[#4DFF88]/10 px-2.5 py-1 text-xs font-bold text-[#4DFF88]">
                  <Check className="h-3 w-3" />
                  {policy.status}
                </span>
              </td>
              <td className="px-3 py-2.5 font-mono text-xs text-white/68">{policy.lastReviewed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </EnterpriseTable>
  );
}

function GoldActionButton({
  label,
  onClick,
  title,
}: {
  label: string;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title ?? label}
      onClick={onClick}
      className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-[#FFD36B]/18 bg-[#FFD36B]/8 px-3 text-xs font-black text-[#FFD36B] transition hover:border-[#FFD36B]/38 hover:bg-[#FFD36B]/14 focus:outline-none focus:ring-2 focus:ring-[#FFD36B]/40"
    >
      <span className="truncate">{label}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0" />
    </button>
  );
}

function ComplianceDetailModal({
  active,
  onClose,
}: {
  active: ComplianceModalKey | null;
  onClose: () => void;
}) {
  const content = active ? complianceModalContent[active] : null;
  const Icon = content?.icon ?? Info;

  return (
    <AnimatePresence>
      {content && (
        <motion.div
          key={active}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] grid place-items-center bg-[#0f1428]/70 p-4 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="compliance-modal-title"
            className="relative max-h-[min(86vh,720px)] w-full max-w-3xl overflow-y-auto rounded-lg border border-[#FFD36B]/25 bg-[#070A14]/96 p-5 text-white shadow-[0_0_70px_rgba(255,211,107,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FFF4C0]/70 to-transparent" />
            <button
              type="button"
              title="Close detail panel"
              onClick={onClose}
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-white/[0.03] text-white/60 transition hover:border-[#FFD36B]/28 hover:text-[#FFD36B] focus:outline-none focus:ring-2 focus:ring-[#FFD36B]/40"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-4 pr-12">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-[#FFD36B]/24 bg-[#FFD36B]/10 text-[#FFD36B] shadow-[0_0_22px_rgba(255,211,107,0.16)]">
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase text-[#FFD36B]/78">{content.eyebrow}</div>
                <h2 id="compliance-modal-title" className="mt-1 text-2xl font-black leading-tight text-[#FFE8A8]">
                  {content.title}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">{content.summary}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {content.metrics.map((metric) => (
                <div key={metric.label} className="rounded-lg border border-[#FFD36B]/10 bg-white/[0.03] p-3">
                  <div className="text-[11px] font-bold uppercase text-white/50">{metric.label}</div>
                  <div className={cx('mt-2 font-mono text-3xl font-black leading-none', toneClasses[metric.tone])}>{metric.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-lg border border-[#FFD36B]/10 bg-[#0f1428]/20 p-4">
              <div className="mb-3 text-xs font-black uppercase text-[#FFE8A8]">Executive Notes</div>
              <div className="space-y-3">
                {content.bullets.map((bullet) => (
                  <div key={bullet} className="flex gap-3 text-sm leading-6 text-white/72">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[#4DFF88]" />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FrameworkRadar() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[230px]">
      <div className="absolute inset-3 rounded-full border border-[#FFD36B]/12" />
      <div className="absolute inset-8 rounded-full border border-[#FFD36B]/18" />
      <div className="absolute inset-14 rounded-full border border-[#FFD36B]/24" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" aria-label="Framework radar alignment">
        {[0, 30, 60, 90, 120, 150].map((angle) => (
          <line
            key={angle}
            x1="50"
            y1="50"
            x2={50 + Math.cos((angle * Math.PI) / 180) * 42}
            y2={50 + Math.sin((angle * Math.PI) / 180) * 42}
            stroke="rgba(255,211,107,0.16)"
            strokeWidth="0.55"
          />
        ))}
        <polygon
          points="50,21 72,34 72,63 50,78 28,63 28,34"
          fill="rgba(255,211,107,0.10)"
          stroke="rgba(255,211,107,0.70)"
          strokeWidth="1.8"
        />
        <polygon points="50,28 64,38 64,59 50,69 36,59 36,38" fill="rgba(255,179,0,0.20)" stroke="rgba(255,244,192,0.50)" />
      </svg>
      {frameworkAlignment.map((framework, index) => {
        const angle = (index / frameworkAlignment.length) * Math.PI * 2 - Math.PI / 2;
        const left = 50 + Math.cos(angle) * 41;
        const top = 50 + Math.sin(angle) * 41;

        return (
          <span
            key={framework.name}
            title={`${framework.name}: ${framework.score}%`}
            className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#FFE8A8] bg-[#FFD36B] shadow-[0_0_16px_rgba(255,211,107,0.92)]"
            style={{ left: `${left}%`, top: `${top}%` }}
          />
        );
      })}
      <div className="absolute inset-0 grid place-items-center">
        <div className="grid h-16 w-16 place-items-center rounded-lg border border-[#FFD36B]/34 bg-[#0f1428]/48 text-[#FFD36B] shadow-[inset_0_0_20px_rgba(255,211,107,0.10),0_0_28px_rgba(255,211,107,0.22)]">
          <Landmark className="h-9 w-9" />
        </div>
      </div>
    </div>
  );
}

function PolicyFrameworkAlignmentPanel({ onOpen }: { onOpen: () => void }) {
  return (
    <GlassPanel delay={0.32} className="min-h-[350px]">
      <PanelTitle icon={Landmark} title="Policy Framework Alignment" />

      <div className="grid gap-5 sm:grid-cols-[minmax(160px,0.85fr)_minmax(220px,1fr)] xl:grid-cols-1">
        <FrameworkRadar />

        <div className="flex min-w-0 flex-col justify-center gap-3">
          {frameworkAlignment.map((framework) => (
            <div key={framework.name} className="grid grid-cols-[minmax(118px,1fr)_minmax(78px,0.9fr)_44px] items-center gap-3">
              <div className="truncate text-xs font-bold text-white/72">{framework.name}</div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#FFD36B]/8">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${framework.score}%` }}
                  transition={{ duration: 0.85, delay: 0.35, ease: 'easeOut' }}
                  className="h-full rounded-full bg-[linear-gradient(90deg,#4D3910,#FFD36B)] shadow-[0_0_12px_rgba(255,211,107,0.55)]"
                />
              </div>
              <div className="text-right font-mono text-sm font-black text-[#FFE8A8]">{framework.score}%</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <GoldActionButton label="View All Frameworks" onClick={onOpen} />
      </div>
    </GlassPanel>
  );
}

function PolicyMaturityPanel({ onOpen }: { onOpen: () => void }) {
  return (
    <GlassPanel delay={0.36} className="min-h-[350px]">
      <PanelTitle icon={Gauge} title="Policy Maturity Model" />

      <div className="grid items-center gap-5 sm:grid-cols-[minmax(180px,0.85fr)_minmax(220px,1fr)] xl:grid-cols-1">
        <div className="relative mx-auto aspect-square w-full max-w-[230px] rounded-full border border-[#FFD36B]/18 p-4">
          <div
            className="absolute inset-4 rounded-full shadow-[0_0_36px_rgba(255,211,107,0.14)]"
            style={{
              background:
                'conic-gradient(#FFD36B 0% 18%, #D49B18 18% 60%, #8F6B19 60% 88%, #4D3910 88% 96%, #2B210B 96% 100%)',
            }}
          />
          <div className="absolute inset-[28%] rounded-full border border-[#FFD36B]/18 bg-[#070A14] shadow-[inset_0_0_28px_rgba(255,211,107,0.10)]" />
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="text-xs font-bold text-[#FFD36B]/80">Level</div>
              <div className="font-mono text-6xl font-black leading-none text-white drop-shadow-[0_0_18px_rgba(255,211,107,0.48)]">4</div>
              <div className="mt-1 text-xs font-bold text-white/68">Managed</div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {maturityLevels.map((level) => (
            <div key={level.label} className="grid grid-cols-[18px_minmax(0,1fr)_42px] items-center gap-3 text-sm">
              <span className="h-2.5 w-2.5 rounded-sm border border-[#FFD36B]/35" style={{ backgroundColor: level.color }} />
              <span className="truncate text-white/70">{level.label}</span>
              <span className="text-right font-mono text-xs font-black text-white/72">{level.value}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <GoldActionButton label="View Maturity Model" onClick={onOpen} />
      </div>
    </GlassPanel>
  );
}

function PolicyTrendPanel({ onOpen }: { onOpen: () => void }) {
  const width = 430;
  const height = 224;
  const left = 42;
  const right = 416;
  const top = 20;
  const bottom = 152;
  const xFor = (index: number) => left + (index / (policyTrend.length - 1)) * (right - left);
  const yFor = (value: number) => bottom - (value / 100) * (bottom - top);
  const points = policyTrend.map((point, index) => `${xFor(index)},${yFor(point.value)}`).join(' ');
  const areaPoints = `${points} ${xFor(policyTrend.length - 1)},${bottom} ${xFor(0)},${bottom}`;

  return (
    <GlassPanel delay={0.4} className="min-h-[350px]">
      <PanelTitle icon={LineChart} title="Policy Compliance Over Time" />

      <div className="rounded-lg border border-[#FFD36B]/10 bg-[#0f1428]/18 p-2">
        <svg className="h-[220px] w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Policy compliance trend">
          {[0, 25, 50, 75, 100].map((tick) => {
            const y = yFor(tick);
            return (
              <g key={tick}>
                <line x1={left} y1={y} x2={right} y2={y} stroke="rgba(255,211,107,0.12)" strokeWidth="1" />
                <text x="8" y={y + 4} fill="rgba(255,255,255,0.62)" fontSize="11" fontFamily="monospace">
                  {tick}%
                </text>
              </g>
            );
          })}
          <polygon points={areaPoints} fill="rgba(255,179,0,0.18)" />
          <polyline points={points} fill="none" stroke="#FFD36B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {policyTrend.map((point, index) => (
            <g key={point.label}>
              <circle cx={xFor(index)} cy={yFor(point.value)} r="4" fill="#FFE8A8" stroke="#FFB300" strokeWidth="2" />
              <text x={xFor(index)} y="196" textAnchor="middle" fill="rgba(255,255,255,0.58)" fontSize="10" fontFamily="monospace">
                {point.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-lg border border-[#FFD36B]/10 bg-white/[0.03]">
        {[
          { label: 'This Week', value: '96%', tone: 'gold' as Tone },
          { label: 'Last Week', value: '87%', tone: 'muted' as Tone },
          { label: 'Change', value: '+9%', tone: 'green' as Tone },
        ].map((stat) => (
          <div key={stat.label} className="border-r border-[#FFD36B]/10 p-3 text-center last:border-r-0">
            <div className="text-[11px] font-black uppercase text-[#FFD36B]/78">{stat.label}</div>
            <div className={cx('mt-1 font-mono text-2xl font-black leading-none', toneClasses[stat.tone])}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <GoldActionButton label="View Trend Evidence" onClick={onOpen} />
      </div>
    </GlassPanel>
  );
}

function GovernanceStatusBadge({ status }: { status: GovernancePolicyRow['status'] }) {
  const config =
    status === 'Enforced'
      ? 'border-[#4DFF88]/24 bg-[#4DFF88]/10 text-[#4DFF88]'
      : 'border-[#FFD36B]/26 bg-[#FFD36B]/10 text-[#FFD36B]';

  return <span className={cx('inline-flex rounded-md border px-2 py-1 text-[11px] font-black', config)}>{status}</span>;
}

function GovernancePolicyMatrixPanel({ onOpen }: { onOpen: () => void }) {
  return (
    <GlassPanel delay={0.44} className="min-h-[350px] p-0">
      <div className="px-5 pt-4">
        <PanelTitle icon={ListChecks} title="Governance Policies" />
      </div>
      <div className="overflow-x-auto px-5">
        <table className="w-full min-w-[680px] border-collapse text-left">
          <thead>
            <tr className="border-y border-[#FFD36B]/12 bg-[#FFD36B]/7">
              {['Policy Name', 'Category', 'Status', 'Coverage', 'Last Updated', 'Action'].map((header) => (
                <th key={header} className="px-2.5 py-2 text-[10px] font-black uppercase text-[#FFE8A8]">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {governancePolicyMatrix.map((policy) => (
              <tr key={policy.name} className="border-b border-[#FFD36B]/8 hover:bg-[#FFD36B]/6">
                <td className="px-2.5 py-2.5 text-xs font-semibold text-white/82">{policy.name}</td>
                <td className="px-2.5 py-2.5 text-xs text-white/62">{policy.category}</td>
                <td className="px-2.5 py-2.5">
                  <GovernanceStatusBadge status={policy.status} />
                </td>
                <td className="px-2.5 py-2.5 font-mono text-xs font-black text-white/78">{policy.coverage}%</td>
                <td className="px-2.5 py-2.5 font-mono text-[11px] text-white/58">{policy.updated}</td>
                <td className="px-2.5 py-2.5">
                  <button
                    type="button"
                    title={`Inspect ${policy.name}`}
                    onClick={onOpen}
                    className="grid h-7 w-7 place-items-center rounded-md border border-[#FFD36B]/16 bg-[#FFD36B]/8 text-[#FFD36B] transition hover:border-[#FFD36B]/36 hover:bg-[#FFD36B]/14 focus:outline-none focus:ring-2 focus:ring-[#FFD36B]/35"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-5 pt-4">
        <GoldActionButton label="View All Policies" onClick={onOpen} />
      </div>
    </GlassPanel>
  );
}

function SeverityBadge({ severity }: { severity: PolicyViolation['severity'] }) {
  const config = {
    High: 'border-[#FF4D5A]/28 bg-[#FF4D5A]/12 text-[#FF6A73]',
    Medium: 'border-[#FFD36B]/30 bg-[#FFD36B]/10 text-[#FFD36B]',
    Low: 'border-[#4DFF88]/25 bg-[#4DFF88]/10 text-[#4DFF88]',
  }[severity];

  return <span className={cx('inline-flex rounded-md border px-2.5 py-1 text-xs font-black', config)}>{severity}</span>;
}

function PolicyViolationsPanel({ onOpen }: { onOpen: () => void }) {
  return (
    <GlassPanel delay={0.48} className="min-h-[350px]">
      <PanelTitle icon={AlertTriangle} title="Policy Violations" />

      <div className="space-y-1">
        {policyViolations.map((violation) => {
          const Icon = violation.type === 'warning' ? AlertTriangle : Info;
          const iconClass = violation.severity === 'Low' ? 'text-[#65CFFF] border-[#65CFFF]/35 bg-[#65CFFF]/8' : 'text-[#FFD36B] border-[#FFD36B]/35 bg-[#FFD36B]/8';

          return (
            <div key={violation.title} className="grid grid-cols-[34px_minmax(0,1fr)_70px_54px] items-center gap-3 border-b border-[#FFD36B]/8 py-3 last:border-b-0">
              <div className={cx('grid h-7 w-7 place-items-center rounded-md border', iconClass)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-white/84">{violation.title}</div>
                <div className="truncate text-xs text-white/55">{violation.detail}</div>
              </div>
              <SeverityBadge severity={violation.severity} />
              <div className="text-right font-mono text-[11px] text-white/50">{violation.time}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <GoldActionButton label="View All Violations" onClick={onOpen} />
      </div>
    </GlassPanel>
  );
}

function ComplianceRequirementsPanel({ onOpen, className }: { onOpen: () => void; className?: string }) {
  const total = requirementBreakdown.reduce((sum, item) => sum + item.value, 0);

  return (
    <GlassPanel delay={0.52} className={cx('min-h-[350px]', className)}>
      <PanelTitle icon={FileCheck2} title="Compliance Requirements" />

      <div className="grid items-center gap-5 sm:grid-cols-[minmax(190px,0.86fr)_minmax(220px,1fr)] 2xl:grid-cols-1">
        <div className="relative mx-auto aspect-square w-full max-w-[245px] rounded-full border border-[#FFD36B]/12 p-3">
          <div
            className="absolute inset-3 rounded-full shadow-[0_0_42px_rgba(77,255,136,0.14)]"
            style={{
              background:
                'conic-gradient(#42D95B 0% 76%, #FFCF33 76% 91%, #FF5D52 91% 97%, #B8B8B8 97% 100%)',
            }}
          />
          <div className="absolute inset-[29%] rounded-full border border-[#FFD36B]/14 bg-[#070A14] shadow-[inset_0_0_28px_rgba(0,0,0,0.85)]" />
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="font-mono text-4xl font-black leading-none text-white">96%</div>
              <div className="mt-1 text-xs font-bold text-white/62">Overall Compliance</div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {requirementBreakdown.map((requirement) => {
            const percentage = Math.round((requirement.value / total) * 100);

            return (
              <div key={requirement.label} className="grid grid-cols-[18px_minmax(0,1fr)_82px] items-center gap-3">
                <span className="h-3 w-3 rounded-sm shadow-[0_0_12px_rgba(255,255,255,0.12)]" style={{ backgroundColor: requirement.color }} />
                <span className="truncate text-sm text-white/72">{requirement.label}</span>
                <span className="text-right font-mono text-sm text-white/78">
                  {requirement.value} ({percentage}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <GoldActionButton label="View Compliance Evidence" onClick={onOpen} />
      </div>
    </GlassPanel>
  );
}

function CapabilityRail() {
  return (
    <div className="grid overflow-hidden rounded-lg border border-[#FFD36B]/18 bg-[#0f1428]/42 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_30px_rgba(255,211,107,0.10)] sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {capabilityHighlights.map((item) => {
        const Icon = item.icon;

        return (
          <div key={item.label} className="flex min-w-0 items-center gap-3 border-b border-r border-[#FFD36B]/10 p-4 last:border-r-0 2xl:border-b-0">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#FFD36B]/28 bg-[#FFD36B]/10 text-[#FFD36B]">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-black uppercase text-[#FFD36B]">{item.label}</div>
              <div className="mt-1 truncate text-xs text-white/58">{item.detail}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PolicyIntelligenceSection({ onOpen }: { onOpen: (key: ComplianceModalKey) => void }) {
  return (
    <section className="space-y-4" aria-labelledby="policy-intelligence-heading">
      <div className="flex flex-col gap-3 rounded-lg border border-[#FFD36B]/14 bg-[#0f1428]/16 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase text-[#FFD36B]/74">Governance Intelligence</div>
          <h2 id="policy-intelligence-heading" className="mt-1 text-xl font-black uppercase leading-tight text-[#FFE8A8]">
            Policy Control Center
          </h2>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-md border border-[#4DFF88]/20 bg-[#4DFF88]/8 px-3 py-2 text-xs font-black text-[#4DFF88]">
          <span className="h-2 w-2 rounded-full bg-[#4DFF88] shadow-[0_0_12px_rgba(77,255,136,0.8)]" />
          Continuous Evidence Sync
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <PolicyFrameworkAlignmentPanel onOpen={() => onOpen('frameworks')} />
        <PolicyMaturityPanel onOpen={() => onOpen('maturity')} />
        <PolicyTrendPanel onOpen={() => onOpen('trend')} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-[minmax(0,1.15fr)_minmax(330px,0.85fr)_minmax(330px,0.95fr)]">
        <GovernancePolicyMatrixPanel onOpen={() => onOpen('policies')} />
        <PolicyViolationsPanel onOpen={() => onOpen('violations')} />
        <ComplianceRequirementsPanel onOpen={() => onOpen('evidence')} className="xl:col-span-2 2xl:col-span-1" />
      </div>

      <CapabilityRail />
    </section>
  );
}

function BackgroundAtmosphere() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[#050816]" />
      <div className="absolute -right-24 -top-36 h-[560px] w-[560px] rounded-full border border-[#FFD36B]/18 bg-[radial-gradient(circle,rgba(255,211,107,0.20),rgba(255,179,0,0.06)_38%,transparent_68%)] shadow-[0_0_120px_rgba(255,179,0,0.22)]" />
      <div className="absolute left-1/4 top-0 h-80 w-[520px] bg-[radial-gradient(circle,rgba(255,211,107,0.13),transparent_68%)] blur-3xl" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,211,107,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,211,107,0.04)_1px,transparent_1px)] bg-[size:48px_48px] opacity-50" />
      <svg className="absolute right-0 top-0 h-[360px] w-[700px] opacity-70" viewBox="0 0 700 360">
        <path d="M45 140 168 62 286 122 430 38 622 84" fill="none" stroke="rgba(255,211,107,0.33)" strokeWidth="1" />
        <path d="M110 262 286 122 372 238 622 84 670 186" fill="none" stroke="rgba(255,211,107,0.18)" strokeWidth="1" />
        <path d="M168 62 372 238 430 38" fill="none" stroke="rgba(255,211,107,0.16)" strokeWidth="1" />
        {[45, 168, 286, 430, 622, 110, 372, 670].map((x, index) => (
          <circle
            key={`${x}-${index}`}
            cx={x}
            cy={[140, 62, 122, 38, 84, 262, 238, 186][index]}
            r={index % 3 === 0 ? 4 : 2.8}
            fill="#FFD36B"
            opacity="0.88"
          />
        ))}
      </svg>
      {particles.map((particle) => (
        <motion.span
          key={`${particle.left}-${particle.top}`}
          className="absolute rounded-full bg-[#FFD36B] shadow-[0_0_14px_rgba(255,211,107,0.95)]"
          style={{ left: particle.left, top: particle.top, width: particle.size, height: particle.size }}
          animate={{ y: [0, -14, 0], opacity: [0.15, 0.85, 0.15] }}
          transition={{ duration: particle.duration, delay: particle.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

function Header() {
  return (
    <header className="relative z-10 mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="text-4xl font-black leading-none text-[#FFE8A8] drop-shadow-[0_0_24px_rgba(255,211,107,0.34)] md:text-6xl"
        >
          Qguard Helix
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08 }}
          className="mt-2 text-base font-medium text-white/82"
        >
          Quantum Governance & Compliance Platform
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.1 }}
        className="flex flex-wrap items-center gap-3"
      >
        <button
          type="button"
          title="Compliance notifications"
          className="inline-flex h-12 items-center gap-2 rounded-lg border border-[#FFD36B]/22 bg-[#0f1428]/58 px-4 text-[#FFD36B] backdrop-blur-xl transition hover:border-[#FFD36B]/45 hover:bg-[#FFD36B]/10"
        >
          <Bell className="h-5 w-5" />
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#FFD36B] px-1 font-mono text-xs font-black text-[#050816]">3</span>
        </button>
        <button
          type="button"
          title="Administrator profile"
          className="inline-flex h-12 items-center gap-2 rounded-lg border border-[#FFD36B]/22 bg-[#0f1428]/58 px-4 text-white/85 backdrop-blur-xl transition hover:border-[#FFD36B]/45 hover:bg-[#FFD36B]/10"
        >
          <UserCog className="h-5 w-5 text-[#FFD36B]" />
          <span className="text-sm font-bold">SYS-ADMIN</span>
          <ChevronDown className="h-4 w-4 text-[#FFD36B]" />
        </button>
        <button
          type="button"
          title="Secure session status"
          className="inline-flex h-12 items-center gap-2 rounded-lg border border-[#4DFF88]/22 bg-[#0f1428]/58 px-4 text-[#4DFF88] backdrop-blur-xl transition hover:border-[#4DFF88]/45 hover:bg-[#4DFF88]/10"
        >
          <ShieldCheck className="h-5 w-5" />
          <span className="text-sm font-black">SECURE</span>
          <ChevronDown className="h-4 w-4 -rotate-90" />
        </button>
      </motion.div>
    </header>
  );
}

export default function ComplianceDashboard() {
  const [activeModal, setActiveModal] = useState<ComplianceModalKey | null>(null);

  return (
    <div className="compliance-page relative min-h-screen overflow-hidden bg-[#050816] p-4 text-white sm:p-5 lg:p-6">
      <BackgroundAtmosphere />

      <div className="relative z-10 mx-auto max-w-[1420px]">
        <Header />

        <main className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,0.95fr)]">
            <OverviewCard />
            <SecurityStatusCard />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.9fr)]">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
              {metrics.map((metric, index) => (
                <div key={metric.title}>
                  <MetricTile metric={metric} index={index} />
                </div>
              ))}
            </div>
            <ChecklistPanel />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <CertificateTable />
            <PolicyTable />
          </div>

          <PolicyIntelligenceSection onOpen={setActiveModal} />

          <div className="flex flex-wrap items-center justify-center gap-5 pb-1 pt-1 text-sm font-semibold text-[#FFD36B]/86">
            {[
              { icon: LockKeyhole, label: 'End-to-End Quantum-Secure' },
              { icon: Activity, label: 'Zero Trust by Design' },
              { icon: Sparkles, label: 'Future Ready' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <span key={item.label} className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
              );
            })}
          </div>
        </main>
      </div>

      <ComplianceDetailModal active={activeModal} onClose={() => setActiveModal(null)} />

      <style>{`
        .compliance-page,
        .compliance-page * {
          letter-spacing: 0;
        }

        .compliance-page {
          isolation: isolate;
        }

        .compliance-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
          transform: translateX(-100%);
          animation: complianceShimmer 2.8s ease-in-out infinite;
        }

        @keyframes complianceShimmer {
          0% {
            transform: translateX(-120%);
          }
          58%, 100% {
            transform: translateX(120%);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .compliance-page *,
          .compliance-page *::before,
          .compliance-page *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
