import type { OrchestrationPlan, SubTask } from "@orchestrator/shared";
import { matchTemplate } from "./task-templates";

const uid = () => Math.random().toString(36).slice(2, 9);

export function buildPlan(task: string, projectId: string, projectPath: string): OrchestrationPlan {
  const template = matchTemplate(task);
  const planId = `orch-${uid()}`;

  let subTasks: SubTask[];

  if (template) {
    const idMap = new Map<string, string>();
    subTasks = template.subTasks.map((t, idx) => {
      const taskId = `st-${uid()}`;
      idMap.set(String(idx), taskId);
      return {
        id: taskId,
        role: t.role,
        title: t.title,
        prompt: t.promptTemplate.replace("{{TASK}}", task),
        scope: t.scope,
        skills: t.skills,
        deps: [],
        retryCount: 0,
        maxRetries: 5,
        status: "pending" as const,
      };
    });

    template.subTasks.forEach((t, idx) => {
      subTasks[idx].deps = t.deps.map((depIdx) => idMap.get(depIdx) || depIdx);
    });

    for (const st of subTasks) {
      if (st.deps.length === 0) {
        st.status = "ready";
      }
    }
  } else {
    subTasks = [{
      id: `st-${uid()}`,
      role: "fullstack",
      title: task,
      prompt: task,
      scope: ["src/"],
      skills: ["react-best-practices", "api-design", "error-handling"],
      deps: [],
      retryCount: 0,
      maxRetries: 5,
      status: "ready",
    }];
  }

  const tokenEstimate = subTasks.reduce((sum, t) => sum + Math.round(t.prompt.length * 0.35) + 700, 0);

  return {
    id: planId,
    taskDescription: task,
    projectId,
    projectPath,
    status: "decomposing",
    subTasks,
    createdAt: Date.now(),
    tokenEstimate,
    cacheHits: 0,
  };
}
