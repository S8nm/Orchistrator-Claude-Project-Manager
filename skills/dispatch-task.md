---
name: dispatch-task
description: Route a task to the correct project based on context
---

# Dispatch Task

When given a task, determine which project it belongs to and act on it.

## Process

1. Read the task description
2. Load `projects.json` and examine project names, tags, stacks, and types
3. Match the task to the most relevant project by keyword scoring
4. Open the matched project directory and execute the task

## CLI dispatch
```bash
npm run cli -- dispatch "fix the login bug in the frontend"
```

## Manual dispatch from Claude Code
1. Run `npm run cli -- project list` to see all projects
2. Identify the target project
3. Navigate to the project: `cd <project-path>`
4. Execute the task in that project's context
