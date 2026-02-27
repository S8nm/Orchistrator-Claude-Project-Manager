import { NextResponse } from "next/server";
import { getHierarchyManager } from "@/lib/hierarchy/manager";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { projectId, task } = await req.json();
    if (!projectId || !task) {
      return NextResponse.json({ error: "projectId and task required" }, { status: 400 });
    }

    const mgr = getHierarchyManager(projectId);
    if (!mgr) {
      return NextResponse.json({ error: "No active hierarchy for project" }, { status: 404 });
    }

    // Fire and forget — result streams via SSE
    mgr.sendTask(task).catch((err) => {
      console.error(`[hierarchy] Task failed for ${projectId}:`, err.message);
    });

    return NextResponse.json({ success: true, projectId, task });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
