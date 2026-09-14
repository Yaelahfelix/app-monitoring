import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepoById, listScansForRepo } from "@/lib/queries";

type ScanRow = {
  id: number;
  scanned_at: string;
  branch: string | null;
  commit_sha: string | null;
  tool: string;
  workflow_run_url: string | null;
  critical_count: number;
  high_count: number;
  moderate_count: number;
  low_count: number;
  outdated_count: number;
};

export default async function RepoPage(props: PageProps<"/repos/[id]">) {
  const { id } = await props.params;
  const repoId = Number(id);
  const repo = await getRepoById(repoId);
  if (!repo) notFound();

  const scans = (await listScansForRepo(repoId)) as ScanRow[];

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
        >
          ← kembali
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-black dark:text-zinc-50">
          {repo.client} / {repo.name}
        </h1>
        {repo.github_url && (
          <a
            href={repo.github_url}
            className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
          >
            {repo.github_url}
          </a>
        )}

        <h2 className="mt-8 text-sm font-semibold uppercase text-zinc-500">
          Riwayat scan
        </h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-zinc-100 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Commit</th>
                <th className="px-4 py-3">Tool</th>
                <th className="px-4 py-3">Critical/High/Mod/Low</th>
                <th className="px-4 py-3">Outdated</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((s) => (
                <tr
                  key={s.id}
                  className="border-t border-zinc-200 dark:border-zinc-800"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/scans/${s.id}`}
                      className="font-medium text-zinc-950 hover:underline dark:text-zinc-50"
                    >
                      {s.scanned_at} UTC
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {s.branch ?? "-"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {s.commit_sha ? s.commit_sha.slice(0, 7) : "-"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {s.tool}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {s.critical_count}/{s.high_count}/{s.moderate_count}/
                    {s.low_count}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {s.outdated_count}
                  </td>
                </tr>
              ))}
              {scans.length === 0 && (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-zinc-500"
                    colSpan={6}
                  >
                    Belum ada scan untuk repo ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
