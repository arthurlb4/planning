using System.Diagnostics;
using System.Text.Json.Nodes;

namespace LecteurNatif;

/* Mise à jour automatique : comme l'appli Windows classique. Au démarrage (puis toutes les 6 h, et à l'ouverture des
   Paramètres), la version publiée (natif-version.txt de la version « iptv-natif » sur GitHub) est comparée à celle-ci ;
   plus récente, l'installateur est téléchargé en arrière-plan, puis installé sans fenêtre à la fermeture de l'appli, ou tout
   de suite avec « Redémarrer et installer » (l'appli se rouvre). Réglages et listes gardés. État envoyé à la page
   (encadré de Paramètres et bandeau « version prête », les mêmes que pour l'appli classique). */
static class Updater
{
    const string BASE = "https://github.com/arthurlb4/planning/releases/download/iptv-natif/";
    static readonly HttpClient http = MakeClient();
    static HttpClient MakeClient() { var h = new HttpClient { Timeout = TimeSpan.FromMinutes(10) }; h.DefaultRequestHeaders.UserAgent.ParseAdd("LecteurIPTV-natif"); return h; }
    static string? ready;                                   // installateur téléchargé, prêt à être lancé
    static int busy;
    public static JsonObject State { get; private set; } = new() { ["state"] = "idle" };
    public static event Action<JsonObject>? Changed;

    static Version Current => Version.TryParse(Application.ProductVersion.Split('+')[0], out var v) ? v : new Version(0, 0);
    static void Set(JsonObject st) { State = st; try { Changed?.Invoke(st); } catch { } }

    public static void Start()
    {
        _ = Task.Run(async () =>
        {
            await Task.Delay(TimeSpan.FromSeconds(20));
            while (true) { await Check(); await Task.Delay(TimeSpan.FromHours(6)); }
        });
    }

    // demandé par la page (bouton Vérifier, ouverture des Paramètres) ; version prête : installation tout de suite
    public static void CheckNow(Form app)
    {
        if (ready != null) { InstallNow(app); return; }
        _ = Task.Run(Check);
    }

    static async Task Check()
    {
        if (ready != null || Interlocked.Exchange(ref busy, 1) == 1) return;
        try
        {
            Set(new() { ["state"] = "checking" });
            var txt = (await http.GetStringAsync(BASE + "natif-version.txt")).Trim();
            if (!Version.TryParse(txt, out var v) || v <= Current) { Set(new() { ["state"] = "latest" }); return; }
            var dir = Path.Combine(Path.GetTempPath(), "LecteurIPTVNatif-maj"); Directory.CreateDirectory(dir);
            foreach (var old in Directory.GetFiles(dir)) try { File.Delete(old); } catch { }
            var file = Path.Combine(dir, "Lecteur-IPTV-Natif-" + txt + ".exe"); var part = file + ".part";
            Set(new() { ["state"] = "downloading", ["version"] = txt, ["pct"] = 0 });
            using (var r = await http.GetAsync(BASE + "Lecteur-IPTV-Natif-Installation.exe", HttpCompletionOption.ResponseHeadersRead))
            {
                r.EnsureSuccessStatusCode();
                long total = r.Content.Headers.ContentLength ?? 0, got = 0; int last = -1;
                await using var src = await r.Content.ReadAsStreamAsync();
                await using var fs = File.Create(part);
                var buf = new byte[1 << 16]; int n;
                while ((n = await src.ReadAsync(buf)) > 0)
                {
                    await fs.WriteAsync(buf.AsMemory(0, n)); got += n;
                    int pct = total > 0 ? (int)(got * 100 / total) : 0;
                    if (pct != last) { last = pct; Set(new() { ["state"] = "downloading", ["version"] = txt, ["pct"] = pct }); }
                }
            }
            if (new FileInfo(part).Length < 5_000_000) { File.Delete(part); throw new Exception("fichier incomplet"); }
            File.Move(part, file, true);
            ready = file;
            Set(new() { ["state"] = "ready", ["version"] = txt });
        }
        catch (Exception e) { Set(new() { ["state"] = "error", ["msg"] = e.Message }); }
        finally { Interlocked.Exchange(ref busy, 0); }
    }

    static void Launch(bool reopen)
    {
        if (ready == null || !File.Exists(ready)) return;
        var exe = Application.ExecutablePath;
        // quelques secondes d'attente (fermeture de l'appli et de mpv), installation sans fenêtre, puis réouverture si demandée
        var cmd = "/c timeout /t 3 /nobreak >nul & start \"\" /wait \"" + ready + "\" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART"
            + (reopen ? " & start \"\" \"" + exe + "\"" : "");
        try { Process.Start(new ProcessStartInfo("cmd.exe", cmd) { CreateNoWindow = true, UseShellExecute = false, WindowStyle = ProcessWindowStyle.Hidden }); ready = null; }
        catch { }
    }
    static void InstallNow(Form app) { Launch(true); app.BeginInvoke(() => app.Close()); }
    // à la fermeture de l'appli : installée sans la rouvrir
    public static void InstallOnExit() => Launch(false);
}
