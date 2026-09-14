#!/usr/bin/env node
// Runs `npm audit` + `npm outdated`, normalizes the result, and reports it
// to the app-monitoring dashboard's /api/ingest endpoint.
//
// Required env vars:
//   DASHBOARD_URL   e.g. https://monitoring.internal.example.com
//   INGEST_TOKEN    shared secret, must match the dashboard's INGEST_TOKEN
//   CLIENT_NAME     e.g. "pdam-kota-a"
// Optional (auto-filled from GitHub Actions env when present):
//   REPO_NAME, GITHUB_URL, GIT_BRANCH, GIT_COMMIT_SHA, WORKFLOW_RUN_URL

import { execSync } from "node:child_process";

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", maxBuffer: 1024 * 1024 * 64 });
  } catch (err) {
    // npm audit / npm outdated exit non-zero when findings exist; stdout still has the JSON.
    return err.stdout ?? "";
  }
}

function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function collectVulnerabilities() {
  const raw = run("npm audit --json");
  const audit = safeJsonParse(raw, {});
  const vulnerabilities = [];

  const advisories = audit.vulnerabilities ?? {};
  for (const [packageName, info] of Object.entries(advisories)) {
    const via = Array.isArray(info.via) ? info.via : [];
    const detailedAdvisories = via.filter((v) => typeof v === "object");

    if (detailedAdvisories.length === 0) {
      vulnerabilities.push({
        packageName,
        severity: info.severity ?? "low",
        isDirect: Boolean(info.isDirect),
        fixedVersion:
          info.fixAvailable && typeof info.fixAvailable === "object"
            ? info.fixAvailable.version
            : undefined,
      });
      continue;
    }

    for (const advisory of detailedAdvisories) {
      vulnerabilities.push({
        packageName,
        severity: advisory.severity ?? info.severity ?? "low",
        title: advisory.title,
        vulnerableRange: advisory.range,
        installedVersion: info.range,
        isDirect: Boolean(info.isDirect),
        url: advisory.url,
        fixedVersion:
          info.fixAvailable && typeof info.fixAvailable === "object"
            ? info.fixAvailable.version
            : undefined,
      });
    }
  }

  return vulnerabilities;
}

function collectOutdatedPackages() {
  const raw = run("npm outdated --json");
  const outdated = safeJsonParse(raw, {});
  return Object.entries(outdated).map(([packageName, info]) => ({
    packageName,
    currentVersion: info.current,
    wantedVersion: info.wanted,
    latestVersion: info.latest,
  }));
}

async function main() {
  const dashboardUrl = process.env.DASHBOARD_URL;
  const token = process.env.INGEST_TOKEN;
  const client = process.env.CLIENT_NAME;

  if (!dashboardUrl || !token || !client) {
    console.error(
      "Missing required env vars: DASHBOARD_URL, INGEST_TOKEN, CLIENT_NAME"
    );
    process.exit(1);
  }

  const repo =
    process.env.REPO_NAME ?? process.env.GITHUB_REPOSITORY?.split("/").pop();
  const githubUrl =
    process.env.GITHUB_URL ??
    (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`
      : undefined);
  const branch =
    process.env.GIT_BRANCH ?? process.env.GITHUB_REF_NAME ?? undefined;
  const commitSha = process.env.GIT_COMMIT_SHA ?? process.env.GITHUB_SHA;
  const workflowRunUrl =
    process.env.WORKFLOW_RUN_URL ??
    (process.env.GITHUB_SERVER_URL &&
    process.env.GITHUB_REPOSITORY &&
    process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : undefined);

  const payload = {
    client,
    repo,
    githubUrl,
    branch,
    commitSha,
    tool: "npm-audit",
    workflowRunUrl,
    vulnerabilities: collectVulnerabilities(),
    outdatedPackages: collectOutdatedPackages(),
  };

  console.log(
    `Reporting ${payload.vulnerabilities.length} vulnerabilities and ${payload.outdatedPackages.length} outdated packages for ${client}/${repo}`
  );

  const res = await fetch(`${dashboardUrl.replace(/\/$/, "")}/api/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error(`Ingest failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  console.log("Reported successfully.");
}

main();
