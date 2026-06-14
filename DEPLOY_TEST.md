# 🚀 Deploy & Testing Guide - Server_MC Chat

## Tahap 1: Deploy Backend API ke Cloudflare

### 1a. Database Schema
1. Buka **Cloudflare Dashboard** → **Workers & Pages** → **D1 SQL Editor**
2. Query database `server-mc-db`
3. Paste seluruh isi `functions/api/community/database-schema.sql` → Run

### 1b. Deploy Workers
```bash
# Install Wrangler CLI
npm install -g wrangler

# Login
wrangler login

# Deploy (dari root project)
wrangler pages deploy public/
```

### 1c. Set Environment Variables di Cloudflare
Di **Workers & Pages** → **server-mc-website** → **Settings** → **Environment Variables**:
```
JWT_SECRET = random-32-char-string-here
ADMIN_EMAIL = sutawijayaraden024@gmail.com
DB = (bind to D1 database server-mc-db)
```

### 1d. Custom Domain
Di **Workers & Pages** → **Custom Domains**:
- Tambah domain: `servermc.chat` atau subdomain lain
- Atau gunakan URL default Cloudflare Pages

---

## Tahap 2: Testing (tanpa deploy, local testing)

### Open langsung di browser:
```
file:///f:/server_mc_website/public/index.html
```

### Login test:
1. Buka `index.html` di browser
2. Klik **Masuk / Daftar**
3. Register dengan email & password
4. Setelah login, klik **💬 Chat** di navigation
5. Akan redirect ke `komunitas.html`

### Features yang bisa di-test tanpa backend:
✅ Login/Register (localStorage)  
✅ Theme toggle (Dark/Light)  
✅ Sound toggle  
✅ Music player (upload file)  
✅ Navigasi ke komunitas  
✅ Settings page  

---

## Tahap 3: Full Testing (dengan backend)

### Test Checklist:

#### 🔐 Auth
- [ ] Register dengan email baru
- [ ] Login dengan email & password
- [ ] Login error: wrong password
- [ ] Login error: email tidak terdaftar
- [ ] Logout

#### 💬 Chat
- [ ] Kirim pesan ke #umum
- [ ] Pesan muncul real-time
- [ ] Ganti ke #diskusi
- [ ] Kirim pesan ke #diskusi
- [ ] Klik member di sidebar → profil muncul

#### 👥 Member
- [ ] Member list muncul
- [ ] Online status update
- [ ] Klik profil member

#### 🔔 Notification
- [ ] Klik 🔔 → notifikasi modal
- [ ] Klik "Tandai Semua Dibaca"

#### ⚙️ Settings
- [ ] Klik ⚙️ di user panel
- [ ] Navigasi 15 kategori
- [ ] Ubah tema (Dark/Light)
- [ ] Ubah aksen warna
- [ ] Simpan profil
- [ ] Export data

#### 🎵 Music
- [ ] Klik 🎵 di user panel
- [ ] Upload file audio
- [ ] Play/Pause
- [ ] Next/Previous
- [ ] Shuffle/Repeat
- [ ] Volume slider

#### 📱 Mobile
- [ ] Responsive di mobile
- [ ] Bottom nav muncul
- [ ] Touch-friendly buttons

---

## Tahap 4: Post-Deploy Verification

Setelah deploy ke Cloudflare:
1. Buka URL production
2. Register akun baru
3. Login
4. Buka Chat
5. Kirim pesan pertama
6. Cek member list
7. Test semua fitur

---

## Troubleshooting

### "Guest" name muncul:
- Login dulu via index.html
- Atau klik 🔐 Login di komunitas

### Chat kosong:
- Backend belum deploy? Chat jalan local (localStorage)
- Deploy backend untuk sync antar user

### Music tidak bisa play:
- Browser memblokir autoplay
- Klik play button setelah upload

### iOS/Safari issues:
- Tambah ke Home Screen untuk PWA experience
- Gunakan Safari untuk testing iOS