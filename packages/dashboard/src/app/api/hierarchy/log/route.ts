import { NextResponse } from "next/server";
import { getHierarchyManager } from "@/lib/hierarchy/manager";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const limitStr = url.searchParams.get("limit");

  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const mgr = getHierarchyManager(projectId);
  if (!mgr) {
    return NextResponse.json({ error: "No hierarchy for project" }, { status: 404 });
  }

  const limit = limitStr ? parseInt(limitStr, 10) : 50;
  const tree = mgr.getTree();
  return NextResponse.json({ messageLog: tree.messageLog.slice(-limit) });
}
