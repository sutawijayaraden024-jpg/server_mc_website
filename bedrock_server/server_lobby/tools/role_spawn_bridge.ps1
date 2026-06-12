param(
  [string]$ServerRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$roleSpawnsPath = Join-Path $ServerRoot 'role_spawns.json'
$logPath = Join-Path $ServerRoot 'logs\server.log'

if (-not (Test-Path -LiteralPath $roleSpawnsPath)) {
  Write-Error "role_spawns.json tidak ditemukan di $roleSpawnsPath"
  exit 1
}

if (-not (Test-Path -LiteralPath $logPath)) {
  Write-Error "server.log tidak ditemukan di $logPath"
  exit 1
}

$config = Get-Content -LiteralPath $roleSpawnsPath -Raw | ConvertFrom-Json
$accountsByXuid = @{}
foreach ($account in $config.accounts) {
  if ($account.xuid) {
    $accountsByXuid[$account.xuid] = $account
  }
}

function Get-SpawnCommand {
  param(
    [string]$PlayerName,
    [string]$Xuid
  )

  $account = $accountsByXuid[$Xuid]
  $role = if ($account -and $account.role) { $account.role } else { $config.default_role }
  $spawn = $config.spawns.$role

  if (-not $spawn) {
    $role = $config.default_role
    $spawn = $config.spawns.$role
  }

  [PSCustomObject]@{
    Player = $PlayerName
    Xuid = $Xuid
    Role = $role
    Command = "tp `"$PlayerName`" $($spawn.x) $($spawn.y) $($spawn.z)"
  }
}

Write-Host "Role spawn bridge aktif."
Write-Host "Memantau: $logPath"
Write-Host "Saat player spawn, jalankan command yang muncul di console server atau chat operator."
Write-Host ""

Get-Content -LiteralPath $logPath -Wait -Tail 0 | ForEach-Object {
  if ($_ -match 'Player Spawned:\s+(.+?)\s+xuid:\s+([0-9]+)') {
    $result = Get-SpawnCommand -PlayerName $Matches[1] -Xuid $Matches[2]
    Write-Host "[$($result.Role)] $($result.Player) / $($result.Xuid)"
    Write-Host "/$($result.Command)"
    Write-Host ""
  }
}
