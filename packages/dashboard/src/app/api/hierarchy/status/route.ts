import { NextResponse } from "next/server";
import { getAllHierarchyManagers } from "@/lib/hierarchy/manager";

export const dynamic = "force-dynamic";

export async function GET() {
  const managers = getAllHierarchyManagers();
  const statuses = managers.map((m) => m.getStatus());
  return NextResponse.json({ hierarchies: statuses });
}
