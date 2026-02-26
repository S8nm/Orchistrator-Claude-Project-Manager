import { NextResponse } from "next/server";
import { loadPresets, savePreset, deletePreset } from "@/lib/persistence";
import { AgentPresetSchema } from "@orchestrator/shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const presets = loadPresets();
  return NextResponse.json({ presets });
}

export async function POST(req: Request) {
  try {
    const { action, preset, id } = await req.json();

    if (action === "delete") {
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const deleted = deletePreset(id);
      return NextResponse.json({ success: deleted });
    }

    if (action === "save") {
      const parsed = AgentPresetSchema.safeParse(preset);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.message }, { status: 400 });
      }
      savePreset(parsed.data);
      return NextResponse.json({ success: true, preset: parsed.data });
    }

    return NextResponse.json({ error: "Unknown action. Use 'save' or 'delete'" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
