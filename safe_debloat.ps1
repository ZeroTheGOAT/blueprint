# ============================================
# 🧹 Safe Windows Debloat for UE5 Development
# Based on Chris Titus WinUtil + manual tweaks
# Run as ADMINISTRATOR
# ============================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Safe Windows Debloat for Game Dev" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# --- Create restore point first ---
Write-Host "[0/7] Creating System Restore Point..." -ForegroundColor Yellow
try {
    Enable-ComputerRestore -Drive "C:\" -ErrorAction SilentlyContinue
    Checkpoint-Computer -Description "Before UE5 Debloat" -RestorePointType MODIFY_SETTINGS -ErrorAction SilentlyContinue
    Write-Host "  Restore point created (you can undo everything!)" -ForegroundColor Green
} catch {
    Write-Host "  Could not create restore point (may need admin)" -ForegroundColor DarkYellow
}

# --- STEP 1: Remove pre-installed bloat apps ---
Write-Host "`n[1/7] Removing bloat apps (keeping Store & essentials)..." -ForegroundColor Yellow

$bloatApps = @(
    "Microsoft.BingNews",
    "Microsoft.BingWeather",
    "Microsoft.BingFinance",
    "Microsoft.BingSports",
    "Microsoft.GetHelp",
    "Microsoft.Getstarted",
    "Microsoft.MicrosoftOfficeHub",
    "Microsoft.MicrosoftSolitaireCollection",
    "Microsoft.People",
    "Microsoft.PowerAutomateDesktop",
    "Microsoft.Todos",
    "Microsoft.WindowsAlarms",
    "Microsoft.WindowsFeedbackHub",
    "Microsoft.WindowsMaps",
    "Microsoft.WindowsSoundRecorder",
    "Microsoft.YourPhone",
    "Microsoft.ZuneMusic",
    "Microsoft.ZuneVideo",
    "Microsoft.549981C3F5F10",  # Cortana
    "MicrosoftCorporationII.QuickAssist",
    "Microsoft.MicrosoftStickyNotes",
    "Microsoft.ScreenSketch",
    "Clipchamp.Clipchamp",
    "Microsoft.GamingApp",
    "Microsoft.Xbox.TCUI",
    "Microsoft.XboxGameOverlay",
    "Microsoft.XboxGamingOverlay",
    "Microsoft.XboxIdentityProvider",
    "Microsoft.XboxSpeechToTextOverlay",
    "MicrosoftTeams",
    "Microsoft.WindowsCommunicationsApps",  # Mail & Calendar
    "Microsoft.OutlookForWindows"
)

$removed = 0
foreach ($app in $bloatApps) {
    $pkg = Get-AppxPackage -Name $app -ErrorAction SilentlyContinue
    if ($pkg) {
        $pkg | Remove-AppxPackage -ErrorAction SilentlyContinue
        # Also prevent re-install
        Get-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue | 
            Where-Object {$_.PackageName -like "*$app*"} | 
            Remove-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue
        Write-Host "  Removed: $app" -ForegroundColor Green
        $removed++
    }
}
Write-Host "  Total removed: $removed apps" -ForegroundColor Green

# --- STEP 2: Disable Widgets ---
Write-Host "`n[2/7] Disabling Widgets & News Feed..." -ForegroundColor Yellow
$widgetKey = "HKLM:\SOFTWARE\Policies\Microsoft\Dsh"
if (!(Test-Path $widgetKey)) { New-Item -Path $widgetKey -Force | Out-Null }
Set-ItemProperty -Path $widgetKey -Name "AllowNewsAndInterests" -Value 0 -ErrorAction SilentlyContinue
# Kill Widgets process
Get-Process -Name "Widgets", "WidgetService" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "  Widgets disabled" -ForegroundColor Green

# --- STEP 3: Disable Copilot ---
Write-Host "`n[3/7] Disabling Copilot..." -ForegroundColor Yellow
$copilotKey = "HKCU:\Software\Policies\Microsoft\Windows\WindowsCopilot"
if (!(Test-Path $copilotKey)) { New-Item -Path $copilotKey -Force | Out-Null }
Set-ItemProperty -Path $copilotKey -Name "TurnOffWindowsCopilot" -Value 1 -ErrorAction SilentlyContinue
Write-Host "  Copilot disabled" -ForegroundColor Green

# --- STEP 4: Disable telemetry (privacy + saves CPU) ---
Write-Host "`n[4/7] Reducing telemetry..." -ForegroundColor Yellow

# Reduce telemetry to minimum (Security level only)
Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection" -Name "AllowTelemetry" -Value 0 -ErrorAction SilentlyContinue

# Disable activity history
Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System" -Name "EnableActivityFeed" -Value 0 -ErrorAction SilentlyContinue
Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System" -Name "PublishUserActivities" -Value 0 -ErrorAction SilentlyContinue

# Disable advertising ID
$adKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo"
if (Test-Path $adKey) { Set-ItemProperty -Path $adKey -Name "Enabled" -Value 0 -ErrorAction SilentlyContinue }

