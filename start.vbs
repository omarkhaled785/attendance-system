' Proper Attendance System Launcher (Production Mode)
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

' Prevent duplicate launch
Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")
Set colProcesses = objWMIService.ExecQuery("SELECT * FROM Win32_Process WHERE Name = 'electron.exe'")

If colProcesses.Count > 0 Then
    MsgBox "البرنامج يعمل بالفعل!", vbInformation, "نظام الحضور"
    WScript.Quit
End If

' ⭐ Launch PRODUCTION build, NOT dev server
WshShell.Run "cmd /c npm start", 0, False

WScript.Quit
