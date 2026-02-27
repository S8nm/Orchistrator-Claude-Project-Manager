<<<<<<< C:/Users/PC/Desktop/Claude/packages/cli/src/commands/project.ts
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
=======
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
            if (!data.projects.some((p: { id: string }) => p.id === id)) {
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
>>>>>>> C:/Users/PC/.windsurf/worktrees/Claude/Claude-443cfaf1/packages/cli/src/commands/project.ts
