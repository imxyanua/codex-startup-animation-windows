Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(WScript.ScriptFullName)
exe = root & "\dist\windows\AemeathPreview.exe"
If fso.FileExists(exe) Then
  sh.Run Quote(exe), 0, False
Else
  sh.CurrentDirectory = root
  sh.Run "node " & Quote(root & "\windows\preview.mjs"), 0, False
End If

Function Quote(value)
  Quote = """" & Replace(value, """", """""") & """"
End Function
