import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "email_alerts, telegram_alerts, telegram_chat_id, alert_before_hearing_hours"
    )
    .eq("id", user.id)
    .single();

  return NextResponse.json({ preferences: profile });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    email_alerts,
    telegram_alerts,
    telegram_chat_id,
    alert_before_hearing_hours,
  } = body;

  const updates: Record<string, unknown> = {};
  if (email_alerts !== undefined) updates.email_alerts = email_alerts;
  if (telegram_alerts !== undefined) updates.telegram_alerts = telegram_alerts;
  if (telegram_chat_id !== undefined)
    updates.telegram_chat_id = telegram_chat_id;
  if (alert_before_hearing_hours !== undefined)
    updates.alert_before_hearing_hours = alert_before_hearing_hours;

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ preferences: data });
}
