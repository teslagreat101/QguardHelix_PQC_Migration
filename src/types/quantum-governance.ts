export interface GovernanceKPI {
  label: string;
  value: string | number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  trend: 'up' | 'down' | 'stable';
  updatedAt: string;
}

export interface CryptoAsset {
  id: string;
  name: string;
  environment: string;
  businessOwner: string;
  technicalOwner: string;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  dataClassification: string;
  algorithm: string;
  keyType: string;
  protocol: string;
  lastRotation: string;
  nextRotation: string;
  pqcReadiness: number; // 0-100
  riskScore: number;
  status: 'active' | 'deprecated' | 'rotation_due' | 'revoked';
}

export interface OwnershipRecord {
  domain: string;
  businessOwner: string;
  technicalOwner: string;
  securityOwner: string;
  lastReview: string;
  status: 'compliant' | 'review_required' | 'unowned';
}

export interface PkiDebtItem {
  id: string;
  type: string;
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  blockingPqc: boolean;
  status: 'stale' | 'unknown' | 'manual' | 'vulnerable';
}

export interface PqcMigrationStep {
  id: string;
  asset: string;
  stage: 'discover' | 'classify' | 'assign' | 'assess' | 'prioritize' | 'pilot' | 'migrate' | 'monitor' | 'retire';
  targetAlgorithm: string;
  deadline: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
}

export interface ComplianceControl {
  framework: string;
  controlId: string;
  name: string;
  status: 'implemented' | 'partial' | 'not_implemented' | 'exception' | 'needs_review';
  evidenceStatus: 'attached' | 'missing' | 'expired';
}

export interface VendorReadiness {
  name: string;
  product: string;
  pqcRoadmap: boolean;
  hybridSupport: boolean;
  targetDate: string;
  riskRating: 'low' | 'medium' | 'high';
  status: 'unknown' | 'roadmap_confirmed' | 'pqc_ready' | 'blocked';
}

export interface GovernanceWorkflow {
  id: string;
  type: string;
  assignee: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_review' | 'approved' | 'completed';
  dueDate: string;
}

export interface GovernanceEvidence {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  owner: string;
}
