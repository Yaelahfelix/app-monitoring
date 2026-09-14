import Link from "next/link";
import { listReposWithLatestScan } from "@/lib/queries";

// Always read fresh data from Postgres; nothing here is prerenderable
// at build time (DATABASE_URL is only available at runtime).
export const dynamic = "force-dynamic";

type RepoRow = {
  id: number;
  client: string;
  name: string;
  github_url: string | null;
  scan_id: number | null;
  scanned_at: string | null;
  branch: string | null;
  tool: string | null;
  critical_count: number | null;
  high_count: number | null;
  moderate_count: number | null;
  low_count: number | null;
  outdated_count: number | null;
};

function SeverityBadge({ label, count }: { label: string; count: number }) {
  if (!count) return null;
  const colors: Record<string, string> = {
    critical: "bg-red-600 text-white",
    high: "bg-orange-500 text-white",
    moderate: "bg-yellow-400 text-black",
    low: "bg-zinc-300 text-black dark:bg-zinc-600 dark:text-white",
  };
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${colors[label]}`}
    >
      {count} {label}
    </span>
  );
}

export default async function Home() {
  const repos = (await listReposWithLatestScan()) as RepoRow[];

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          Security Monitoring
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Dependency vulnerability &amp; outdated-package status across client
          repositories.
        </p>

        {repos.length === 0 ? (
          <div className="mt-10 rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            Belum ada data scan masuk. Hubungkan repo klien lewat GitHub
            Action reusable workflow (lihat{" "}
            <code>.github/workflows/reusable-security-scan.yml</code>) supaya
            hasilnya tampil di sini.
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-zinc-100 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Repo</th>
                  <th className="px-4 py-3">Last scan</th>
                  <th className="px-4 py-3">Findings</th>
                  <th className="px-4 py-3">Outdated</th>
                </tr>
              </thead>
              <tbody>
                {repos.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-zinc-200 dark:border-zinc-800"
                  >
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {r.client}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/repos/${r.id}`}
                        className="font-medium text-zinc-950 hover:underline dark:text-zinc-50"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {r.scanned_at
                        ? `${r.scanned_at} UTC (${r.branch ?? "?"})`
                        : "belum pernah"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <SeverityBadge label="critical" count={r.critical_count ?? 0} />
                        <SeverityBadge label="high" count={r.high_count ?? 0} />
                        <SeverityBadge label="moderate" count={r.moderate_count ?? 0} />
                        <SeverityBadge label="low" count={r.low_count ?? 0} />
                        {!r.critical_count &&
                        !r.high_count &&
                        !r.moderate_count &&
                        !r.low_count &&
                        r.scan_id ? (
                          <span className="text-xs text-green-600 dark:text-green-400">
                            aman
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {r.outdated_count ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
