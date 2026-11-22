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
    // mise à jour prête ou lancée : à la fermeture, le serveur local est arrêté net (ses fichiers vont être remplacés)
    public static bool Pending => ready != null || launched;
    static bool launched;
    public static JsonObject State { get; private set; } = new() { ["state"] = "idle" };
    public static event Action<JsonObject>? Changed;

    // numéro montré : celui de l'appli Windows (le 4e, numéro de construction, reste caché)
    static string Short(string v) => string.Join(".", v.Split('.').Take(3));
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
    // auto : recherche lancée d'elle-même (ouverture des Paramètres) ; seul un clic sur le bouton installe une version prête
    public static void CheckNow(Form app, bool auto = false)
    {
        if (ready != null) { if (!auto) InstallNow(app); else Set(State); return; }
        _ = Task.Run(Check);
    }

    static async Task Check()
    {
        if (ready != null || Interlocked.Exchange(ref busy, 1) == 1) return;
        try
        {
            Set(new() { ["state"] = "checking" });
            string txt;
            using (var cts = new CancellationTokenSource(TimeSpan.FromSeconds(20))) txt = (await http.GetStringAsync(BASE + "natif-version.txt", cts.Token)).Trim();
            if (!Version.TryParse(txt, out var v) || v <= Current) { Clean(); Set(new() { ["state"] = "latest" }); return; }
            // version portable : rien n'est installé, la nouvelle version est seulement annoncée (zip à télécharger)
            if (Program.Portable) { Set(new() { ["state"] = "portable", ["version"] = Short(txt) }); return; }
            var dir = Path.Combine(Path.GetTempPath(), "LecteurIPTVNatif-maj"); Directory.CreateDirectory(dir);
            foreach (var old in Directory.GetFiles(dir)) try { File.Delete(old); } catch { }
            var file = Path.Combine(dir, "Lecteur-IPTV-Natif-" + txt + ".exe"); var part = file + ".part";
            await Download(txt, part);
            if (new FileInfo(part).Length < 5_000_000) { File.Delete(part); throw new Exception("fichier incomplet"); }
            File.Move(part, file, true);
            ready = file;
            Set(new() { ["state"] = "ready", ["version"] = Short(txt), ["total"] = new FileInfo(file).Length });
        }
        catch (Exception e) { Set(new() { ["state"] = "error", ["msg"] = e.Message }); }
        finally { Interlocked.Exchange(ref busy, 0); }
    }

    /* Téléchargement de l'installateur : fichier propre à cette version (jamais remplacé pendant qu'on le télécharge, sinon
       l'installateur commun des anciennes versions), repris là où il s'est arrêté si la connexion coupe (8 essais).
       Avancement envoyé à la page : %, Mo reçus sur le total, vitesse. */
    static async Task Download(string ver, string part)
    {
        string url = BASE + "Lecteur-IPTV-Natif-" + ver + ".exe";
        // existe ? (un seul octet demandé : le stockage de GitHub refuse les requêtes HEAD)
        using (var probe = new HttpRequestMessage(HttpMethod.Get, url))
        {
            probe.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(0, 0);
            using var hr = await http.SendAsync(probe, HttpCompletionOption.ResponseHeadersRead);
            if (!hr.IsSuccessStatusCode) url = BASE + "Lecteur-IPTV-Natif-Installation.exe";
        }
        long got = 0, total = 0, winBytes = 0; var win = Stopwatch.StartNew(); double bps = 0; int last = -1; string? etag = null;
        void Report(bool force)
        {
            if (win.ElapsedMilliseconds >= 1000) { bps = winBytes * 1000.0 / win.ElapsedMilliseconds; winBytes = 0; win.Restart(); force = true; }
            int pct = total > 0 ? (int)(got * 100 / total) : 0;
            if (!force && pct == last) return; last = pct;
            Set(new() { ["state"] = "downloading", ["version"] = Short(ver), ["pct"] = pct, ["total"] = total, ["done"] = got, ["bps"] = (long)bps });
        }
        Report(true);
        await using var fs = File.Create(part);
        for (int attempt = 0; ; attempt++)
        {
            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, url);
                if (got > 0) { req.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(got, null); if (etag != null) req.Headers.TryAddWithoutValidation("If-Range", etag); }
                using var r = await http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead);
                r.EnsureSuccessStatusCode();
                if (got > 0 && r.StatusCode != System.Net.HttpStatusCode.PartialContent) { got = 0; fs.SetLength(0); }   // fichier changé : depuis le début
                fs.Position = got;
                etag ??= r.Headers.ETag?.ToString();
                if (total == 0) total = got + (r.Content.Headers.ContentLength ?? 0);
                await using var src = await r.Content.ReadAsStreamAsync();
                var buf = new byte[1 << 16]; int n;
                while ((n = await src.ReadAsync(buf)) > 0) { await fs.WriteAsync(buf.AsMemory(0, n)); got += n; winBytes += n; Report(false); }
                if (total > 0 && got < total) throw new IOException("coupé");
                return;
            }
            catch (Exception) when (attempt < 8) { await Task.Delay(TimeSpan.FromSeconds(2 + attempt * 2)); }
            catch (Exception e) { throw new Exception("téléchargement interrompu (" + (got / 1_000_000) + " Mo sur " + (total / 1_000_000) + " Mo reçus) : " + e.Message); }
        }
    }

    // à jour : installateurs déjà utilisés supprimés (≈ 150 Mo chacun) ; seul le compte rendu de la dernière installation reste
    static void Clean()
    {
        try { foreach (var f in Directory.GetFiles(Path.Combine(Path.GetTempPath(), "LecteurIPTVNatif-maj"))) if (!f.EndsWith("install.log", StringComparison.OrdinalIgnoreCase)) try { File.Delete(f); } catch { } } catch { }
    }
    static void Launch(bool reopen)
    {
        if (ready == null || !File.Exists(ready)) return;
        /* Installation lancée seulement une fois l'appli vraiment fermée (on attend la fin de son processus, puis de ceux qu'elle
           a lancés depuis son dossier : serveur local, mpv), sinon l'installateur trouve ses fichiers pris et abandonne sans rien
           dire. Fermeture forcée en dernier recours ; compte rendu dans install.log ; réouverture par l'installateur (/RELANCE=1). */
        string dir = Path.GetDirectoryName(ready)!, logf = Path.Combine(dir, "install.log"), appDir = AppContext.BaseDirectory.TrimEnd('\\');
        var ps = "$ErrorActionPreference='SilentlyContinue';"
            + "Wait-Process -Id " + Environment.ProcessId + " -Timeout 40;"
            + "for($k=0;$k -lt 20;$k++){$l=Get-Process|?{$_.Path -and $_.Path.StartsWith('" + appDir.Replace("'", "''") + "')};if(-not $l){break};if($k -eq 12){$l|Stop-Process -Force};Start-Sleep 1};"
            + "Start-Sleep 1;"
            + "Start-Process -FilePath '" + ready.Replace("'", "''") + "' -ArgumentList '/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/CLOSEAPPLICATIONS','/FORCECLOSEAPPLICATIONS','/LOG=\"" + logf.Replace("'", "''") + "\"'" + (reopen ? ",'/RELANCE=1'" : "") + " -Wait";
        try
        {
            var psi = new ProcessStartInfo("powershell.exe") { CreateNoWindow = true, UseShellExecute = false, WindowStyle = ProcessWindowStyle.Hidden };
            foreach (var a in new[] { "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-Command", ps }) psi.ArgumentList.Add(a);
            Process.Start(psi); ready = null; launched = true;
        }
        catch { }
    }
    static void InstallNow(Form app) { Launch(true); app.BeginInvoke(() => app.Close()); }
    // à la fermeture de l'appli : installée sans la rouvrir
    public static void InstallOnExit() => Launch(false);
}
