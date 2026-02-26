import type { AgentRole } from "@orchestrator/shared";

export interface TaskTemplate {
  id: string;
  match: string[];
  subTasks: Array<{
    role: AgentRole;
    title: string;
    promptTemplate: string;
    scope: string[];
    skills: string[];
    deps: string[];
  }>;
}

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: "feature",
    match: ["feature", "add", "implement", "create", "build", "new"],
    subTasks: [
      { role: "architect", title: "Design feature architecture", promptTemplate: "Analyze the codebase and design the architecture for: {{TASK}}. Output: file plan, interfaces, data flow. Do NOT write implementation code.", scope: ["src/"], skills: ["analyze-codebase", "design-system"], deps: [] },
      { role: "backend", title: "Implement backend", promptTemplate: "Implement the backend for: {{TASK}}.\n\nARCHITECT OUTPUT:\n{{DEP:0}}", scope: ["src/", "lib/", "api/"], skills: ["api-design", "error-handling"], deps: ["0"] },
      { role: "frontend", title: "Implement frontend", promptTemplate: "Implement the frontend for: {{TASK}}.\n\nARCHITECT OUTPUT:\n{{DEP:0}}", scope: ["components/", "pages/"], skills: ["react-best-practices"], deps: ["0"] },
      { role: "tester", title: "Write tests", promptTemplate: "Write tests for: {{TASK}}.\n\nBACKEND:\n{{DEP:1}}\n\nFRONTEND:\n{{DEP:2}}", scope: ["tests/", "__tests__/"], skills: ["unit-testing", "integration-testing"], deps: ["1", "2"] },
      { role: "reviewer", title: "Review implementation", promptTemplate: "Review all changes for: {{TASK}}. Check for bugs, security issues, missing error handling. Output: {severity, file, line, issue, fix}.", scope: ["src/"], skills: ["code-review", "security-audit"], deps: ["1", "2", "3"] },
    ],
  },
  {
    id: "bug",
    match: ["bug", "fix", "broken", "error", "crash", "issue", "debug"],
    subTasks: [
      { role: "architect", title: "Diagnose bug", promptTemplate: "Diagnose this bug: {{TASK}}. Find the root cause. Output: affected files, root cause, proposed fix.", scope: ["src/"], skills: ["analyze-codebase"], deps: [] },
      { role: "backend", title: "Fix bug", promptTemplate: "Fix this bug: {{TASK}}.\n\nDIAGNOSIS:\n{{DEP:0}}", scope: ["src/"], skills: ["error-handling"], deps: ["0"] },
      { role: "tester", title: "Add regression test", promptTemplate: "Write a regression test for: {{TASK}}.\n\nFIX:\n{{DEP:1}}", scope: ["tests/"], skills: ["unit-testing"], deps: ["1"] },
    ],
  },
  {
    id: "refactor",
    match: ["refactor", "clean", "restructure", "simplify", "optimize"],
    subTasks: [
      { role: "architect", title: "Analyze refactor targets", promptTemplate: "Analyze code for refactoring: {{TASK}}. Identify duplication, poor naming, complex control flow. Output: plan with before/after.", scope: ["src/"], skills: ["analyze-codebase"], deps: [] },
      { role: "refactorer", title: "Execute refactor", promptTemplate: "Refactor: {{TASK}}.\n\nPLAN:\n{{DEP:0}}\n\nAll existing tests MUST still pass.", scope: ["src/"], skills: ["refactoring-patterns", "code-quality"], deps: ["0"] },
      { role: "tester", title: "Verify tests pass", promptTemplate: "Run all tests and verify nothing broke from refactoring: {{TASK}}.", scope: ["tests/"], skills: ["unit-testing"], deps: ["1"] },
    ],
  },
  {
    id: "tests",
    match: ["test", "tests", "coverage", "spec"],
    subTasks: [
      { role: "architect", title: "Analyze test coverage", promptTemplate: "Analyze test coverage for: {{TASK}}. Identify untested paths, edge cases, error paths.", scope: ["src/", "tests/"], skills: ["analyze-codebase"], deps: [] },
      { role: "tester", title: "Write tests", promptTemplate: "Write comprehensive tests for: {{TASK}}.\n\nCOVERAGE ANALYSIS:\n{{DEP:0}}\n\nCover: happy path, edge cases, error cases. Use AAA pattern.", scope: ["tests/"], skills: ["unit-testing", "integration-testing", "mocking"], deps: ["0"] },
    ],
  },
  {
    id: "security",
    match: ["security", "audit", "vulnerability", "secure"],
    subTasks: [
      { role: "security", title: "Security audit", promptTemplate: "Full security audit: {{TASK}}. Check: injection, auth bypass, CSRF/XSS, insecure deps, secrets in code. Output: {severity, file, line, issue, fix}.", scope: ["src/"], skills: ["security-audit", "input-validation", "dependency-check"], deps: [] },
    ],
  },
  {
    id: "review",
    match: ["review", "check", "inspect"],
    subTasks: [
      { role: "reviewer", title: "Code review", promptTemplate: "Review recent changes: {{TASK}}. Output: {severity: CRITICAL|WARN|SUGGESTION, file, line, issue, fix}.", scope: ["src/"], skills: ["code-review", "security-audit", "performance-check"], deps: [] },
    ],
  },
  {
    id: "docs",
    match: ["docs", "documentation", "readme", "jsdoc", "docstring"],
    subTasks: [
      { role: "docs", title: "Generate documentation", promptTemplate: "Generate documentation for: {{TASK}}. Scan exports, add JSDoc/docstrings to public APIs, update README.", scope: ["docs/", "src/"], skills: ["technical-writing", "api-documentation"], deps: [] },
    ],
  },
  {
    id: "deploy",
    match: ["deploy", "release", "ship", "ci"],
    subTasks: [
      { role: "devops", title: "Lint", promptTemplate: "Run linter and fix all issues. Command: npx eslint . --fix", scope: ["src/"], skills: ["ci-cd-patterns"], deps: [] },
      { role: "devops", title: "Type check", promptTemplate: "Run TypeScript type checker: npx tsc --noEmit. Fix all type errors.", scope: ["src/"], skills: ["ci-cd-patterns"], deps: ["0"] },
      { role: "tester", title: "Run tests", promptTemplate: "Run full test suite. Fix any failures.", scope: ["tests/"], skills: ["unit-testing"], deps: ["1"] },
      { role: "devops", title: "Build", promptTemplate: "Run production build. Fix any build errors.", scope: ["src/"], skills: ["ci-cd-patterns"], deps: ["2"] },
    ],
  },
];

export function matchTemplate(task: string): TaskTemplate | null {
  const words = task.toLowerCase().split(/\s+/);
  let bestMatch: TaskTemplate | null = null;
  let bestScore = 0;

  for (const template of TASK_TEMPLATES) {
    let score = 0;
    for (const keyword of template.match) {
      if (words.some((w) => w.includes(keyword))) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = template;
    }
  }

  return bestScore > 0 ? bestMatch : null;
}
