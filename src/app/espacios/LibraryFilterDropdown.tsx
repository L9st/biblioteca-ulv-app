"use client";

import { useRouter } from "next/navigation";
import { DropdownSelect } from "@/app/ui/DropdownSelect";
import { libraryFilters } from "./page";

type LibraryFilterDropdownProps = {
  selectedLibraryCode: string | null;
  selectedLibraryLabel: string;
};

export function LibraryFilterDropdown({
  selectedLibraryCode,
  selectedLibraryLabel,
}: LibraryFilterDropdownProps) {
  const router = useRouter();
  const selectedValue = selectedLibraryCode ?? "all";
  const options = libraryFilters.map((filter) => ({
    label: filter.label,
    value: filter.code ?? "all",
  }));

  function selectLibrary(value: string) {
    const selectedFilter = libraryFilters.find((filter) => (filter.code ?? "all") === value);

    if (selectedFilter) {
      router.push(selectedFilter.href);
    }
  }

  return (
    <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <DropdownSelect
        label="Filtrar por biblioteca"
        options={options}
        value={selectedValue}
        onChange={selectLibrary}
        emptyLabel={selectedLibraryLabel}
      />
    </div>
  );
}
