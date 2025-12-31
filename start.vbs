' Attendance System Launcher
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the directory where this script is located
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Create a Windows shortcut that will show the icon
shortcutPath = WshShell.SpecialFolders("Desktop") & "\نظام الحضور والانصراف.lnk"
Set shortcut = WshShell.CreateShortcut(shortcutPath)

shortcut.TargetPath = "cmd.exe"
shortcut.Arguments = "/c cd /d """ & scriptDir & """ && npm run electron:dev"
shortcut.WorkingDirectory = scriptDir
shortcut.IconLocation = scriptDir & "\icon.ico"
shortcut.WindowStyle = 1 ' Normal window
shortcut.Save

' Run the app with visible window
WshShell.CurrentDirectory = scriptDir
WshShell.Run "cmd /c npm run electron:dev", 1, False

' Clean up
Set shortcut = Nothing
Set fso = Nothing
Set WshShell = Nothing