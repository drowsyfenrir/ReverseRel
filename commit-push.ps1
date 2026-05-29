$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8

Set-Location -LiteralPath $PSScriptRoot

Write-Host ""
Write-Host "[상태 확인]"
git status --short
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Git 상태를 확인하지 못했습니다."
  exit 1
}

Write-Host ""
Write-Host "[변경 요약]"
git diff --stat

Write-Host ""
$continue = Read-Host "위 변경 사항을 커밋하시겠습니까? (y/N)"
if ($continue -notmatch '^(y|Y)$') {
  Write-Host "커밋을 취소했습니다."
  exit 0
}

Write-Host ""
$message = Read-Host "커밋 메시지를 입력하세요"
if ([string]::IsNullOrWhiteSpace($message)) {
  $message = "Update site"
}

Write-Host ""
Write-Host "[스테이징]"
git add .
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "파일을 스테이징하지 못했습니다."
  exit 1
}

Write-Host ""
Write-Host "[커밋]"
git commit -m $message
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "커밋할 변경 사항이 없거나 커밋에 실패했습니다."
  exit 1
}

Write-Host ""
$push = Read-Host "GitHub main 브랜치로 푸시하시겠습니까? (y/N)"
if ($push -notmatch '^(y|Y)$') {
  Write-Host "푸시는 하지 않았습니다."
  exit 0
}

Write-Host ""
Write-Host "[푸시]"
git push
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "푸시에 실패했습니다."
  exit 1
}

Write-Host ""
Write-Host "완료했습니다. Cloudflare Pages가 잠시 후 자동 배포합니다."
