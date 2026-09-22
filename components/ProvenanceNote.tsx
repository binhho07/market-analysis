"use client";

import { describeProvenance, readPositive, readValue } from "@/lib/provenance";

export function ProvenanceNote({ field }: { field: unknown }) {
  const note = describeProvenance(field);
  const tone =
    note.mark === "●" ? "text-emerald-700" : note.mark === "◐" ? "text-amber-700" : "text-gray-500";

  return (
    <p className={`text-[11px] leading-tight ${tone}`}>
      {note.mark} {note.label}
    </p>
  );
}

export function PriceCell({ field }: { field: unknown }) {
  const value = readPositive(field);
  return (
    <div className="min-w-[9.5rem] py-1">
      <div className="font-medium">{value ? `$${value}` : "—"}</div>
      <ProvenanceNote field={field} />
    </div>
  );
}

export function ObservedCell({ field, suffix = "" }: { field: unknown; suffix?: string }) {
  const value = readValue(field);
  const empty = value == null || value === "" || (Array.isArray(value) && value.length === 0);
  return (
    <div className="min-w-[8rem] py-1">
      <div className="text-sm">{empty ? "—" : `${value}${suffix}`}</div>
      <ProvenanceNote field={field} />
    </div>
  );
}
