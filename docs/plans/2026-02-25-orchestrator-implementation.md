# Orchestrator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a TypeScript monorepo that serves as a master control center for managing all projects across local, GitHub, and remote locations — with a CLI, web dashboard, shared skills, and CLAUDE.md brain.

**Architecture:** npm workspaces monorepo with three packages: `shared` (types/schemas), `cli` (Commander-based CLI tool), and `dashboard` (Next.js web UI). A `projects.json` registry at the root tracks all known projects. Skills in `skills/` directory provide Claude Code integration.

**Tech Stack:** TypeScript, Node.js, Commander.js, Zod, Next.js 14, npm workspaces, Vitest

---

### Task 1: Initialize Monorepo & Shared Package

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/schemas.ts`
- Create: `packages/shared/src/index.ts`
- Create: `projects.json`

**Step 1: Create root package.json with workspaces**

```json
{
  "name": "orchestrator",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces",
    "dev:dashboard": "npm run dev --workspace=packages/dashboard",
    "cli": "node packages/cli/dist/index.js"
  }
}
```

**Step 2: Create root tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

**Step 3: Create .gitignore**

```
node_modules/
dist/
.next/
.env
.env.local
.claude.local.md
*.tsbuildinfo
```

**Step 4: Create shared package types**

`packages/shared/package.json`:
```json
{
  "name": "@orchestrator/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  },
  "dependencies": {
    "zod": "^3.23.0"
  }
}
```

`packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

`packages/shared/src/types.ts`:
```typescript
export interface Project {
  id: string;
  name: string;
  path: string;
  type: string;
  stack: string[];
  remote?: string;
  status: "active" | "archived" | "paused";
  tags: string[];
  commands: Record<string, string>;
}

export interface ProjectRegistry {
  projects: Project[];
  locations: string[];
}

export interface TaskDispatch {
  task: string;
  projectId?: string;
  tags?: string[];
}

export interface ProjectStatus {
  id: string;
  name: string;
  gitBranch?: string;
  gitDirty?: boolean;
  lastCommit?: string;
  lastCommitDate?: string;
  exists: boolean;
}
```

`packages/shared/src/schemas.ts`:
```typescript
import { z } from "zod";

export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  path: z.string().min(1),
  type: z.string().default("unknown"),
  stack: z.array(z.string()).default([]),
  remote: z.string().optional(),
  status: z.enum(["active", "archived", "paused"]).default("active"),
  tags: z.array(z.string()).default([]),
  commands: z.record(z.string()).default({}),
});

export const RegistrySchema = z.object({
  projects: z.array(ProjectSchema).default([]),
  locations: z.array(z.string()).default([]),
});
```

`packages/shared/src/index.ts`:
```typescript
export * from "./types.js";
export * from "./schemas.js";
```

**Step 5: Create empty projects.json**

```json
{
  "projects": [],
  "locations": []
}
```

**Step 6: Install dependencies and build**

Run: `npm install && npm run build --workspace=packages/shared`
Expected: Clean build, dist/ folder created in packages/shared

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: initialize monorepo with shared types and schemas"
```

---

### Task 2: Build the Registry Manager

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/registry.ts`
- Create: `packages/cli/src/__tests__/registry.test.ts`

**Step 1: Create CLI package scaffolding**

`packages/cli/package.json`:
```json
{
  "name": "@orchestrator/cli",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "orchestrator": "./dist/index.js"
  },
  "main": "./dist/index.js",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@orchestrator/shared": "*",
    "commander": "^12.1.0",
    "chalk": "^5.3.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^2.0.0",
    "@types/node": "^20.0.0"
  }
}
```

