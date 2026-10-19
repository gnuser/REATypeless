$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
 $english = $voice.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -like 'en-*' } | Select-Object -First 1
 if (!$english) { throw 'An English Windows speech voice is required for the integration fixture.' }
 $voice.SelectVoice($english.VoiceInfo.Name)
 $voice.SetOutputToWaveFile((Join-Path $PSScriptRoot '../build/test-speech.wav'))
 $voice.Speak('Hello world, this is a private voice dictation test. Please send the project update tomorrow morning.')
} finally { $voice.Dispose() }
