# Update Plan — Public Website (Server_MC)

Daftar perbaikan dan fitur yang disarankan untuk folder `public`.

## Prioritas Tinggi

- Sistem akun sudah diarahkan ke backend publik
  - `servermc_users` dipakai sebagai cache tampilan
  - `servermc_online` dipakai sebagai cache status aktif
  - Role dipisah menjadi `member` dan `admin`
  - Login/register otomatis mencoba backend publik saat website online
- Perbaiki logika akun/pemain
  - Hitung `registered` dari `servermc_users` di `localStorage`.
  - Hitung `online` dari `servermc_online` di `localStorage`.
  - Perbarui elemen UI: `hero-player-count`, `player-count-registered`, `player-count-online`, `total-members`, `total-active-members`, `registered-player-list`.
- Pastikan admin utama tersimpan di backend
  - Email: `scarlettruiss@gmail.com`
  - Username: `Ra172`
  - Role: `admin`
  - Password tidak disimpan di client untuk produksi.
- Implementasikan logout & hapus akun
  - Logout harus mengosongkan status online dan token.
  - Hapus akun harus menghapus dari `servermc_users` dan `servermc_online`.

## Fungsionalitas (Medium)

- Proteksi akses halaman penting (Server, Update, Event, Komunitas, Members, Admin)
  - Tampilkan overlay login bila belum autentikasi.
  - Redirect ke login/register jika pengguna mengakses file statis di `servers/*`.
- Sistem post sederhana
  - Simpan post di `localStorage` (`servermc_posts`) untuk demo.
  - Hitung `total-posts` dari array ini.

## Keamanan & Produksi (Harus dilakukan sebelum publikasi)

- Jangan menyimpan password plaintext di client-side.
  - Gunakan backend untuk auth, simpan password ter-hash (bcrypt/scrypt/argon2).
- Hilangkan seed admin otomatis pada environment produksi.
- Implementasikan rate-limiting & validasi input di server.
- Implementasikan OAuth nyata (Google/Microsoft) menggunakan backend/credentials.

## Pengalaman Pengguna & UI (Optional)

- Tambah indikator online real-time (WebSocket / server-side status).
- Tambah halaman manajemen account (ubah password, ganti email).
- Tambah halaman verifikasi email sungguhan (kirim email via backend).

## File yang Diubah/Perlu Diperbarui

- `public/index.html` — penempatan elemen UI untuk counts & auth (sudah ada).
- `public/js/app.js` — logika auth, update counts, dan sinkronisasi backend.
- `public/servers/*` — tambahkan guard untuk akses jika perlu.

## Langkah Berikutnya yang Saya Bisa Lakukan

- Tambahkan proteksi ke file di `servers/` (redirect / overlay) — butuh konfirmasi.
- Integrasi backend auth sudah dipakai sebagai jalur utama saat online.
- Tambahkan UI untuk manajemen post/komunitas yang tersimpan di `localStorage`.

---

Catatan: semua perubahan yang dibuat saat ini bersifat demo/lokal dan menggunakan `localStorage`. Untuk produksi, pindahkan semua logika sensitif ke server.
