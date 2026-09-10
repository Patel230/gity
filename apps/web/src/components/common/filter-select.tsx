"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface FilterOption {
  value: string;
  label: string;
}

export function FilterSelect({
  value,
  onChange,
  label,
  options,
  wide = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: FilterOption[];
  wide?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-8 ${wide ? "w-52" : "w-auto min-w-24"}`} title={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function allOption(label: string): FilterOption {
  return { value: "all", label: `All ${label.toLowerCase()}` };
}

export function textOptions(values: Iterable<string>, label: string): FilterOption[] {
  return [
    allOption(label),
    ...[...new Set(values)].sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value })),
  ];
}
