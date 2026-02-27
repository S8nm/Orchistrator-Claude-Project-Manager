import { NextResponse } from "next/server";
import { getHierarchyManager, removeHierarchyManager } from "@/lib/hierarchy/manager";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { projectId } = await req.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const mgr = getHierarchyManager(projectId);
    if (!mgr) {
      return NextResponse.json({ error: "No active hierarchy for project" }, { status: 404 });
    }

    mgr.deactivate();
    removeHierarchyManager(projectId);

    return NextResponse.json({ success: true, projectId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
