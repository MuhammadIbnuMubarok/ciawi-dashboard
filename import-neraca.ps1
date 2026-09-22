param([string]$Csv = "data\NERACA.csv")
if (-not (Test-Path $Csv)) { Write-Host "FILE TIDAK ADA: $Csv - salin NERACA.csv lengkap ke folder data dulu." ; exit 1 }
Add-Type -AssemblyName Microsoft.VisualBasic
$parser = New-Object Microsoft.VisualBasic.FileIO.TextFieldParser((Resolve-Path $Csv))
$parser.TextFieldType = "Delimited"; $parser.SetDelimiters(",")
$inv = [System.Globalization.CultureInfo]::InvariantCulture
$rows = New-Object System.Collections.Generic.List[string]; $count = 0
while (-not $parser.EndOfData) {
  $f = $parser.ReadFields()
  if ($f.Count -ge 13 -and $f[0] -match "^\d+$" -and $f[1] -match "^\d{1,2}/\d{1,2}/\d{4}$") {
    try {
      $tgl = ""; foreach ($df in @("M/d/yyyy","d/M/yyyy")) { try { $tgl = [DateTime]::ParseExact($f[1], $df, $inv).ToString("yyyy-MM-dd"); break } catch { } }
      $jam = ""; foreach ($fmt in @("h:mm:ss tt","H:mm:ss","H:mm")) { try { $jam = [DateTime]::ParseExact($f[2].Trim(), $fmt, $inv).ToString("HH:mm"); break } catch { } }
      if ($tgl -eq "" -or $jam -eq "") { throw "skip" }
      $n = @(); foreach ($i in 3,4,5,6,7,8,9,10,11) { $v = $f[$i].Replace(",", ""); if ($v -eq "") { $n += "null" } else { $n += ([double]::Parse($v, $inv)).ToString($inv) } }
      $st = "null"; if ($f[12] -ne "") { $st = "`"" + $f[12] + "`"" }
      $rows.Add("[" + $f[0] + ",`"" + $tgl + "`",`"" + $jam + "`"," + ($n -join ",") + "," + $st + "],")
      $count++
    } catch { }
  }
}
$parser.Close()
if ($count -eq 0) { Write-Host "TIDAK ADA BARIS VALID - periksa format CSV."; exit 1 }
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("/* DATASET NERACA - generasi otomatis import-neraca.ps1 " + (Get-Date).ToString("yyyy-MM-dd HH:mm") + " */")
[void]$sb.AppendLine("const RAW = [")
foreach ($r in $rows) { [void]$sb.AppendLine($r) }
[void]$sb.AppendLine("];")
[void]$sb.AppendLine("const REAL_DATA = RAW.map(r=>({no:r[0],tanggal:r[1],jam:r[2],elevasi:r[3],sedimen:r[4],bukaan:r[5],vol:r[6],qout_konduit:r[7],qout_spillway:r[8],qout_total:r[9],qin:r[10],reduksi:r[11],status:r[12]==null?null:r[12]}));")
[void]$sb.AppendLine("REAL_DATA.sort((a,b)=>((a.tanggal+`"T`"+a.jam)<(b.tanggal+`"T`"+b.jam)?-1:1));")
Set-Content -Path js\data.js -Value $sb.ToString() -Encoding UTF8
Write-Host "[OK] js\data.js diregenerasi: $count rekaman dari $Csv"
