import React from 'react';

export default function QuantumGovernanceLoading() {
  return (
    <div className="p-8 space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="space-y-4">
        <div className="h-10 w-64 bg-gold/10 rounded-lg border border-gold/20" />
        <div className="h-4 w-96 bg-white/5 rounded" />
      </div>

      {/* KPI Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-32 bg-gold/5 rounded-xl border border-gold/10" />
        ))}
      </div>

      {/* Tables Skeleton */}
      <div className="space-y-6">
        <div className="h-[400px] bg-white/[0.02] rounded-xl border border-white/5" />
        <div className="h-[300px] bg-white/[0.02] rounded-xl border border-white/5" />
      </div>
    </div>
  );
}
