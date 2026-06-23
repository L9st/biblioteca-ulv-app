"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export type DropdownOption = {
  label: string;
  value: string;
};

type DropdownSelectProps = {
  label: string;
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
};

export function DropdownSelect({
  label,
  options,
  value,
  onChange,
  emptyLabel = "No hay opciones disponibles",
  disabled = false,
  className = "",
}: DropdownSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? emptyLabel;
  const visibleOptions = options.length > 0 ? options : [{ label: emptyLabel, value: "" }];

  function handleBlur() {
    closeTimeoutRef.current = setTimeout(() => setIsOpen(false), 120);
  }

  function handleFocus() {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
  }

  function selectOption(nextValue: string) {
    if (!nextValue || disabled) {
      return;
    }

    setIsOpen(false);
    onChange(nextValue);
  }

  return (
    <div className={`w-full max-w-full min-w-0 ${className}`}>
      <p className="pb-3 text-sm font-bold text-ulv-blue">{label}</p>
      <div className="relative w-full max-w-full min-w-0" onBlur={handleBlur} onFocus={handleFocus}>
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
          disabled={disabled || options.length === 0}
          className="flex min-h-12 w-full min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-bold text-ulv-blue shadow-sm transition hover:border-ulv-yellow disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="min-w-0 break-words leading-snug">{selectedLabel}</span>
          <ChevronDown className={`h-5 w-5 transition ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>

        {isOpen ? (
          <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
            {visibleOptions.map((option) => {
              const isActive = option.value === value;

              return (
                <button
                  key={option.value || option.label}
                  type="button"
                  onClick={() => selectOption(option.value)}
                  disabled={!option.value}
                  className={`block w-full break-words px-4 py-3 text-left text-sm font-bold leading-snug transition disabled:cursor-not-allowed disabled:text-slate-400 ${
                    isActive ? "bg-ulv-blue text-white" : "text-ulv-blue hover:bg-ulv-yellow/10"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
