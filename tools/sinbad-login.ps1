[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$base = "https://sinbad.sda.pu.go.id"
$user = "upb_ciliwungcisadane"
$pass = "upbbisa"
$s = Invoke-WebRequest -Uri "$base/index.php" -UseBasicParsing -TimeoutSec 30 -SessionVariable sv
$action = ([regex]::Match($s.Content, '<form[^>]*action="([^"]+)"')).Groups[1].Value
if (-not $action) { $action = "/index.php" }
if ($action -notlike "http*") { if ($action -notlike "/*") { $action = "/" + $action } }
$body = @{}
foreach ($i in ([regex]::Matches($s.Content, '<input[^>]+>'))) {
  $tag = $i.Value
  $nm = ([regex]::Match($tag, 'name="([^"]+)"')).Groups[1].Value
  $vl = ([regex]::Match($tag, 'value="([^"]*)"')).Groups[1].Value
  if (-not $nm) { continue }
  if ($nm -match "user|login|uname") { $body[$nm] = $user }
  elseif ($nm -match "pass") { $body[$nm] = $pass }
  elseif ($tag -match 'type="hidden"') { $body[$nm] = $vl }
}
"--- field terkirim: " + (($body.Keys | ForEach-Object { "$_=(isi)" }) -join ", ")
$login = Invoke-WebRequest -Uri ($base + $action) -Method Post -Body $body -WebSession $sv -UseBasicParsing -TimeoutSec 30
"--- URL setelah login: " + $login.BaseResponse.ResponseUri
$b = Invoke-WebRequest -Uri "$base/balai/balai.php" -WebSession $sv -UseBasicParsing -TimeoutSec 30
"--- balai.php panjang: " + $b.Content.Length
"--- 600 karakter pertama:"
$b.Content.Substring(0, [Math]::Min(600, $b.Content.Length))
"--- kandidat sumber foto/video:"
[regex]::Matches($b.Content, '(?:src|href)="([^"]+)"') | ForEach-Object { $_.Groups[1].Value } | Where-Object { $_ -match "cctv|cam|jpg|jpeg|stream|video|snapshot" } | Select-Object -Unique -First 15
