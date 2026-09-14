import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordScan } from "@/lib/queries";

const vulnerabilitySchema = z.object({
  packageName: z.string(),
  severity: z.enum(["critical", "high", "moderate", "low"]),
  title: z.string().optional(),
  installedVersion: z.string().optional(),
  vulnerableRange: z.string().optional(),
  fixedVersion: z.string().optional(),
  isDirect: z.boolean().optional(),
  url: z.string().optional(),
});

const outdatedPackageSchema = z.object({
  packageName: z.string(),
  currentVersion: z.string().optional(),
  wantedVersion: z.string().optional(),
  latestVersion: z.string().optional(),
});

const ingestSchema = z.object({
  client: z.string().min(1),
  repo: z.string().min(1),
  githubUrl: z.string().url().optional(),
  branch: z.string().optional(),
  commitSha: z.string().optional(),
  tool: z.string().min(1),
  workflowRunUrl: z.string().url().optional(),
  vulnerabilities: z.array(vulnerabilitySchema).default([]),
  outdatedPackages: z.array(outdatedPackageSchema).default([]),
});

function isAuthorized(req: NextRequest) {
  const expected = process.env.INGEST_TOKEN;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  return token === expected;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = ingestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const result = await recordScan(parsed.data);
  return NextResponse.json({ ok: true, ...result }, { status: 201 });
}
