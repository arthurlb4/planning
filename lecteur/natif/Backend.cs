using System.Diagnostics;
using System.Text.Json.Nodes;

namespace LecteurNatif;

/* Serveur local de l'appli (le même que celui de l'appli Electron : torrents, conversion des films, chaînes par VLC),
   lancé avec Node fourni avec l'appli ; il donne son port, s'arrête quand l'appli se ferme. */
public class Backend
{
    Process proc;
    public Task<int> StartAsync()
    {
        var tcs = new TaskCompletionSource<int>();
        string dir = AppContext.BaseDirectory, node = Path.Combine(dir, "node", "node.exe"), js = Path.Combine(dir, "backend", "backend.js");
        if (!File.Exists(node) || !File.Exists(js)) { tcs.SetResult(0); return tcs.Task; }
        var psi = new ProcessStartInfo(node) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardInput = true, WorkingDirectory = Path.GetDirectoryName(js)! };
        psi.ArgumentList.Add(js);
        try { proc = Process.Start(psi); } catch { tcs.SetResult(0); return tcs.Task; }
        try { proc.PriorityClass = ProcessPriorityClass.BelowNormal; } catch { }
        proc.OutputDataReceived += (s, e) =>
        {
            if (e.Data == null || tcs.Task.IsCompleted) return;
            try { var j = JsonNode.Parse(e.Data); int p = (int?)j?["port"] ?? 0; if (p > 0) tcs.TrySetResult(p); } catch { }
        };
        proc.BeginOutputReadLine();
        _ = Task.Delay(20000).ContinueWith(_ => tcs.TrySetResult(0));
        return tcs.Task;
    }
    public void Stop() { try { if (proc != null && !proc.HasExited) proc.Kill(true); } catch { } }
}
