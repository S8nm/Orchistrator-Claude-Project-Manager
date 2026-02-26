import { NextResponse } from "next/server";
import { sendInput } from "@/lib/agent-executor";

export async function POST(req: Request) {
  try {
    const { id, input } = await req.json();

    if (!id || typeof input !== "string") {
      return NextResponse.json({ error: "id and input required" }, { status: 400 });
    }

    const sent = sendInput(id, input);
    if (!sent) {
      return NextResponse.json({ error: "Agent not found or not running" }, { status: 404 });
    }

    return NextResponse.json({ success: true, id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
