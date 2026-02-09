"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { COURT_TYPES, INDIAN_STATES } from "@/lib/utils";
import { PlusCircle, Hash, FileText } from "lucide-react";

export default function AddCasePage() {
  const [mode, setMode] = useState<"case_number" | "cnr">("case_number");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();

  const [courtType, setCourtType] = useState("DC");
  const [stateCode, setStateCode] = useState("");
  const [caseType, setCaseType] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [caseYear, setCaseYear] = useState(new Date().getFullYear().toString());
  const [cnrNumber, setCnrNumber] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const body =
      mode === "cnr"
        ? { courtType: "DC", caseType: "", caseNumber: "", caseYear: "", cnrNumber }
        : { courtType, caseType, caseNumber, caseYear, stateCode };

    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess("Case added successfully!");
        setTimeout(() => router.push(`/case/${data.case.id}`), 1000);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to add case");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  }

  const showStateSelector = courtType === "HC" || courtType === "DC";

  return (
    <DashboardShell>
      <div className="p-6 max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900">Add Case</h1>
        <p className="text-sm text-gray-500 mt-1">
          Add a case to track by entering its details
        </p>

        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
          {/* Mode toggle */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMode("case_number")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                mode === "case_number"
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Hash className="w-4 h-4" />
              By Case Number
            </button>
            <button
              onClick={() => setMode("cnr")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                mode === "cnr"
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <FileText className="w-4 h-4" />
              By CNR Number
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "cnr" ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CNR Number
                </label>
                <input
                  type="text"
                  value={cnrNumber}
                  onChange={(e) => setCnrNumber(e.target.value.toUpperCase())}
                  placeholder="e.g., DLCT010012345"
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">
                  16-character unique case number from eCourts
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Court Type
                  </label>
                  <select
                    value={courtType}
                    onChange={(e) => setCourtType(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                  >
                    {COURT_TYPES.map((ct) => (
                      <option key={ct.value} value={ct.value}>
                        {ct.label}
                      </option>
                    ))}
                  </select>
                </div>

                {showStateSelector && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State
                    </label>
                    <select
                      value={stateCode}
                      onChange={(e) => setStateCode(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                    >
                      <option value="">Select State</option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Case Type
                  </label>
                  <input
                    type="text"
                    value={caseType}
                    onChange={(e) => setCaseType(e.target.value)}
                    placeholder="e.g., Civil Appeal, Writ Petition, SLP"
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Case Number
                    </label>
                    <input
                      type="text"
                      value={caseNumber}
                      onChange={(e) => setCaseNumber(e.target.value)}
                      placeholder="e.g., 1234"
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Year
                    </label>
                    <input
                      type="text"
                      value={caseYear}
                      onChange={(e) => setCaseYear(e.target.value)}
                      placeholder="e.g., 2024"
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white font-medium rounded-lg transition-colors"
            >
              <PlusCircle className="w-5 h-5" />
              {loading ? "Adding Case..." : "Add Case"}
            </button>
          </form>
        </div>
      </div>
    </DashboardShell>
  );
}
