Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(WScript.ScriptFullName)
exe = root & "\dist\windows\CodexStartup.exe"
args = ""
If WScript.Arguments.Count > 0 Then
  For i = 0 To WScript.Arguments.Count - 1
    args = args & " " & Quote(WScript.Arguments(i))
  Next
End If
If fso.FileExists(exe) Then
  sh.Run Quote(exe) & args, 0, False
Else
  sh.CurrentDirectory = root
  sh.Run "node " & Quote(root & "\windows\run.mjs") & args, 0, False
End If

Function Quote(value)
  Quote = """" & Replace(value, """", """""") & """"
End Function
