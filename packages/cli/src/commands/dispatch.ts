import { Command } from "commander";
import { Registry } from "../registry.js";
import { findRegistryPath } from "../utils.js";
import chalk from "chalk";

export function dispatchCommand(): Command {
  return new Command("dispatch")
    .description("Route a task to the right project")
    .argument("<task>", "Task description")
    .action((task) => {
      const registry = new Registry(findRegistryPath());
      const projects = registry.listProjects({ status: "active" });

      if (projects.length === 0) {
        console.log(chalk.yellow("No projects to dispatch to."));
        return;
      }

      const words = task.toLowerCase().split(/\s+/);
      const scored = projects.map((p) => {
        let score = 0;
        const searchable = [p.name, p.type, ...p.tags, ...p.stack].map((s) => s.toLowerCase());
        for (const word of words) {
          for (const term of searchable) {
            if (term.includes(word)) score++;
          }
        }
        return { project: p, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const best = scored[0];

      if (best.score === 0) {
        console.log(chalk.yellow("No matching project found for this task."));
        console.log(chalk.gray("Registered projects:"));
        for (const p of projects) {
          console.log(chalk.gray(`  - ${p.name} (${p.tags.join(", ")})`));
        }
        return;
      }

      console.log(chalk.bold(`\nRouting: "${task}"`));
      console.log(chalk.green(`→ ${best.project.name} (${best.project.id})`));
      console.log(chalk.gray(`  Path: ${best.project.path}`));
      console.log(chalk.gray(`  Score: ${best.score} keyword matches`));

      if (scored.length > 1 && scored[1].score > 0) {
        console.log(chalk.gray(`\n  Also possible:`));
        for (const s of scored.slice(1, 3).filter((s) => s.score > 0)) {
          console.log(chalk.gray(`  - ${s.project.name} (score: ${s.score})`));
        }
      }
    });
}
