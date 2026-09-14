import Link from "next/link";
import { notFound } from "next/navigation";
import { getScanDetail } from "@/lib/queries";

type Vulnerability = {
  id: number;
  package_name: string;
  severity: string;
  title: string | null;
  installed_version: string | null;
  vulnerable_range: string | null;
  fixed_version: string | null;
  is_direct: number;
  url: string | null;
};

type OutdatedPackage = {
  id: number;
  package_name: string;
  current_version: string | null;
  wanted_version: string | null;
  latest_version: string | null;
};

type Scan = { id: number; repo_id: number };

export default async function ScanPage(props: PageProps<"/scans/[scanId]">) {
  const { scanId } = await props.params;
  const { scan, vulnerabilities, outdatedPackages } = (await getScanDetail(
    Number(scanId)
  )) as {
    scan: Scan | undefined;
    vulnerabilities: Vulnerability[];
    outdatedPackages: OutdatedPackage[];
  };
  if (!scan) notFound();

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <Link
          href={`/repos/${scan.repo_id}`}
          className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
        >
          ← kembali ke repo
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-black dark:text-zinc-50">
          Hasil scan #{scan.id}
        </h1>

        <h2 className="mt-8 text-sm font-semibold uppercase text-zinc-500">
          Vulnerabilities ({vulnerabilities.length})
        </h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-zinc-100 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Package</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Installed</th>
                <th className="px-4 py-3">Fixed in</th>
                <th className="px-4 py-3">Direct?</th>
              </tr>
            </thead>
            <tbody>
              {vulnerabilities.map((v) => (
                <tr
                  key={v.id}
                  className="border-t border-zinc-200 dark:border-zinc-800"
                >
                  <td className="px-4 py-3 font-medium">{v.package_name}</td>
                  <td className="px-4 py-3 uppercase">{v.severity}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {v.url ? (
                      <a href={v.url} className="hover:underline">
                        {v.title ?? v.url}
                      </a>
                    ) : (
                      v.title ?? "-"
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {v.installed_version ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {v.fixed_version ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {v.is_direct ? "ya" : "tidak"}
                  </td>
                </tr>
              ))}
              {vulnerabilities.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-zinc-500" colSpan={6}>
                    Tidak ada vulnerability.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <h2 className="mt-8 text-sm font-semibold uppercase text-zinc-500">
          Outdated packages ({outdatedPackages.length})
        </h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-zinc-100 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Package</th>
                <th className="px-4 py-3">Current</th>
                <th className="px-4 py-3">Wanted</th>
                <th className="px-4 py-3">Latest</th>
              </tr>
            </thead>
            <tbody>
              {outdatedPackages.map((o) => (
                <tr
                  key={o.id}
                  className="border-t border-zinc-200 dark:border-zinc-800"
                >
                  <td className="px-4 py-3 font-medium">{o.package_name}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {o.current_version ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {o.wanted_version ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {o.latest_version ?? "-"}
                  </td>
                </tr>
              ))}
              {outdatedPackages.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-zinc-500" colSpan={4}>
                    Tidak ada package outdated.
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
