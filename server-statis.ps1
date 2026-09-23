$root = "C:\Users\Hp\ciawi-dashboard"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:5500/")
$listener.Prefixes.Add("http://127.0.0.1:5500/")
$listener.Start()
"SERVER STATIS AKTIF di http://localhost:5500 dan http://127.0.0.1:5500 - JANGAN TUTUP"
while ($listener.IsListening) { $ctx = $listener.GetContext(); $p = $ctx.Request.Url.AbsolutePath; if ($p -eq "/") { $p = "/index.html" }
$f = Join-Path $root ($p -replace "/", "\"); if (Test-Path $f -PathType Leaf) {
$ext = [IO.Path]::GetExtension($f).ToLower()
$mime = "application/octet-stream"
if ($ext -eq ".html") { $mime = "text/html; charset=utf-8" } elseif ($ext -eq ".js") { $mime = "text/javascript; charset=utf-8" } elseif ($ext -eq ".css") { $mime = "text/css; charset=utf-8" }
elseif ($ext -eq ".csv") { $mime = "text/csv; charset=utf-8" } elseif ($ext -eq ".json") { $mime = "application/json; charset=utf-8" } elseif ($ext -eq ".svg") { $mime = "image/svg+xml" }
$bytes = [IO.File]::ReadAllBytes($f); $ctx.Response.ContentType = $mime; $ctx.Response.StatusCode = 200; $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
} else { $ctx.Response.StatusCode = 404; $b = [Text.Encoding]::UTF8.GetBytes("404 tidak ditemukan"); $ctx.Response.OutputStream.Write($b, 0, $b.Length) }
$ctx.Response.Close() }
