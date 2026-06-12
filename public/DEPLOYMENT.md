# Deployment Guide

Panduan singkat untuk menjalankan website Server_MC secara publik 24/7 di Cloudflare Pages.

## Yang Sudah Disiapkan

- `public/` sebagai output statis
- API auth di `functions/api/*`
- storage fallback di `_lib/store.js`
- frontend yang otomatis memakai backend publik saat dibuka `http` atau `https`

## Yang Perlu Kamu Buat di Cloudflare

1. Buat `KV namespace` baru, misalnya `server_mc_website`.
2. Ambil `namespace ID` produksi dan preview.
3. Pasang binding bernama `SERVER_MC_KV`.
4. Deploy Pages project dari repo ini.
5. Pastikan domain publik mengarah ke project Pages.

## Nilai yang Harus Diisi

Di [wrangler.toml](/f:/server_mc_website/wrangler.toml), ganti:

- `REPLACE_WITH_PRODUCTION_KV_NAMESPACE_ID`
- `REPLACE_WITH_PREVIEW_KV_NAMESPACE_ID`

## Verifikasi Setelah Deploy

1. Buka website publik.
2. Register akun baru.
3. Login dengan akun yang sama.
4. Pastikan endpoint berikut aktif:
   - `/api/auth/register`
   - `/api/auth/login`
   - `/api/auth/session`
   - `/api/server/join`
   - `/api/server/leave`
   - `/api/server/resolve`

## Catatan Produksi

- Jangan simpan password plaintext di frontend.
- Untuk akun admin, pastikan hanya disimpan di backend.
- Kalau ingin data lebih kuat untuk banyak relasi, pertimbangkan `D1`.

