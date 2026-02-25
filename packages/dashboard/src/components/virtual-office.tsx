"use client";

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";

const ProjectManager = lazy(() => import("./project-manager"));

const uid = () => Math.random().toString(36).slice(2, 9);

const AGENT_TYPES: Record<string, { icon: string; color: string; label: string; desk: string; scope: string; skills: string[] }> = {
  orchestrator: { icon: "\u{1F9E0}", color: "#a855f7", label: "Orchestrator", desk: "Command Center", scope: "Coordinates all agents", skills: ["task-decomposition", "batching", "prompt-caching"] },
  architect: { icon: "\u{1F3D7}\uFE0F", color: "#8b5cf6", label: "Architect", desk: "Design Lab", scope: "READ-ONLY \u2192 specs", skills: ["analyze-codebase", "design-system", "define-interfaces"] },
  backend: { icon: "\u2699\uFE0F", color: "#3b82f6", label: "Backend", desk: "Server Room", scope: "src/ lib/ api/ db/", skills: ["api-design", "database-ops", "error-handling", "auth-patterns"] },
  frontend: { icon: "\u{1F3A8}", color: "#ec4899", label: "Frontend", desk: "UI Studio", scope: "components/ pages/ styles/", skills: ["react-best-practices", "css-patterns", "accessibility"] },
  tester: { icon: "\u{1F9EA}", color: "#10b981", label: "Tester", desk: "QA Lab", scope: "tests/ __tests__/", skills: ["unit-testing", "integration-testing", "mocking"] },
  reviewer: { icon: "\u{1F50D}", color: "#f59e0b", label: "Reviewer", desk: "Review Desk", scope: "READ-ONLY \u2192 audit", skills: ["code-review", "security-audit", "performance-check"] },
  fullstack: { icon: "\u{1F527}", color: "#6366f1", label: "Fullstack", desk: "Workshop", scope: "all src/", skills: ["react-best-practices", "api-design", "error-handling"] },
  devops: { icon: "\u{1F680}", color: "#14b8a6", label: "DevOps", desk: "Ops Center", scope: ".github/ docker/ config/", skills: ["ci-cd-patterns", "docker-best-practices", "env-management"] },
  security: { icon: "\u{1F6E1}\uFE0F", color: "#ef4444", label: "Security", desk: "Security Vault", scope: "READ + advisory", skills: ["security-audit", "input-validation", "dependency-check"] },
  docs: { icon: "\u{1F4DD}", color: "#8b5cf6", label: "Docs", desk: "Library", scope: "docs/ *.md", skills: ["technical-writing", "api-documentation"] },
  refactorer: { icon: "\u267B\uFE0F", color: "#06b6d4", label: "Refactorer", desk: "Clean Room", scope: "all src/ (no behavior \u0394)", skills: ["refactoring-patterns", "code-quality"] },
};

const ALL_SKILLS = [
  "react-best-practices","api-design","database-ops","auth-patterns","state-management",
  "error-handling","unit-testing","integration-testing","mocking","test-patterns",
  "code-review","security-audit","performance-check","accessibility","css-patterns",
  "ci-cd-patterns","docker-best-practices","env-management","technical-writing",
  "api-documentation","refactoring-patterns","code-quality","dry-principles",
  "analyze-codebase","design-system","define-interfaces","input-validation",
  "dependency-check","task-decomposition","batching","prompt-caching",
];

