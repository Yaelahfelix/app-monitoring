#!/usr/bin/env node
// One-off schema setup/migration. Run after provisioning the Postgres
// database (e.g. `vercel integration add neon`) and pulling DATABASE_URL:
//   node --env-file=.env.local scripts/migrate.mjs
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(url);

const statements = [
  `CREATE TABLE IF NOT EXISTS repos (
    id SERIAL PRIMARY KEY,
    client TEXT NOT NULL,
    name TEXT NOT NULL,
    github_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (client, name)
  )`,
  `CREATE TABLE IF NOT EXISTS scans (
    id SERIAL PRIMARY KEY,
    repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
    branch TEXT,
    commit_sha TEXT,
    tool TEXT NOT NULL,
    workflow_run_url TEXT,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    critical_count INTEGER NOT NULL DEFAULT 0,
    high_count INTEGER NOT NULL DEFAULT 0,
    moderate_count INTEGER NOT NULL DEFAULT 0,
    low_count INTEGER NOT NULL DEFAULT 0,
    outdated_count INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS vulnerabilities (
    id SERIAL PRIMARY KEY,
    scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    package_name TEXT NOT NULL,
    severity TEXT NOT NULL,
    title TEXT,
    installed_version TEXT,
    vulnerable_range TEXT,
    fixed_version TEXT,
    is_direct BOOLEAN NOT NULL DEFAULT false,
    url TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS outdated_packages (
    id SERIAL PRIMARY KEY,
    scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    package_name TEXT NOT NULL,
    current_version TEXT,
    wanted_version TEXT,
    latest_version TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_scans_repo ON scans(repo_id, scanned_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_vulns_scan ON vulnerabilities(scan_id)`,
  `CREATE INDEX IF NOT EXISTS idx_outdated_scan ON outdated_packages(scan_id)`,
];

for (const statement of statements) {
  await sql.query(statement);
  console.log("OK:", statement.trim().split("\n")[0], "...");
}

console.log("Migration complete.");
