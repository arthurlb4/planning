using System.Diagnostics;

namespace LecteurNatif;

/* Mise à jour automatique : comme l'appli Windows classique. Au démarrage (puis toutes les 6 h), la version publiée
   (natif-version.txt de la version « iptv-natif » sur GitHub) est comparée à celle-ci ; plus récente, l'installateur est
   téléchargé en arrière-plan, puis installé sans fenêtre à la fermeture de l'appli. Réglages et listes gardés. */
static class Updater
{
    const string BASE = "https://github.com/arthurlb4/planning/releases/download/iptv-natif/";
    static readonly HttpClient http = MakeClient();
    static HttpClient MakeClient() { var h = new HttpClient { Timeout = TimeSpan.FromMinutes(10) }; h.DefaultRequestHeaders.UserAgent.ParseAdd("LecteurIPTV-natif"); return h; }
    static string? ready;                                   // installateur téléchargé, prêt à être lancé
    public static string? ReadyVersion { get; private set; }

    static Version Current => Version.TryParse(Application.ProductVersion.Split('+')[0], out var v) ? v : new Version(0, 0);

    public static void Start(Action<string> onReady)
    {
        _ = Task.Run(async () =>
        {
            await Task.Delay(TimeSpan.FromSeconds(20));
            while (true)
            {
                try { await Check(onReady); } catch { }
                await Task.Delay(TimeSpan.FromHours(6));
            }
        });
    }

    static async Task Check(Action<string> onReady)
    {
        if (ready != null) return;
        var txt = (await http.GetStringAsync(BASE + "natif-version.txt")).Trim();
        if (!Version.TryParse(txt, out var v) || v <= Current) return;
        var dir = Path.Combine(Path.GetTempPath(), "LecteurIPTVNatif-maj"); Directory.CreateDirectory(dir);
        foreach (var old in Directory.GetFiles(dir, "*.exe")) try { File.Delete(old); } catch { }
        var file = Path.Combine(dir, "Lecteur-IPTV-Natif-" + txt + ".exe"); var part = file + ".part";
        using (var r = await http.GetAsync(BASE + "Lecteur-IPTV-Natif-Installation.exe", HttpCompletionOption.ResponseHeadersRead))
        {
            r.EnsureSuccessStatusCode();
            await using var fs = File.Create(part);
            await r.Content.CopyToAsync(fs);
        }
        if (new FileInfo(part).Length < 5_000_000) { File.Delete(part); return; }   // fichier incomplet ou page d'erreur
        File.Move(part, file, true);
        ready = file; ReadyVersion = txt;
        onReady(txt);
    }

    // à la fermeture : installateur lancé sans fenêtre, quelques secondes après (le temps que l'appli et mpv se ferment)
    public static void InstallOnExit()
    {
        if (ready == null || !File.Exists(ready)) return;
        try
        {
            Process.Start(new ProcessStartInfo("cmd.exe", "/c timeout /t 3 /nobreak >nul & start \"\" \"" + ready + "\" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART")
            { CreateNoWindow = true, UseShellExecute = false, WindowStyle = ProcessWindowStyle.Hidden });
        }
        catch { }
    }
}
