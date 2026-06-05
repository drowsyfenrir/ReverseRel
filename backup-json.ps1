$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8

Set-Location -LiteralPath $PSScriptRoot

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$targets = @(
  @{ Source = "data.json"; Prefix = "data" },
  @{ Source = "version-data.json"; Prefix = "version-data" },
  @{ Source = "deck-data.json"; Prefix = "deck-data" }
)

Write-Host ""
Write-Host "[JSON 백업]"

$successCount = 0
$failedCount = 0

foreach ($target in $targets) {
  $source = Join-Path $PSScriptRoot $target.Source
  if (-not (Test-Path -LiteralPath $source)) {
    Write-Host "건너뜀: $($target.Source) 파일이 없습니다."
    continue
  }

  $destinationName = "$($target.Prefix).backup-$stamp.json"
  $destination = Join-Path $PSScriptRoot $destinationName
  try {
    Copy-Item -LiteralPath $source -Destination $destination -Force -ErrorAction Stop
    Write-Host "백업 완료: $destinationName"
    $successCount += 1
  } catch {
    Write-Host "백업 실패: $destinationName"
    Write-Host $_.Exception.Message
    $failedCount += 1
  }
}

Write-Host ""
if ($failedCount -gt 0) {
  Write-Host "백업 실패 파일이 있습니다. 위 내용을 확인하세요."
  exit 1
}

Write-Host "완료했습니다. 총 $successCount개 파일을 백업했습니다."
