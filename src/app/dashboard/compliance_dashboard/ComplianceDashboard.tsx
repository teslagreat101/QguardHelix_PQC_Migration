import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Bell,
  Check,
  ChevronDown,
  ClipboardCheck,
  FileCheck2,
  FileText,
  KeyRound,
  LockKeyhole,
  Radar,
  ScrollText,
  Shield,
  ShieldCheck,
  Sparkles,
  UserCog,
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
    <div className="relative h-24 min-w-[210px] overflow-hidden rounded-lg border border-[#FFD36B]/10 bg-black/15 p-3">
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
        <div className="flex min-w-0 items-center justify-center rounded-lg border border-[#FFD36B]/10 bg-black/10 px-2 py-3">
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
              <div key={item.label} className="rounded-lg border border-[#FFD36B]/10 bg-black/20 p-3 text-center">
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
        <div className="mr-1 shrink-0 self-start rounded-lg border border-[#FFD36B]/12 bg-black/10 p-1.5">
          <GoldShieldBadge compact showMetric={false} />
        </div>
      </div>

      <div className="mt-5">
        <div className="h-5 overflow-hidden rounded-full border border-[#FFD36B]/30 bg-black/35 p-0.5 shadow-[inset_0_0_16px_rgba(0,0,0,0.65)]">
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
          <div className="relative mx-auto aspect-[1484/1060] w-full max-w-[460px] overflow-hidden rounded-lg border border-[#FFD36B]/18 bg-black/18 p-2 shadow-[inset_0_0_28px_rgba(255,211,107,0.05),0_0_28px_rgba(255,211,107,0.10)]">
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

        <div className="rounded-lg border border-[#FFD36B]/10 bg-black/18 p-3">
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
