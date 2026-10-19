param([int]$OwnerProcessId = 0)
# JSON-lines bridge. Only restore UI Automation controls with a readable document
# and a restorable selection; unsupported controls remain available in History.
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms
Add-Type -Path (Join-Path $PSScriptRoot 'windows/DesktopInput.cs')
. (Join-Path $PSScriptRoot 'windows/targets.ps1')
$nextLine = [DesktopInput]::ReadNext()
while ($true) {
 if (!$nextLine.Wait(100)) {
  try { Inspect-Target } catch { $script:lastTarget = $null }
  continue
 }
 $line = $nextLine.Result
 if ($null -eq $line) { break }
 $request = $null
 try { $request = $line | ConvertFrom-Json; $reply = Handle-Request $request }
 catch {
  if ($request.op -eq 'paste' -and $script:pasteAttempted) { $reply = @{status='unverified'} }
  else { $reply = @{status='unsupported';reason='Windows input control is unavailable.';line=$_.InvocationInfo.ScriptLineNumber;errorType=$_.Exception.GetType().Name} }
 }
 $reply.id = $request.id
 [Console]::WriteLine(($reply | ConvertTo-Json -Compress -Depth 6))
 $nextLine = [DesktopInput]::ReadNext()
}
