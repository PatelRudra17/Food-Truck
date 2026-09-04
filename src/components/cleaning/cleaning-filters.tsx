"use client";

import { StatusFilterSelect } from "@/components/shared/status-filter-select";
import { CLEANING_ENTITY_TYPES, CLEANING_ENTITY_TYPE_LABELS } from "@/lib/validators/cleaning";

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
];

const ENTITY_TYPE_OPTIONS = CLEANING_ENTITY_TYPES.map((type) => ({
  value: type,
  label: CLEANING_ENTITY_TYPE_LABELS[type],
}));

export function CleaningFilters() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusFilterSelect options={ENTITY_TYPE_OPTIONS} paramName="entityType" placeholder="All types" />
      <StatusFilterSelect options={STATUS_OPTIONS} paramName="status" placeholder="All statuses" />
    </div>
  );
}
