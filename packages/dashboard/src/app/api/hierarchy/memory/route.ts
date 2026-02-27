import { NextResponse } from "next/server";
import { loadMemory, saveMemory } from "@/lib/persistence";
import { renderMemoryAsMarkdown } from "@/lib/hierarchy/memory";
import type { AgentMemory, AgentRole } from "@orchestrator/shared";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const role = url.searchParams.get("role");

  if (!projectId || !role) {
    return NextResponse.json({ error: "projectId and role required" }, { status: 400 });
  }

  const memory = loadMemory(projectId, role);
  if (!memory) {
    return NextResponse.json({ error: "No memory found" }, { status: 404 });
  }

  return NextResponse.json({
    memory,
    markdown: renderMemoryAsMarkdown(memory),
  });
}

export async function POST(req: Request) {
  try {
    const { projectId, role, memory } = await req.json();
    if (!projectId || !role || !memory) {
      return NextResponse.json({ error: "projectId, role, and memory required" }, { status: 400 });
    }

    saveMemory(projectId, role, memory as AgentMemory);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
