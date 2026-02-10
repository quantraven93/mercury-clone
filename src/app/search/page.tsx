"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { cn, COURT_TYPES, COURT_TYPE_COLORS } from "@/lib/utils";
import { Search, PlusCircle, Users, FileText } from "lucide-react";

interface SearchResult {
  caseTitle: string;
  caseNumber: string;
  caseYear: string;
  caseType: string;
  courtType: string;
  courtName: string;
  courtCode?: string;
  cnrNumber?: string;
  status?: string;
  petitioner?: string;
  respondent?: string;
  nextHearingDate?: string;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [courtType, setCourtType] = useState("");
  const [searchType, setSearchType] = useState<"party" | "judgment">("party");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const router = useRouter();

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);

    const params = new URLSearchParams({ q: query, type: searchType });
    if (courtType) params.set("court_type", courtType);

    try {
      const res = await fetch(`/api/search?${params}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }

  async function trackCase(result: SearchResult) {
    setTrackingId(result.caseNumber + result.caseYear);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtType: result.courtType,
          caseType: result.caseType,
          caseNumber: result.caseNumber,
          caseYear: result.caseYear,
          courtCode: result.courtCode,
          cnrNumber: result.cnrNumber,
          courtName: result.courtName,
          caseTitle: result.caseTitle,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/case/${data.case.id}`);
      }
    } catch {
      // ignore
    }
    setTrackingId(null);
  }

  return (
    <DashboardShell>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Search</h1>
          <p className="text-sm text-gray-500 mt-1">
            Search across Indian courts by party name or judgment
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {/* Search type toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSearchType("party")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                searchType === "party"
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Users className="w-4 h-4" />
              Party Name
            </button>
            <button
              onClick={() => setSearchType("judgment")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                searchType === "judgment"
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <FileText className="w-4 h-4" />
              Judgment
            </button>
          </div>

          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  searchType === "party"
                    ? "Enter party name (min 3 characters)..."
                    : "Search judgments..."
                }
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-gray-900 bg-white placeholder:text-gray-400"
              />
            </div>
            {searchType === "party" && (
              <select
                value={courtType}
                onChange={(e) => setCourtType(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white appearance-auto focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Courts</option>
                {COURT_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>
                    {ct.label}
                  </option>
                ))}
              </select>
            )}
            <button
              type="submit"
              disabled={loading || query.length < 3}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white font-medium rounded-lg transition-colors text-sm"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </form>
        </div>

        {/* Results */}
        {searched && (
          <div className="space-y-3">
            {results.length === 0 && !loading ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <p className="text-gray-500">No results found</p>
                <p className="text-sm text-gray-400 mt-1">
                  Try a different search term
                </p>
              </div>
            ) : (
              results.map((r, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-gray-200 p-5 flex items-start justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={cn(
                          "inline-flex px-2 py-0.5 text-xs font-medium rounded-full",
                          COURT_TYPE_COLORS[r.courtType] || "bg-gray-100"
                        )}
                      >
                        {r.courtType}
                      </span>
                      {r.status && (
                        <span className="text-xs text-gray-500">
                          {r.status}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {r.caseTitle || `${r.caseNumber}/${r.caseYear}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {r.courtName}
                      {r.caseNumber &&
                        ` | ${r.caseType} ${r.caseNumber}/${r.caseYear}`}
                    </p>
                    {r.petitioner && (
                      <p className="text-xs text-gray-400 mt-1">
                        {r.petitioner} vs {r.respondent}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => trackCase(r)}
                    disabled={
                      trackingId === r.caseNumber + r.caseYear
                    }
                    className="shrink-0 ml-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:bg-indigo-400"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Track
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
