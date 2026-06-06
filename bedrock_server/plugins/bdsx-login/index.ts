// Example bdsx plugin (TypeScript) — PoC only
// This plugin displays a ModalForm for login, then calls the backend /api/login
// Replace endpoints and authentication for production.

import { events } from "bdsx/event";
import { ModalForm, Player } from "bdsx/bds/form";

// lightweight POST JSON helper using builtin http/https to avoid node-fetch dependency
function postJson(url: string, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const lib = (u.protocol === 'https:') ? require('https') : require('http');
      const payload = JSON.stringify(data);
      const opts: any = {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };
      const req = lib.request(opts, (res: any) => {
        let body = '';
        res.on('data', (chunk: any) => body += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); } catch (e) { resolve({ ok: false, error: 'invalid-json' }); }
        });
      });
      req.on('error', (e: any) => reject(e));
      req.write(payload);
      req.end();
    } catch (e) { reject(e); }
  });
}

const BACKEND = process.env.AUTH_BACKEND || 'http://127.0.0.1:3000';

events.playerJoin.on((ev) => {
  const pl = ev.player;
  showLogin(pl);
});

function showLogin(player: Player){
  const form = new ModalForm();
  form.title = 'Server_MC — Login';
  form.content = 'Masukkan username dan password akun Server_MC kamu (PoC)';
  form.button1 = 'Login';
  form.button2 = 'Kembali';
  form.show(player, (res) => {
    if(!res) return;
    // For bdsx ModalForm simple PoC we don't have inputs; replace with custom form API as needed
    // Here we open chat prompt as quick PoC
    player.sendMessage('Ketik: /login <username> <password> untuk login');
  });
}

// Provide a simple command /login for PoC
import { command } from 'bdsx/command';

command.register('login', 'Login to server_mc').overload((ptr, origin, args) => {
  const username = args[0].toString();
  const password = args[1].toString();
  const player = origin.getEntity();
  if(!player) return;
  const xuid = player.getXuid();
  // call backend
  (async ()=>{
    try{
      const j = await postJson(BACKEND + '/api/login', { username, password, xuid });
      if(j && j.ok){
        player.sendMessage('Login sukses — selamat datang ' + j.payload.username);
      } else {
        player.sendMessage('Login gagal: ' + (j && j.error ? j.error : 'unknown'));
      }
    }catch(e){ player.sendMessage('Error connecting auth server'); }
  })();
}, { parameters:[{ name:'username' }, { name:'password' }] });
