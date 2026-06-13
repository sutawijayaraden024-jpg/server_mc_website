export const CONFIG = {
  websiteUrl: 'https://server-mc-website.pages.dev',
  loginSpawn: { x: 951, y: 48, z: -574 },
  adminSpawn: { x: 1600, y: 31, z: -241 },
  memberSpawn: { x: -2068, y: 33, z: -2043 },
  lobbyBarrier: {
    enabled: false,
    min: { x: 0, y: 0, z: 0 },
    max: { x: 0, y: 0, z: 0 }
  },
  welcomeFireworks: {
    enabled: true,
    burstCount: 5,
    message: 'Selamat datang di Server_MC! Login dulu untuk masuk ke dunia.'
  },
  guideBook: {
    enabled: true,
    itemId: 'minecraft:book',
    title: 'Server_MC Guide Book',
    lore: [
      'Panduan server, ekonomi, dan aturan.',
      'Kamu bisa buka buku ini kapan saja.'
    ]
  },
  phoneItem: {
    enabled: true,
    itemId: 'minecraft:clock',
    title: 'Server_MC Phone',
    lore: [
      'Buka menu transfer item dan koin.',
      'Item sementara sampai texture custom dibuat.'
    ]
  },
  economy: {
    currencyName: 'Koin',
    startingCoins: 0,
    tradeItems: [
      { id: 'minecraft:wheat', name: 'Wheat', coinPerItem: 1 },
      { id: 'minecraft:carrot', name: 'Carrot', coinPerItem: 1 },
      { id: 'minecraft:potato', name: 'Potato', coinPerItem: 1 },
      { id: 'minecraft:beetroot', name: 'Beetroot', coinPerItem: 2 },
      { id: 'minecraft:sugar_cane', name: 'Sugar Cane', coinPerItem: 2 },
      { id: 'minecraft:pumpkin', name: 'Pumpkin', coinPerItem: 4 },
      { id: 'minecraft:melon_slice', name: 'Melon Slice', coinPerItem: 2 }
    ],
    shopItems: [
      { id: 'minecraft:diamond_sword', name: 'Diamond Sword', price: 75, category: 'Weapon' },
      { id: 'minecraft:diamond_helmet', name: 'Diamond Helmet', price: 60, category: 'Armor' },
      { id: 'minecraft:elytra', name: 'Elytra', price: 250, category: 'Special' },
      { id: 'minecraft:oak_sapling', name: 'Oak Sapling Pack', price: 10, category: 'Utility', amount: 16 }
    ]
  },
  storeNpcLocations: [],
  tradeNpcLocations: [],
  adminJoinTag: 'servermc_admin',
  memberJoinTag: 'servermc_member'
};
