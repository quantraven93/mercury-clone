import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  console.log(
    `[Webhook] Update completed at ${body.timestamp}: status=${body.status}`
  );

  return NextResponse.json({ received: true });
}
