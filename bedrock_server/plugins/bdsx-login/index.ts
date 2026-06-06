// Example bdsx plugin (TypeScript) — PoC only
// This plugin displays a ModalForm for login, then calls the backend /api/login
// Replace endpoints and authentication for production.

import { events } from "bdsx/event";
import { ModalForm, Player } from "bdsx/bds/form";
import fetch from 'node-fetch';

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
      const r = await fetch(BACKEND + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, xuid })
      });
      const j = await r.json();
      if(j.ok){
        player.sendMessage('Login sukses — selamat datang ' + j.payload.username);
        // allow movement / other logic here
      } else {
        player.sendMessage('Login gagal: ' + (j.error || 'unknown'));
      }
    }catch(e){ player.sendMessage('Error connecting auth server'); }
  })();
}, { parameters:[{ name:'username' }, { name:'password' }] });
