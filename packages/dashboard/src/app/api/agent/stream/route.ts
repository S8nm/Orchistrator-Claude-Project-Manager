import { getAgent } from "@/lib/agent-executor";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response("Missing id parameter", { status: 400 });
  }

  const agent = getAgent(id);
  if (!agent) {
    return new Response("Agent not found", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: string) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      // Send initial status
      send("status", agent.status);

      // If already finished, send exit and close
      if (agent.status !== "running") {
        send("exit", JSON.stringify({ code: agent.exitCode, status: agent.status }));
        controller.close();
        return;
      }

      const onStdout = (data: string) => send("stdout", data);
      const onStderr = (data: string) => send("stderr", data);
      const onExit = (info: { code: number | null; status: string }) => {
        send("exit", JSON.stringify(info));
        cleanup();
        controller.close();
      };

      agent.emitter.on("stdout", onStdout);
      agent.emitter.on("stderr", onStderr);
      agent.emitter.on("exit", onExit);

      const cleanup = () => {
        agent.emitter.off("stdout", onStdout);
        agent.emitter.off("stderr", onStderr);
        agent.emitter.off("exit", onExit);
      };

      // Handle client disconnect
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
