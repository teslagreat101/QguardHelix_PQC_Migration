import React from 'react';

export default function QuantumQrngLoading() {
  return (
    <div className="p-8 space-y-8 animate-pulse">
      <div className="h-12 w-1/3 bg-gold/10 rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-white/5 rounded-2xl border border-white/10" />
        ))}
      </div>
      <div className="h-[400px] bg-white/5 rounded-2xl border border-white/10" />
    </div>
  );
}
