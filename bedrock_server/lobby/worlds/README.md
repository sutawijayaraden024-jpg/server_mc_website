# Worlds

This directory contains world data and player progress.

## Main World

- **Maharlika_City/** - Main server world with all player data and builds

## World Structure

Each world folder contains:
```
world_name/
├── level.dat          # World data
├── levelname.txt      # World display name
├── world_behavior_packs.json    # Active behavior packs
├── world_resource_packs.json    # Active resource packs
├── world_icon.jpeg    # World icon
├── behavior_packs/    # World-specific behavior packs
├── resource_packs/    # World-specific resource packs
└── db/                # World database (block/entity data)
```

## Backup

World data is stored in `../MaharlikaCityV.8.0.mcworld` backup file.

## Player Data

Player progress, inventory, and stats are stored in the `db/` folder.

## Important Files

- `level.dat` - World configuration
- `world_behavior_packs.json` - Active behavior pack list
- `world_resource_packs.json` - Active resource pack list
- `db/` - World and player data (DO NOT EDIT)
