import { NextResponse } from "next/server";
import { listOrchestratorLoops } from "@/lib/orchestrator";
import { loadAllOrchestrations } from "@/lib/persistence";

export const dynamic = "force-dynamic";

export async function GET() {
  const active = listOrchestratorLoops().map((l) => l.plan);
  const persisted = loadAllOrchestrations();

  const activeIds = new Set(active.map((a) => a.id));
  const merged = [...active, ...persisted.filter((p) => !activeIds.has(p.id))];

  return NextResponse.json({ orchestrations: merged });
}
