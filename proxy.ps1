# PROXY LOKAL - jembatan server-side ke sdatelemetry.com (bebas CORS)
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8080/")
$listener.Start()
Write-Host "PROXY LOKAL AKTIF di http://localhost:8080 - JANGAN TUTUP JENDELA INI"
while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $res = $ctx.Response
    $res.Headers.Add("Access-Control-Allow-Origin", "*")
    $url = $ctx.Request.QueryString["url"]
    try {
        if (-not $url) { throw "param url kosong" }
        $wr = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20 -UserAgent "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        $bytes = $wr.RawContentStream.ToArray()
        $res.StatusCode = 200
        $res.ContentType = "text/html; charset=utf-8"
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
        $msg = [System.Text.Encoding]::UTF8.GetBytes("PROXY ERROR: " + $_.Exception.Message)
        $res.StatusCode = 502
        $res.ContentType = "text/plain; charset=utf-8"
        $res.OutputStream.Write($msg, 0, $msg.Length)
    }
    $res.Close()
}
