#!/usr/bin/env node
import { Command } from "commander";
import { projectCommand } from "./commands/project.js";
import { runCommand } from "./commands/run.js";
import { statusCommand } from "./commands/status.js";
import { dispatchCommand } from "./commands/dispatch.js";

const program = new Command()
  .name("orchestrator")
  .description("Master control center for all your projects")
  .version("0.1.0");

program.addCommand(projectCommand());
program.addCommand(runCommand());
program.addCommand(statusCommand());
program.addCommand(dispatchCommand());

program.parse();
