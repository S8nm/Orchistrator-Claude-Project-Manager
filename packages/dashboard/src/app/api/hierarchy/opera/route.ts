import { NextResponse } from "next/server";
import { OperaManager } from "@/lib/hierarchy/opera";

export const dynamic = "force-dynamic";

export async function GET() {
  const opera = OperaManager.getInstance();
  return NextResponse.json(opera.getStatus());
}
