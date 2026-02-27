import { NextResponse } from "next/server";
import { getAllHierarchyManagers } from "@/lib/hierarchy/manager";
import { OperaManager } from "@/lib/hierarchy/opera";

export const dynamic = "force-dynamic";

export async function GET() {
  const managers = getAllHierarchyManagers();
  const statuses = managers.map((m) => m.getStatus());
  const opera = OperaManager.getInstance();
  return NextResponse.json({
    hierarchies: statuses,
    opera: opera.getStatus(),
  });
}
