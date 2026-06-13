import { system, world, ItemStack } from '@minecraft/server';
import { ActionFormData, MessageFormData, ModalFormData } from '@minecraft/server-ui';
import { CONFIG } from './config.js';

const JOIN_TAG = 'servermc_gameplay_suite_joined';
const COIN_OBJECTIVE = 'servermc_coins';

system.run(() => {
  ensureCoinObjective();
  ensureBarrier();
});

system.runInterval(() => {
  for (const player of world.getPlayers()) {
    syncHotbarTools(player);
  }
}, 40);

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!player) return;

  if (initialSpawn) {
    initializePlayer(player);
    grantStarterTools(player);
    playWelcomeSequence(player);
  }
});

world.afterEvents.itemUse.subscribe(event => {
  const player = event.source;
  const item = event.itemStack;
  if (!player || !item) return;

  if (isNamedTool(item, CONFIG.guideBook)) {
    openGuideBook(player);
    return;
  }

  if (isNamedTool(item, CONFIG.phoneItem)) {
    openPhoneMenu(player);
  }
});

world.beforeEvents.chatSend.subscribe(event => {
  const player = event.sender;
  const message = String(event.message || '').trim().toLowerCase();
  if (message === '!store') {
    event.cancel = true;
    openStoreHub(player);
  } else if (message === '!trade') {
    event.cancel = true;
    openTradeHub(player);
  } else if (message === '!guide') {
    event.cancel = true;
    openGuideBook(player);
  }
});

function initializePlayer(player) {
  if (!player.hasTag(JOIN_TAG)) {
    player.addTag(JOIN_TAG);
  }
  ensureCoins(player);
}

function grantStarterTools(player) {
  if (CONFIG.guideBook.enabled) {
    giveNamedItemOnce(player, CONFIG.guideBook.itemId, CONFIG.guideBook.title, CONFIG.guideBook.lore);
  }
  if (CONFIG.phoneItem.enabled) {
    giveNamedItemOnce(player, CONFIG.phoneItem.itemId, CONFIG.phoneItem.title, CONFIG.phoneItem.lore);
  }
  player.sendMessage(`Server_MC: ketik !store untuk buka toko, !trade untuk penukaran, !guide untuk buku panduan.`);
}

function playWelcomeSequence(player) {
  player.sendMessage(CONFIG.welcomeFireworks.message);
  player.runCommandAsync(`title @s title Selamat datang di Server_MC`).catch(() => {});
  player.runCommandAsync(`title @s subtitle Login dan jelajahi dunia`).catch(() => {});
  for (let i = 0; i < CONFIG.welcomeFireworks.burstCount; i += 1) {
    system.runTimeout(() => {
      player.runCommandAsync(`summon fireworks_rocket ^ ^1 ^`).catch(() => {});
    }, i * 8);
  }
}

function ensureBarrier() {
  if (!CONFIG.lobbyBarrier.enabled) return;
  const { min, max } = CONFIG.lobbyBarrier;
  if (!min || !max) return;
  system.run(() => {
    world.getDimension('overworld').runCommandAsync(
      `fill ${min.x} ${min.y} ${min.z} ${max.x} ${max.y} ${max.z} barrier replace air`
    ).catch(() => {});
  });
}

function syncHotbarTools(player) {
  if (CONFIG.guideBook.enabled) {
    ensureItemInInventory(player, CONFIG.guideBook.itemId, CONFIG.guideBook.title, CONFIG.guideBook.lore);
  }
  if (CONFIG.phoneItem.enabled) {
    ensureItemInInventory(player, CONFIG.phoneItem.itemId, CONFIG.phoneItem.title, CONFIG.phoneItem.lore);
  }
}

function ensureItemInInventory(player, itemId, title, lore = []) {
  const inventory = player.getComponent('minecraft:inventory')?.container;
  if (!inventory) return;
  for (let slot = 0; slot < inventory.size; slot += 1) {
    const stack = inventory.getItem(slot);
    if (stack && stack.typeId === itemId && stack.nameTag === title) return;
  }
  giveNamedItemOnce(player, itemId, title, lore);
}

function giveNamedItemOnce(player, itemId, title, lore = []) {
  try {
    const item = new ItemStack(itemId, 1);
    item.nameTag = title;
    if (Array.isArray(lore) && lore.length > 0) {
      item.setLore(lore);
    }
    const inventory = player.getComponent('minecraft:inventory')?.container;
    if (!inventory) return;
    inventory.addItem(item);
  } catch {
    player.runCommandAsync(`give @s ${itemId}`).catch(() => {});
  }
}

