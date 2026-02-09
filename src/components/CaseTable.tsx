"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { cn, COURT_TYPE_COLORS, STATUS_COLORS } from "@/lib/utils";
import { Search, ChevronRight } from "lucide-react";

interface CaseRow {
  id: string;
  case_title: string;
  court_type: string;
  court_name: string | null;
  case_number: string;
  case_year: string | null;
  current_status: string | null;
  next_hearing_date: string | null;
  last_order_date: string | null;
  petitioner: string | null;
  respondent: string | null;
  tags: string[];
}

export function CaseTable({ cases }: { cases: CaseRow[] }) {
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let result = cases;
    if (filter !== "all") result = result.filter((c) => c.court_type === filter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.case_title?.toLowerCase().includes(q) ||
          c.case_number?.includes(q) ||
          c.petitioner?.toLowerCase().includes(q) ||
          c.respondent?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [cases, filter, search]);

  const courtTabs = [
    { key: "all", label: "All" },
    { key: "SC", label: "SC" },
    { key: "HC", label: "HC" },
    { key: "DC", label: "District" },
    { key: "NCLT", label: "NCLT" },
    { key: "CF", label: "Consumer" },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-1">
            {courtTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                  filter === tab.key
                    ? "bg-indigo-100 text-indigo-700"
                    : "text-gray-500 hover:bg-gray-100"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search cases..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center text-gray-500">
          <p className="text-lg font-medium">No cases found</p>
          <p className="text-sm mt-1">
            {cases.length === 0
              ? "Add your first case to get started"
              : "Try adjusting your filters"}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Case
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Court
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Next Hearing
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Tags
                </th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="max-w-xs">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {c.case_title || `${c.case_number}/${c.case_year}`}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {c.case_number}{c.case_year ? `/${c.case_year}` : ""}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        "inline-flex px-2 py-0.5 text-xs font-medium rounded-full",
                        COURT_TYPE_COLORS[c.court_type] || "bg-gray-100 text-gray-800"
                      )}
                    >
                      {c.court_type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        "inline-flex px-2 py-0.5 text-xs font-medium rounded-full",
                        STATUS_COLORS[c.current_status || "Unknown"] ||
                          "bg-gray-100 text-gray-800"
                      )}
                    >
                      {c.current_status || "Unknown"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {c.next_hearing_date
                      ? format(new Date(c.next_hearing_date), "dd MMM yyyy")
                      : "-"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1 flex-wrap">
                      {(c.tags || []).slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/case/${c.id}`}
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
