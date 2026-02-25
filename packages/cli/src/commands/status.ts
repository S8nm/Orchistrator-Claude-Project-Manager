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
          // Not a git repo
        }

        const icon = dirty ? chalk.yellow("●") : chalk.green("●");
        console.log(`${icon} ${chalk.bold(project.name)} [${branch}]`);
        if (lastCommit !== "—") console.log(`  ${chalk.gray(lastCommit)}`);
      }
    });
}
