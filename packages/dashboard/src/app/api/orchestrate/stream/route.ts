import { getOrchestratorLoop } from "@/lib/orchestrator";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response("Missing id parameter", { status: 400 });
  }

  const loop = getOrchestratorLoop(id);
  if (!loop) {
    return new Response("Orchestration not found", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send("plan_ready", { plan: loop.plan });

      const onTaskStarted = (data: any) => send("task_started", data);
      const onTaskDone = (data: any) => send("task_done", data);
      const onTaskFailed = (data: any) => send("task_failed", data);
      const onDone = (data: any) => {
        send("orchestration_done", data);
        cleanup();
        controller.close();
      };

      loop.emitter.on("task_started", onTaskStarted);
      loop.emitter.on("task_done", onTaskDone);
      loop.emitter.on("task_failed", onTaskFailed);
      loop.emitter.on("orchestration_done", onDone);

      const cleanup = () => {
        loop.emitter.off("task_started", onTaskStarted);
        loop.emitter.off("task_done", onTaskDone);
        loop.emitter.off("task_failed", onTaskFailed);
        loop.emitter.off("orchestration_done", onDone);
      };

      req.signal.addEventListener("abort", () => {
        cleanup();
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
