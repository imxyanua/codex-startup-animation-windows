using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Windows.Forms;

internal static class Program
{
    [STAThread]
    static int Main(string[] args)
    {
        try
        {
            var root = FindRoot(AppDomain.CurrentDomain.BaseDirectory);
            if (Array.Exists(args, item => item == "--smoke-test"))
            {
                return RunNode(root, Path.Combine(root, "windows", "preview.mjs"));
            }
            var page = Path.Combine(root, "index.html");
            var url = new Uri(page).AbsoluteUri + "?native=1";
            var edge = FindEdge();
            var profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AemeathStartup", "preview-profile");
            Directory.CreateDirectory(profile);
            var info = new ProcessStartInfo
            {
                FileName = edge,
                Arguments = "--user-data-dir=" + Quote(profile) + " --app=" + Quote(url) + " --no-first-run --no-default-browser-check --disable-extensions",
                UseShellExecute = false
            };
            using (var process = Process.Start(info))
            {
                if (process == null) throw new Exception("无法打开 Edge 预览窗口。");
                process.WaitForExit();
            }
            return 0;
        }
        catch (Exception error)
        {
            MessageBox.Show(error.Message, "爱弥斯启动动画", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return 1;
        }
    }

    static string FindRoot(string start)
    {
        for (var dir = Path.GetFullPath(start); dir != null; dir = Path.GetDirectoryName(dir))
        {
            if (File.Exists(Path.Combine(dir, "index.html")) && Directory.Exists(Path.Combine(dir, "assets"))) return dir;
        }
        throw new Exception("找不到动画文件。请先运行 tools\\build-windows.ps1。");
    }

    static string FindEdge()
    {
        var paths = new[]
        {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "msedge.exe")
        };
        foreach (var path in paths) if (File.Exists(path)) return path;
        throw new Exception("没有找到 Microsoft Edge，无法打开独立预览。");
    }

    static int RunNode(string root, string script)
    {
        var info = new ProcessStartInfo
        {
            FileName = "node",
            Arguments = Quote(script) + " --smoke-test",
            WorkingDirectory = root,
            UseShellExecute = false
        };
        using (var process = Process.Start(info))
        {
            if (process == null) throw new Exception("无法运行预览检查。");
            process.WaitForExit();
            return process.ExitCode;
        }
    }

    static string Quote(string value)
    {
        return "\"" + value.Replace("\"", "\\\"") + "\"";
    }
}
