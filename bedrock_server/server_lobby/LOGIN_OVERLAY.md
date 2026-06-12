# Login Overlay

Behavior pack `Server_MC Login Overlay` menampilkan form Login/Register saat player pertama spawn di `Maharlika_City`.

## Files

- `behavior_packs/servermc_login_overlay/manifest.json`
- `behavior_packs/servermc_login_overlay/scripts/main.js`
- `worlds/Maharlika_City/world_behavior_packs.json`

## Current Behavior

- Player baru spawn akan melihat pilihan:
  - Login
  - Register
  - Lanjut sebagai Guest
- Login admin dengan email `scarlettruiss@gmail.com` diarahkan ke spawn admin `1600 31 -241`.
- Login/register member diarahkan ke spawn member `-2068 33 -2043`.

## Important Notes

- Ini adalah overlay in-game berbasis Script API dan server UI form.
- Verifikasi password/backend belum aktif di dalam Script API.
- Untuk produksi, jangan percaya input email dari form saja. Sambungkan ke backend/bridge yang memvalidasi token login website.
- Kalau pack gagal load, cek `logs/server.log` setelah restart server.

## Test Steps

1. Restart server.
2. Join dengan Minecraft Bedrock `1.21.120`.
3. Saat spawn pertama, form `Server_MC` harus muncul.
4. Pilih Login atau Register.
5. Cek apakah player diteleport ke koordinat role yang sesuai.