function isNamedTool(item, descriptor) {
  return item.typeId === descriptor.itemId && item.nameTag === descriptor.title;
}

function openGuideBook(player) {
  const lines = [
    'Server_MC Guide',
    '',
    '• Login di spawn awal lalu pilih akun yang terdaftar.',
    '• !store untuk toko, !trade untuk tukar item farming.',
    '• Koin dipakai untuk beli item atau skin store.',
    '• Phone item dipakai untuk transfer item atau koin.'
  ];
  player.sendMessage(lines.join('\n'));
}

function openPhoneMenu(player) {
  const form = new ActionFormData()
    .title('Server_MC Phone')
    .body(`Koin kamu: ${getCoins(player)}\nPilih aksi:`)
    .button('Kirim Item')
    .button('Kirim Koin')
    .button('Jual Item Farming')
    .button('Tutup');

  form.show(player).then(response => {
    if (response.canceled) return;
    switch (response.selection) {
      case 0:
        openTransferItemForm(player);
        break;
      case 1:
        openTransferCoinForm(player);
        break;
      case 2:
        openTradeHub(player);
        break;
      default:
        break;
    }
  }).catch(() => {});
}

function openStoreHub(player) {
  const form = new ActionFormData()
    .title('Server_MC Store')
    .body(`Koin: ${getCoins(player)}\nPilih menu store:`)
    .button('Beli Barang')
    .button('Tukar Farming -> Koin')
    .button('Info Harga')
    .button('Tutup');

  form.show(player).then(response => {
    if (response.canceled) return;
    switch (response.selection) {
      case 0:
        openShopCatalog(player);
        break;
      case 1:
        openTradeHub(player);
        break;
      case 2:
        openPriceInfo(player);
        break;
      default:
        break;
    }
  }).catch(() => {});
}

function openTradeHub(player) {
  const buttons = CONFIG.economy.tradeItems.map(item => `${item.name} - ${item.coinPerItem} koin`);
  const form = new ActionFormData()
    .title('Tukar Item Farming')
    .body(`Pilih item farming untuk dijual. Koin kamu: ${getCoins(player)}`);
  for (const label of buttons) form.button(label);
  form.button('Tutup');

  form.show(player).then(response => {
    if (response.canceled || response.selection >= CONFIG.economy.tradeItems.length) return;
    promptTradeAmount(player, CONFIG.economy.tradeItems[response.selection]);
  }).catch(() => {});
}

function openShopCatalog(player) {
  const form = new ActionFormData()
    .title('Katalog Shop')
    .body(`Koin: ${getCoins(player)}\nPilih item yang ingin dibeli.`);
  for (const item of CONFIG.economy.shopItems) {
    form.button(`${item.name}\n${item.price} koin`);
  }
  form.button('Tutup');

  form.show(player).then(response => {
    if (response.canceled || response.selection >= CONFIG.economy.shopItems.length) return;
    promptShopAmount(player, CONFIG.economy.shopItems[response.selection]);
  }).catch(() => {});
}

function openPriceInfo(player) {
  const message = CONFIG.economy.shopItems
    .map(item => `• ${item.name} [${item.category}] = ${item.price} koin`)
    .join('\n');
  player.sendMessage(`Harga store:\n${message}`);
}

function promptTradeAmount(player, item) {
  const form = new ModalFormData()
    .title(`Jual ${item.name}`)
    .textField(`Jumlah ${item.name} yang dijual`, '1', '1')
    .submitButton('Tukar');

  form.show(player).then(response => {
    if (response.canceled) return;
    const amount = Math.max(1, Number(response.formValues?.[0] || 1));
    const result = removeItems(player, item.id, amount);
    if (!result.success) {
      player.sendMessage(`Server_MC: item ${item.name} tidak cukup.`);
      return;
    }
    addCoins(player, amount * item.coinPerItem);
    player.sendMessage(`Server_MC: kamu menukar ${amount} ${item.name} menjadi ${amount * item.coinPerItem} koin.`);
  }).catch(() => {});
}

