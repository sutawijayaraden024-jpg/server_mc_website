# Playit Tunnel Setup

Gunakan ini kalau pemain dari data seluler tidak bisa masuk lewat IP publik/router.

Playit membuat tunnel publik untuk Minecraft Bedrock tanpa port forwarding router. Ini berguna kalau:

- kamu tidak tahu password router,
- port forwarding gagal,
- ISP memakai CGNAT,
- atau WAN IP router tidak sama dengan IP publik.

## Kondisi Server Lokal

Server lokal Server_MC berjalan di:

```text
Local IP: 127.0.0.1
Local Port: 19132
Protocol: UDP
Type: Minecraft Bedrock
```

Jika playit agent berjalan di PC yang sama dengan server, gunakan:

```text
Local Address: 127.0.0.1
Local Port: 19132
```

## Langkah

1. Pastikan server berjalan:

```text
start_server.bat
```

2. Download dan jalankan playit agent untuk Windows:

```text
https://playit.gg/download/windows
```

3. Saat agent dibuka, playit akan memberi claim link.

4. Buka link tersebut di browser dan login/buat akun playit.

5. Buat tunnel baru:

```text
Tunnel Type: Minecraft Bedrock
Local Address: 127.0.0.1
Local Port: 19132
Protocol: UDP
```

6. Setelah tunnel aktif, playit memberi address publik seperti:

```text
example-name.gl.at.ply.gg
Port: 12345
```

7. Pemain dari data seluler masuk ke Minecraft Bedrock dengan:

```text
Server Address: example-name.gl.at.ply.gg
Port: 12345
```

## Catatan Penting

- Agent playit harus tetap berjalan selama server ingin diakses publik.
- Jangan gunakan IP lokal `192.168.100.13` untuk data seluler.
- Jangan gunakan IP publik router kalau port forwarding belum berhasil.
- Untuk Bedrock, pastikan tunnel yang dipilih adalah `Minecraft Bedrock` atau UDP, bukan Minecraft Java TCP.

## Troubleshooting

Jika masih gagal:

- Pastikan server lokal bisa dimasuki dari Wi-Fi yang sama memakai `192.168.100.13:19132`.
- Pastikan playit agent statusnya online.
- Pastikan tunnel mengarah ke `127.0.0.1:19132`.
- Coba region tunnel Asia/Singapore jika tersedia.
- Coba restart server dan playit agent.
