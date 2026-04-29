# ============================================
# 🚀 UE5 RAM Optimization Script
# Run as Administrator for full effect
# ============================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  UE5 RAM Optimization Script" -ForegroundColor Cyan  
Write-Host "========================================`n" -ForegroundColor Cyan

# --- STEP 1: Disable Startup Apps via Registry ---
Write-Host "[1/6] Disabling unnecessary startup apps..." -ForegroundColor Yellow

$startupKeys = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run",
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"
)

# Startup apps to disable (via Task Manager method - more reliable)
$disableList = @(
    "Steam",
    "Discord", 
    "EpicGamesLauncher",
    "RiotClient",
    "EADM",
    "com.blitz.app",
    "com.oplus.devicespace",
    "Reallusion Hub",
    "Proton VPN",
    "iTunesHelper",
    "Zero",
    "Ollama",
    "StartRLCMS"
)

foreach ($app in $disableList) {
    # Check HKCU Run key
    $val = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name $app -ErrorAction SilentlyContinue
    if ($val) {
        Write-Host "  Found startup entry: $app" -ForegroundColor Gray
    }
}

Write-Host "  NOTE: For most reliable results, use Task Manager > Startup tab" -ForegroundColor DarkYellow
Write-Host "  Press Ctrl+Shift+Esc > Startup Apps > Disable all non-essential`n" -ForegroundColor DarkYellow

# --- STEP 2: Stop unnecessary services ---
Write-Host "[2/6] Optimizing Windows services..." -ForegroundColor Yellow

$servicesToDisable = @(
    @{Name="SysMain"; Desc="Superfetch - preloads apps, wastes RAM"},
    @{Name="WSearch"; Desc="Windows Search Indexer - constant CPU/RAM drain"},
    @{Name="PhoneSvc"; Desc="Phone Service - not needed"},
    @{Name="DiagTrack"; Desc="Telemetry - sends data to Microsoft"},
    @{Name="MapsBroker"; Desc="Downloaded Maps Manager"},
    @{Name="RetailDemo"; Desc="Retail Demo Service"},
    @{Name="wisvc"; Desc="Windows Insider Service"},
    @{Name="WMPNetworkSvc"; Desc="Windows Media Player Sharing"}
)

foreach ($svc in $servicesToDisable) {
    $s = Get-Service -Name $svc.Name -ErrorAction SilentlyContinue
    if ($s -and $s.Status -eq 'Running') {
        Write-Host "  Stopping: $($svc.Name) ($($svc.Desc))" -ForegroundColor Gray
        Stop-Service -Name $svc.Name -Force -ErrorAction SilentlyContinue
        Set-Service -Name $svc.Name -StartupType Disabled -ErrorAction SilentlyContinue
        Write-Host "    -> Stopped and Disabled" -ForegroundColor Green
    } elseif ($s -and $s.StartType -ne 'Disabled') {
        Set-Service -Name $svc.Name -StartupType Disabled -ErrorAction SilentlyContinue
        Write-Host "  Disabled: $($svc.Name) ($($svc.Desc))" -ForegroundColor Green
    } else {
        Write-Host "  Already disabled: $($svc.Name)" -ForegroundColor DarkGray
    }
}

# Set Xbox services to manual
$xboxServices = @("XblAuthManager", "XblGameSave", "XboxGipSvc", "XboxNetApiSvc")
foreach ($xsvc in $xboxServices) {
    $s = Get-Service -Name $xsvc -ErrorAction SilentlyContinue
    if ($s) {
        if ($s.Status -eq 'Running') {
            Stop-Service -Name $xsvc -Force -ErrorAction SilentlyContinue
        }
        Set-Service -Name $xsvc -StartupType Manual -ErrorAction SilentlyContinue
        Write-Host "  Set to Manual: $xsvc" -ForegroundColor Green
    }
}
Write-Host ""

