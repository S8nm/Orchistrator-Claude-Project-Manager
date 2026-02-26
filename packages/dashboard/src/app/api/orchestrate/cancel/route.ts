import { NextResponse } from "next/server";
import { getOrchestratorLoop } from "@/lib/orchestrator";

export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const loop = getOrchestratorLoop(id);
    if (!loop) return NextResponse.json({ error: "Orchestration not found" }, { status: 404 });

    loop.cancel();
    return NextResponse.json({ success: true, status: "cancelled" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
