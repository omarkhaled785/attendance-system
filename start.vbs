' Attendance System Launcher - Silent Version
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the directory where this script is located
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Create shortcut on desktop (optional - remove if not needed)
shortcutPath = WshShell.SpecialFolders("Desktop") & "\نظام الحضور والانصراف.lnk"
Set shortcut = WshShell.CreateShortcut(shortcutPath)

shortcut.TargetPath = scriptDir & "\start.bat"
shortcut.WorkingDirectory = scriptDir
shortcut.IconLocation = scriptDir & "\icon.ico"
shortcut.WindowStyle = 7 ' Minimized window
shortcut.Save

' Create a batch file that will run Electron silently
batchContent = "@echo off" & vbCrLf & _
              "title Attendance System" & vbCrLf & _
              "cd /d " & Chr(34) & scriptDir & Chr(34) & vbCrLf & _
              "npm run electron" & vbCrLf & _
              "exit"

batchPath = scriptDir & "\start.bat"
Set batchFile = fso.CreateTextFile(batchPath, True)
batchFile.Write batchContent
batchFile.Close

' Run the batch file minimized
WshShell.CurrentDirectory = scriptDir
WshShell.Run "cmd /c start.bat", 0, False

Set shortcut = Nothing
Set batchFile = Nothing
Set fso = Nothing
Set WshShell = Nothing