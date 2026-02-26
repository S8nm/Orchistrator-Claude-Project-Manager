import { NextResponse } from "next/server";
import { getOrchestratorLoop } from "@/lib/orchestrator";
import { loadOrchestration } from "@/lib/persistence";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const loop = getOrchestratorLoop(params.id);
  if (loop) {
    return NextResponse.json({ orchestration: loop.plan });
  }

  const orch = loadOrchestration(params.id);
  if (orch) {
    return NextResponse.json({ orchestration: orch });
  }

  return NextResponse.json({ error: "Orchestration not found" }, { status: 404 });
}
