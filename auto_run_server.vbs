Set WshShell = CreateObject("WScript.Shell")
strPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strPath
WshShell.Run "cmd /c run_forever.bat", 0
WshShell.Run "cmd /c run_ngrok_forever.bat", 0
Set WshShell = Nothing
