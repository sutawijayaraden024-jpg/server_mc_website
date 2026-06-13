# Cloudflare Pages Setup - Cara Perbaiki Build Error

## Masalah
Error: `npx wrangler deploy` — ini command untuk Worker, bukan Pages.

## Solusi

### 1. Buka Cloudflare Dashboard
https://dash.cloudflare.com → **Workers & Pages** → `server-mc-website`

### 2. Klik "Settings" → "Build settings"

### 3. Ubah Build Configuration menjadi:

| Setting | Value |
|---------|-------|
| **Build command** | **(kosongkan)** |
| **Build output directory** | `./public` |
| **Root directory** | (kosongkan) |

> **JANGAN** isi build command dengan `npx wrangler deploy` atau apapun. **Kosongkan saja.**

### 4. Framework preset: **None**

### 5. Environment Variables (Advanced):
| Variable | Value |
|----------|-------|
| `NODE_VERSION` | `22` |

### 6. Simpan → Trigger redeploy

---

## Kenapa Ini Terjadi?

Cloudflare Pages membaca `wrangler.toml` dan otomatis mengubah build command menjadi `npx wrangler deploy`. Ini salah karena:
- `wrangler.toml` hanya untuk **binding definitions** (KV, D1)
- Pages Functions di-deploy **otomatis** dari folder `functions/`
- Tidak perlu build command untuk static HTML/CSS/JS

## Yang Benar Terjadi Saat Build:

```
1. Clone repository
2. npm install (optional, untuk dependencies)
3. Copy folder public/ → output
4. Deploy functions/ sebagai Pages Functions
5. Selesai ✅
```

Tidak perlu `wrangler deploy`.