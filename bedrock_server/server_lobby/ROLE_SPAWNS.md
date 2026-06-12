# Role Spawns

Koordinat spawn role untuk world `Maharlika_City`.

## Coordinates

- Member: `-2068 33 -2043`
- Admin: `1600 31 -241`

## Admin Account

- Email website: `scarlettruiss@gmail.com`
- Minecraft/Xbox name: `ruiss971`
- XUID: `2535433223991124`
- Role: `admin`

## Manual Commands

Gunakan command ini saat perlu memindahkan player secara manual.

Teleport diri sendiri ke spawn member:

```mcfunction
/tp @s -2068 33 -2043
```

Teleport diri sendiri ke spawn admin:

```mcfunction
/tp @s 1600 31 -241
```

Teleport player tertentu ke spawn member:

```mcfunction
/tp "PLAYER_NAME" -2068 33 -2043
```

Teleport player tertentu ke spawn admin:

```mcfunction
/tp "PLAYER_NAME" 1600 31 -241
```

## Automation Plan

Bedrock Dedicated Server vanilla tidak bisa otomatis memilih spawn berbeda berdasarkan akun website hanya dari `server.properties`.

Untuk otomatisasi penuh, gunakan data di `role_spawns.json` sebagai sumber:

1. Player join ke `server_lobby`.
2. Bridge/backend membaca XUID player.
3. Bridge/backend memanggil `/api/server/resolve?xuid=PLAYER_XUID&username=PLAYER_NAME`.
4. Response memberikan `role`, `spawn`, dan `teleport_command`.
5. Jika role `member`, jalankan teleport ke `-2068 33 -2043`.
6. Jika role `admin`, jalankan teleport ke `1600 31 -241`.

Sampai bridge/backend dibuat, teleport role dilakukan manual oleh operator/admin.

## Local Helper

Helper lokal tersedia di:

```text
tools\role_spawn_bridge.ps1
```

Cara pakai:

1. Jalankan server.
2. Buka terminal kedua di folder `server_lobby`.
3. Jalankan:

```powershell
powershell -ExecutionPolicy Bypass -File tools\role_spawn_bridge.ps1
```

Saat player spawn, helper akan membaca `logs\server.log`, mencocokkan XUID dengan `role_spawns.json`, lalu menampilkan command teleport yang perlu dijalankan.

Contoh output:

```text
[admin] ruiss971 / 2535433223991124
/tp "ruiss971" 1600 31 -241
```

Kalau ingin mengetik command langsung di console server, jalankan server memakai:

```text
start_server_console.bat
```

Catatan: helper ini belum bisa mengirim command otomatis ke BDS vanilla. Untuk otomatis penuh tetap perlu plugin/proxy/bridge yang punya akses command ke server.

## API Example

Resolve admin utama:

```http
GET /api/server/resolve?xuid=2535433223991124&username=ruiss971
```

Expected result:

```json
{
  "ok": true,
  "authenticated": true,
  "username": "ruiss971",
  "email": "scarlettruiss@gmail.com",
  "xuid": "2535433223991124",
  "role": "admin",
  "spawn": {
    "x": 1600,
    "y": 31,
    "z": -241
  },
  "teleport_command": "tp \"ruiss971\" 1600 31 -241"
}
```
