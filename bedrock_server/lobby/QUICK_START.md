# Bedrock Server - Quick Start Guide

## Prerequisites

- Minecraft Bedrock Edition (Java or Windows 10/11)
- Bedrock Server files must be in this directory

## How to Start Server

### Method 1: Double-click (Recommended)
1. Navigate to: `bedrock_server/lobby/`
2. Double-click `start_server.bat`
3. Server console will open
4. Wait for "Server started" message

### Method 2: Command Line
```
cd bedrock_server\lobby
start_server.bat
```

## Configuration

Edit `server.properties` to customize:
- `server-name` - Server name
- `max-players` - Maximum players (default: 10)
- `gamemode` - survival/creative
- `difficulty` - peaceful/easy/normal/hard
- `pvp` - Enable PvP (true/false)

## Connecting to Server

1. Start the server first (run start_server.bat)
2. Open Minecraft Bedrock
3. Go to "Play"
4. Join your server from LAN Games list

## Troubleshooting

### "bedrock_server.exe not found"
- Ensure `bedrock_server.exe` is in this directory

### Server won't start
- Check Windows Firewall settings
- Ensure port 19132 (UDP) is open

### Can't connect to server
- Server must be running
- Ensure both players are on same network
- Check Firewall settings

## Important Files

- `server.properties` - Server configuration
- `worlds/Maharlika_City/` - Main world data
- `behavior_packs/` - Custom behavior packs
- `resource_packs/` - Custom resource packs
- `logs/` - Server log files

## Support

For more info, see: `bedrock_server/README.md`
