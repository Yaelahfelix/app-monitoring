import { getSql } from "./db";

export type Severity = "critical" | "high" | "moderate" | "low";

export interface IngestVulnerability {
  packageName: string;
  severity: Severity;
  title?: string;
  installedVersion?: string;
  vulnerableRange?: string;
  fixedVersion?: string;
  isDirect?: boolean;
  url?: string;
}

export interface IngestOutdatedPackage {
  packageName: string;
  currentVersion?: string;
  wantedVersion?: string;
  latestVersion?: string;
}

export interface IngestPayload {
  client: string;
  repo: string;
  githubUrl?: string;
  branch?: string;
  commitSha?: string;
  tool: string;
  workflowRunUrl?: string;
  vulnerabilities: IngestVulnerability[];
  outdatedPackages: IngestOutdatedPackage[];
}

export async function recordScan(payload: IngestPayload) {
  const sql = getSql();

  const [repo] = (await sql`
    INSERT INTO repos (client, name, github_url)
    VALUES (${payload.client}, ${payload.repo}, ${payload.githubUrl ?? null})
    ON CONFLICT (client, name) DO UPDATE SET github_url = EXCLUDED.github_url
    RETURNING id
  `) as { id: number }[];

  const counts = { critical: 0, high: 0, moderate: 0, low: 0 };
  for (const v of payload.vulnerabilities) counts[v.severity]++;

  const [scan] = (await sql`
    INSERT INTO scans (
      repo_id, branch, commit_sha, tool, workflow_run_url,
      critical_count, high_count, moderate_count, low_count, outdated_count
    ) VALUES (
      ${repo.id}, ${payload.branch ?? null}, ${payload.commitSha ?? null},
      ${payload.tool}, ${payload.workflowRunUrl ?? null},
      ${counts.critical}, ${counts.high}, ${counts.moderate}, ${counts.low},
      ${payload.outdatedPackages.length}
    )
    RETURNING id
  `) as { id: number }[];

  const inserts = [
    ...payload.vulnerabilities.map(
      (v) => sql`
        INSERT INTO vulnerabilities (
          scan_id, package_name, severity, title, installed_version,
          vulnerable_range, fixed_version, is_direct, url
        ) VALUES (
          ${scan.id}, ${v.packageName}, ${v.severity}, ${v.title ?? null},
          ${v.installedVersion ?? null}, ${v.vulnerableRange ?? null},
          ${v.fixedVersion ?? null}, ${v.isDirect ?? false}, ${v.url ?? null}
        )
      `
    ),
    ...payload.outdatedPackages.map(
      (o) => sql`
        INSERT INTO outdated_packages (
          scan_id, package_name, current_version, wanted_version, latest_version
        ) VALUES (
          ${scan.id}, ${o.packageName}, ${o.currentVersion ?? null},
          ${o.wantedVersion ?? null}, ${o.latestVersion ?? null}
        )
      `
    ),
  ];

  if (inserts.length > 0) {
    await sql.transaction(inserts);
  }

  return { repoId: repo.id as number, scanId: scan.id as number };
}

export async function listReposWithLatestScan() {
  const sql = getSql();
  return await sql`
    SELECT
      r.id, r.client, r.name, r.github_url,
      s.id AS scan_id, s.scanned_at, s.branch, s.commit_sha, s.tool, s.workflow_run_url,
      s.critical_count, s.high_count, s.moderate_count, s.low_count, s.outdated_count
    FROM repos r
    LEFT JOIN LATERAL (
      SELECT * FROM scans WHERE repo_id = r.id ORDER BY scanned_at DESC LIMIT 1
    ) s ON true
    ORDER BY (
      COALESCE(s.critical_count, 0) * 1000 +
      COALESCE(s.high_count, 0) * 100 +
      COALESCE(s.moderate_count, 0) * 10 +
      COALESCE(s.low_count, 0)
    ) DESC,
    r.client, r.name
  `;
}

export async function getRepoById(id: number) {
  const sql = getSql();
  const rows = (await sql`SELECT * FROM repos WHERE id = ${id}`) as {
    id: number;
    client: string;
    name: string;
    github_url: string | null;
  }[];
  return rows[0];
}

export async function listScansForRepo(repoId: number) {
  const sql = getSql();
  return await sql`
    SELECT * FROM scans WHERE repo_id = ${repoId} ORDER BY scanned_at DESC
  `;
}

export async function getScanDetail(scanId: number) {
  const sql = getSql();
  const [scanRows, vulnerabilities, outdatedPackages] = await Promise.all([
    sql`SELECT * FROM scans WHERE id = ${scanId}`,
    sql`
      SELECT * FROM vulnerabilities WHERE scan_id = ${scanId}
      ORDER BY CASE severity
        WHEN 'critical' THEN 0
        WHEN 'high' THEN 1
        WHEN 'moderate' THEN 2
        ELSE 3
      END, package_name
    `,
    sql`SELECT * FROM outdated_packages WHERE scan_id = ${scanId} ORDER BY package_name`,
  ]);
  return { scan: scanRows[0], vulnerabilities, outdatedPackages };
}
