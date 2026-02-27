import { NextResponse } from "next/server";
import { getOrCreateHierarchyManager } from "@/lib/hierarchy/manager";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { projectId, projectPath, projectName } = await req.json();
    if (!projectId || !projectPath) {
      return NextResponse.json({ error: "projectId and projectPath required" }, { status: 400 });
    }

    const mgr = getOrCreateHierarchyManager(projectId, projectPath, projectName || projectId);
    await mgr.activate();

    return NextResponse.json({
      success: true,
      projectId,
      status: mgr.getStatus(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
