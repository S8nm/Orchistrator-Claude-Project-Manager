export { buildPlan } from "./plan-builder";
export { buildPrompt, findMcpConfig } from "./prompt-builder";
export { OrchestratorLoop, getOrchestratorLoop, listOrchestratorLoops } from "./loop";
export { matchTemplate, TASK_TEMPLATES } from "./task-templates";

import { loadAllOrchestrations } from "../persistence";
import { OrchestratorLoop, getOrchestratorLoop } from "./loop";

// Reconnect orchestrations that were running when the server restarted
export function reconnectOrchestrations(): { restarted: number } {
  const persisted = loadAllOrchestrations();
  let restarted = 0;

  for (const plan of persisted) {
    if (plan.status !== "running") continue;
    if (getOrchestratorLoop(plan.id)) continue;

    const loop = new OrchestratorLoop(plan);
    loop.start();
    restarted++;
  }

  return { restarted };
}
