' Simple Attendance System Launcher
Set WshShell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)

' Run the application silently
WshShell.CurrentDirectory = scriptDir
WshShell.Run "cmd.exe /c npm run electron:dev", 0, False