# J.A.R.V.I.S. — Complete Toolbox & Resource Reference

Everything collected, categorized, and rated for building an AI assistant with PersonaPlex + Ollama + Claude + OpenClaw on Raspberry Pi.

---

## TOOLS TO INSTALL (Claude Code / Dev Environment)

### Tier 1: Install These — Directly Useful

**GSD (Get Shit Done)**
- Repo: github.com/gsd-build/get-shit-done
- What: Meta-prompting + spec-driven development system for Claude Code
- Install: `npx get-shit-done-cc --claude --local`
- Use: `/gsd:new-project` -> paste your project spec -> it interviews you, builds a full spec, executes phase by phase with verification
- Why: Your Jarvis project has 12+ implementation phases across multiple sessions. GSD tracks state, manages progress, orchestrates subagents, and handles context loss between sessions. This is the backbone tool.
- Stars: 13.5k | Status: Very active, frequent releases
- Caveat: Has had some command compatibility issues with Claude Code updates. Check github issues if commands freeze.

**Superpowers (obra/superpowers)**
- Repo: github.com/obra/superpowers
- What: Core skills library for Claude Code — 20+ battle-tested skills including TDD, debugging, brainstorming, micro-task planning, parallel subagents, and automatic code review
- Install: `npx skills add obra/superpowers`
- Use: Automatically activates when relevant. Forces Claude Code to brainstorm before coding, write tests, use subagents for parallel work, and review its own code.
- Why: Your agent.py is 26KB. When Claude Code modifies it, Superpowers forces it to think first, test, and review — reducing the chance it breaks your existing 33 tools and integrations.
- Stars: Referenced as top community skill library

**Vercel Agent Skills**
- Repo: github.com/vercel-labs/agent-skills
- What: Official Vercel collection — React/Next.js best practices (40+ rules), web design guidelines, frontend code review
- Install: `npx skills add vercel-labs/agent-skills`
- Use: Passively improves React code output when Claude Code builds your frontend components
- Why: Your frontend has 27 JSX components. When building AgentDashboard.jsx, updating ServiceDot.jsx, WidgetsPanel.jsx — this makes the output better automatically.
- Stars: 20.5k | Status: Official Vercel, well maintained

**UI/UX Pro Max Skill**
- Repo: github.com/nextlevelbuilder/ui-ux-pro-max-skill
- What: Auto-generates complete design systems — styles, color palettes, font pairings, spacing scales
- Install: `npx skills add nextlevelbuilder/ui-ux-pro-max-skill`
- Use: When building new UI components, Claude Code will generate designer-level visual output
- Why: Your Jarvis HUD (3-column layout) will look more polished, especially the new agent dashboard and cost widgets
- Note: Pairs well with Vercel Agent Skills — one handles design, the other handles React best practices

### Tier 2: Install If Relevant to Your Workflow

**Obsidian Skills**
- Repo: github.com/kepano/obsidian-skills
- What: Connects Claude Code to your Obsidian vault — create, organize, manage notes
- Install: `npx skills add kepano/obsidian-skills`
- Use: If you use Obsidian for notes/docs, Claude Code can read/write to your vault
- Why: Could be useful for Jarvis project documentation, architecture notes, session logs. Skip if you don't use Obsidian.

**Ralph (Autonomous Agent Loop)**
- Repo: github.com/snarktank/ralph
- What: Bash loop that runs Claude Code repeatedly until all PRD items are complete. Each iteration = fresh context, memory persists via git + progress.txt + prd.json
- Install: Copy ralph.sh + CLAUDE.md to your project's scripts/ralph/
- Use: `./ralph.sh --tool claude 20` -> runs up to 20 iterations autonomously
- Why: Could be useful for the boring phases (resilience primitives, tests) where you want Claude Code to just grind through without you watching. GSD is better for phases where you want control.
- Stars: 9.7k
- Note: Don't use alongside GSD — pick one per session. GSD for supervised, Ralph for autonomous.

### Tier 3: Reference Only — Don't Install, Just Bookmark

**React Bits**
- Repo: github.com/DavidHDev/react-bits
- Site: reactbits.dev
- What: 110+ animated React components (text animations, backgrounds, UI elements)
- Stars: 33k
- Use when: You want to add polish to the Jarvis HUD — animated status text, background effects, transition animations
- Install per-component: `npx shadcn@latest add @react-bits/BlurText-TS-TW`
- Note: Eye candy, not architecture. Use after core functionality works.

**CodeRabbit**
- Site: coderabbit.ai
- What: AI-powered code review bot for GitHub PRs
- Use when: If you push Jarvis to GitHub and want automated PR reviews
- Free tier available
- Note: Nice to have, not essential for solo development

**Pencil (Design to Code)**
- What: Tool that bridges design and code — generates UI from design specs
- Use when: If you have Figma/design mockups for the Jarvis HUD
- Note: Niche tool, skip unless you're doing heavy design work

---

## LEARNING RESOURCES (Bookmark, Don't Install)

### Directly Relevant to Jarvis

**System Design Primer**
- Repo: github.com/donnemartin/system-design-primer
- What: How large systems are designed — databases, caching, scaling, load balancing
- Use for: Understanding the architecture patterns behind your router, circuit breaker, and orchestrator. Read the sections on load balancing, message queues, and microservices.

**Build Your Own X**
- Repo: github.com/codecrafters-io/build-your-own-x
- What: Step-by-step guides to rebuild real technologies from scratch
- Use for: If you want to deeply understand any component — build your own database, build your own bot, build your own web server. Good for leveling up.

