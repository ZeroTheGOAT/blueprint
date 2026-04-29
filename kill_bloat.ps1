# ============================================
# ⚡ Quick RAM Cleaner - Run BEFORE opening UE5
# No admin needed for this one
# ============================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Quick RAM Cleaner for UE5 Dev" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Show current state
$before = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1MB,2)
$procsBefore = (Get-Process).Count
Write-Host "Before: $procsBefore processes | $before GB free RAM`n" -ForegroundColor DarkGray

# Processes to kill (safe to kill - they auto-reopen when you launch them)
$killList = @(
    # Game launchers (not needed while developing)
    @{Name="steam";            Desc="Steam"},
    @{Name="steamservice";     Desc="Steam Service"},
    @{Name="steamwebhelper";   Desc="Steam WebHelper"},
    @{Name="Discord";          Desc="Discord"},
    @{Name="DiscordPTB";       Desc="Discord PTB"},
    @{Name="RiotClientServices"; Desc="Riot Client"},
    @{Name="RiotClientCrashHandler"; Desc="Riot Crash Handler"},
    @{Name="vgtray";           Desc="Riot Vanguard Tray"},
    @{Name="EADesktop";        Desc="EA Desktop"},
    @{Name="EALauncher";       Desc="EA Launcher"},
    @{Name="EABackgroundService"; Desc="EA Background"},
    @{Name="Blitz";            Desc="Blitz App"},

    # Phone/sync apps
    @{Name="O+Connect";        Desc="O+Connect (OPPO phone)"},
    @{Name="WhatsApp";         Desc="WhatsApp Desktop"},
    @{Name="WhatsApp.Root";    Desc="WhatsApp Root"},
    
    # Misc
    @{Name="iTunesHelper";     Desc="iTunes Helper"},
    @{Name="iTunes";           Desc="iTunes"},
    @{Name="ollama";           Desc="Ollama AI (restart when needed)"},
    @{Name="devin";            Desc="Devin AI"},
    @{Name="ProtonVPN.Client"; Desc="ProtonVPN"},
    @{Name="ProtonVPN.Launcher"; Desc="ProtonVPN Launcher"},
    
    # Browser (the biggest RAM hog after IDEs!)
    @{Name="chrome";           Desc="Google Chrome"},
    @{Name="msedge";           Desc="Microsoft Edge"},
    @{Name="brave";            Desc="Brave Browser"}
)

$totalFreed = 0
foreach ($proc in $killList) {
    $processes = Get-Process -Name $proc.Name -ErrorAction SilentlyContinue
    if ($processes) {
        $ramMB = [math]::Round(($processes | Measure-Object WorkingSet64 -Sum).Sum/1MB,1)
        $totalFreed += $ramMB
        Write-Host "  Killing: $($proc.Desc) ($($processes.Count) processes, $ramMB MB)" -ForegroundColor Yellow
        $processes | Stop-Process -Force -ErrorAction SilentlyContinue
    }
}

# Epic Games Launcher - kill ONLY if no UE5 project is being opened right now
$epic = Get-Process -Name "EpicGamesLauncher" -ErrorAction SilentlyContinue
$epicWeb = Get-Process -Name "EpicWebHelper" -ErrorAction SilentlyContinue
if ($epic -or $epicWeb) {
    $ue = Get-Process -Name "UnrealEditor" -ErrorAction SilentlyContinue
    if ($ue) {
        $epicRAM = 0
        if ($epic) { $epicRAM += [math]::Round(($epic | Measure-Object WorkingSet64 -Sum).Sum/1MB,1) }
        if ($epicWeb) { $epicRAM += [math]::Round(($epicWeb | Measure-Object WorkingSet64 -Sum).Sum/1MB,1) }
        $totalFreed += $epicRAM
        Write-Host "  Killing: Epic Games Launcher ($epicRAM MB) - UE5 already running!" -ForegroundColor Yellow
        if ($epic) { $epic | Stop-Process -Force -ErrorAction SilentlyContinue }
        if ($epicWeb) { $epicWeb | Stop-Process -Force -ErrorAction SilentlyContinue }
    } else {
        Write-Host "  Skipping: Epic Games Launcher (UE5 not running yet)" -ForegroundColor DarkGray
    }
}

Start-Sleep -Seconds 2

# Show results
$after = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1MB,2)
$procsAfter = (Get-Process).Count
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  Results:" -ForegroundColor Green
Write-Host "  Processes: $procsBefore -> $procsAfter (killed $($procsBefore - $procsAfter))" -ForegroundColor White
Write-Host "  Free RAM:  $before GB -> $after GB (+$([math]::Round($after - $before, 2)) GB)" -ForegroundColor White
Write-Host "  Est. freed: ~$([math]::Round($totalFreed/1024,2)) GB" -ForegroundColor White
Write-Host "========================================`n" -ForegroundColor Green
Write-Host "TIP: Now open UE5 for maximum available RAM!" -ForegroundColor Cyan
Write-Host ""
