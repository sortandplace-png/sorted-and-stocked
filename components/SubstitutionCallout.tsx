'use client';

import React from 'react';

interface SubstitutionCalloutProps {
  recipeName: string;
  substitutionNotes?: string | null;
}

export default function SubstitutionCallout({ recipeName, substitutionNotes }: SubstitutionCalloutProps) {
  // If the manager hasn't annotated manually yet, we gracefully collapse without error.
  if (!substitutionNotes || substitutionNotes.trim() === "") return null;

  return (
    <div className="my-6 bg-amber-950/40 border border-amber-800/40 rounded-xl p-4 flex gap-3 text-amber-200">
      {/* Alert Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      {/* Content Cluster */}
      <div className="space-y-1">
        <h4 className="text-sm font-bold tracking-tight text-amber-400">
          House Manager Operational Substitutions
        </h4>
        <p className="text-xs text-amber-200/80 leading-relaxed font-sans">
          {substitutionNotes}
        </p>
        <span className="text-[10px] text-amber-500/70 block uppercase font-mono tracking-wider pt-1">
          *Fallback enabled: Standard string matching suspended for {recipeName}
        </span>
      </div>
    </div>
  );
}