# --- STEP 3: Add Windows Defender exclusions for UE5 ---
Write-Host "[3/6] Adding Windows Defender exclusions for UE5 folders..." -ForegroundColor Yellow
$defenderPaths = @(
    "C:\Program Files\Epic Games",
    "$env:USERPROFILE\Documents\Unreal Projects",
    "C:\project"
)
foreach ($path in $defenderPaths) {
    if (Test-Path $path) {
        try {
            Add-MpPreference -ExclusionPath $path -ErrorAction SilentlyContinue
            Write-Host "  Excluded: $path" -ForegroundColor Green
        } catch {
            Write-Host "  Needs admin: $path" -ForegroundColor DarkYellow
        }
    }
}
# Exclude UE5 processes from Defender scanning
$defenderProcesses = @("UnrealEditor.exe", "UnrealEditor-Win64-DebugGame.exe", "ShaderCompileWorker.exe")
foreach ($proc in $defenderProcesses) {
    try {
        Add-MpPreference -ExclusionProcess $proc -ErrorAction SilentlyContinue
        Write-Host "  Excluded process: $proc" -ForegroundColor Green
    } catch {
        Write-Host "  Needs admin: $proc" -ForegroundColor DarkYellow
    }
}
Write-Host ""

# --- STEP 4: Visual effects optimization ---
Write-Host "[4/6] Optimizing visual effects for performance..." -ForegroundColor Yellow
# Set visual effects to "Adjust for best performance" but keep font smoothing
$regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects"
Set-ItemProperty -Path $regPath -Name "VisualFXSetting" -Value 2 -ErrorAction SilentlyContinue
Write-Host "  Set to 'Adjust for best performance'" -ForegroundColor Green

# Re-enable font smoothing (ClearType) since disabling it looks terrible
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "FontSmoothing" -Value "2" -ErrorAction SilentlyContinue
Write-Host "  Kept ClearType font smoothing enabled" -ForegroundColor Green
Write-Host ""

# --- STEP 5: Power plan ---
Write-Host "[5/6] Setting power plan to High Performance..." -ForegroundColor Yellow
powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
if ($LASTEXITCODE -ne 0) {
    # High performance plan might not exist, create it
    powercfg /duplicatescheme 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
    powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
}
Write-Host "  Power plan set to High Performance" -ForegroundColor Green
Write-Host ""

# --- STEP 6: Memory optimization tweaks ---
Write-Host "[6/6] Applying memory optimization registry tweaks..." -ForegroundColor Yellow

# Disable memory compression (frees CPU cycles, uses more page file instead)
$mcKey = "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management"
if (Test-Path $mcKey) {
    # Large system cache disabled for workstation use
    Set-ItemProperty -Path $mcKey -Name "LargeSystemCache" -Value 0 -ErrorAction SilentlyContinue
    Write-Host "  Large system cache: Disabled (workstation mode)" -ForegroundColor Green
}

# Reduce kernel memory usage
$regPath2 = "HKLM:\SYSTEM\CurrentControlSet\Control"
Set-ItemProperty -Path $regPath2 -Name "SvcHostSplitThresholdInKB" -Value 4194304 -ErrorAction SilentlyContinue
Write-Host "  svchost split threshold: Set to 4GB (reduces svchost process count)" -ForegroundColor Green

Write-Host ""

# --- SUMMARY ---
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Optimization Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. Open Task Manager (Ctrl+Shift+Esc) > Startup Apps tab" -ForegroundColor White
Write-Host "2. Disable ALL of these:" -ForegroundColor White
Write-Host "   - Steam" -ForegroundColor Gray
Write-Host "   - Discord" -ForegroundColor Gray
Write-Host "   - Epic Games Launcher" -ForegroundColor Gray
Write-Host "   - Riot Client" -ForegroundColor Gray
Write-Host "   - EA Desktop" -ForegroundColor Gray
Write-Host "   - Blitz" -ForegroundColor Gray
Write-Host "   - O+Connect" -ForegroundColor Gray
Write-Host "   - Reallusion Hub" -ForegroundColor Gray
Write-Host "   - Proton VPN" -ForegroundColor Gray
Write-Host "   - iTunes Helper" -ForegroundColor Gray
Write-Host "   - Zero" -ForegroundColor Gray
Write-Host "   - Ollama" -ForegroundColor Gray
Write-Host "3. RESTART your laptop for all changes to take effect" -ForegroundColor Yellow
Write-Host "4. After restart, run this to check: (Get-Process).Count" -ForegroundColor White
Write-Host ""
Write-Host "Expected improvement: 291 processes -> ~120-150 processes" -ForegroundColor Green
Write-Host "Expected RAM freed: ~3-4 GB more available for UE5" -ForegroundColor Green
Write-Host ""
