# Bedrock Server - Lobby

Main Bedrock Server installation directory.

## Quick Start

**To start the server:** Double-click `start_server.bat`

See [QUICK_START.md](QUICK_START.md) for detailed instructions.

## Directory Structure

```
lobby/
├── start_server.bat           # Server launcher
├── bedrock_server.exe         # Server executable (required)
├── server.properties          # Server configuration
├── behavior_packs/            # Installed behavior packs
├── resource_packs/            # Installed resource packs
├── worlds/                    # World data
│   └── Maharlika_City/        # Main server world
├── world_templates/           # World templates
├── development_*              # Development resource/behavior/skin packs
└── logs/                      # Server log files
```

## Key Files

- **start_server.bat** - Run this to start the server
- **server.properties** - Configure server settings (name, difficulty, etc)
- **worlds/** - World data and player progress
- **behavior_packs/** - Functional packs (game mechanics)
- **resource_packs/** - Visual packs (textures, models)

## Configuration

Edit `server.properties` to customize:
```properties
server-name=Maharlika City Server
max-players=10
gamemode=survival
difficulty=normal
pvp=true
```

See [QUICK_START.md](QUICK_START.md) for more details.

## Troubleshooting

### Server won't start
1. Check if `bedrock_server.exe` exists
2. Ensure Windows Firewall allows the server
3. Check port 19132 (UDP) availability

### Can't connect to server
1. Ensure server is running
2. Check if both players are on same network
3. Verify Firewall settings

## Support

See parent directory: `../README.md`
