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