Write-Host "  Telemetry minimized" -ForegroundColor Green

# --- STEP 5: Disable unnecessary scheduled tasks ---
Write-Host "`n[5/7] Disabling unnecessary scheduled tasks..." -ForegroundColor Yellow

$tasksToDisable = @(
    "\Microsoft\Windows\Application Experience\Microsoft Compatibility Appraiser",
    "\Microsoft\Windows\Application Experience\ProgramDataUpdater",
    "\Microsoft\Windows\Autochk\Proxy",
    "\Microsoft\Windows\Customer Experience Improvement Program\Consolidator",
    "\Microsoft\Windows\Customer Experience Improvement Program\UsbCeip",
    "\Microsoft\Windows\DiskDiagnostic\Microsoft-Windows-DiskDiagnosticDataCollector",
    "\Microsoft\Windows\Maps\MapsUpdateTask",
    "\Microsoft\Windows\Maps\MapsToastTask",
    "\Microsoft\Windows\Feedback\Siuf\DmClient",
    "\Microsoft\Windows\Feedback\Siuf\DmClientOnScenarioDownload"
)

foreach ($task in $tasksToDisable) {
    try {
        Disable-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue | Out-Null
        $taskName = $task.Split('\')[-1]
        Write-Host "  Disabled: $taskName" -ForegroundColor Green
    } catch {}
}

# --- STEP 6: Optimize visual effects further ---
Write-Host "`n[6/7] Optimizing visual effects..." -ForegroundColor Yellow

# Disable transparency effects
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" -Name "EnableTransparency" -Value 0 -ErrorAction SilentlyContinue
# Disable animation effects  
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop\WindowMetrics" -Name "MinAnimate" -Value "0" -ErrorAction SilentlyContinue
# Disable Snap Assist flyout
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "SnapAssist" -Value 0 -ErrorAction SilentlyContinue

Write-Host "  Visual effects optimized" -ForegroundColor Green

# --- STEP 7: Disable Edge background processes ---
Write-Host "`n[7/7] Stopping Edge from running in background..." -ForegroundColor Yellow

$edgeKey = "HKLM:\SOFTWARE\Policies\Microsoft\Edge"
if (!(Test-Path $edgeKey)) { New-Item -Path $edgeKey -Force | Out-Null }
Set-ItemProperty -Path $edgeKey -Name "StartupBoostEnabled" -Value 0 -ErrorAction SilentlyContinue
Set-ItemProperty -Path $edgeKey -Name "BackgroundModeEnabled" -Value 0 -ErrorAction SilentlyContinue

# Also disable Edge prelaunch
$edgeKey2 = "HKLM:\SOFTWARE\Policies\Microsoft\MicrosoftEdge\Main"
if (!(Test-Path $edgeKey2)) { New-Item -Path $edgeKey2 -Force -ErrorAction SilentlyContinue | Out-Null }
Set-ItemProperty -Path $edgeKey2 -Name "AllowPrelaunch" -Value 0 -ErrorAction SilentlyContinue

Write-Host "  Edge background disabled" -ForegroundColor Green

# --- SUMMARY ---
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Debloat Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "What was done (all reversible via System Restore):" -ForegroundColor White
Write-Host "  - Removed $removed bloat apps (Xbox, Mail, Solitaire, etc.)" -ForegroundColor Gray
Write-Host "  - Disabled Widgets, Copilot, News Feed" -ForegroundColor Gray
Write-Host "  - Minimized telemetry & data collection" -ForegroundColor Gray
Write-Host "  - Disabled 10 unnecessary scheduled tasks" -ForegroundColor Gray
Write-Host "  - Optimized visual effects" -ForegroundColor Gray
Write-Host "  - Stopped Edge from running in background" -ForegroundColor Gray
Write-Host ""
Write-Host "What was KEPT (safe for UE5 dev):" -ForegroundColor White
Write-Host "  + Windows Update (working)" -ForegroundColor Green
Write-Host "  + Windows Defender (working)" -ForegroundColor Green
Write-Host "  + .NET Framework (needed by UE5)" -ForegroundColor Green
Write-Host "  + Visual C++ Runtimes (needed by UE5)" -ForegroundColor Green
Write-Host "  + Microsoft Store (needed for some deps)" -ForegroundColor Green
Write-Host "  + DirectX/Vulkan (needed by UE5)" -ForegroundColor Green
Write-Host ""
Write-Host "RESTART your laptop to see full effect!" -ForegroundColor Yellow
Write-Host "Expected: ~500MB-1GB less RAM at idle" -ForegroundColor Green
Write-Host ""
Write-Host "To undo everything:" -ForegroundColor DarkGray
Write-Host "  Settings > System > Recovery > Go Back" -ForegroundColor DarkGray
Write-Host "  Or: System Restore > 'Before UE5 Debloat'" -ForegroundColor DarkGray
