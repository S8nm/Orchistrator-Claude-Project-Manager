import { NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const REGISTRY_PATH = resolve(process.cwd(), "../../projects.json");

export async function GET() {
  try {
    const raw = readFileSync(REGISTRY_PATH, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const raw = readFileSync(REGISTRY_PATH, "utf-8");
    const data = JSON.parse(raw);

    if (body.action === "add") {
      if (data.projects.some((p: any) => p.id === body.project.id)) {
        return NextResponse.json({ error: "Project already exists" }, { status: 400 });
      }
      data.projects.push(body.project);
    } else if (body.action === "remove") {
      data.projects = data.projects.filter((p: any) => p.id !== body.id);
    } else if (body.action === "update") {
      data.projects = data.projects.map((p: any) => p.id === body.project.id ? { ...p, ...body.project } : p);
    }

    writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2));
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