const PRESET_COMMANDS = [
  { id:"bootstrap", label:"\u{1F3D7}\uFE0F Bootstrap", desc:"Scan repo \u2192 create CLAUDE.md + skills", cat:"setup", prompt:`You are a Setup Agent. Scan this repo, detect the stack, create: CLAUDE.md, .claude/skills/, .claude/templates/. Fill all values. No placeholders. No questions.` },
  { id:"feature", label:"\u2728 New Feature", desc:"Decompose \u2192 Architect \u2192 Build \u2192 Test \u2192 Review", cat:"build", prompt:`Act as Orchestrator. Decompose this feature into subtasks. Architect first, then batch Backend+Frontend parallel, then Tester, then Reviewer. Feature: ` },
  { id:"bug", label:"\u{1F41B} Fix Bug", desc:"Locate \u2192 Diagnose \u2192 Fix \u2192 Test", cat:"build", prompt:`Act as Orchestrator. Diagnostic agent to locate bug, fix agent scoped to affected files, Tester for regression. Bug: ` },
  { id:"refactor", label:"\u267B\uFE0F Refactor", desc:"Analyze \u2192 Plan \u2192 Refactor \u2192 Test", cat:"build", prompt:`Act as Orchestrator. Architect analyzes, Refactorer executes (tests must pass), Reviewer validates. Target: ` },
  { id:"tests", label:"\u{1F9EA} Add Tests", desc:"Coverage analysis \u2192 Generate \u2192 Verify", cat:"quality", prompt:`Act as Orchestrator. Analyze untested paths, batch Tester agents per module. Cover happy+edge+error. Target: ` },
  { id:"security", label:"\u{1F6E1}\uFE0F Security Audit", desc:"Deps \u2192 Auth \u2192 Inputs \u2192 Report", cat:"quality", prompt:`Act as Orchestrator. Security agent: check deps, auth bypass, input validation, secrets, CSRF/XSS. Output severity report.` },
  { id:"review", label:"\u{1F50D} Code Review", desc:"Review recent changes", cat:"quality", prompt:`Act as Orchestrator. git diff HEAD~5, Reviewer on changed files. Output: {severity, file, line, issue, fix}.` },
  { id:"optimize", label:"\u{1F4B0} Token Optimize", desc:"Audit prompts for waste", cat:"optimize", prompt:`Analyze CLAUDE.md and .claude/skills/. Report tokens per agent, find redundancy, rewrite over-budget sections. Target: <1400 tok/agent.` },
  { id:"docs", label:"\u{1F4DD} Gen Docs", desc:"Document APIs + README", cat:"build", prompt:`Act as Orchestrator. Docs agent: scan exports, generate JSDoc/docstrings, update README. Target: ` },
  { id:"deploy", label:"\u{1F680} Deploy Prep", desc:"Lint \u2192 Types \u2192 Test \u2192 Build", cat:"quality", prompt:`Act as Orchestrator. Sequential: lint, typecheck, test, build, audit. Fix failures. Don't proceed until current passes.` },
];

const LOG_MESSAGES: Record<string, string[]> = {
  idle: ["Waiting for assignment...", "Standing by...", "Ready for tasks..."],
  running: [
    "Analyzing file structure...", "Reading dependencies...", "Scanning for patterns...",
    "Compiling module...", "Running type checks...", "Resolving imports...",
    "Building AST...", "Optimizing bundle...", "Checking test coverage...",
    "Validating schema...", "Reviewing changes...", "Writing documentation...",
    "Linting source files...", "Generating fixtures...", "Patching endpoints...",
    "Migrating database...", "Caching prompt prefix...", "Batching API calls...",
    "Spawning sub-process...", "Merging branches...", "Deploying artifacts...",
    "Profiling performance...", "Auditing security...", "Compressing tokens...",
  ],
  done: ["Task complete \u2713", "All checks passed \u2713", "Delivered \u2713"],
  failed: ["Error encountered \u2717", "Tests failing \u2717", "Needs retry \u2717"],
  queued: ["In queue...", "Waiting for dependencies...", "Scheduled..."],
};

const STORAGE_KEY = "orchestrator-state";

interface Agent {
  id: string;
  type: string;
  name: string;
  skills: string[];
  status: string;
  task: string;
  logs: any[];
}

interface Task {
  id: string;
  title: string;
  prompt: string;
  status: string;
  assignedAgent: string | null;
  created: number;
  tokens: number;
}

interface Project {
  id: string;
  name: string;
  stack: string;
  agents: Agent[];
  tasks: Task[];
  tokensSaved: number;
}

const saveState = (state: any) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e) { console.error("Save failed", e); }
};

const loadState = (): any => {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    return r ? JSON.parse(r) : null;
  } catch(e) { return null; }
};

