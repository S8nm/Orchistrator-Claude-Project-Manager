# Agent Orchestrator System

## How it works
Drop a task into Claude Code. The CLAUDE.md instructs it to:
1. Scan repo (cached after first run)
2. Decompose task into subtasks
3. Batch related subtasks together
4. Spawn typed agents with cached prompts
5. Loop until tests pass
6. Report results

## Files
- `CLAUDE.md` — Main orchestrator protocol (auto-loaded by Claude Code)
- `.claude/skills/` — Domain knowledge injected into agent prompts
  - `backend.md` — TypeScript, Commander.js, Zod, Registry patterns
  - `frontend.md` — Next.js 14, React, Virtual Office UI, dark theme
  - `testing.md` — Vitest, AAA pattern, temp dir pattern
  - `devops.md` — Build chain, npm workspaces, deployment
- `.claude/templates/` — Reusable prompt templates
  - `agent-prompt.md` — Standard agent prompt with REPO_CONTEXT prefix
  - `review-prompt.md` — Code review prompt template
- `.claude/cache/` — Reserved for context caching artifacts

## Token optimization
- Prompt prefix caching: ~90% savings on repeated agent spawns
- Batch processing: 50% discount on parallel independent agents
- Compressed context: path references instead of inlined files
- Progressive detail: minimal prompts first, add context only on retry
- Target: <1400 tokens per agent prompt

## Customization
- Edit skills in `.claude/skills/` to refine agent expertise
- Adjust REPO_CONTEXT in CLAUDE.md if project structure changes
- Add new agent roles in the Agent Registry section of CLAUDE.md
