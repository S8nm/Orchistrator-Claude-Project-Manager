import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, basename } from "path";

function detect(projectPath: string) {
  const has = (f: string) => existsSync(join(projectPath, f));
  const read = (f: string) => {
    try { return readFileSync(join(projectPath, f), "utf-8"); } catch { return ""; }
  };

  let language = "unknown", framework = "unknown", testRunner = "unknown", linter = "unknown";
  let testCmd = "", lintCmd = "", typeCheckCmd = "", buildCmd = "";
  const folders: Record<string, string> = {};

  // Detect language + framework
  if (has("package.json")) {
    const pkg = JSON.parse(read("package.json"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    language = deps.typescript || has("tsconfig.json") ? "TypeScript" : "JavaScript";

    if (deps.next) framework = "Next.js";
    else if (deps.react) framework = "React";
    else if (deps.express) framework = "Express";
    else if (deps.fastify) framework = "Fastify";
    else if (deps.electron) framework = "Electron";
    else framework = "Node.js";

    // Test runner
    if (deps.vitest) { testRunner = "Vitest"; testCmd = "npx vitest run"; }
    else if (deps.jest) { testRunner = "Jest"; testCmd = "npx jest"; }
    else if (deps.mocha) { testRunner = "Mocha"; testCmd = "npx mocha"; }
    else { testCmd = "npm test"; }

    // Linter
    if (deps.eslint || has(".eslintrc.js") || has(".eslintrc.json") || has("eslint.config.js") || has("eslint.config.mjs")) {
      linter = "ESLint"; lintCmd = "npx eslint .";
    } else if (deps.biome || has("biome.json")) {
      linter = "Biome"; lintCmd = "npx biome check .";
    }

    // Type check
    if (deps.typescript || has("tsconfig.json")) typeCheckCmd = "npx tsc --noEmit";

    // Build
    if (pkg.scripts?.build) buildCmd = "npm run build";

    // Name
    folders["name"] = pkg.name || basename(projectPath);
  } else if (has("pyproject.toml") || has("requirements.txt")) {
    language = "Python";
    if (has("pyproject.toml")) {
      const pyproj = read("pyproject.toml");
      if (pyproj.includes("fastapi")) framework = "FastAPI";
      else if (pyproj.includes("django")) framework = "Django";
      else if (pyproj.includes("flask")) framework = "Flask";
      else framework = "Python";
    }
    testRunner = "Pytest"; testCmd = "pytest";
    if (has("ruff.toml") || has("pyproject.toml")) { linter = "Ruff"; lintCmd = "ruff check ."; }
    typeCheckCmd = "mypy .";
  } else if (has("Cargo.toml")) {
    language = "Rust"; framework = "Rust"; testRunner = "cargo test"; testCmd = "cargo test";
    lintCmd = "cargo clippy"; typeCheckCmd = "cargo check"; buildCmd = "cargo build";
  } else if (has("go.mod")) {
    language = "Go"; framework = "Go"; testRunner = "go test"; testCmd = "go test ./...";
    lintCmd = "golangci-lint run"; typeCheckCmd = "go vet ./..."; buildCmd = "go build ./...";
  } else if (has("build.gradle") || has("build.gradle.kts")) {
    language = "Java/Kotlin"; framework = "Gradle"; testCmd = "gradle test"; buildCmd = "gradle build";
  }

  // Detect folder purposes
  const tryFolders: Record<string, string> = {
    "src": "Source code", "lib": "Library code", "api": "API routes",
    "app": "App router / pages", "pages": "Page components", "components": "UI components",
    "hooks": "React hooks", "styles": "Stylesheets", "public": "Static assets",
    "tests": "Test files", "__tests__": "Test files", "test": "Test files",
    "docs": "Documentation", "config": "Configuration", "scripts": "Build/utility scripts",
    "backend": "Backend server", "frontend": "Frontend app", "server": "Server code",
    "db": "Database", "models": "Data models", "data": "Data files",
    "electron": "Electron main process", "modules": "Feature modules",
  };
  for (const [dir, purpose] of Object.entries(tryFolders)) {
    if (existsSync(join(projectPath, dir))) folders[dir] = purpose;
  }

  // Detect conventions
  let conventions = "";
  if (has(".prettierrc") || has(".prettierrc.json") || has("prettier.config.js")) {
    conventions += "Prettier configured. ";
  }
  if (has(".editorconfig")) conventions += "EditorConfig present. ";
  if (has("tsconfig.json")) {
    const tsconfig = read("tsconfig.json");
    if (tsconfig.includes('"strict": true')) conventions += "Strict TypeScript. ";
  }

  return {
    name: folders["name"] || basename(projectPath),
    language, framework, testRunner, testCmd, linter, lintCmd,
    typeCheckCmd, buildCmd, folders, conventions: conventions || "No explicit config detected",
  };
}

export async function POST(req: Request) {
  try {
    const { projectPath } = await req.json();

    if (!projectPath || !existsSync(projectPath)) {
      return NextResponse.json({ error: `Path not found: ${projectPath}` }, { status: 400 });
    }

    const d = detect(projectPath);
    const logs: string[] = [];
    logs.push(`Detected: ${d.language} / ${d.framework}`);
    logs.push(`Test: ${d.testRunner} (${d.testCmd})`);
    logs.push(`Lint: ${d.linter} (${d.lintCmd})`);
    logs.push(`Folders: ${Object.keys(d.folders).join(", ")}`);

    // Create .claude dirs
    const claudeDir = join(projectPath, ".claude");
    mkdirSync(join(claudeDir, "skills"), { recursive: true });
    mkdirSync(join(claudeDir, "templates"), { recursive: true });
    mkdirSync(join(claudeDir, "cache"), { recursive: true });
    logs.push("Created .claude/skills/, .claude/templates/, .claude/cache/");

    // Build folder structure string
    const folderLines = Object.entries(d.folders)
      .filter(([k]) => k !== "name")
      .map(([k, v]) => `  ${k}/: ${v}`)
      .join("\n");

    // Write CLAUDE.md
    const claudeMd = `# ORCHESTRATOR PROTOCOL — TOKEN-OPTIMIZED

> You are an **Orchestrator**. You NEVER do work directly.
> You decompose, batch, and coordinate sub-agents with MINIMAL token usage.

---

## REPO_CONTEXT (CACHED PREFIX — identical for ALL agents)

\`\`\`
Project: ${d.name}
Lang: ${d.language}
Framework: ${d.framework}
Test: ${d.testRunner} — cmd: ${d.testCmd}
Lint: ${d.linter} — cmd: ${d.lintCmd}
Types: ${d.typeCheckCmd || "N/A"}
Build: ${d.buildCmd || "N/A"}
Structure:
${folderLines}
Conventions: ${d.conventions}
\`\`\`

---

## TOKEN ECONOMY RULES

1. Compress context — NEVER inline full files. Use path:line_range references.
2. Batch agents — Merge subtasks touching same files into 1 agent.
3. Cache prefixes — Put stable context FIRST in every prompt.
4. Terse prompts — Bullets not prose. <500 tokens for role+skills, <300 for task.
5. Progressive detail — Start minimal. Add context only on retry.

---

## TASK DECOMPOSITION

When given ANY task:
1. Restate it in <10 words
2. Break into atomic subtasks
3. Batch: merge tasks touching same files, separate different domains
4. Map to agents + skills
5. Execute

---

## AGENT REGISTRY

**ARCHITECT** — READ-ONLY -> specs, interface definitions, file plans
**BACKEND** — src/ lib/ api/ server/ db/ — error handling, validation, auth
**FRONTEND** — components/ pages/ app/ styles/ — React, a11y, performance
**TESTER** — tests/ __tests__/ — AAA pattern, mock externals, happy+error+edge
**REVIEWER** — READ-ONLY — {severity, file, line, issue, fix}
**FULLSTACK** — all src/ — when feature spans FE+BE
**DEVOPS** — .github/ docker/ config/ — CI/CD, Docker, env
**SECURITY** — READ + advisory — injection, auth bypass, XSS, deps

---

## EXECUTION LOOP

1. ASSESS — what's done, failed, next?
2. BATCH — group independent agents, spawn parallel
3. COLLECT — read outputs, check file conflicts
4. VERIFY — run: ${d.testCmd}${d.lintCmd ? " && " + d.lintCmd : ""}${d.typeCheckCmd ? " && " + d.typeCheckCmd : ""}
5. ON FAIL — retry with error context (up to 2x), then escalate
6. REPORT — files changed, tests pass/fail, concerns

---

## RULES

1. Never inline full files — path references only
2. Stable context FIRST in all prompts (enables caching)
3. Batch independent agents, chain dependent ones
4. Max 5 agents for simple features
5. Reuse role prompts VERBATIM
6. ALWAYS run tests before reporting complete
`;

    const claudeMdPath = join(projectPath, "CLAUDE.md");
    const hadClaudeMd = existsSync(claudeMdPath);
    writeFileSync(claudeMdPath, claudeMd);
    logs.push(hadClaudeMd ? "Updated CLAUDE.md" : "Created CLAUDE.md");

    // Write skills
    writeFileSync(join(claudeDir, "skills", "backend.md"), `---
name: backend
description: Backend best practices for ${d.name}
---
# Backend Skills — ${d.name}
- Language: ${d.language}, Framework: ${d.framework}
- Always include error handling for all failure modes
- Validate all external inputs
- Follow existing patterns in the codebase
- Test command: ${d.testCmd}
`);

    writeFileSync(join(claudeDir, "skills", "frontend.md"), `---
name: frontend
description: Frontend best practices for ${d.name}
---
# Frontend Skills — ${d.name}
- Follow existing component patterns in the codebase
- Accessibility: ARIA labels, keyboard nav, focus management
- Performance: lazy load routes, dynamic imports for heavy components
- Match existing styling approach
`);

    writeFileSync(join(claudeDir, "skills", "testing.md"), `---
name: testing
description: Testing best practices for ${d.name}
---
# Testing Skills — ${d.name}
- Test runner: ${d.testRunner} — cmd: ${d.testCmd}
- AAA pattern: Arrange, Act, Assert
- Cover happy paths, edge cases, and error scenarios
- Mock externals not internals
- Run tests after writing, fix failures before reporting done
`);

    logs.push("Created .claude/skills/ (backend, frontend, testing)");

    // Write agent prompt template
    writeFileSync(join(claudeDir, "templates", "agent-prompt.md"), `Project: ${d.name}
Lang: ${d.language}
Framework: ${d.framework}
Test: ${d.testRunner} — cmd: ${d.testCmd}
Lint: ${d.linter} — cmd: ${d.lintCmd}
Build: ${d.buildCmd || "N/A"}

ROLE: {{ROLE}}
SKILLS: {{SKILLS}}
SCOPE: {{SCOPE}}
FORBIDDEN: {{FORBIDDEN}}
BAR: production-ready, error-handled, match existing style

TASK: {{TASK}}
FILES: {{FILES}}
OUTPUT: {{OUTPUT}}
`);
    logs.push("Created .claude/templates/agent-prompt.md");

    // Git commit if it's a git repo
    let gitResult = "";
    if (existsSync(join(projectPath, ".git"))) {
      try {
        execSync("git add CLAUDE.md .claude/", { cwd: projectPath, encoding: "utf-8" });
        execSync('git commit -m "feat: add multi-agent orchestrator system for Claude Code"', {
          cwd: projectPath, encoding: "utf-8",
        });
        gitResult = "Committed to git";
      } catch (e: any) {
        gitResult = "Git commit skipped: " + (e.message || "").slice(0, 100);
      }
    }
    if (gitResult) logs.push(gitResult);

    return NextResponse.json({
      success: true,
      detected: d,
      logs,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
