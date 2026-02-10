import { createClient } from "@/lib/supabase/server";
import { courtService } from "@/lib/courts/court-service";
import { NextResponse } from "next/server";
import type { CourtType } from "@/lib/courts/types";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const courtType = searchParams.get("court_type") as CourtType | null;
  const stateCode = searchParams.get("state_code");
  const year = searchParams.get("year");
  const searchType = searchParams.get("type") || "party";

  if (!query || query.length < 3) {
    return NextResponse.json(
      { error: "Query too short (min 3 chars)" },
      { status: 400 }
    );
  }

  try {
    // Only search official court sources (sci.gov.in, ecourts.gov.in)
    const results = await courtService.searchByPartyName({
      partyName: query,
      courtType: courtType || undefined,
      stateCode: stateCode || undefined,
      year: year || undefined,
    });
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
