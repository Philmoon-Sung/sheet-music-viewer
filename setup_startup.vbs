Set WshShell = CreateObject("WScript.Shell")
strStartupFolder = WshShell.SpecialFolders("Startup")
strShortcutPath = strStartupFolder & "\SheetMusicServer.lnk"

' 현재 스크립트가 있는 경로를 기본 경로로 설정
Set fso = CreateObject("Scripting.FileSystemObject")
strCurrentPath = fso.GetParentFolderName(WScript.ScriptFullName)

' 바로 가기 생성
Set oShortcut = WshShell.CreateShortcut(strShortcutPath)
oShortcut.TargetPath = "wscript.exe"
oShortcut.Arguments = """" & strCurrentPath & "\start_background.vbs"""
oShortcut.WorkingDirectory = strCurrentPath
oShortcut.Description = "Sheet Music Server (Background)"
oShortcut.IconLocation = "wscript.exe, 0"
oShortcut.Save

WScript.Echo "✅ 시작 프로그램 설정 완료!" & vbCrLf & "경로: " & strShortcutPath & vbCrLf & "대상: " & strCurrentPath & "\start_background.vbs"

