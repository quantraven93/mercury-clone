import { createClient } from "@/lib/supabase/server";
import { summarizeCase, isAzureConfigured } from "@/lib/azure-vision";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isAzureConfigured()) {
    return NextResponse.json(
      { error: "AI summarization not configured" },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch the case
  const { data: caseData, error: caseError } = await supabase
    .from("cases")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (caseError || !caseData) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  // Fetch recent updates
  const { data: updates } = await supabase
    .from("case_updates")
    .select("update_type, old_value, new_value, created_at")
    .eq("case_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  // Generate summary
  const summary = await summarizeCase({
    caseTitle: caseData.case_title,
    courtType: caseData.court_type,
    courtName: caseData.court_name,
    currentStatus: caseData.current_status,
    petitioner: caseData.petitioner,
    respondent: caseData.respondent,
    filingDate: caseData.filing_date,
    nextHearingDate: caseData.next_hearing_date,
    lastOrderDate: caseData.last_order_date,
    lastOrderSummary: caseData.last_order_summary,
    judges: caseData.judges,
    updates: (updates || []).map((u) => ({
      type: u.update_type,
      oldValue: u.old_value || undefined,
      newValue: u.new_value || undefined,
      date: u.created_at,
    })),
  });

  return NextResponse.json({ summary });
}
