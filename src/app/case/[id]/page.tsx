"use client";

import { useEffect, useState, use } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { cn, COURT_TYPE_COLORS, STATUS_COLORS } from "@/lib/utils";
import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  User,
  Gavel,
  FileText,
  Tag,
  Clock,
  Save,
  Trash2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface CaseDetail {
  id: string;
  case_title: string;
  court_type: string;
  court_name: string | null;
  case_number: string;
  case_year: string | null;
  cnr_number: string | null;
  current_status: string | null;
  next_hearing_date: string | null;
  last_order_date: string | null;
  last_order_summary: string | null;
  petitioner: string | null;
  respondent: string | null;
  petitioner_advocate: string | null;
  respondent_advocate: string | null;
  judges: string | null;
  filing_date: string | null;
  registration_date: string | null;
  tags: string[];
  notes: string;
  last_checked_at: string | null;
  raw_data: Record<string, unknown>;
}

interface CaseUpdate {
  id: string;
  update_type: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export default function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [updates, setUpdates] = useState<CaseUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/cases/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setCaseData(data.case);
        setUpdates(data.updates || []);
        setNotes(data.case?.notes || "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  async function saveNotes() {
    setSaving(true);
    await fetch(`/api/cases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setSaving(false);
  }

  async function addTag() {
    if (!tagInput.trim() || !caseData) return;
    const newTags = [...(caseData.tags || []), tagInput.trim()];
    await fetch(`/api/cases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: newTags }),
    });
    setCaseData({ ...caseData, tags: newTags });
    setTagInput("");
  }

  async function removeTag(tag: string) {
    if (!caseData) return;
    const newTags = caseData.tags.filter((t) => t !== tag);
    await fetch(`/api/cases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: newTags }),
    });
    setCaseData({ ...caseData, tags: newTags });
  }

  async function deleteCase() {
    if (!confirm("Are you sure you want to remove this case from tracking?"))
      return;
    await fetch(`/api/cases/${id}`, { method: "DELETE" });
    router.push("/dashboard");
  }

  async function generateSummary() {
    setSummarizing(true);
    try {
      const res = await fetch(`/api/cases/${id}/summarize`, {
        method: "POST",
      });
      const data = await res.json();
      setAiSummary(data.summary || "Failed to generate summary.");
    } catch {
      setAiSummary("Failed to generate summary. Please try again.");
    }
    setSummarizing(false);
  }

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardShell>
    );
  }

  if (!caseData) {
    return (
      <DashboardShell>
        <div className="p-6">
          <p className="text-gray-500">Case not found.</p>
          <Link href="/dashboard" className="text-indigo-600 mt-2 inline-block">
            Back to Dashboard
          </Link>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="p-6 max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              {caseData.case_title ||
                `${caseData.case_number}/${caseData.case_year}`}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span
                className={cn(
                  "inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full",
                  COURT_TYPE_COLORS[caseData.court_type] || "bg-gray-100"
                )}
              >
                {caseData.court_type}
              </span>
              <span
                className={cn(
                  "inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full",
                  STATUS_COLORS[caseData.current_status || "Unknown"] ||
                    "bg-gray-100"
                )}
              >
                {caseData.current_status || "Unknown"}
              </span>
              {caseData.cnr_number && (
                <span className="text-xs text-gray-400">
                  CNR: {caseData.cnr_number}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={deleteCase}
            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Remove from tracking"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        {/* AI Summary */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              AI Case Summary
            </h2>
            <button
              onClick={generateSummary}
              disabled={summarizing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:bg-indigo-400 transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              {summarizing
                ? "Generating..."
                : aiSummary
                ? "Regenerate"
                : "Generate Summary"}
            </button>
          </div>
          {aiSummary ? (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {aiSummary}
            </p>
          ) : (
            <p className="text-sm text-indigo-400">
              Click &quot;Generate Summary&quot; to get an AI-powered overview of
              this case.
            </p>
          )}
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoCard
            icon={<Calendar className="w-5 h-5 text-blue-500" />}
            label="Next Hearing"
            value={
              caseData.next_hearing_date
                ? format(new Date(caseData.next_hearing_date), "dd MMM yyyy")
                : "Not scheduled"
            }
          />
          <InfoCard
            icon={<FileText className="w-5 h-5 text-green-500" />}
            label="Last Order"
            value={
              caseData.last_order_date
                ? `${format(new Date(caseData.last_order_date), "dd MMM yyyy")}${caseData.last_order_summary ? ` - ${caseData.last_order_summary}` : ""}`
                : "No orders"
            }
          />
          <InfoCard
            icon={<Gavel className="w-5 h-5 text-purple-500" />}
            label="Judges"
            value={caseData.judges || "Not available"}
          />
          <InfoCard
            icon={<Clock className="w-5 h-5 text-gray-500" />}
            label="Filing Date"
            value={
              caseData.filing_date
                ? format(new Date(caseData.filing_date), "dd MMM yyyy")
                : "Not available"
            }
          />
        </div>

        {/* Parties */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User className="w-4 h-4" />
            Parties
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">
                Petitioner
              </p>
              <p className="text-sm text-gray-900 mt-1">
                {caseData.petitioner || "-"}
              </p>
              {caseData.petitioner_advocate && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Adv. {caseData.petitioner_advocate}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">
                Respondent
              </p>
              <p className="text-sm text-gray-900 mt-1">
                {caseData.respondent || "-"}
              </p>
              {caseData.respondent_advocate && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Adv. {caseData.respondent_advocate}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Tags
          </h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {(caseData.tags || []).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 text-sm rounded-full"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="text-indigo-400 hover:text-indigo-700"
                >
                  x
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
              placeholder="Add tag..."
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={addTag}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-500"
            >
              Add
            </button>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Notes</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            placeholder="Add notes about this case..."
          />
          <button
            onClick={saveNotes}
            disabled={saving}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Notes"}
          </button>
        </div>

        {/* Update History */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Update History
          </h2>
          {updates.length === 0 ? (
            <p className="text-sm text-gray-500">No updates yet.</p>
          ) : (
            <div className="space-y-3">
              {updates.map((u) => (
                <div
                  key={u.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {u.update_type.replace(/_/g, " ")}
                    </p>
                    {u.old_value && (
                      <p className="text-xs text-gray-500">
                        From: {u.old_value}
                      </p>
                    )}
                    {u.new_value && (
                      <p className="text-xs text-gray-700">
                        To: {u.new_value}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {format(new Date(u.created_at), "dd MMM yyyy, HH:mm")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Last checked */}
        {caseData.last_checked_at && (
          <p className="text-xs text-gray-400 text-center">
            Last checked:{" "}
            {format(new Date(caseData.last_checked_at), "dd MMM yyyy, HH:mm")}
          </p>
        )}
      </div>
    </DashboardShell>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}
