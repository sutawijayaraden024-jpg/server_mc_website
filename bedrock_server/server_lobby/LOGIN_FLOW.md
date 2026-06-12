# Login Flow

Flow login untuk player di lobby server.

## Tujuan

- membedakan `guest`, `member`, dan `admin`
- memastikan pemain login lewat website sebelum akses penuh
- sinkron online/offline otomatis

## Langkah Flow

1. Player join ke `server_lobby`.
2. Server cek apakah player punya sesi login aktif.
3. Jika tidak ada sesi:
   - player tetap di lobby
   - overlay/login prompt ditampilkan
4. Player buka website `public`.
5. Player login atau register.
6. Website membuat token sesi.
7. Token dikirim ke server.
8. Server memvalidasi token.
9. Jika valid:
   - player ditandai `logged in`
   - role diterapkan
   - akses server dibuka
10. Saat player disconnect:
   - server kirim event `leave`
   - website menandai status offline

## Role

- `guest`
  - belum login
  - hanya bisa melihat lobby/prompt
- `member`
  - player biasa
  - dapat akses fitur server
  - spawn role: `-2068 33 -2043`
- `admin`
  - pengawas
  - dapat menerima barang/jualan/farming hasil player
  - spawn role: `1600 31 -241`

## Role Spawn Coordinates

Koordinat role yang dipakai di world `Maharlika_City`:

- Member spawn: `-2068 33 -2043`
- Admin spawn: `1600 31 -241`

Catatan:

- Bedrock Dedicated Server vanilla hanya punya satu world spawn default.
- Spawn berbeda per role perlu mekanisme tambahan, seperti command admin, command block, behavior pack/script, atau backend bridge yang menjalankan teleport berdasarkan `xuid` dan role.
- Untuk admin utama, gunakan XUID `2535433223991124` dengan nama Xbox `ruiss971` dan email website `scarlettruiss@gmail.com`.
- Data role spawn sementara disimpan di `role_spawns.json`.
- Instruksi operasional ada di `ROLE_SPAWNS.md`.

## File Data Lokal Sementara

Kalau belum ada backend:

- website bisa menyimpan cache demo di `localStorage`
- server bisa membaca file JSON sementara untuk testing

## Next Step

Kalau kamu mau implementasi nyata, langkah berikutnya adalah:

1. bikin backend auth
2. bikin token session
3. bikin bridge antara server Bedrock dan website
4. bikin overlay login di resource pack / UI
