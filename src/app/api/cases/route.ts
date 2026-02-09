import { createClient } from "@/lib/supabase/server";
import { courtService } from "@/lib/courts/court-service";
import { NextResponse } from "next/server";
import type { CaseIdentifier } from "@/lib/courts/types";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const courtType = searchParams.get("court_type");
  const tag = searchParams.get("tag");
  const status = searchParams.get("status");

  let query = supabase
    .from("cases")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("next_hearing_date", { ascending: true, nullsFirst: false });

  if (courtType) query = query.eq("court_type", courtType);
  if (status) query = query.eq("current_status", status);
  if (tag) query = query.contains("tags", [tag]);

  const { data, error } = await query;

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cases: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    courtType,
    caseType,
    caseTypeCode,
    caseNumber,
    caseYear,
    cnrNumber,
    courtCode,
    stateCode,
    districtCode,
    courtName,
    caseTitle: inputTitle,
  } = body;

  const identifier: CaseIdentifier = {
    courtType,
    caseType: caseType || "",
    caseTypeCode,
    caseNumber: caseNumber || "",
    caseYear: caseYear || "",
    cnrNumber,
    courtCode,
    stateCode,
    districtCode,
  };

  let caseStatus = null;
  try {
    caseStatus = await courtService.getCaseStatus(identifier);
  } catch (error) {
    console.error("Failed to fetch case status:", error);
  }

  const { data, error } = await supabase
    .from("cases")
    .insert({
      user_id: user.id,
      court_type: courtType,
      court_name: courtName || null,
      court_code: courtCode || null,
      state_code: stateCode || null,
      district_code: districtCode || null,
      case_type: caseType || null,
      case_type_code: caseTypeCode || null,
      case_number: caseNumber || cnrNumber || "",
      case_year: caseYear || null,
      cnr_number: cnrNumber || null,
      case_title:
        caseStatus?.caseTitle ||
        inputTitle ||
        `Case ${caseType || ""}/${caseNumber || cnrNumber}/${caseYear || ""}`,
      current_status: caseStatus?.currentStatus || "Unknown",
      next_hearing_date: caseStatus?.nextHearingDate || null,
      last_order_date: caseStatus?.lastOrderDate || null,
      last_order_summary: caseStatus?.lastOrderSummary || null,
      petitioner: caseStatus?.petitioner || "",
      respondent: caseStatus?.respondent || "",
      petitioner_advocate: caseStatus?.petitionerAdvocate || "",
      respondent_advocate: caseStatus?.respondentAdvocate || "",
      judges: caseStatus?.judges || "",
      filing_date: caseStatus?.filingDate || null,
      registration_date: caseStatus?.registrationDate || null,
      decision_date: caseStatus?.decisionDate || null,
      raw_data: caseStatus?.rawData || {},
      last_checked_at: new Date().toISOString(),
      last_changed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Case already being tracked" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("case_updates").insert({
    case_id: data.id,
    update_type: "new_case",
    new_value: "Case added to tracking",
    details: { source: "manual_add" },
  });

  return NextResponse.json({ case: data }, { status: 201 });
}
