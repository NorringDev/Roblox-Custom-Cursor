$sig = Get-Content 'C:\roblox-crosshair-manager\src-tauri\target\release\bundle\nsis\Roblox Crosshair Manager_1.0.2_x64-setup.exe.sig' -Raw
$latest = (Get-Content 'C:\roblox-crosshair-manager\latest.json' -Raw | ConvertFrom-Json).platforms.'windows-x86_64'.signature
$sigTrim = $sig.Trim()
$latestTrim = $latest.Trim()
if ($sigTrim -eq $latestTrim) {
    Write-Output 'MATCH'
} else {
    Write-Output 'MISMATCH'
    Write-Output "SIG:  $sigTrim"
    Write-Output "LATEST: $latestTrim"
    for ($i = 0; $i -lt [Math]::Max($sigTrim.Length, $latestTrim.Length); $i++) {
        if ($i -ge $sigTrim.Length -or $i -ge $latestTrim.Length -or $sigTrim[$i] -ne $latestTrim[$i]) {
            Write-Output "First diff at index $i : sig='$($sigTrim[$i])' latest='$($latestTrim[$i])'"
            break
        }
    }
}
