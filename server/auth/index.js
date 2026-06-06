const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const USERS_FILE = __dirname + '/users.json';
let users = {};
if (fs.existsSync(USERS_FILE)) {
  users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

// In-memory logged players: xuid -> { username, xuid, loginAt }
const loggedPlayers = new Map();

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Simple login endpoint (PoC). Expects { username, password, xuid }
app.post('/api/login', (req, res) => {
  const { username, password, xuid } = req.body || {};
  if (!username || !password || !xuid) return res.status(400).json({ error: 'missing' });
  const user = users[username.toLowerCase()];
  if (!user) return res.status(401).json({ error: 'unknown_user' });
  // PoC: plain password check (replace with hashed verify in prod)
  if (user.password !== password) return res.status(401).json({ error: 'invalid_credentials' });

  const payload = { username: user.username, xuid, loginAt: Date.now() };
  loggedPlayers.set(xuid, payload);
  io.emit('player-login', payload);
  return res.json({ ok: true, payload });
});

app.post('/api/logout', (req, res) => {
  const { xuid } = req.body || {};
  if (!xuid) return res.status(400).json({ error: 'missing' });
  const p = loggedPlayers.get(xuid);
  if (p) {
    loggedPlayers.delete(xuid);
    io.emit('player-logout', { xuid });
  }
  return res.json({ ok: true });
});

app.get('/api/logged', (req, res) => {
  return res.json(Array.from(loggedPlayers.values()));
});

io.on('connection', socket => {
  // allow admin clients to request current list
  socket.on('who', () => {
    socket.emit('players', Array.from(loggedPlayers.values()));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Auth server listening on', PORT));
