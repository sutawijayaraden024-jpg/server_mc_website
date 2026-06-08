# Cloudflare Deployment Setup

## Perintah Setup Git untuk Cloudflare

Langkah-langkah yang sudah dilakukan:
1. ✅ Update `.gitignore` - mengecualikan file besar (.mcworld, db, logs)
2. ✅ Update `wrangler.toml` - konfigurasi Cloudflare Pages
3. ✅ Buat GitHub Actions workflow - otomatis deploy saat push

## Langkah Selanjutnya

### 1. Push ke GitHub (Jika belum ada remote)
```powershell
git remote add origin https://github.com/YOUR_USERNAME/server_mc_website.git
git branch -M main
git push -u origin main
```

### 2. Setup GitHub Secrets untuk Auto-Deploy
Di GitHub repository, go to **Settings → Secrets and variables → Actions**, tambahkan:
- `CLOUDFLARE_API_TOKEN` - dari Cloudflare API tokens
- `CLOUDFLARE_ACCOUNT_ID` - `0333957e835e4bf528fac6bd17d8e3a6`

### 3. Setup Cloudflare Pages
1. Login ke [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Go to **Pages** → **Create a project** → **Connect to Git**
3. Authorize GitHub dan select repository `server_mc_website`
4. Build settings:
   - **Framework preset**: None
   - **Build command**: `echo 'Build complete'`
   - **Build output directory**: `public`
5. Deploy!

## Struktur Deployment

```
GitHub (main branch)
    ↓
GitHub Actions (deploy.yml)
    ↓
Cloudflare Pages
    ↓
https://server-mc-website.pages.dev
```

Setiap kali push ke `main` branch, otomatis deploy ke Cloudflare Pages!
