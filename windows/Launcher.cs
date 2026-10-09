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
            var script = Path.Combine(root, "windows", "run.mjs");
            var node = FindNode(root);
            var probe = Array.Exists(args, item => item == "--probe");
            var info = new ProcessStartInfo
            {
                FileName = node,
                Arguments = Quote(script) + (args.Length == 0 ? "" : " " + QuoteAll(args)),
                WorkingDirectory = root,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = !probe,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8
            };
            using (var process = Process.Start(info))
            {
                if (process == null) throw new Exception("无法启动 Node 进程。");
                var output = process.StandardOutput.ReadToEnd();
                var error = process.StandardError.ReadToEnd();
                process.WaitForExit();
                var text = (output + "\n" + error).Trim();
                if (probe)
                {
                    Console.OutputEncoding = Encoding.UTF8;
                    Console.Write(string.IsNullOrEmpty(output) ? text : output);
                    return process.ExitCode;
                }
                if (process.ExitCode != 0)
                {
                    MessageBox.Show(string.IsNullOrEmpty(text) ? "启动扩展失败。" : text, "Codex", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
                return process.ExitCode;
            }
        }
        catch (Exception error)
        {
            MessageBox.Show(error.Message, "Codex", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return 1;
        }
    }

    static string FindRoot(string start)
    {
        for (var dir = Path.GetFullPath(start); dir != null; dir = Path.GetDirectoryName(dir))
        {
            if (File.Exists(Path.Combine(dir, "windows", "run.mjs")) && File.Exists(Path.Combine(dir, "index.html"))) return dir;
        }
        throw new Exception("找不到启动脚本。请先运行 tools\\build-windows.ps1。");
    }

    static string FindNode(string root)
    {
        var env = Environment.GetEnvironmentVariable("CODEX_STARTUP_NODE");
        if (!string.IsNullOrEmpty(env) && File.Exists(env)) return env;
        foreach (var item in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator))
        {
            if (string.IsNullOrWhiteSpace(item)) continue;
            var candidate = Path.Combine(item.Trim('"'), "node.exe");
            if (File.Exists(candidate)) return candidate;
        }
        var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var nested = Path.Combine(local, "OpenAI", "Codex", "runtimes", "cua_node");
        if (Directory.Exists(nested))
        {
            foreach (var dir in Directory.GetDirectories(nested))
            {
                var bundled = Path.Combine(dir, "bin", "node.exe");
                if (File.Exists(bundled)) return bundled;
            }
        }
        throw new Exception("没有找到 Node.js。请安装 Node 22+，或确认已安装官方 Codex 桌面应用。");
    }

    static string Quote(string value)
    {
        return "\"" + value.Replace("\"", "\\\"") + "\"";
    }

    static string QuoteAll(string[] args)
    {
        var builder = new StringBuilder();
        foreach (var arg in args)
        {
            if (builder.Length > 0) builder.Append(' ');
            builder.Append(Quote(arg));
        }
        return builder.ToString();
    }
}
