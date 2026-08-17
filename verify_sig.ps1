$sig = Get-Content 'C:\roblox-crosshair-manager\src-tauri\target\release\bundle\nsis\Roblox Crosshair Manager_1.0.4_x64-setup.exe.sig' -Raw
$latest = (Get-Content 'C:\roblox-crosshair-manager\latest.json' -Raw | ConvertFrom-Json).platforms.'windows-x86_64'.signature
if ($sig.Trim() -eq $latest.Trim()) { 'MATCH' } else { 'MISMATCH' }
