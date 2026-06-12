# Auth API Spec

Dokumen ini adalah kontrak awal antara website dan server lobby.

## Endpoint Yang Dibutuhkan

### `POST /api/auth/register`

Membuat akun baru.

Request:

```json
{
  "username": "Ra172",
  "email": "scarlettruiss@gmail.com",
  "password": "secret-password"
}
```

Response:

```json
{
  "ok": true,
  "message": "Account created",
  "role": "member"
}
```

### `POST /api/auth/login`

Login akun dan membuat sesi.

Request:

```json
{
  "email": "scarlettruiss@gmail.com",
  "password": "secret-password"
}
```

Response:

```json
{
  "ok": true,
  "token": "session-token",
  "role": "admin",
  "username": "Ra172"
}
```

### `GET /api/auth/session`

Mengecek status sesi aktif.

Response:

```json
{
  "ok": true,
  "authenticated": true,
  "username": "Ra172",
  "role": "admin",
  "online": true
}
```

### `POST /api/server/join`

Dipanggil saat pemain masuk ke lobby.

Request:

```json
{
  "username": "Ra172",
  "xuid": "1234567890",
  "server": "server_lobby"
}
```

Response:

```json
{
  "ok": true,
  "online": true,
  "username": "Ra172",
  "xuid": "1234567890",
  "role": "admin",
  "spawn": {
    "x": 1600,
    "y": 31,
    "z": -241
  },
  "teleport_command": "tp \"Ra172\" 1600 31 -241"
}
```

### `GET /api/server/resolve?xuid=1234567890&username=Ra172`

Dipakai bridge/server untuk mengecek role dan koordinat spawn dari XUID.

Response admin:

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

### `POST /api/server/leave`

Dipanggil saat pemain keluar dari server.

Request:

```json
{
  "username": "Ra172",
  "xuid": "1234567890",
  "server": "server_lobby"
}
```

## Status Yang Disarankan

- `guest`
- `member`
- `admin`
- `banned`

## Catatan Implementasi

- Jika backend belum ada, endpoint ini bisa jadi mock dulu di development.
- Untuk produksi, gunakan auth server-side dan simpan password dengan hash.
