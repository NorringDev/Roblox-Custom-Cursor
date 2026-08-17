$key = (Get-Content 'C:\roblox-crosshair-manager\src-tauri\crosshair-update.key' -Raw).Trim()
$env:TAURI_SIGNING_PRIVATE_KEY = $key
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = 'crosshair-update.key'
Set-Location 'C:\roblox-crosshair-manager'
& cargo tauri build
Write-Host ""
Write-Host "Build complete! Sig files are in:"
Write-Host "  NSIS: src-tauri\target\release\bundle\nsis\"
Write-Host "  MSI:  src-tauri\target\release\bundle\msi\"
