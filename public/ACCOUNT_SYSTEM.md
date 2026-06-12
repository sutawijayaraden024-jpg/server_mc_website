# Account System Overview

Sistem akun Server_MC dibagi menjadi dua lapisan:

1. Website `public`
   - register
   - login
   - status member/admin
   - daftar online/offline
   - pusat informasi pemain
   - memakai backend publik saat website dibuka online
2. Server `bedrock_server/server_lobby`
   - validasi sesi pemain
   - kontrol akses sebelum masuk world
   - sinkron status online/offline

## Alur Singkat

1. Pemain membuka website dan membuat akun.
2. Akun disimpan dengan role:
   - `member`
   - `admin`
3. Saat pemain masuk ke server lobby, server meminta status autentikasi.
4. Jika belum login, server menahan akses dan menampilkan overlay/login prompt.
5. Pemain login di website.
6. Website mengirim token/sesi ke server.
7. Server menandai pemain sebagai login aktif.
8. Saat pemain keluar, server mengirim event logout ke website.

## Data Minimal

### User

- `username`
- `email`
- `password_hash`
- `role`
- `created_at`
- `last_login`
- `online_status`

### Session

- `session_id`
- `username`
- `xuid`
- `token`
- `expires_at`
- `is_active`

## Catatan Penting

- Password tidak boleh disimpan plaintext di produksi atau di bundle frontend.
- `xuid` lebih stabil daripada nama pemain untuk identifikasi.
- Untuk Minecraft Bedrock, overlay login in-game biasanya butuh plugin, proxy, atau backend bridge.
