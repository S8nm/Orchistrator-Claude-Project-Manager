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
