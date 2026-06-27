Set WshShell = CreateObject("WScript.Shell")
strDesktopFolder = WshShell.SpecialFolders("Desktop")
' Using English filename to avoid encoding issues in VBS/Windows Script Host
strShortcutPath = strDesktopFolder & "\ManualServerStart.lnk"

' 현재 스크립트가 있는 경로를 기본 경로로 설정
Set fso = CreateObject("Scripting.FileSystemObject")
strCurrentPath = fso.GetParentFolderName(WScript.ScriptFullName)

' 바로 가기 생성
Set oShortcut = WshShell.CreateShortcut(strShortcutPath)
oShortcut.TargetPath = strCurrentPath & "\run_forever.bat"
oShortcut.WorkingDirectory = strCurrentPath
oShortcut.Description = "Sheet Music Server (Visible)"
oShortcut.IconLocation = "cmd.exe, 0"
oShortcut.Save

WScript.Echo "✅ Desktop shortcut created!" & vbCrLf & "Path: " & strShortcutPath
