import { system, world } from '@minecraft/server';
import { ModalFormData } from '@minecraft/server-ui';

const WEBSITE_URL = 'https://server-mc-website.pages.dev';
const WEBSITE_AUTH_API = `${WEBSITE_URL}/api/auth/login`;
const LOGIN_SPAWN = { x: 951, y: 48, z: -574 };
const ADMIN_SPAWN = { x: 1600, y: 31, z: -241 };
const MEMBER_SPAWN = { x: -2068, y: 33, z: -2043 };
const PROMPT_TAG = 'servermc_login_prompt_v5';
const frozenPlayers = new Map();

system.runInterval(() => {
  for (const player of world.getPlayers()) {
    const freeze = frozenPlayers.get(player.name);
    if (!freeze) continue;
    player.teleport(freeze.location, { dimension: player.dimension });
  }
}, 5);

world.afterEvents.playerLeave.subscribe(event => {
  frozenPlayers.delete(event.playerName);
});

world.afterEvents.playerSpawn.subscribe(event => {
  const player = event.player;
  if (!event.initialSpawn || !player || player.hasTag(PROMPT_TAG)) return;

  freezePlayer(player);
  player.teleport(LOGIN_SPAWN);
  frozenPlayers.set(player.name, { location: LOGIN_SPAWN });
  showTitleFallback(player);
  system.runTimeout(() => {
    showLoginForm(player);
  }, 100);
});

async function showLoginForm(player) {
  try {
    const response = await new ModalFormData()
      .title('Login Server_MC')
      .textField('Email akun website', 'email@example.com')
      .textField('Password', 'password')
      .submitButton('Login')
      .show(player);

    if (response.canceled) {
      player.sendMessage('Server_MC: login wajib diselesaikan sebelum bermain.');
      system.runTimeout(() => showLoginForm(player), 20);
      return;
    }

    const email = String(response.formValues?.[0] || '').trim().toLowerCase();
    const password = String(response.formValues?.[1] || '');

    if (!email || !password) {
      player.sendMessage('Server_MC: email dan password harus diisi.');
      system.runTimeout(() => showLoginForm(player), 20);
      return;
    }

    const loginResult = await authenticateWithWebsite(email, password);
    if (!loginResult.ok) {
      handleUnregisteredAccount(player, loginResult.message);
      return;
    }

    const role = loginResult.role === 'admin' ? 'admin' : 'member';
    const spawn = role === 'admin' ? ADMIN_SPAWN : MEMBER_SPAWN;

    player.sendMessage(`Server_MC: login diterima sebagai ${role}. Kamu akan dipindahkan ke spawn ${role}.`);
    completeLogin(player);
    player.teleport(spawn);
  } catch (error) {
    player.sendMessage('Server_MC: login form gagal ditampilkan.');
    system.runTimeout(() => showLoginForm(player), 60);
  }
}

function freezePlayer(player) {
  frozenPlayers.set(player.name, {
    location: {
      x: Math.floor(player.location.x) + 0.5,
      y: player.location.y,
      z: Math.floor(player.location.z) + 0.5
    }
  });
  player.sendMessage('Server_MC: kamu dikunci sementara sampai proses login/register selesai.');
}

function completeLogin(player) {
  player.addTag(PROMPT_TAG);
  frozenPlayers.delete(player.name);
}

function releasePlayer(player) {
  frozenPlayers.delete(player.name);
}

async function authenticateAccount(email, password) {
  const remoteAccount = await authenticateWithWebsite(email, password);
  if (remoteAccount) {
    return remoteAccount;
  }

  return null;
}

async function authenticateWithWebsite(email, password) {
  if (typeof fetch !== 'function') {
    return { ok: false, message: 'fetch is not available in this script runtime' };
  }

  try {
    const response = await fetch(WEBSITE_AUTH_API, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message: data?.message || data?.error || 'Akun tidak terdaftar'
      };
    }

    return {
      ok: Boolean(data?.ok),
      message: data?.message || 'Login berhasil',
      role: data?.role || 'member',
      username: data?.username || '',
      token: data?.token || ''
    };
  } catch {
    return { ok: false, message: 'Gagal terhubung ke website authentication' };
  }
}

function showTitleFallback(player) {
  try {
    player.runCommandAsync('title @s title Server_MC');
    player.runCommandAsync('title @s subtitle Login untuk akses penuh');
  } catch {
    player.sendMessage('Server_MC: Login untuk akses penuh.');
  }
}

function redirectToWebsite(player, reason = '') {
  player.sendMessage(reason ? `Server_MC: ${reason}` : 'Server_MC: akun atau password tidak terdaftar di website.');
  player.sendMessage(`Server_MC: daftar/login dulu di ${WEBSITE_URL}, lalu coba login lagi di server.`);
  try {
    player.runCommandAsync('title @s title Akun Tidak Terdaftar');
    player.runCommandAsync(`title @s subtitle Buka website: ${WEBSITE_URL}`);
  } catch {}
}

function handleUnregisteredAccount(player, reason = '') {
  releasePlayer(player);
  redirectToWebsite(player, reason);
  system.runTimeout(() => {
    try {
      player.runCommandAsync(`kick @s "Akun belum terdaftar. Buka ${WEBSITE_URL} untuk register/login."`);
    } catch {
      player.sendMessage(`Server_MC: silakan buka ${WEBSITE_URL} untuk register/login.`);
    }
  }, 20);
}
