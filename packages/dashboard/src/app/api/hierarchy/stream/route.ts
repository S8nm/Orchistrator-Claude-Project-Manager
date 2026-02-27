import { getHierarchyManager } from "@/lib/hierarchy/manager";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");

  if (!projectId) {
    return new Response("Missing projectId parameter", { status: 400 });
  }

  const mgr = getHierarchyManager(projectId);
  if (!mgr) {
    return new Response("No hierarchy for project", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch { /* stream closed */ }
      };

      // Send initial status
      send("status", mgr.getStatus());

      const onEvent = (evt: { type: string; data: unknown }) => {
        send(evt.type, evt.data);
      };

      mgr.emitter.on("event", onEvent);

      const cleanup = () => {
        mgr.emitter.off("event", onEvent);
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
