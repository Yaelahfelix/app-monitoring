# Security Monitoring

Dashboard internal untuk memantau **dependency vulnerability** dan
**package outdated** di seluruh project JavaScript (Next.js / Express, dll)
milik klien-klien PDAM. Data scan dikirim langsung dari GitHub Actions di
masing-masing repo klien.

## Arsitektur singkat

```
repo klien A ──(reusable workflow: npm audit + npm outdated)──▶ POST /api/ingest ──▶ Postgres (Neon) ──▶ dashboard
repo klien B ──(reusable workflow)───────────────────────────▶ POST /api/ingest
repo klien C ──(reusable workflow)───────────────────────────▶ POST /api/ingest
```

- **Dashboard** (app ini): Next.js App Router, simpan data di Postgres lewat
  `@neondatabase/serverless` (lihat `lib/db.ts`, `lib/queries.ts`) — cocok
  untuk deploy ke Vercel karena tidak bergantung pada filesystem lokal.
- **Endpoint ingest**: `POST /api/ingest`, diautentikasi dengan
  `Authorization: Bearer <INGEST_TOKEN>`.
- **Reusable GitHub Action**: `.github/workflows/reusable-security-scan.yml`
  — dipanggil dari workflow di tiap repo klien, menjalankan
  `npm audit` + `npm outdated`, lalu melaporkan hasilnya lewat
  `scripts/report-scan.mjs`.

## Deploy ke Vercel

1. Push repo ini ke GitHub, import ke Vercel.
2. Provision database Postgres lewat Vercel Marketplace:
   ```bash
   vercel integration add neon
   ```
   Ini otomatis membuat database & inject env var `DATABASE_URL` ke project
   Vercel kamu.
3. Set env var `INGEST_TOKEN` di Vercel (Project Settings → Environment
   Variables) dengan string random yang panjang.
4. Tarik env var ke lokal untuk jalankan migrasi schema:
   ```bash
   vercel env pull .env.local --yes
   npm run db:migrate
   ```
5. Deploy (`vercel --prod` atau lewat Git push, tergantung setup CI kamu).
6. Kalau project Vercel kamu punya **Vercel Authentication** (deployment
   protection) aktif untuk domain `*.vercel.app` bawaan — cek di Project
   Settings → Deployment Protection — generate juga **Protection Bypass for
   Automation**:
   ```bash
   vercel api /v1/projects/<project-id>/protection-bypass -X PATCH --input <(echo '{"generate": {}}')
   ```
   Simpan secret yang dihasilkan; ini yang dipakai GitHub Actions repo klien
   supaya bisa POST ke `/api/ingest` tanpa kena SSO wall (lihat bagian
   "Menghubungkan repo klien" di bawah). Kalau dashboard sudah punya custom
   domain sendiri, langkah ini bisa dilewati — proteksi hanya berlaku di
   domain `*.vercel.app` default.

## Menjalankan dashboard secara lokal

```bash
cp .env.example .env.local   # isi INGEST_TOKEN + DATABASE_URL
npm install
npm run db:migrate           # sekali saja, bikin tabel di database
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

## Menghubungkan repo klien

1. Ganti placeholder `<org>` di
   `.github/workflows/reusable-security-scan.yml` dan
   `docs/client-repo-workflow.example.yml` dengan nama GitHub org/user
   perusahaan kamu, lalu commit & push repo ini ke GitHub.
2. Di tiap repo klien, tambahkan secrets berikut (Settings → Secrets and
   variables → Actions):
   - `SECURITY_DASHBOARD_URL` — URL publik dashboard ini, mis.
     `https://monitoring.internal.example.com`
   - `SECURITY_INGEST_TOKEN` — nilai yang sama persis dengan `INGEST_TOKEN`
     di dashboard
   - `SECURITY_PROTECTION_BYPASS` — hanya perlu kalau dashboard masih pakai
     domain `*.vercel.app` bawaan yang diproteksi Vercel Authentication;
     nilainya sama dengan secret Protection Bypass for Automation di
     langkah deploy nomor 6
3. Salin `docs/client-repo-workflow.example.yml` ke
   `.github/workflows/security-scan.yml` di repo klien, sesuaikan nama
   `client` dan jadwal `cron`-nya.
4. Push / tunggu jadwal cron — hasil scan otomatis muncul di dashboard ini.

## Struktur data

- `repos` — satu baris per (client, repo)
- `scans` — riwayat setiap kali workflow jalan, termasuk ringkasan jumlah
  vulnerability per severity
- `vulnerabilities` — detail tiap temuan `npm audit` pada satu scan
- `outdated_packages` — detail tiap package outdated pada satu scan

## Menambah scanner lain

`scripts/report-scan.mjs` saat ini hanya memakai `npm audit` +
`npm outdated`. Untuk menambah OSV-Scanner, Snyk, atau Dependabot alerts,
tambahkan fungsi pengambil data baru di script tersebut dan gabungkan ke
array `vulnerabilities` sebelum di-POST — skema `/api/ingest`
(`lib/queries.ts`) sudah generik per-tool lewat field `tool`.
