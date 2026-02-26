import { NextResponse } from "next/server";
import { buildPlan, OrchestratorLoop } from "@/lib/orchestrator";
import { readFileSync } from "fs";
import { resolve } from "path";

export async function POST(req: Request) {
  try {
    const { task, projectId } = await req.json();

    if (!task) {
      return NextResponse.json({ error: "task required" }, { status: 400 });
    }

    let projectPath = process.cwd();
    if (projectId) {
      try {
        const registryPath = resolve(process.cwd(), "../../projects.json");
        const registry = JSON.parse(readFileSync(registryPath, "utf-8"));
        const project = registry.projects?.find((p: any) => p.id === projectId);
        if (project?.path) projectPath = project.path;
      } catch {}
    }

    const plan = buildPlan(task, projectId || "default", projectPath);
    const loop = new OrchestratorLoop(plan);
    loop.start();

    return NextResponse.json({
      success: true,
      orchestration: plan,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
