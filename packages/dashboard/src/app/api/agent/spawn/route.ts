import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { spawnAgent } from "@/lib/agent-executor";

export async function POST(req: Request) {
  try {
    const { id, command, cwd } = await req.json();

    if (!id || !command) {
      return NextResponse.json({ error: "id and command required" }, { status: 400 });
    }

    if (cwd && !existsSync(cwd)) {
      return NextResponse.json({ error: `Path not found: ${cwd}` }, { status: 400 });
    }

    const agent = spawnAgent({
      id,
      command,
      cwd: cwd || process.cwd(),
    });

    return NextResponse.json({
      success: true,
      id: agent.id,
      pid: agent.pid,
      status: agent.status,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
