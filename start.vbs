' Attendance System Launcher - Improved
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the directory where this script is located
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Create shortcut
shortcutPath = WshShell.SpecialFolders("Desktop") & "\نظام الحضور والانصراف.lnk"
Set shortcut = WshShell.CreateShortcut(shortcutPath)

shortcut.TargetPath = "cmd.exe"
shortcut.Arguments = "/k cd /d """ & scriptDir & """ && npm run electron"
shortcut.WorkingDirectory = scriptDir
shortcut.IconLocation = scriptDir & "\icon.ico"
shortcut.WindowStyle = 1
shortcut.Save

' Run app with proper environment
WshShell.CurrentDirectory = scriptDir
WshShell.Run "cmd /c npm run electron", 1, True

Set shortcut = Nothing
Set fso = Nothing
Set WshShell = Nothing