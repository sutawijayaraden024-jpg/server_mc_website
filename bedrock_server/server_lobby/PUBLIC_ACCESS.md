# Public Access Guide

Panduan singkat supaya lobby server bisa diakses dari luar jaringan lokal.

## LAN / PC Rumah Checklist

1. Pastikan `server_lobby` bisa dijalankan lewat `start_server.bat`.
2. Cek `logs\server.log` dan pastikan server benar-benar start tanpa error fatal.
3. Cari IP lokal PC server, misalnya `192.168.x.x` atau `10.x.x.x`.
4. Buat IP lokal PC server tetap:
   - paling bagus lewat DHCP reservation di router
   - atau set static IP di Windows
5. Buat inbound rule di Windows Firewall untuk UDP `19132`.
6. Port forward di router:
   - protocol: UDP
   - external port: `19132`
   - internal port: `19132`
   - internal IP: IP lokal PC server
7. Tes dari perangkat di luar Wi-Fi rumah, misalnya pakai hotspot data seluler.
8. Bagikan `IP publik:19132` ke pemain.
9. Kalau tidak bisa diakses dari luar, cek apakah ISP kamu memakai CGNAT.

## Yang perlu disiapkan

- Server menyala lewat `start_server.bat`
- Port UDP `19132` terbuka di Windows Firewall
- Port UDP `19132` di-forward di router ke IP lokal mesin server
- IP lokal mesin server tetap, idealnya pakai static IP atau DHCP reservation

## Langkah

1. Jalankan server dulu dan pastikan tidak ada error di `logs\server.log`.
2. Buka Windows Firewall.
3. Buat rule inbound untuk `bedrock_server.exe` atau port UDP `19132`.
4. Di router, forward port UDP `19132` ke IP lokal mesin server.
5. Bagikan alamat publik kamu ke pemain dalam format:
   - `IP_PUBLIK:19132`

## Catatan

- Jika ISP memakai CGNAT, port forwarding biasanya tidak akan berhasil dari internet.
- Kalau kamu pakai VPS, biasanya cukup buka firewall provider dan firewall Windows.
- Kalau nanti kamu memberi tahu jenis hosting yang kamu pakai, saya bisa bantu langkah yang lebih presisi.
- Kalau tidak bisa login router atau port forwarding tetap gagal, gunakan tunnel UDP seperti playit. Lihat [Playit Tunnel Setup](PLAYIT_TUNNEL.md).
