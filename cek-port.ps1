$l = New-Object System.Net.HttpListener
$l.Prefixes.Add('http://localhost:8090/')
try { $l.Start(); $l.Stop(); $l.Close(); exit 0 }
catch { Write-Host ("PORT 8090 GAGAL DIIKAT: " + $_.Exception.Message); exit 1 }