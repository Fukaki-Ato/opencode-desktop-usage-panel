$ErrorActionPreference = 'Stop'
$executable = Join-Path $env:LOCALAPPDATA 'Programs\@opencode-aidesktop\OpenCode.exe'
$processes = @(Get-Process OpenCode -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $executable })
$windows = @($processes | Where-Object { $_.MainWindowHandle -ne 0 })
if ($processes.Count -gt 0 -and $windows.Count -eq 0) {
  throw 'Desktop is running without a visible main window. Exit it manually before installation.'
}
foreach ($process in $windows) {
  if (-not $process.CloseMainWindow()) { throw 'Desktop did not accept a normal close request.' }
}
foreach ($process in $processes) {
  if (-not $process.HasExited) { $process.WaitForExit(30000) | Out-Null }
}
if (@(Get-Process OpenCode -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $executable }).Count -gt 0) {
  throw 'Desktop is still running. No files were replaced.'
}
& node (Join-Path $PSScriptRoot 'patch.cjs') install
if ($LASTEXITCODE -ne 0) {
  Start-Process -FilePath $executable
  throw 'Patch installation failed; Desktop was reopened.'
}
Start-Process -FilePath $executable
Write-Output 'Desktop restarted with the in-window usage panel patch.'