`packages/cli/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**Step 2: Write the failing test for registry**

`packages/cli/src/__tests__/registry.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Registry } from "../registry.js";
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("Registry", () => {
  let testDir: string;
  let registryPath: string;
  let registry: Registry;

  beforeEach(() => {
    testDir = join(tmpdir(), `orch-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    registryPath = join(testDir, "projects.json");
    writeFileSync(registryPath, JSON.stringify({ projects: [], locations: [] }));
    registry = new Registry(registryPath);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("loads an empty registry", () => {
    const data = registry.load();
    expect(data.projects).toEqual([]);
    expect(data.locations).toEqual([]);
  });

  it("adds a project", () => {
    registry.addProject({
      id: "test-proj",
      name: "Test Project",
      path: "/tmp/test",
      type: "web-app",
      stack: ["typescript"],
      status: "active",
      tags: [],
      commands: {},
    });
    const data = registry.load();
    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].id).toBe("test-proj");
  });

  it("removes a project by id", () => {
    registry.addProject({
      id: "to-remove",
      name: "Remove Me",
      path: "/tmp/remove",
      type: "cli",
      stack: [],
      status: "active",
      tags: [],
      commands: {},
    });
    registry.removeProject("to-remove");
    const data = registry.load();
    expect(data.projects).toHaveLength(0);
  });

  it("lists projects filtered by tag", () => {
    registry.addProject({
      id: "frontend",
      name: "Frontend",
      path: "/tmp/fe",
      type: "web-app",
      stack: [],
      status: "active",
      tags: ["frontend"],
      commands: {},
    });
    registry.addProject({
      id: "backend",
      name: "Backend",
      path: "/tmp/be",
      type: "api",
      stack: [],
      status: "active",
      tags: ["backend"],
      commands: {},
    });
    const filtered = registry.listProjects({ tag: "frontend" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("frontend");
  });

  it("prevents duplicate project ids", () => {
    const proj = {
      id: "dupe",
      name: "Dupe",
      path: "/tmp/dupe",
      type: "app",
      stack: [],
      status: "active" as const,
      tags: [],
      commands: {},
    };
    registry.addProject(proj);
    expect(() => registry.addProject(proj)).toThrow("already exists");
  });
});
```

**Step 3: Run test to verify it fails**

Run: `cd /c/Users/PC/Desktop/Claude && npx vitest run --workspace=packages/cli 2>&1 || npx vitest run packages/cli/src/__tests__/registry.test.ts`
Expected: FAIL — cannot resolve `../registry.js`

**Step 4: Write the registry implementation**

`packages/cli/src/registry.ts`:
```typescript
import { readFileSync, writeFileSync } from "fs";
import { RegistrySchema } from "@orchestrator/shared";
import type { Project, ProjectRegistry } from "@orchestrator/shared";

export class Registry {
  constructor(private registryPath: string) {}

  load(): ProjectRegistry {
    const raw = readFileSync(this.registryPath, "utf-8");
    return RegistrySchema.parse(JSON.parse(raw));
  }

  private save(data: ProjectRegistry): void {
    writeFileSync(this.registryPath, JSON.stringify(data, null, 2));
  }

  addProject(project: Omit<Project, "remote">& { remote?: string }): void {
    const data = this.load();
    if (data.projects.some((p) => p.id === project.id)) {
      throw new Error(`Project "${project.id}" already exists`);
    }
    data.projects.push(project as Project);
    this.save(data);
  }

  removeProject(id: string): void {
    const data = this.load();
    data.projects = data.projects.filter((p) => p.id !== id);
    this.save(data);
  }

  getProject(id: string): Project | undefined {
    return this.load().projects.find((p) => p.id === id);
  }

  listProjects(filter?: { tag?: string; status?: string }): Project[] {
    let projects = this.load().projects;
    if (filter?.tag) {
      projects = projects.filter((p) => p.tags.includes(filter.tag!));
    }
    if (filter?.status) {
      projects = projects.filter((p) => p.status === filter.status);
    }
    return projects;
  }

  addLocation(location: string): void {
    const data = this.load();
    if (!data.locations.includes(location)) {
      data.locations.push(location);
      this.save(data);
    }
  }
}
```

**Step 5: Install deps and run tests**

Run: `npm install && npm run build --workspace=packages/shared && npx vitest run packages/cli/src/__tests__/registry.test.ts`
Expected: All 5 tests PASS

**Step 6: Commit**

```bash
git add packages/cli/ package-lock.json
git commit -m "feat: add registry manager with tests"
```

---

### Task 3: Build CLI Commands

**Files:**
- Create: `packages/cli/src/index.ts`
- Create: `packages/cli/src/commands/project.ts`
- Create: `packages/cli/src/commands/run.ts`
- Create: `packages/cli/src/commands/status.ts`
- Create: `packages/cli/src/utils.ts`

**Step 1: Write utils.ts**

```typescript
import { resolve } from "path";
import { existsSync } from "fs";

export function findRegistryPath(): string {
  // Walk up from cwd to find projects.json, default to cwd
  let dir = process.cwd();
  while (dir) {
    const candidate = resolve(dir, "projects.json");
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(process.cwd(), "projects.json");
}
```

**Step 2: Write project command**

`packages/cli/src/commands/project.ts`:
```typescript
import { Command } from "commander";
import { Registry } from "../registry.js";
import { findRegistryPath } from "../utils.js";
import { readdirSync, statSync, existsSync } from "fs";
import { join, basename, resolve } from "path";
import chalk from "chalk";

export function projectCommand(): Command {
  const cmd = new Command("project").description("Manage projects in the registry");

  cmd
    .command("add <path>")
    .description("Register a project")
    .option("-n, --name <name>", "Project name")
    .option("-t, --type <type>", "Project type", "unknown")
    .option("--tags <tags>", "Comma-separated tags", "")
    .action((path, opts) => {
      const registry = new Registry(findRegistryPath());
      const fullPath = resolve(path);
      const id = basename(fullPath).toLowerCase().replace(/\s+/g, "-");
      const name = opts.name || basename(fullPath);

      registry.addProject({
        id,
        name,
        path: fullPath,
        type: opts.type,
        stack: [],
        status: "active",
        tags: opts.tags ? opts.tags.split(",") : [],
        commands: {},
      });
      console.log(chalk.green(`+ Added project "${name}" (${id})`));
    });

  cmd
    .command("list")
    .description("List all registered projects")
    .option("-t, --tag <tag>", "Filter by tag")
    .action((opts) => {
      const registry = new Registry(findRegistryPath());
      const projects = registry.listProjects({ tag: opts.tag });
      if (projects.length === 0) {
        console.log(chalk.yellow("No projects registered."));
        return;
      }
      for (const p of projects) {
        const status = p.status === "active" ? chalk.green("●") : chalk.gray("○");
        console.log(`${status} ${chalk.bold(p.name)} (${p.id}) — ${p.path}`);
        if (p.tags.length) console.log(`  tags: ${p.tags.join(", ")}`);
      }
    });

  cmd
    .command("remove <id>")
    .description("Unregister a project")
    .action((id) => {
      const registry = new Registry(findRegistryPath());
      registry.removeProject(id);
      console.log(chalk.red(`- Removed project "${id}"`));
    });

  cmd
    .command("scan")
    .description("Auto-discover projects in registered locations")
    .action(() => {
      const registry = new Registry(findRegistryPath());
      const data = registry.load();
      let found = 0;
      for (const loc of data.locations) {
        if (!existsSync(loc)) continue;
        const entries = readdirSync(loc);
        for (const entry of entries) {
          const fullPath = join(loc, entry);
          if (!statSync(fullPath).isDirectory()) continue;
          const hasPackageJson = existsSync(join(fullPath, "package.json"));
          const hasGit = existsSync(join(fullPath, ".git"));
          const hasPyproject = existsSync(join(fullPath, "pyproject.toml"));
          if (hasPackageJson || hasGit || hasPyproject) {
            const id = entry.toLowerCase().replace(/\s+/g, "-");
            if (!data.projects.some((p) => p.id === id)) {
              try {
                registry.addProject({
                  id,
                  name: entry,
                  path: fullPath,
                  type: hasPackageJson ? "node" : hasPyproject ? "python" : "unknown",
                  stack: [],
                  status: "active",
                  tags: [],
                  commands: {},
                });
                console.log(chalk.green(`+ Discovered: ${entry}`));
                found++;
              } catch { /* skip duplicates */ }
            }
          }
        }
      }
      console.log(chalk.bold(`\nScan complete. ${found} new projects found.`));
    });

  return cmd;
}
```

**Step 3: Write run command**

`packages/cli/src/commands/run.ts`:
```typescript
import { Command } from "commander";
import { Registry } from "../registry.js";
import { findRegistryPath } from "../utils.js";
import { execSync } from "child_process";
import { existsSync } from "fs";
import chalk from "chalk";

export function runCommand(): Command {
  return new Command("run")
    .description("Run a command across projects")
    .argument("<cmd>", "Command to run")
    .option("-a, --all", "Run on all projects")
    .option("-t, --tag <tag>", "Filter by tag")
    .option("-p, --project <id>", "Run on specific project")
    .action((cmd, opts) => {
      const registry = new Registry(findRegistryPath());
      let projects = registry.listProjects({ tag: opts.tag });

      if (opts.project) {
        projects = projects.filter((p) => p.id === opts.project);
      }

      if (projects.length === 0) {
        console.log(chalk.yellow("No matching projects."));
        return;
      }

      for (const project of projects) {
        console.log(chalk.bold(`\n=== ${project.name} ===`));

        if (!existsSync(project.path)) {
          console.log(chalk.red(`  Path not found: ${project.path}`));
          continue;
        }

        // Check if cmd is a registered command alias
        const actualCmd = project.commands[cmd] || cmd;

        try {
          const output = execSync(actualCmd, {
            cwd: project.path,
            encoding: "utf-8",
            timeout: 60000,
          });
          console.log(output);
        } catch (err: any) {
          console.log(chalk.red(`  Failed: ${err.message}`));
        }
      }
    });
}
```

**Step 4: Write status command**

`packages/cli/src/commands/status.ts`:
```typescript
import { Command } from "commander";
import { Registry } from "../registry.js";
import { findRegistryPath } from "../utils.js";
import { execSync } from "child_process";
import { existsSync } from "fs";
import chalk from "chalk";

export function statusCommand(): Command {
  return new Command("status")
    .description("Check status of all projects")
    .option("-a, --all", "Include archived projects")
    .action((opts) => {
      const registry = new Registry(findRegistryPath());
      const filter = opts.all ? undefined : { status: "active" };
      const projects = registry.listProjects(filter);

      for (const project of projects) {
        const exists = existsSync(project.path);
        if (!exists) {
          console.log(`${chalk.red("✗")} ${chalk.bold(project.name)} — path missing`);
          continue;
        }

        let branch = "—";
        let dirty = false;
        let lastCommit = "—";

        try {
          branch = execSync("git rev-parse --abbrev-ref HEAD", {
            cwd: project.path,
            encoding: "utf-8",
          }).trim();

          const status = execSync("git status --porcelain", {
            cwd: project.path,
            encoding: "utf-8",
          }).trim();
          dirty = status.length > 0;

          lastCommit = execSync('git log -1 --format="%s (%cr)"', {
            cwd: project.path,
            encoding: "utf-8",
          }).trim();
        } catch {
          // Not a git repo, that's fine
        }

        const icon = dirty ? chalk.yellow("●") : chalk.green("●");
        console.log(`${icon} ${chalk.bold(project.name)} [${branch}]`);
        if (lastCommit !== "—") console.log(`  ${chalk.gray(lastCommit)}`);
      }
    });
}
```

**Step 5: Write CLI entry point**

`packages/cli/src/index.ts`:
```typescript
#!/usr/bin/env node
import { Command } from "commander";
import { projectCommand } from "./commands/project.js";
import { runCommand } from "./commands/run.js";
import { statusCommand } from "./commands/status.js";

const program = new Command()
  .name("orchestrator")
  .description("Master control center for all your projects")
  .version("0.1.0");

program.addCommand(projectCommand());
program.addCommand(runCommand());
program.addCommand(statusCommand());

program.parse();
```

**Step 6: Install deps, build, and test CLI**

Run: `npm install && npm run build --workspaces`
Run: `node packages/cli/dist/index.js --help`
Expected: Shows help with project, run, status commands

**Step 7: Commit**

```bash
git add packages/cli/src/
git commit -m "feat: add CLI with project, run, and status commands"
```

---

### Task 4: Create CLAUDE.md & Skills

**Files:**
- Create: `CLAUDE.md`
- Create: `skills/manage-project.md`
- Create: `skills/cross-project-run.md`
- Create: `skills/dispatch-task.md`
- Create: `skills/project-status.md`

**Step 1: Write CLAUDE.md**

```markdown
# Orchestrator

Master control center for all projects. Manages a registry of projects across local folders, GitHub repos, and remote servers.

## Quick Start

```bash
npm install            # Install all dependencies
npm run build          # Build all packages
npm run cli -- --help  # Show CLI help
npm run dev:dashboard  # Start web dashboard on localhost:3000
```

## Architecture

TypeScript monorepo with npm workspaces:
- `packages/shared` — Types and Zod schemas
- `packages/cli` — Commander-based CLI tool
- `packages/dashboard` — Next.js web dashboard

## Key Files

- `projects.json` — Project registry (source of truth)
- `packages/cli/src/registry.ts` — Registry read/write logic
- `packages/cli/src/commands/` — CLI command implementations
- `skills/` — Claude Code skills for orchestration

## CLI Commands

```
npm run cli -- project add <path>       # Register project
npm run cli -- project list             # List projects
npm run cli -- project remove <id>      # Remove project
npm run cli -- project scan             # Auto-discover projects
npm run cli -- run <cmd> [--tag=X]      # Cross-project command
npm run cli -- status                   # Git status of all projects
```

## Testing

```bash
npm test                                        # All tests
npx vitest run packages/cli/src/__tests__/      # CLI tests only
```

## Code Style

- TypeScript strict mode
- ES modules (type: "module")
- Zod for all external data validation
- Vitest for testing

## Project Registry Schema

Projects in `projects.json` have: id, name, path, type, stack[], remote?, status, tags[], commands{}

## Skills

Skills in `skills/` directory. Use them from Claude Code:
- `manage-project` — Add/remove/list projects
- `cross-project-run` — Run commands across projects
- `dispatch-task` — Route tasks to the right project
- `project-status` — Health check all projects
```

**Step 2: Write manage-project skill**

`skills/manage-project.md`:
```markdown
---
name: manage-project
description: Register, update, or remove projects from the orchestrator registry
---

# Manage Project

Use the orchestrator CLI to manage the project registry.

## Add a project
```bash
npm run cli -- project add <path> --name "Name" --type web-app --tags "frontend,production"
```

## List projects
```bash
npm run cli -- project list
npm run cli -- project list --tag frontend
```

## Remove a project
```bash
npm run cli -- project remove <id>
```

## Scan for new projects
First add scan locations by editing `projects.json` "locations" array, then:
```bash
npm run cli -- project scan
```

## Direct registry editing
For bulk operations, edit `projects.json` directly. Schema is validated on load via Zod.
```

**Step 3: Write cross-project-run skill**

`skills/cross-project-run.md`:
```markdown
---
name: cross-project-run
description: Execute commands across multiple registered projects
---

# Cross-Project Run

Run any shell command across filtered sets of projects.

## Run on all projects
```bash
npm run cli -- run "git status" --all
```

## Run on tagged projects
```bash
npm run cli -- run "npm test" --tag frontend
```

## Run on specific project
```bash
npm run cli -- run "npm run build" --project my-app
```

## Using registered command aliases
Projects can define command aliases in their `commands` field in `projects.json`. If the command matches an alias, the alias value is executed instead.

Example: if a project has `"commands": {"test": "npm test"}`, then `run test --project my-app` executes `npm test`.
```

**Step 4: Write dispatch-task skill**

`skills/dispatch-task.md`:
```markdown
---
name: dispatch-task
description: Route a task to the correct project based on context
---

# Dispatch Task

When given a task, determine which project it belongs to and act on it.

## Process

1. Read the task description
2. Load `projects.json` and examine project names, tags, stacks, and types
3. Match the task to the most relevant project based on:
   - Keywords matching project names or tags
   - Technology stack alignment
   - Project type relevance
4. Open the matched project directory and execute the task

## Manual dispatch
```bash
npm run cli -- dispatch "fix the login bug in the frontend"
```

## When dispatching manually from Claude Code
1. Run `npm run cli -- project list` to see all projects
2. Identify the target project
3. Navigate to the project: `cd <project-path>`
4. Execute the task in that project's context
```

**Step 5: Write project-status skill**

`skills/project-status.md`:
```markdown
---
name: project-status
description: Check health and git status of all registered projects
---

# Project Status

Get a quick overview of all project health.

## Check all active projects
```bash
npm run cli -- status
```

## Include archived projects
```bash
npm run cli -- status --all
```

## What it shows
- Green dot: clean git working tree
- Yellow dot: uncommitted changes
- Red X: path doesn't exist
- Branch name, last commit message, and relative time
```

**Step 6: Commit**

```bash
git add CLAUDE.md skills/
git commit -m "feat: add CLAUDE.md and orchestrator skills"
```

---

### Task 5: Scaffold Next.js Dashboard

**Files:**
- Create: `packages/dashboard/package.json`
- Create: `packages/dashboard/tsconfig.json`
- Create: `packages/dashboard/next.config.js`
- Create: `packages/dashboard/src/app/layout.tsx`
- Create: `packages/dashboard/src/app/page.tsx`
- Create: `packages/dashboard/src/app/globals.css`
- Create: `packages/dashboard/src/lib/registry.ts`
- Create: `packages/dashboard/src/components/project-card.tsx`

**Step 1: Create dashboard package.json**

```json
{
  "name": "@orchestrator/dashboard",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "@orchestrator/shared": "*",
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

**Step 2: Create Next.js config and tsconfig**

`packages/dashboard/next.config.js`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@orchestrator/shared"],
};
export default nextConfig;
```

`packages/dashboard/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 3: Create layout and globals**

`packages/dashboard/src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orchestrator",
  description: "Master control center for all projects",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`packages/dashboard/src/app/globals.css`:
```css
:root {
  --bg: #0a0a0a;
  --fg: #ededed;
  --accent: #3b82f6;
  --card: #1a1a1a;
  --border: #2a2a2a;
  --green: #22c55e;
  --yellow: #eab308;
  --red: #ef4444;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  background: var(--bg);
  color: var(--fg);
  font-family: system-ui, -apple-system, sans-serif;
}
```

**Step 4: Create registry reader for dashboard**

`packages/dashboard/src/lib/registry.ts`:
```typescript
import { readFileSync } from "fs";
import { resolve } from "path";
import { RegistrySchema } from "@orchestrator/shared";
import type { ProjectRegistry } from "@orchestrator/shared";

export function loadRegistry(): ProjectRegistry {
  const registryPath = resolve(process.cwd(), "../../projects.json");
  const raw = readFileSync(registryPath, "utf-8");
  return RegistrySchema.parse(JSON.parse(raw));
}
```

**Step 5: Create project card component**

`packages/dashboard/src/components/project-card.tsx`:
```tsx
import type { Project } from "@orchestrator/shared";

export function ProjectCard({ project }: { project: Project }) {
  const statusColor =
    project.status === "active" ? "var(--green)" :
    project.status === "paused" ? "var(--yellow)" : "var(--red)";

  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: 16,
      display: "flex",
      flexDirection: "column",
      gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: statusColor, display: "inline-block",
        }} />
        <strong>{project.name}</strong>
        <span style={{ color: "#888", fontSize: 12 }}>{project.type}</span>
      </div>
      <div style={{ fontSize: 13, color: "#888" }}>{project.path}</div>
      {project.tags.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {project.tags.map((tag) => (
            <span key={tag} style={{
              background: "var(--border)", borderRadius: 4,
              padding: "2px 8px", fontSize: 11,
            }}>{tag}</span>
          ))}
        </div>
      )}
      {project.stack.length > 0 && (
        <div style={{ fontSize: 12, color: "#aaa" }}>
          Stack: {project.stack.join(", ")}
        </div>
      )}
    </div>
  );
}
```

**Step 6: Create main page**

`packages/dashboard/src/app/page.tsx`:
```tsx
import { loadRegistry } from "@/lib/registry";
import { ProjectCard } from "@/components/project-card";

export const dynamic = "force-dynamic";

export default function Home() {
  const registry = loadRegistry();

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 32 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Orchestrator</h1>
      <p style={{ color: "#888", marginBottom: 24 }}>
        {registry.projects.length} projects registered
      </p>

      {registry.projects.length === 0 ? (
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 8, padding: 32, textAlign: "center", color: "#888",
        }}>
          No projects registered yet. Use the CLI to add projects.
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 16,
        }}>
          {registry.projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </main>
  );
}
```

**Step 7: Install deps and verify**

Run: `npm install && npm run build --workspace=packages/dashboard`
Expected: Next.js builds successfully

**Step 8: Commit**

```bash
git add packages/dashboard/
git commit -m "feat: add Next.js dashboard with project overview"
```

---

### Task 6: Create Templates & Config

**Files:**
- Create: `templates/CLAUDE.md.template`
- Create: `config/eslint.config.js`
- Create: `config/prettier.config.js`

**Step 1: Write CLAUDE.md template**

`templates/CLAUDE.md.template`:
```markdown
# {{PROJECT_NAME}}

## Quick Start

```bash
{{INSTALL_CMD}}
{{DEV_CMD}}
```

## Architecture

{{ARCHITECTURE_DESCRIPTION}}

## Testing

```bash
{{TEST_CMD}}
```

## Code Style

{{CODE_STYLE_NOTES}}
```

**Step 2: Write ESLint config**

`config/eslint.config.js`:
```javascript
export default [
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
    },
  },
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/.next/**"],
  },
];
```

**Step 3: Write Prettier config**

`config/prettier.config.js`:
```javascript
export default {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 100,
  tabWidth: 2,
};
```

**Step 4: Commit**

```bash
git add templates/ config/
git commit -m "feat: add project templates and shared config"
```

---

### Task 7: Final Integration & Initial Commit

**Step 1: Verify full build**

Run: `npm install && npm run build`
Expected: All packages build cleanly

**Step 2: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 3: Test CLI end-to-end**

Run:
```bash
node packages/cli/dist/index.js project list
node packages/cli/dist/index.js --help
```
Expected: Empty project list, help output shows all commands

**Step 4: Create initial git tag**

```bash
git add -A
git commit -m "feat: orchestrator v0.1.0 - initial release"
git tag v0.1.0
```
