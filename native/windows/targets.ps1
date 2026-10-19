$sessions = @{}
$script:lastTarget = $null
function Inspect-Target {
 $window = [DesktopInput]::GetForegroundWindow()
 $processId = [DesktopInput]::WindowProcess($window)
 if (!$processId -or $processId -eq $OwnerProcessId -or $processId -eq $PID) { return }
 # Clear stale destinations when the user moves to a different external surface.
 $script:lastTarget = $null
 $element = [System.Windows.Automation.AutomationElement]::FocusedElement
 if (!$element -or $element.Current.ProcessId -ne $processId -or $element.Current.IsPassword -or !$element.Current.IsEnabled -or !$element.Current.IsKeyboardFocusable) { return }
 $pattern = $null
 if (!$element.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern,[ref]$pattern)) { return }
 $value = $null
 if ($element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern,[ref]$value)) {
  if ($value.Current.IsReadOnly) { return }
 } elseif ($element.Current.ControlType -ne [System.Windows.Automation.ControlType]::Edit -and $element.Current.ControlType -ne [System.Windows.Automation.ControlType]::Document) { return }
 $ranges = $pattern.GetSelection()
 if ($ranges.Count -ne 1) { return }
 $script:lastTarget = @{element=$element;pattern=$pattern;range=$ranges[0].Clone();before=$pattern.DocumentRange.GetText(-1);window=$window}
}
function Handle-Request($request) {
 $script:pasteAttempted = $false
 switch ($request.op) {
  'status' { return @{status='ok'} }
  'release' { $sessions.Remove([string]$request.token); return @{status='ok'} }
  'simplify' {
   $text = [string]$request.text
   if (!$text.Length) { return @{status='ok';text=''} }
   $buffer = New-Object System.Text.StringBuilder ($text.Length * 3 + 1)
   $length = [DesktopInput]::LCMapStringEx('zh-CN',0x02000000,$text,-1,$buffer,$buffer.Capacity,[IntPtr]::Zero,[IntPtr]::Zero,[IntPtr]::Zero)
   if ($length -eq 0) { throw 'Chinese conversion failed' }
   return @{status='ok';text=$buffer.ToString()}
  }
  'capture' {
   Inspect-Target
   $target = $script:lastTarget
   if (!$target) { return @{status='unsupported';reason='No editable input with a restorable cursor.'} }
   $token = [Guid]::NewGuid().ToString()
   if ($sessions.Count -ge 8) { $sessions.Clear() }
   $sessions[$token] = $target
   $selection = ''
   if ($request.ask) { $selection = $target.range.GetText(8000) }
   return @{status='ok';token=$token;selection=$selection}
  }
  'paste' {
   $target = $sessions[[string]$request.token]
   $sessions.Remove([string]$request.token)
   if (!$target) { return @{status='closed'} }
   if ($target.element.Current.IsPassword) { return @{status='unsupported'} }
   if ($target.pattern.DocumentRange.GetText(-1) -cne $target.before) { return @{status='edited'} }
   [DesktopInput]::Activate($target.window)
   for ($i=0; $i -lt 20 -and [DesktopInput]::GetForegroundWindow() -ne $target.window; $i++) { Start-Sleep -Milliseconds 25 }
   if ([DesktopInput]::GetForegroundWindow() -ne $target.window) { return @{status='changed';stage='activate'} }
   $target.element.SetFocus()
   for ($i=0; $i -lt 20; $i++) {
    if ([System.Windows.Automation.Automation]::Compare([System.Windows.Automation.AutomationElement]::FocusedElement,$target.element)) { break }
    Start-Sleep -Milliseconds 25
   }
   $target.range.Select()
   # Wait for the triggering shortcut modifiers to be released.
   for ($i=0; $i -lt 40; $i++) {
    $pressed = @(16,17,18,91,92 | Where-Object { ([DesktopInput]::GetAsyncKeyState($_) -band 0x8000) -ne 0 })
    if (!$pressed.Count) { break }
    Start-Sleep -Milliseconds 25
   }
   if ($pressed.Count -or [DesktopInput]::GetForegroundWindow() -ne $target.window -or ![System.Windows.Automation.Automation]::Compare([System.Windows.Automation.AutomationElement]::FocusedElement,$target.element)) { return @{status='changed';stage='focus'} }
   $selection = $target.pattern.GetSelection()
   if ($selection.Count -ne 1 -or !$selection[0].Compare($target.range) -or $target.pattern.DocumentRange.GetText(-1) -cne $target.before) { return @{status='changed'} }
   $text = [System.Windows.Forms.Clipboard]::GetText()
   if (!$text) { return @{status='unsupported';stage='clipboard'} }
   $prefix = $target.pattern.DocumentRange.Clone()
   $prefix.MoveEndpointByRange([System.Windows.Automation.Text.TextPatternRangeEndpoint]::End,$target.range,[System.Windows.Automation.Text.TextPatternRangeEndpoint]::Start)
   $suffix = $target.pattern.DocumentRange.Clone()
   $suffix.MoveEndpointByRange([System.Windows.Automation.Text.TextPatternRangeEndpoint]::Start,$target.range,[System.Windows.Automation.Text.TextPatternRangeEndpoint]::End)
   $expected = $prefix.GetText(-1) + $text + $suffix.GetText(-1)
   $script:pasteAttempted = $true
   [System.Windows.Forms.SendKeys]::SendWait('^v')
   for ($i=0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 25
    if ($target.pattern.DocumentRange.GetText(-1) -ceq $expected) { return @{status='ok'} }
   }
   # Never retry an unconfirmed paste, since doing so could duplicate text.
   return @{status='unverified'}
  }
  default { return @{status='unsupported'} }
 }
}
