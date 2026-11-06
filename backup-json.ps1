$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8

Set-Location -LiteralPath $PSScriptRoot

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDirectory = Join-Path $PSScriptRoot "backup"
$targets = @(
  @{ Source = "data.json"; Prefix = "data" },
  @{ Source = "version-data.json"; Prefix = "version-data" },
  @{ Source = "deck-data.json"; Prefix = "deck-data" },
  @{ Source = "pickup-data.json"; Prefix = "pickup-data" },
  @{ Source = "story-data.json"; Prefix = "story-data" }
)

Write-Host ""
Write-Host "[JSON 백업]"

try {
  if (-not (Test-Path -LiteralPath $backupDirectory)) {
    New-Item -ItemType Directory -Path $backupDirectory -ErrorAction Stop | Out-Null
  }
  $backupItem = Get-Item -LiteralPath $backupDirectory -Force -ErrorAction Stop
  if (-not $backupItem.PSIsContainer -or ($backupItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
    throw "backup 경로가 일반 폴더가 아닙니다."
  }
  $expectedPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "backup"))
  if ($backupItem.FullName -ne $expectedPath) {
    throw "백업 폴더 경로를 확인하지 못했습니다."
  }
  Get-ChildItem -LiteralPath $backupDirectory -File -Force -ErrorAction Stop | ForEach-Object {
    Remove-Item -LiteralPath $_.FullName -Force -ErrorAction Stop
  }
  Write-Host "기존 백업 파일을 정리했습니다."
} catch {
  Write-Host "백업 폴더 정리에 실패했습니다."
  Write-Host $_.Exception.Message
  exit 1
}

$successCount = 0
$failedCount = 0

foreach ($target in $targets) {
  $source = Join-Path $PSScriptRoot $target.Source
  if (-not (Test-Path -LiteralPath $source)) {
    Write-Host "건너뜀: $($target.Source) 파일이 없습니다."
    continue
  }

  $destinationName = "$($target.Prefix).backup-$stamp.json"
  $destination = Join-Path $backupDirectory $destinationName
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