export default function VirtualOffice() {
  const [view, setView] = useState("office");
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState(0);
  const [modal, setModal] = useState<string | null>(null);
  const [agentForm, setAgentForm] = useState({ type:"backend", name:"", skills:[] as string[] });
  const [taskForm, setTaskForm] = useState({ title:"", prompt:"", assignedAgent:null as string|null });
  const [newProjName, setNewProjName] = useState("");
  const [newProjStack, setNewProjStack] = useState("");
  const [cmdSearch, setCmdSearch] = useState("");
  const [cmdCat, setCmdCat] = useState("all");
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, {ts:string;msg:string}[]>>({});
  const [loaded, setLoaded] = useState(false);
  const logTimers = useRef<Record<string, any>>({});

  useEffect(() => {
    const s = loadState();
    if (s && s.projects && s.projects.length) {
      setProjects(s.projects);
      setActiveProject(s.activeProject || 0);
    } else {
      setProjects([{ id:uid(), name:"J.A.R.V.I.S.", stack:"Python + React", agents:[
        { id:uid(), type:"orchestrator", name:"Orchestrator", skills:["task-decomposition","batching","prompt-caching"], status:"running", task:"Coordinating all agents", logs:[] },
      ], tasks:[], tokensSaved:0 }]);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded && projects.length) saveState({ projects, activeProject });
  }, [projects, activeProject, loaded]);

  const proj = projects[activeProject] || projects[0] || { agents:[], tasks:[], name:"", stack:"" };

  const updateProj = useCallback((fn: (p: Project) => Project) => {
    setProjects(p => p.map((pr,i) => i===activeProject ? fn({...pr, agents:[...pr.agents], tasks:[...pr.tasks]}) : pr));
  }, [activeProject]);

  useEffect(() => {
    Object.keys(logTimers.current).forEach(k => clearInterval(logTimers.current[k]));
    logTimers.current = {};
    proj.agents.forEach((a: Agent) => {
      if (a.status === "running") {
        const tick = () => {
          const msgs = LOG_MESSAGES.running;
          const msg = msgs[Math.floor(Math.random()*msgs.length)];
          const ts = new Date().toLocaleTimeString("en-US",{hour12:false,hour:"2-digit",minute:"2-digit",second:"2-digit"});
          setLogs(prev => {
            const arr = prev[a.id] || [];
            return {...prev, [a.id]: [...arr.slice(-14), {ts, msg}]};
          });
        };
        tick();
        logTimers.current[a.id] = setInterval(tick, 1800 + Math.random()*2400);
      }
    });
    return () => Object.keys(logTimers.current).forEach(k => clearInterval(logTimers.current[k]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proj.agents.map((a: Agent)=>a.id+a.status).join(",")]);

  const copy = (txt: string, id: string) => {
    navigator.clipboard.writeText(txt).catch(()=>{});
    setCopyMsg(id);
    setTimeout(()=>setCopyMsg(null), 2000);
  };

  const addAgent = () => {
    const t = AGENT_TYPES[agentForm.type];
    const a: Agent = { id:uid(), type:agentForm.type, name:agentForm.name||t.label, skills:agentForm.skills.length?agentForm.skills:[...t.skills], status:"idle", task:"", logs:[] };
    updateProj(p => { p.agents.push(a); return p; });
    setAgentForm({ type:"backend", name:"", skills:[] });
    setModal(null);
  };

  const addTask = () => {
    const t: Task = { id:uid(), title:taskForm.title, prompt:taskForm.prompt, status:"queued", assignedAgent:taskForm.assignedAgent, created:Date.now(), tokens:Math.round(taskForm.prompt.length*0.35) };
    updateProj(p => { p.tasks.push(t); return p; });
    if (taskForm.assignedAgent) {
      updateProj(p => {
        p.agents = p.agents.map(a => a.id===taskForm.assignedAgent ? {...a, status:"running", task:taskForm.title} : a);
        p.tasks = p.tasks.map(tk => tk.id===t.id ? {...tk, status:"running"} : tk);
        return p;
      });
    }
    setTaskForm({ title:"", prompt:"", assignedAgent:null });
    setModal(null);
  };

  const toggleStatus = (agentId: string) => {
    const order = ["idle","running","done","failed","idle"];
    updateProj(p => {
      p.agents = p.agents.map(a => {
        if (a.id!==agentId) return a;
        const next = order[order.indexOf(a.status)+1]||"idle";
        if (next!=="running") {
          setLogs(prev => {
            const arr = prev[a.id]||[];
            const ts = new Date().toLocaleTimeString("en-US",{hour12:false,hour:"2-digit",minute:"2-digit",second:"2-digit"});
            const msgs = LOG_MESSAGES[next];
            return {...prev, [a.id]: [...arr.slice(-14), {ts, msg:msgs[Math.floor(Math.random()*msgs.length)]}]};
          });
        }
        return {...a, status:next};
      });
      return p;
    });
  };

  const removeAgent = (id: string) => updateProj(p => { p.agents=p.agents.filter(a=>a.id!==id); return p; });
  const removeTask = (id: string) => updateProj(p => { p.tasks=p.tasks.filter(t=>t.id!==id); return p; });
  const cycleTask = (id: string) => {
    const order = ["queued","running","done","failed","queued"];
    updateProj(p => { p.tasks=p.tasks.map(t=>t.id===id?{...t,status:order[order.indexOf(t.status)+1]||"queued"}:t); return p; });
  };

  const usePreset = (p: typeof PRESET_COMMANDS[0]) => {
    setTaskForm({ title:p.label.replace(/^[^\s]+\s/,""), prompt:p.prompt, assignedAgent:null });
    setModal("task");
  };

  const addProject = () => {
    if(!newProjName.trim()) return;
    setProjects(p=>[...p, {id:uid(), name:newProjName, stack:newProjStack||"Not set", agents:[], tasks:[], tokensSaved:0}]);
    setActiveProject(projects.length);
    setNewProjName(""); setNewProjStack(""); setModal(null);
  };

  const totalTok = proj.tasks.reduce((s: number,t: Task)=>s+(t.tokens||0),0);
  const cacheSave = Math.round(totalTok*0.7);
  const STATUS_C: Record<string,string> = { idle:"#6b7280", running:"#3b82f6", done:"#10b981", failed:"#ef4444", queued:"#f59e0b" };
  const filtCmds = PRESET_COMMANDS.filter(c => (cmdCat==="all"||c.cat===cmdCat) && (!cmdSearch || c.label.toLowerCase().includes(cmdSearch.toLowerCase())));

  const dark = "#080810", panel = "#0d0d1a", card = "#111122", border = "#1a1a33", borderLight = "#252545";
  const S = {
    app: { fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", background:dark, color:"#e2e8f0", minHeight:"100vh" } as React.CSSProperties,
    header: { background:panel, borderBottom:`1px solid ${border}`, padding:"10px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap" as const, gap:8 } as React.CSSProperties,
    logo: { fontSize:18, fontWeight:800, background:"linear-gradient(135deg,#818cf8,#c084fc,#f472b6)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" } as React.CSSProperties,
    tabs: { display:"flex", gap:2, background:"#0a0a18", borderRadius:8, padding:3 } as React.CSSProperties,
    tab: (a: boolean): React.CSSProperties => ({ padding:"6px 14px", borderRadius:6, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, background:a?"#252545":"transparent", color:a?"#fff":"#64748b" }),
    projTab: (a: boolean): React.CSSProperties => ({ padding:"4px 12px", borderRadius:6, border:a?`1px solid #6366f1`:`1px solid ${border}`, background:a?"#6366f120":"transparent", color:a?"#a5b4fc":"#64748b", cursor:"pointer", fontSize:11, fontWeight:500 }),
    btn: (c="#6366f1"): React.CSSProperties => ({ padding:"7px 14px", borderRadius:7, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, background:c, color:"#fff" }),
    btnSm: (c="#6366f1"): React.CSSProperties => ({ padding:"3px 9px", borderRadius:5, border:"none", cursor:"pointer", fontSize:10, fontWeight:600, background:c+"30", color:c }),
    btnGhost: { padding:"3px 8px", borderRadius:5, border:`1px solid ${border}`, background:"transparent", color:"#64748b", cursor:"pointer", fontSize:11 } as React.CSSProperties,
    input: { width:"100%", padding:"9px 11px", borderRadius:7, border:`1px solid ${border}`, background:panel, color:"#e2e8f0", fontSize:12, outline:"none", boxSizing:"border-box" as const } as React.CSSProperties,
    textarea: { width:"100%", padding:"9px 11px", borderRadius:7, border:`1px solid ${border}`, background:panel, color:"#e2e8f0", fontSize:11, fontFamily:"'SF Mono',Monaco,monospace", outline:"none", boxSizing:"border-box" as const, resize:"vertical" as const, minHeight:80 } as React.CSSProperties,
    select: { padding:"9px 11px", borderRadius:7, border:`1px solid ${border}`, background:panel, color:"#e2e8f0", fontSize:12, outline:"none", cursor:"pointer", width:"100%" } as React.CSSProperties,
    modal: { position:"fixed" as const, inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:16 } as React.CSSProperties,
    modalBox: { background:card, border:`1px solid ${borderLight}`, borderRadius:14, padding:20, maxWidth:520, width:"100%", maxHeight:"85vh", overflowY:"auto" as const } as React.CSSProperties,
    badge: (c: string): React.CSSProperties => ({ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px", borderRadius:12, fontSize:10, fontWeight:600, background:c+"18", color:c, border:`1px solid ${c}30`, cursor:"pointer" }),
    skill: (a: boolean): React.CSSProperties => ({ padding:"2px 7px", borderRadius:4, fontSize:9, fontWeight:500, cursor:"pointer", border:a?`1px solid #818cf8`:`1px solid ${border}`, background:a?"#818cf815":"transparent", color:a?"#a5b4fc":"#475569", whiteSpace:"nowrap" as const }),
    dot: (c: string): React.CSSProperties => ({ width:7, height:7, borderRadius:"50%", background:c, boxShadow:`0 0 6px ${c}80`, display:"inline-block" }),
  };

  const renderOffice = () => {
    const agents = proj.agents;
    const running = agents.filter((a: Agent)=>a.status==="running").length;
    const done = agents.filter((a: Agent)=>a.status==="done").length;

    return (
      <div style={{ padding:"16px 20px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))", gap:8, marginBottom:16 }}>
          {[
            {n:agents.length,l:"Agents",c:"#818cf8"},{n:running,l:"Active",c:"#3b82f6"},
            {n:done,l:"Done",c:"#10b981"},{n:proj.tasks.length,l:"Tasks",c:"#f59e0b"},
            {n:`${(totalTok/1000).toFixed(1)}k`,l:"Tokens",c:"#ef4444"},{n:`${(cacheSave/1000).toFixed(1)}k`,l:"Saved",c:"#10b981"},
          ].map((s,i) => (
            <div key={i} style={{ background:card, border:`1px solid ${border}`, borderRadius:10, padding:"12px 8px", textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:700, color:s.c, letterSpacing:-1 }}>{s.n}</div>
              <div style={{ fontSize:9, color:"#475569", textTransform:"uppercase", letterSpacing:1, marginTop:2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"#94a3b8" }}>{"\u{1F3E2}"} Virtual Office — {proj.name}</div>
          <div style={{ display:"flex", gap:6 }}>
            <button style={S.btn("#f59e0b")} onClick={()=>setView("commands")}>{"\u26A1"} Commands</button>
            <button style={S.btn()} onClick={()=>setModal("agent")}>+ Spawn Agent</button>
          </div>
        </div>

        {agents.length === 0 ? (
          <div style={{ textAlign:"center", padding:60, color:"#374151" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>{"\u{1F3D7}\uFE0F"}</div>
            <div style={{ fontSize:14 }}>Office is empty. Spawn your first agent!</div>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:12 }}>
            {agents.map((a: Agent) => {
              const t = AGENT_TYPES[a.type] || AGENT_TYPES.backend;
              const isRunning = a.status === "running";
              const agentLogs = logs[a.id] || [];
              const borderGlow = isRunning ? `1px solid ${t.color}50` : `1px solid ${border}`;
              const shadowGlow = isRunning ? `0 0 20px ${t.color}15, inset 0 1px 0 ${t.color}10` : "none";

              return (
                <div key={a.id} style={{ background:card, border:borderGlow, borderRadius:12, overflow:"hidden", boxShadow:shadowGlow, transition:"all 0.4s" }}>
                  <div style={{ background:`linear-gradient(135deg, ${t.color}15, ${t.color}05)`, borderBottom:`1px solid ${t.color}20`, padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ fontSize:24, filter:isRunning?"none":"grayscale(0.5)", transition:"filter 0.3s" }}>{t.icon}</div>
                      <div>
                        <div style={{ fontWeight:700, fontSize:13, color:"#e2e8f0" }}>{a.name}</div>
                        <div style={{ fontSize:10, color:t.color, fontWeight:600, opacity:0.8 }}>{t.desk}</div>
                      </div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={S.badge(STATUS_C[a.status])} onClick={()=>toggleStatus(a.id)}>
                        <span style={S.dot(STATUS_C[a.status])} />{a.status}
                      </span>
                      <button onClick={()=>removeAgent(a.id)} style={{ background:"transparent", border:"none", color:"#374151", cursor:"pointer", fontSize:16, padding:0, lineHeight:1 }}>{"\u00D7"}</button>
                    </div>
                  </div>

                  {a.task && (
                    <div style={{ padding:"6px 14px", background:`${t.color}08`, borderBottom:`1px solid ${border}`, fontSize:11, color:"#94a3b8" }}>
                      {"\u{1F4CB}"} <span style={{ color:"#cbd5e1" }}>{a.task}</span>
                    </div>
                  )}

                  <div style={{ padding:"8px 10px", height:145, overflowY:"auto", fontFamily:"'SF Mono',Monaco,'Fira Code',monospace", fontSize:10, lineHeight:1.7, background:"#08080f" }}>
                    {isRunning && agentLogs.length > 0 ? (
                      agentLogs.map((l,i) => (
                        <div key={i} style={{ color: i===agentLogs.length-1 ? t.color : "#4a5568" }}>
                          <span style={{ color:"#2d3748" }}>[{l.ts}]</span> {l.msg}
                          {i===agentLogs.length-1 && <span style={{ animation:"blink 1s infinite", color:t.color }}> {"\u2588"}</span>}
                        </div>
                      ))
                    ) : a.status === "done" ? (
                      <div style={{ color:"#10b981" }}>
                        <span style={{ color:"#2d3748" }}>[{new Date().toLocaleTimeString("en-US",{hour12:false,hour:"2-digit",minute:"2-digit",second:"2-digit"})}]</span> All tasks completed {"\u2713"}
                      </div>
                    ) : a.status === "failed" ? (
                      <div style={{ color:"#ef4444" }}>
                        <span style={{ color:"#2d3748" }}>[{new Date().toLocaleTimeString("en-US",{hour12:false,hour:"2-digit",minute:"2-digit",second:"2-digit"})}]</span> Error — needs retry {"\u2717"}
                      </div>
                    ) : (
                      <div style={{ color:"#2d3748", fontStyle:"italic" }}>Awaiting assignment...</div>
                    )}
                  </div>

                  <div style={{ padding:"8px 10px", borderTop:`1px solid ${border}`, display:"flex", flexWrap:"wrap", gap:3 }}>
                    {a.skills.map(sk => <span key={sk} style={S.skill(true)}>{sk}</span>)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ fontSize:13, fontWeight:600, color:"#94a3b8" }}>{"\u{1F4CB}"} Task Queue</div>
            <button style={S.btn()} onClick={()=>setModal("task")}>+ Task</button>
          </div>
          {proj.tasks.length === 0 ? (
            <div style={{ background:card, border:`1px solid ${border}`, borderRadius:10, padding:24, textAlign:"center", color:"#374151", fontSize:12 }}>No tasks yet — use a preset command or create one</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {proj.tasks.map((tk: Task) => (
                <div key={tk.id} style={{ background:card, border:`1px solid ${border}`, borderRadius:8, padding:"10px 14px", display:"flex", alignItems:"center", gap:10 }}>
                  <span style={S.badge(STATUS_C[tk.status])} onClick={()=>cycleTask(tk.id)}>
                    <span style={S.dot(STATUS_C[tk.status])} />{tk.status}
                  </span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:12 }}>{tk.title}</div>
                    {tk.assignedAgent && <div style={{ fontSize:10, color:"#475569" }}>{"\u2192"} {proj.agents.find((a: Agent)=>a.id===tk.assignedAgent)?.name || "Unassigned"}</div>}
                  </div>
                  {tk.tokens>0 && <span style={{ fontSize:9, color:"#475569" }}>~{tk.tokens}tok</span>}
                  <button style={{...(copyMsg===`t-${tk.id}`?{color:"#10b981"}:{}), ...S.btnGhost}} onClick={()=>copy(tk.prompt,`t-${tk.id}`)}>
                    {copyMsg===`t-${tk.id}` ? "\u2713" : "Copy"}
                  </button>
                  <button onClick={()=>removeTask(tk.id)} style={{...S.btnGhost, color:"#374151"}}>{"\u00D7"}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCommands = () => (
    <div style={{ padding:"16px 20px" }}>
      <div style={{ marginBottom:12 }}>
        <input style={S.input} placeholder="Search commands..." value={cmdSearch} onChange={e=>setCmdSearch(e.target.value)} />
      </div>
      <div style={{ display:"flex", gap:4, marginBottom:14, flexWrap:"wrap" }}>
        {["all","setup","build","quality","optimize"].map(c=>(
          <button key={c} style={S.projTab(cmdCat===c)} onClick={()=>setCmdCat(c)}>
            {c==="all"?"All":c[0].toUpperCase()+c.slice(1)}
          </button>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:10 }}>
        {filtCmds.map(cmd=>(
          <div key={cmd.id} style={{ background:card, border:`1px solid ${border}`, borderRadius:10, padding:14 }}>
            <div style={{ fontSize:14, fontWeight:600, marginBottom:3 }}>{cmd.label}</div>
            <div style={{ fontSize:11, color:"#64748b", marginBottom:10 }}>{cmd.desc}</div>
            <div style={{ display:"flex", gap:6 }}>
              <button style={S.btn()} onClick={()=>usePreset(cmd)}>Use</button>
              <button style={{...(copyMsg===`c-${cmd.id}`?{color:"#10b981"}:{}), ...S.btnGhost}} onClick={()=>copy(cmd.prompt,`c-${cmd.id}`)}>
                {copyMsg===`c-${cmd.id}` ? "\u2713 Copied" : "Copy"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSkills = () => (
    <div style={{ padding:"16px 20px" }}>
      <div style={{ fontSize:13, fontWeight:600, color:"#94a3b8", marginBottom:10 }}>Skills by Agent Type</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:10 }}>
        {Object.entries(AGENT_TYPES).map(([k,v])=>(
          <div key={k} style={{ background:card, border:`1px solid ${border}`, borderRadius:10, padding:14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
              <span style={{ fontSize:20 }}>{v.icon}</span>
              <div>
                <div style={{ fontWeight:600, fontSize:13 }}>{v.label}</div>
                <div style={{ fontSize:10, color:v.color }}>{v.desk}</div>
              </div>
            </div>
            <div style={{ fontSize:10, color:"#475569", marginBottom:6 }}>{v.scope}</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>
              {v.skills.map(sk=><span key={sk} style={S.skill(true)}>{sk}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderExport = () => {
    const json = JSON.stringify({ project:proj.name, stack:proj.stack, agents:proj.agents.map((a: Agent)=>({type:a.type,name:a.name,skills:a.skills,status:a.status})), tasks:proj.tasks.map((t: Task)=>({title:t.title,status:t.status})), tokens:totalTok, saved:cacheSave }, null, 2);
    const md = `# ${proj.name} \u2014 Orchestrator\nStack: ${proj.stack}\n\n## Agents\n${proj.agents.map((a: Agent)=>`- ${AGENT_TYPES[a.type]?.icon} **${a.name}** (${a.type}) \u2014 ${a.skills.join(", ")}`).join("\n")}\n\n## Tasks\n${proj.tasks.map((t: Task)=>`- [${t.status}] ${t.title}`).join("\n")}`;
    return (
      <div style={{ padding:"16px 20px" }}>
        <div style={{ background:card, border:`1px solid ${border}`, borderRadius:10, padding:14, marginBottom:12 }}>
          <div style={{ fontWeight:600, marginBottom:6, fontSize:13 }}>JSON Config</div>
          <pre style={{ ...S.textarea, minHeight:160, whiteSpace:"pre-wrap" }}>{json}</pre>
          <button style={{...S.btn(), marginTop:8}} onClick={()=>copy(json,"json")}>{copyMsg==="json"?"\u2713 Copied":"Copy JSON"}</button>
        </div>
        <div style={{ background:card, border:`1px solid ${border}`, borderRadius:10, padding:14 }}>
          <div style={{ fontWeight:600, marginBottom:6, fontSize:13 }}>CLAUDE.md</div>
          <pre style={{ ...S.textarea, minHeight:160, whiteSpace:"pre-wrap" }}>{md}</pre>
          <button style={{...S.btn("#10b981"), marginTop:8}} onClick={()=>copy(md,"md")}>{copyMsg==="md"?"\u2713 Copied":"Copy CLAUDE.md"}</button>
        </div>
      </div>
    );
  };

  if (!loaded) return <div style={{ ...S.app, display:"flex", alignItems:"center", justifyContent:"center" }}><div style={{ color:"#475569" }}>Loading...</div></div>;

  return (
    <div style={S.app}>
      <div style={S.header}>
        <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
          <div style={S.logo}>{"\u26A1"} Agent Orchestrator</div>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {projects.map((p,i)=>(
              <button key={p.id} style={S.projTab(i===activeProject)} onClick={()=>setActiveProject(i)}>{p.name}</button>
            ))}
            <button style={S.btnGhost} onClick={()=>setModal("project")}>+</button>
          </div>
        </div>
        <div style={S.tabs}>
          {[{id:"office",l:"\u{1F3E2} Office"},{id:"projects",l:"\u{1F4C2} Projects"},{id:"commands",l:"\u26A1 Commands"},{id:"skills",l:"\u{1F3AF} Skills"},{id:"export",l:"\u{1F4E6} Export"}].map(t=>(
            <button key={t.id} style={S.tab(view===t.id)} onClick={()=>setView(t.id)}>{t.l}</button>
          ))}
        </div>
      </div>

      {view==="office" && renderOffice()}
      {view==="projects" && <Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#475569"}}>Loading...</div>}><ProjectManager /></Suspense>}
      {view==="commands" && renderCommands()}
      {view==="skills" && renderSkills()}
      {view==="export" && renderExport()}

      {modal && (
        <div style={S.modal} onClick={(e: React.MouseEvent)=>e.target===e.currentTarget&&setModal(null)}>
          <div style={S.modalBox}>
            {modal==="agent" && (<>
              <div style={{ fontSize:16, fontWeight:700, marginBottom:14 }}>Spawn Agent</div>
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:11, color:"#64748b", marginBottom:3 }}>Type</div>
                <select style={S.select} value={agentForm.type} onChange={e=>{
                  const tp=e.target.value;
                  setAgentForm({type:tp, name:"", skills:[...AGENT_TYPES[tp].skills]});
                }}>
                  {Object.entries(AGENT_TYPES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label} — {v.desk}</option>)}
                </select>
              </div>
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:11, color:"#64748b", marginBottom:3 }}>Name</div>
                <input style={S.input} placeholder={AGENT_TYPES[agentForm.type].label} value={agentForm.name} onChange={e=>setAgentForm(f=>({...f,name:e.target.value}))} />
              </div>
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:11, color:"#64748b", marginBottom:3 }}>Scope</div>
                <div style={{ fontSize:11, color:"#475569", padding:8, background:panel, borderRadius:6 }}>{AGENT_TYPES[agentForm.type].scope}</div>
              </div>
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:"#64748b", marginBottom:3 }}>Skills (tap to toggle)</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>
                  {ALL_SKILLS.map(sk=>(
                    <span key={sk} style={S.skill(agentForm.skills.includes(sk))} onClick={()=>{
                      setAgentForm(f=>({...f, skills:f.skills.includes(sk)?f.skills.filter(s=>s!==sk):[...f.skills,sk]}));
                    }}>{sk}</span>
                  ))}
                </div>
              </div>
              <div style={{ display:"flex", gap:6, justifyContent:"flex-end" }}>
                <button style={S.btnGhost} onClick={()=>setModal(null)}>Cancel</button>
                <button style={S.btn()} onClick={addAgent}>Spawn</button>
              </div>
            </>)}
            {modal==="task" && (<>
              <div style={{ fontSize:16, fontWeight:700, marginBottom:14 }}>Create Task</div>
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:11, color:"#64748b", marginBottom:3 }}>Title</div>
                <input style={S.input} placeholder="e.g. Add user auth" value={taskForm.title} onChange={e=>setTaskForm(f=>({...f,title:e.target.value}))} />
              </div>
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:11, color:"#64748b", marginBottom:3 }}>Assign to Agent</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                  <span style={S.skill(!taskForm.assignedAgent)} onClick={()=>setTaskForm(f=>({...f,assignedAgent:null}))}>Auto (Orchestrator)</span>
                  {proj.agents.map((a: Agent)=>(
                    <span key={a.id} style={S.skill(taskForm.assignedAgent===a.id)} onClick={()=>setTaskForm(f=>({...f,assignedAgent:a.id}))}>
                      {AGENT_TYPES[a.type]?.icon} {a.name}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:"#64748b", marginBottom:3 }}>Prompt</div>
                <textarea style={S.textarea} rows={5} value={taskForm.prompt} onChange={e=>setTaskForm(f=>({...f,prompt:e.target.value}))} placeholder="Paste or write the prompt for Claude Code..." />
                {taskForm.prompt && <div style={{ fontSize:9, color:"#374151", marginTop:2 }}>~{Math.round(taskForm.prompt.length*0.35)} tokens</div>}
              </div>
              <div style={{ display:"flex", gap:6, justifyContent:"flex-end" }}>
                <button style={S.btnGhost} onClick={()=>setModal(null)}>Cancel</button>
                <button style={S.btn()} onClick={addTask}>Create</button>
              </div>
            </>)}
            {modal==="project" && (<>
              <div style={{ fontSize:16, fontWeight:700, marginBottom:14 }}>New Project</div>
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:11, color:"#64748b", marginBottom:3 }}>Name</div>
                <input style={S.input} value={newProjName} onChange={e=>setNewProjName(e.target.value)} placeholder="e.g. J.A.R.V.I.S." />
              </div>
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:"#64748b", marginBottom:3 }}>Stack</div>
                <input style={S.input} value={newProjStack} onChange={e=>setNewProjStack(e.target.value)} placeholder="e.g. Python + React" />
              </div>
              <div style={{ display:"flex", gap:6, justifyContent:"flex-end" }}>
                <button style={S.btnGhost} onClick={()=>setModal(null)}>Cancel</button>
                <button style={S.btn()} onClick={addProject}>Create</button>
              </div>
            </>)}
          </div>
        </div>
      )}
    </div>
  );
}