function promptShopAmount(player, item) {
  const form = new ModalFormData()
    .title(`Beli ${item.name}`)
    .textField('Jumlah pembelian', '1', String(item.amount || 1))
    .submitButton('Beli');

  form.show(player).then(response => {
    if (response.canceled) return;
    const amount = Math.max(1, Number(response.formValues?.[0] || 1));
    const total = amount * item.price;
    if (getCoins(player) < total) {
      player.sendMessage('Server_MC: koin tidak cukup.');
      return;
    }
    if (removeCoins(player, total)) {
      giveNamedItem(player, item.id, item.name, [`Harga: ${item.price} koin`, `Kategori: ${item.category}`]);
      player.sendMessage(`Server_MC: pembelian ${item.name} berhasil.`);
    }
  }).catch(() => {});
}

function openTransferItemForm(player) {
  const form = new ModalFormData()
    .title('Kirim Item')
    .textField('Nama pemain tujuan', 'Player')
    .textField('Item id', 'minecraft:diamond')
    .textField('Jumlah', '1', '1')
    .submitButton('Kirim');

  form.show(player).then(response => {
    if (response.canceled) return;
    const targetName = String(response.formValues?.[0] || '').trim();
    const itemId = String(response.formValues?.[1] || '').trim();
    const amount = Math.max(1, Number(response.formValues?.[2] || 1));
    if (!targetName || !itemId) return;
    player.sendMessage(`Server_MC: transfer item ke ${targetName} masih placeholder dan akan dihubungkan ke sistem player lookup.`);
    player.sendMessage(`Server_MC: target item ${itemId} x${amount}.`);
  }).catch(() => {});
}

function openTransferCoinForm(player) {
  const form = new ModalFormData()
    .title('Kirim Koin')
    .textField('Nama pemain tujuan', 'Player')
    .textField('Jumlah koin', '10', '10')
    .submitButton('Kirim');

  form.show(player).then(response => {
    if (response.canceled) return;
    const targetName = String(response.formValues?.[0] || '').trim();
    const amount = Math.max(1, Number(response.formValues?.[1] || 1));
    if (!targetName) return;
    if (!removeCoins(player, amount)) {
      player.sendMessage('Server_MC: koin tidak cukup.');
      return;
    }
    player.sendMessage(`Server_MC: pengiriman koin ke ${targetName} masih placeholder sampai data pemain lintas sesi disambungkan.`);
  }).catch(() => {});
}

function removeItems(player, itemId, amount) {
  const inventory = player.getComponent('minecraft:inventory')?.container;
  if (!inventory) return { success: false };
  let remaining = amount;
  for (let slot = 0; slot < inventory.size; slot += 1) {
    const stack = inventory.getItem(slot);
    if (!stack || stack.typeId !== itemId) continue;
    const take = Math.min(stack.amount, remaining);
    stack.amount -= take;
    remaining -= take;
    if (stack.amount <= 0) {
      inventory.setItem(slot, undefined);
    } else {
      inventory.setItem(slot, stack);
    }
    if (remaining <= 0) break;
  }
  return { success: remaining <= 0 };
}

function ensureCoins(player) {
  const objective = getCoinObjective();
  const identity = player.scoreboardIdentity;
  if (!identity) return;
  try {
    objective.getScore(identity);
  } catch {
    objective.setScore(identity, CONFIG.economy.startingCoins);
  }
}

function getCoins(player) {
  const objective = getCoinObjective();
  const identity = player.scoreboardIdentity;
  if (!identity) return CONFIG.economy.startingCoins;
  try {
    return objective.getScore(identity) ?? CONFIG.economy.startingCoins;
  } catch {
    return CONFIG.economy.startingCoins;
  }
}

function addCoins(player, amount) {
  const objective = getCoinObjective();
  const identity = player.scoreboardIdentity;
  if (!identity) return;
  objective.setScore(identity, getCoins(player) + amount);
}

function removeCoins(player, amount) {
  const coins = getCoins(player);
  if (coins < amount) return false;
  const objective = getCoinObjective();
  const identity = player.scoreboardIdentity;
  if (!identity) return false;
  objective.setScore(identity, coins - amount);
  return true;
}

function ensureCoinObjective() {
  getCoinObjective();
}

function getCoinObjective() {
  const existing = world.scoreboard.getObjective(COIN_OBJECTIVE);
  if (existing) return existing;
  return world.scoreboard.addObjective(COIN_OBJECTIVE, CONFIG.economy.currencyName);
}
