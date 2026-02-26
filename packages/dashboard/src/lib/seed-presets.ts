import { existsSync } from "fs";
import { join, resolve } from "path";
import { savePreset } from "./persistence";
import type { AgentPreset } from "@orchestrator/shared";

const DATA_DIR = resolve(process.cwd(), "../../data");

const ROLE_PRESETS: AgentPreset[] = [
  { id: "role-orchestrator", name: "Orchestrator", type: "role", scope: "global", tags: ["core"], agents: [
    { role: "orchestrator", name: "Orchestrator", skills: ["task-decomposition", "batching", "prompt-caching"], mode: "claude" },
  ]},
  { id: "role-architect", name: "Architect", type: "role", scope: "global", tags: ["design"], agents: [
    { role: "architect", name: "Architect", skills: ["analyze-codebase", "design-system", "define-interfaces"], mode: "claude" },
  ]},
  { id: "role-backend", name: "Backend Dev", type: "role", scope: "global", tags: ["backend"], agents: [
    { role: "backend", name: "Backend Dev", skills: ["api-design", "database-ops", "error-handling", "auth-patterns"], mode: "claude" },
  ]},
  { id: "role-frontend", name: "Frontend Dev", type: "role", scope: "global", tags: ["frontend"], agents: [
    { role: "frontend", name: "Frontend Dev", skills: ["react-best-practices", "css-patterns", "accessibility"], mode: "claude" },
  ]},
  { id: "role-tester", name: "Tester", type: "role", scope: "global", tags: ["quality"], agents: [
    { role: "tester", name: "Tester", skills: ["unit-testing", "integration-testing", "mocking"], mode: "claude" },
  ]},
  { id: "role-reviewer", name: "Reviewer", type: "role", scope: "global", tags: ["quality"], agents: [
    { role: "reviewer", name: "Reviewer", skills: ["code-review", "security-audit", "performance-check"], mode: "claude" },
  ]},
  { id: "role-fullstack", name: "Fullstack Dev", type: "role", scope: "global", tags: ["fullstack"], agents: [
    { role: "fullstack", name: "Fullstack Dev", skills: ["react-best-practices", "api-design", "error-handling"], mode: "claude" },
  ]},
  { id: "role-devops", name: "DevOps", type: "role", scope: "global", tags: ["infra"], agents: [
    { role: "devops", name: "DevOps", skills: ["ci-cd-patterns", "docker-best-practices", "env-management"], mode: "claude" },
  ]},
  { id: "role-security", name: "Security", type: "role", scope: "global", tags: ["security"], agents: [
    { role: "security", name: "Security Analyst", skills: ["security-audit", "input-validation", "dependency-check"], mode: "claude" },
  ]},
  { id: "role-docs", name: "Docs Writer", type: "role", scope: "global", tags: ["docs"], agents: [
    { role: "docs", name: "Docs Writer", skills: ["technical-writing", "api-documentation"], mode: "claude" },
  ]},
  { id: "role-refactorer", name: "Refactorer", type: "role", scope: "global", tags: ["refactor"], agents: [
    { role: "refactorer", name: "Refactorer", skills: ["refactoring-patterns", "code-quality"], mode: "claude" },
  ]},
];

const TEAM_PRESETS: AgentPreset[] = [
  { id: "team-jarvis-dev", name: "J.A.R.V.I.S. Dev Team", type: "team", scope: "jarvis", tags: ["jarvis", "fullstack"], agents: [
    { role: "backend", name: "JARVIS Backend", skills: ["api-design", "database-ops", "error-handling"], mode: "claude", cwd: "C:/Users/PC/!projects/JArvis" },
    { role: "frontend", name: "JARVIS Frontend", skills: ["react-best-practices", "css-patterns", "accessibility"], mode: "claude", cwd: "C:/Users/PC/!projects/JArvis" },
    { role: "tester", name: "JARVIS QA", skills: ["unit-testing", "integration-testing", "mocking"], mode: "claude", cwd: "C:/Users/PC/!projects/JArvis" },
  ]},
];

export function seedPresets(): void {
  for (const preset of [...ROLE_PRESETS, ...TEAM_PRESETS]) {
    const subDir = preset.type === "role" ? "roles" : "teams";
    const filePath = join(DATA_DIR, "presets", subDir, `${preset.id}.json`);
    if (!existsSync(filePath)) {
      savePreset(preset);
    }
  }
}
