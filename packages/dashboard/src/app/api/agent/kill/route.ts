import { NextResponse } from "next/server";
import { killAgent } from "@/lib/agent-executor";

export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const killed = killAgent(id);
    return NextResponse.json({ success: killed, id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
