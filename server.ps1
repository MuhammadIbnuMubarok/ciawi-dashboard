$root=(Get-Location).Path; $listener=New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8090/"); $listener.Start()
Write-Host "SERVER DASHBOARD CIAWI AKTIF di http://localhost:8090 - JANGAN TUTUP"
while ($listener.IsListening) { $ctx=$listener.GetContext(); $res=$ctx.Response; $req=$ctx.Request
$res.Headers.Add("Access-Control-Allow-Origin","*")
$p=$req.Url.AbsolutePath; if($p -eq "/"){$p="/index.html"}
if($req.Url.AbsolutePath -eq "/live"){try{$wr=Invoke-WebRequest -Uri $req.QueryString["url"] -UseBasicParsing -TimeoutSec 20;$b=$wr.RawContentStream.ToArray();$res.StatusCode=200;$res.ContentType="text/html; charset=utf-8";$res.OutputStream.Write($b,0,$b.Length)}catch{$m=[Text.Encoding]::UTF8.GetBytes("PROXY ERROR");$res.StatusCode=502;$res.OutputStream.Write($m,0,$m.Length)}}
else{$f=Join-Path $root ($p -replace "/","\");if(Test-Path $f -PathType Leaf){$b=[IO.File]::ReadAllBytes($f);$res.StatusCode=200;$ext=[IO.Path]::GetExtension($f);$mime=@{".html"="text/html; charset=utf-8";".js"="text/javascript; charset=utf-8";".css"="text/css; charset=utf-8";".csv"="text/csv";".png"="image/png";".svg"="image/svg+xml";".ico"="image/x-icon"};if($mime[$ext]){$res.ContentType=$mime[$ext]}else{$res.ContentType="application/octet-stream"};$res.OutputStream.Write($b,0,$b.Length)}else{$m=[Text.Encoding]::UTF8.GetBytes("404");$res.StatusCode=404;$res.OutputStream.Write($m,0,$m.Length)}};$res.Close()}

