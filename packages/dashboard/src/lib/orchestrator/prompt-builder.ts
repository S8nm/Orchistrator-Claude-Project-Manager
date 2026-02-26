import type { SubTask, OrchestrationPlan } from "@orchestrator/shared";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROLE_PROMPTS: Record<string, string> = {
  orchestrator: "ROLE: Orchestrator\nSKILLS: task-decomposition, batching, prompt-caching\nSCOPE: Coordinates all agents\nBAR: production-ready, efficient",
  architect: "ROLE: Architect\nSKILLS: analyze-codebase, design-system, define-interfaces\nSCOPE: READ-ONLY -> specs\nFORBIDDEN: writing implementation code\nBAR: clear interfaces, data flow diagrams",
  backend: "ROLE: Backend Dev\nSKILLS: api-design, error-handling, database-ops, auth-patterns\nSCOPE: src/ lib/ api/ db/\nBAR: production-ready, error-handled, match existing style",
  frontend: "ROLE: Frontend Dev\nSKILLS: react-best-practices, css-patterns, accessibility\nSCOPE: components/ pages/ styles/\nBAR: FC+hooks, useCallback for handlers, memo for lists",
  tester: "ROLE: Tester\nSKILLS: unit-testing, integration-testing, mocking\nSCOPE: tests/ __tests__/\nBAR: AAA pattern, mock externals, cover happy+error+edge",
  reviewer: "ROLE: Reviewer\nSKILLS: code-review, security-audit, performance-check\nSCOPE: READ-ONLY\nBAR: output {severity: CRITICAL|WARN|SUGGESTION, file, line, issue, fix}",
  fullstack: "ROLE: Fullstack Dev\nSKILLS: react-best-practices, api-design, error-handling\nSCOPE: all src/\nBAR: production-ready, consistent patterns",
  devops: "ROLE: DevOps\nSKILLS: ci-cd-patterns, env-management\nSCOPE: .github/ docker/ config/\nBAR: fail fast, test->lint->typecheck->build",
  security: "ROLE: Security Analyst\nSKILLS: security-audit, input-validation, dependency-check\nSCOPE: READ + advisory\nBAR: check injection, auth bypass, CSRF/XSS, insecure deps, secrets",
  docs: "ROLE: Docs Writer\nSKILLS: technical-writing, api-documentation\nSCOPE: docs/ *.md\nBAR: concise, accurate, public API coverage",
  refactorer: "ROLE: Refactorer\nSKILLS: refactoring-patterns, code-quality\nSCOPE: all src/ (no behavior change)\nBAR: all existing tests must pass",
};

function loadRepoContext(projectPath: string): string {
  const claudeMdPath = join(projectPath, "CLAUDE.md");
  let context = `Project at: ${projectPath}`;

  if (existsSync(claudeMdPath)) {
    try {
      const content = readFileSync(claudeMdPath, "utf-8");
      const repoCtxMatch = content.match(/```[\s\S]*?Structure:[\s\S]*?```/);
      if (repoCtxMatch) {
        context = repoCtxMatch[0];
      } else {
        context = content.slice(0, 1500);
      }
    } catch {
      // fallback already set
    }
  }

  return context;
}

export function findMcpConfig(projectPath: string): string | undefined {
  const projectMcp = join(projectPath, ".mcp.json");
  if (existsSync(projectMcp)) return projectMcp;

  const home = process.env.USERPROFILE || process.env.HOME || "";
  const homeMcp = join(home, ".claude.json");
  if (existsSync(homeMcp)) return homeMcp;

  return undefined;
}

export function buildPrompt(subTask: SubTask, plan: OrchestrationPlan): string {
  const sections: string[] = [];

  sections.push(`REPO_CONTEXT:\n${loadRepoContext(plan.projectPath)}`);
  sections.push(ROLE_PROMPTS[subTask.role] || ROLE_PROMPTS.fullstack);
  sections.push(`TASK: ${subTask.prompt}`);

  const depOutputs: string[] = [];
  for (const depId of subTask.deps) {
    const dep = plan.subTasks.find((t) => t.id === depId);
    if (dep?.output) {
      const truncated = dep.output.slice(-2000);
      depOutputs.push(`--- ${dep.title} (${dep.role}) ---\n${truncated}`);
    }
  }
  if (depOutputs.length > 0) {
    sections.push(`CONTEXT FROM PREVIOUS AGENTS:\n${depOutputs.join("\n\n")}`);
  }

  if (subTask.retryCount > 0 && subTask.error) {
    sections.push(`PREVIOUS ATTEMPT FAILED:\n${subTask.error.slice(-500)}\nFix the issue and try again.`);
  }

  return sections.join("\n\n");
}
