On Error Resume Next
Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)

' Stop existing processes if they are running to prevent conflicts
WshShell.Run "cmd /c taskkill /F /IM node.exe /T", 0, True
WshShell.Run "cmd /c taskkill /F /IM ngrok.exe /T", 0, True

' Start the server loop in hidden mode
WshShell.Run "cmd /c """ & strPath & "\run_forever.bat""", 0, False
' Start the ngrok loop in hidden mode
WshShell.Run "cmd /c """ & strPath & "\run_ngrok_forever.bat""", 0, False