### General Developer Growth

**Developer Roadmap**
- Repo: github.com/kamranahmedse/developer-roadmap
- Site: roadmap.sh
- What: Interactive learning paths for frontend, backend, DevOps, AI
- Use for: Filling knowledge gaps. If you realize you need to learn more about WebSockets, async patterns, or system design — this shows you the path.

**Awesome Lists**
- Repo: github.com/sindresorhus/awesome
- What: Curated lists of best tools & libraries for almost everything
- Use for: Discovery. When you need "best Python async library" or "best SQLite ORM" — search here first.

---

## FREE APIs & INFERENCE (Use in Your Project)

**free-llm-api-resources** - ESSENTIAL
- Repo: github.com/cheahjs/free-llm-api-resources
- What: Comprehensive list of free LLM API access — OpenRouter, Google AI Studio, NVIDIA NIM, Groq, Cerebras, HuggingFace, Vercel AI Gateway, GitHub Models
- Stars: 9.9k | Updated automatically
- Use for:
  - Testing your intent router without burning Claude budget
  - Powering cheap sub-agent roles (monitor, reviewer) in the orchestrator
  - Adding to Pi worker's existing fallback chain (Groq -> Cerebras -> Gemini -> ...)
  - Development/prototyping phase — route everything through free providers
- Key providers for your project:
  - **Groq**: Fast inference, free tier, good for router classification
  - **Cerebras**: Very fast, free tier
  - **Google AI Studio**: Gemini free tier, generous limits
  - **OpenRouter**: Aggregator with free model tiers
  - **NVIDIA NIM**: Free inference endpoints

**Public APIs**
- Repo: github.com/public-apis/public-apis
- What: Directory of free APIs across every category
- Use for: Adding capabilities to Jarvis — weather, news, finance, IoT, entertainment. When you want Jarvis to do something new, check here for a free API first.

**NVIDIA PersonaPlex** (already using)
- Repo: github.com/NVIDIA/personaplex
- Model: nvidia/personaplex-7b-v1 on HuggingFace
- License: NVIDIA Open Model License (commercial OK)
- What: Real-time full-duplex speech-to-speech, persona control via text + voice prompts
- Note: Free weights, needs GPU. You're already integrating this.

**Anthropic API Cost Optimization** (already using)
- Prompt caching: ~90% savings on repeated system prompts / conversation history
- Batch API: 50% discount on input + output tokens for async/non-urgent tasks
- Use Claude Haiku for router classification (cheapest)
- Use Sonnet for complex reasoning
- Docs: docs.anthropic.com/en/docs/build-with-claude/prompt-caching

---

## SKILL & PLUGIN DIRECTORIES (Browse When Needed)

**awesome-claude-skills (travisvn)**
- Repo: github.com/travisvn/awesome-claude-skills
- What: Curated list of Claude Skills with categories, descriptions, install instructions
- Stars: 5.5k
- Use for: Finding specialized skills when you need them — PDF handling, web automation, code quality, testing

**awesome-claude-skills (ComposioHQ)**
- Repo: github.com/ComposioHQ/awesome-claude-skills
- What: Another curated skills list, slightly different curation, includes 874 Composio toolkit integrations
- Use for: Same as above, different selection. Browse both.

**Awesome Claude Code**
- Repo: github.com/hesreallyhim/awesome-claude-code
- What: Directory of skills, hooks, slash commands, plugins, workflow tips
- Stars: 6.7k
- Use for: Finding proven workflows and configurations. Good for discovering hooks (pre-commit checks, auto-formatting) and slash commands.

**skills.sh**
- Site: skills.sh
- What: Vercel's directory and leaderboard for skill packages
- CLI: `npx skills add <package>`
- Use for: Searching for skills by keyword. Easier than browsing GitHub repos manually.

---

## SKIP THESE (Hype or Not Relevant)

| Tool | Why Skip |
|------|----------|
| "$500 prompt" (ericofchong) | Basic meta-prompt, you can write this in 5 min |
| "Vibe coding in 60 seconds" | Oversimplified, not actionable |
| "Claude + Supabase + Vercel" stack | Generic advice, you already have your stack |
| awesome-nano-banana-pro-prompts | Prompt collection, low signal-to-noise |
| Kimi K2.5 / NVIDIA Build posts | Awareness only, not tools you'd use |
| LangExtract | Document extraction — not relevant to Jarvis |
| PicoClaw | Interesting but too early (pre-v1.0, security warnings). You're already on OpenClaw, don't switch mid-build |

---

## QUICK REFERENCE: What to Use When

| Situation | Tool |
|-----------|------|
| Starting a new implementation phase | GSD -> `/gsd:new-milestone` |
| Claude Code loses context mid-session | GSD state tracking or Recovery Prompt |
| Want Claude Code to grind autonomously | Ralph loop |
| Building React components | Vercel Agent Skills + UI/UX Pro Max |
| Need a free LLM API for testing | free-llm-api-resources list |
| Need a free API for a new Jarvis feature | Public APIs list |
| Want Claude Code to write better code | Superpowers (auto-TDD, review) |
| Debugging a specific crash | Paste error + "read the file first, then fix" |
| Adding polish/animations to HUD | React Bits (per-component install) |
| Looking for a specific Claude skill | skills.sh or awesome-claude-skills |
| Understanding system architecture patterns | System Design Primer |
| Learning a new technology deeply | Build Your Own X |
| Finding the right learning path | Developer Roadmap (roadmap.sh) |
