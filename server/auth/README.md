# Auth + Realtime PoC

This small service provides a PoC authentication endpoint and Socket.IO realtime events that the website admin dashboard can consume.

Run locally:

```bash
cd server/auth
npm install
npm start
```

Endpoints:
- `POST /api/login` { username, password, xuid }
- `POST /api/logout` { xuid }
- `GET /api/logged` returns array of logged players

Socket.IO: server emits `player-login` and `player-logout`; clients may emit `who` to get current list.

Admin UI: open `public/admin_online.html` and point it to the auth server host (assumes `:3000`).

PoC notes:
- This is a proof-of-concept. Do NOT use plaintext passwords in production.
- Replace users file with a database and hashed passwords.
- Secure the socket connection with TLS in production.
