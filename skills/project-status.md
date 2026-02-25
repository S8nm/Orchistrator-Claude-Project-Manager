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
