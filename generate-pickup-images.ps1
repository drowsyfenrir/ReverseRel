$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Set-Location -LiteralPath $PSScriptRoot

$port = 4173
$previewUrl = "http://127.0.0.1:$port/pickup-banner-embed.html"
$edgeCandidates = @(
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
  "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
)
$edgePath = $edgeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if (-not $edgePath) {
  Write-Host "Microsoft Edge 실행 파일을 찾지 못했습니다."
  exit 1
}

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  Write-Host "Python을 찾지 못했습니다."
  exit 1
}

$generatedDir = Join-Path $PSScriptRoot "generated\pickup"
$outputPath = Join-Path $generatedDir "banner.png"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "ReverseRel-pickup-$PID"
$tempScreenshot = Join-Path $tempRoot "banner-raw.png"
$edgeProfile = Join-Path $tempRoot "edge-profile"
$serverProcess = $null

New-Item -ItemType Directory -Force -Path $generatedDir | Out-Null
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

try {
  $serverReady = $false
  try {
    Invoke-WebRequest -Uri $previewUrl -UseBasicParsing -TimeoutSec 2 | Out-Null
    $serverReady = $true
  } catch {
    $serverProcess = Start-Process -FilePath "python" -ArgumentList @("-m", "http.server", "$port", "--bind", "127.0.0.1") -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
      Start-Sleep -Milliseconds 250
      try {
        Invoke-WebRequest -Uri $previewUrl -UseBasicParsing -TimeoutSec 1 | Out-Null
        $serverReady = $true
        break
      } catch {}
    }
  }

  if (-not $serverReady) {
    throw "로컬 미리보기 서버를 시작하지 못했습니다."
  }

  $edgeArgs = @(
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=10000",
    "--window-size=900,12000",
    "--user-data-dir=$edgeProfile",
    "--screenshot=$tempScreenshot",
    $previewUrl
  )
  $edgeProcess = Start-Process -FilePath $edgePath -ArgumentList $edgeArgs -WindowStyle Hidden -Wait -PassThru
  if ($edgeProcess.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $tempScreenshot)) {
    throw "Edge 화면 캡처에 실패했습니다."
  }

  & python "$PSScriptRoot\scripts\crop-pickup-banner.py" "$tempScreenshot" "$outputPath"
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $outputPath)) {
    throw "캡처 이미지 정리에 실패했습니다."
  }

  $imageInfo = Get-Item -LiteralPath $outputPath
  Write-Host "생성 완료: generated/pickup/banner.png ($($imageInfo.Length) bytes)"
} catch {
  Write-Host $_.Exception.Message
  exit 1
} finally {
  if ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
  }
  $resolvedTemp = [System.IO.Path]::GetFullPath($tempRoot)
  $resolvedSystemTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
  if ($resolvedTemp.StartsWith($resolvedSystemTemp, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolvedTemp)) {
    Remove-Item -LiteralPath $resolvedTemp -Recurse -Force -ErrorAction SilentlyContinue
  }
}
