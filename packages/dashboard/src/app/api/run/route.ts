import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { existsSync } from "fs";

export async function POST(req: Request) {
  try {
    const { command, cwd, timeout = 60000 } = await req.json();

    if (!command) {
      return NextResponse.json({ error: "No command provided" }, { status: 400 });
    }

    if (cwd && !existsSync(cwd)) {
      return NextResponse.json({ error: `Path not found: ${cwd}` }, { status: 400 });
    }

    const output = execSync(command, {
      cwd: cwd || process.cwd(),
      encoding: "utf-8",
      timeout,
      maxBuffer: 1024 * 1024 * 10,
    });

    return NextResponse.json({ output, success: true });
  } catch (e: any) {
    return NextResponse.json({
      output: e.stdout || e.stderr || e.message,
      success: false,
      exitCode: e.status,
    });
  }
}
