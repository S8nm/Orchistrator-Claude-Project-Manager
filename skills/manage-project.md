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
