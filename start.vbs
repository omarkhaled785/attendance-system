' Improved Attendance System Launcher
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get script directory
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Set working directory
WshShell.CurrentDirectory = scriptDir

' Check if app is already running
Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")
Set colProcesses = objWMIService.ExecQuery("SELECT * FROM Win32_Process WHERE Name = 'electron.exe'")

If colProcesses.Count > 0 Then
    MsgBox "البرنامج يعمل بالفعل!", vbInformation, "نظام الحضور"
    WScript.Quit
End If

' Start the application
WshShell.Run "cmd.exe /c npm run electron:dev", 0, False

WScript.Sleep 2000

' Optional: Show a starting message
' MsgBox "جاري تشغيل نظام الحضور...", vbInformation, "نظام الحضور"

WScript.Quit