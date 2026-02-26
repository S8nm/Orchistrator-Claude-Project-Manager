import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { spawnAgent, spawnClaudeAgent, spawnInteractiveClaude } from "@/lib/agent-executor";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, command, cwd, mode, role, name, skills, prompt, model, orchestrationId, subTaskId, projectId, mcpConfig, maxTurns } = body;

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const workDir = cwd || process.cwd();
    if (cwd && !existsSync(cwd)) {
      return NextResponse.json({ error: `Path not found: ${cwd}` }, { status: 400 });
    }

    const baseOpts = { id, cwd: workDir, role, name, skills, orchestrationId, subTaskId, projectId, mcpConfig, maxTurns };
    let agent;

    if (mode === "claude" && prompt) {
      // One-shot Claude agent with a prompt
      agent = spawnClaudeAgent({ ...baseOpts, command: "", prompt, model });
    } else if (mode === "claude") {
      // Interactive Claude session
      agent = spawnInteractiveClaude({ ...baseOpts, command: "" });
    } else {
      // Shell command
      if (!command) {
        return NextResponse.json({ error: "command required for shell mode" }, { status: 400 });
      }
      agent = spawnAgent({ ...baseOpts, command });
    }

    return NextResponse.json({
      success: true,
      id: agent.id,
      pid: agent.pid,
      status: agent.status,
      mode: agent.mode,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
