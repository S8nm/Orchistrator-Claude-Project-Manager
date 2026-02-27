import { OperaManager } from "@/lib/hierarchy/opera";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const opera = OperaManager.getInstance();
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
      send("status", opera.getStatus());

      const onEvent = (evt: { type: string; data: unknown }) => {
        send(evt.type, evt.data);
      };

      opera.emitter.on("event", onEvent);

      req.signal.addEventListener("abort", () => {
        opera.emitter.off("event", onEvent);
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
