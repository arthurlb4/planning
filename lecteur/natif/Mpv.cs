using System.Diagnostics;
using System.Drawing;
using System.IO.Pipes;
using System.Text;
using System.Text.Json.Nodes;

namespace LecteurNatif;

/* mpv (même moteur que VLC) dessine dans le cadre vidéo de la fenêtre (--wid) ; la page le pilote par son canal de commande
   (position, durée, pause, pistes, chapitres renvoyés à la page). Le cadre suit la zone du lecteur de la page. */
public class Mpv
{
    readonly MainForm f;
    Process proc; NamedPipeClientStream pipe; StreamWriter wr; readonly object wl = new();
    JsonObject rect; long lastPos;
    public Mpv(MainForm form) { f = form; }
    static string Exe => Path.Combine(AppContext.BaseDirectory, "mpv", "mpv.exe");
    public bool Available => File.Exists(Exe);

    public async Task<JsonObject> PlayAsync(JsonObject o)
    {
        if (!Available) return new JsonObject { ["error"] = "mpv absent" };
        Stop();
        rect = o["rect"] as JsonObject; aspect = 0;
        Place();
        string name = "lecteur-mpv-" + Environment.ProcessId + "-" + Environment.TickCount64;
        var lang = new Dictionary<string, string> { ["fr"] = "fre,fra,fr,french", ["en"] = "eng,en" };
        string al = (string)o["alang"] ?? "fr", sl = (string)o["slang"] ?? "off";
        var psi = new ProcessStartInfo(Exe) { UseShellExecute = false, CreateNoWindow = true };
        var args = new List<string> { (string)o["url"], "--wid=" + f.Video.Handle.ToInt64(), "--input-ipc-server=\\\\.\\pipe\\" + name,
            "--force-media-title=" + ((string)o["title"] ?? ""), "--hwdec=auto-safe", "--keep-open=yes", "--idle=no", "--osc=no", "--osd-level=0",
            "--input-default-bindings=no", "--input-vo-keyboard=no", "--no-input-cursor", "--input-cursor-passthrough=yes", "--cursor-autohide=no", "--background=color", "--background-color=#000000",
            "--volume=" + Math.Round(Math.Clamp((double?)o["vol"] ?? 1, 0, 1) * 100),
            "--alang=" + (lang.TryGetValue(al, out var a1) ? a1 : al), sl != "off" ? "--slang=" + (lang.TryGetValue(sl, out var s1) ? s1 : sl) : "--sid=no",
            "--sub-auto=fuzzy", "--msg-level=all=no", "--no-terminal" };
        double start = (double?)o["start"] ?? 0; if (start > 1) args.Add("--start=" + Math.Floor(start));
        if (o["subArgs"] is JsonArray sa) foreach (var x in sa) { var v = (string)x; if (v != null && v.StartsWith("--sub-") && v.Length < 100 && !v.Contains('\n')) args.Add(v); }
        foreach (var x in args) psi.ArgumentList.Add(x);
        try { proc = Process.Start(psi); } catch (Exception e) { return new JsonObject { ["error"] = e.Message }; }
        var p = proc;
        p.EnableRaisingEvents = true;
        p.Exited += (s, e) => { if (proc == p) { proc = null; f.Post(Msg(new JsonObject { ["exit"] = true })); } };
        // canal de commande : quelques essais le temps que mpv démarre
        for (int k = 0; k < 40 && pipe == null && !p.HasExited && proc == p; k++)
        {
            await Task.Delay(150);
            try { var c = new NamedPipeClientStream(".", name, PipeDirection.InOut, PipeOptions.Asynchronous); await c.ConnectAsync(200); pipe = c; } catch { }
        }
        if (proc != p) return new JsonObject { ["error"] = "remplacé" };
        if (pipe == null) { Stop(); return new JsonObject { ["error"] = "mpv ne répond pas" }; }
        wr = new StreamWriter(pipe, new UTF8Encoding(false)) { AutoFlush = true, NewLine = "\n" };
        string[] props = { "time-pos", "duration", "pause", "eof-reached", "aid", "sid", "track-list", "chapter-list", "volume", "mute", "demuxer-cache-time", "video-params/aspect", "paused-for-cache",
            // panneau ⓘ de la page (image et son)
            "width", "height", "video-codec", "audio-codec-name", "audio-params/channel-count", "audio-params/samplerate", "container-fps", "estimated-vf-fps", "video-bitrate", "audio-bitrate", "hwdec-current", "frame-drop-count", "decoder-frame-drop-count", "demuxer-cache-duration", "video-params/gamma" };
        for (int i = 0; i < props.Length; i++) Cmd(new JsonArray("observe_property", i + 1, props[i]));
        var pp = pipe; new Thread(() => Read(pp)) { IsBackground = true }.Start();
        _ = MuteMouse(p);
        Place();
        return new JsonObject { ["ok"] = true };
    }

    // fenêtres que mpv crée dans le cadre vidéo : désactivées, pour que la souris ne s'y arrête jamais (elle va à la page)
    async Task MuteMouse(Process p)
    {
        for (int k = 0; k < 40 && proc == p; k++)
        {
            var h = f.Video.Handle;
            Natif.EnumChildWindows(h, (c, l) => { if (Natif.IsWindowEnabled(c)) Natif.EnableWindow(c, false); return true; }, IntPtr.Zero);
            await Task.Delay(k < 10 ? 100 : 500);
        }
    }

    static JsonObject Msg(JsonObject st) => new() { ["t"] = "mpv", ["st"] = st };
    static readonly HashSet<string> Noisy = new() { "cdur", "efps", "vbr", "abr", "drop", "ddrop", "cache" };
    readonly Dictionary<string, long> lastNoisy = new();
    static readonly Dictionary<string, string> KEYS = new() { ["time-pos"] = "pos", ["duration"] = "dur", ["pause"] = "paused", ["eof-reached"] = "eof", ["aid"] = "aid", ["sid"] = "sid", ["volume"] = "vol", ["mute"] = "mute", ["demuxer-cache-time"] = "cache", ["paused-for-cache"] = "buf",
        ["width"] = "w", ["height"] = "h", ["video-codec"] = "vcodec", ["audio-codec-name"] = "acodec", ["audio-params/channel-count"] = "ach", ["audio-params/samplerate"] = "arate", ["container-fps"] = "fps", ["estimated-vf-fps"] = "efps",
        ["video-bitrate"] = "vbr", ["audio-bitrate"] = "abr", ["hwdec-current"] = "hwdec", ["frame-drop-count"] = "drop", ["decoder-frame-drop-count"] = "ddrop", ["demuxer-cache-duration"] = "cdur", ["video-params/gamma"] = "gamma" };

    void Read(NamedPipeClientStream p)
    {
        try
        {
            using var rd = new StreamReader(p, Encoding.UTF8);
            string line;
            while ((line = rd.ReadLine()) != null)
            {
                JsonObject m; try { m = JsonNode.Parse(line) as JsonObject; } catch { continue; }
                if (m == null || (string)m["event"] != "property-change") continue;
                string n = (string)m["name"]; var d = m["data"]?.DeepClone();
                if (n == "video-params/aspect") { double a = 0; try { a = (double?)d ?? 0; } catch { } if (a > 0.2 && a < 5) { aspect = a; f.BeginInvoke(FitChild); } continue; }
                if (n == "track-list")
                {
                    var tr = new JsonArray();
                    if (d is JsonArray l) foreach (var x in l) { if (x is not JsonObject t) continue;
                        tr.Add(new JsonObject { ["id"] = t["id"]?.DeepClone(), ["type"] = t["type"]?.DeepClone(), ["lang"] = (string)t["lang"] ?? "", ["title"] = (string)t["title"] ?? "", ["codec"] = (string)t["codec"] ?? "",
                            ["ch"] = t["demux-channel-count"]?.DeepClone() ?? 0, ["sel"] = (bool?)t["selected"] ?? false, ["forced"] = (bool?)t["forced"] ?? false, ["w"] = t["demux-w"]?.DeepClone() ?? 0, ["h"] = t["demux-h"]?.DeepClone() ?? 0 }); }
                    f.Post(Msg(new JsonObject { ["tracks"] = tr })); continue;
                }
                if (n == "chapter-list")
                {
                    var ch = new JsonArray();
                    if (d is JsonArray l) foreach (var x in l) if (x is JsonObject c) ch.Add(new JsonObject { ["start"] = c["time"]?.DeepClone(), ["title"] = (string)c["title"] ?? "" });
                    f.Post(Msg(new JsonObject { ["chapters"] = ch })); continue;
                }
                if (!KEYS.TryGetValue(n, out var key)) continue;
                if (key == "pos") { long now = Environment.TickCount64; if (now - lastPos < 500) continue; lastPos = now; }
                // informations du panneau ⓘ qui changent sans cesse : une fois par seconde au plus
                if (Noisy.Contains(key)) { long now = Environment.TickCount64; if (lastNoisy.TryGetValue(key, out var t0) && now - t0 < 1000) continue; lastNoisy[key] = now; }
                var st = new JsonObject { [key] = d };
                if (key == "eof" && (bool?)d == true) st["eof"] = true;
                f.Post(Msg(st));
            }
        }
        catch { }
    }

    public void Cmd(JsonArray a)
    {
        if (a == null || wr == null) return;
        try { lock (wl) wr.WriteLine(new JsonObject { ["command"] = a.DeepClone() }.ToJsonString()); } catch { }
    }

    // zone du lecteur donnée par la page (pixels CSS) → cadre vidéo (pixels de la fenêtre), débordant un peu sous les barres
    long lastRectAt;
    // plein écran : la vidéo occupe tout l'écran (le lecteur de la page aussi), placée par la coque sans attendre la page ;
    // sortie : positions encore « plein écran » envoyées par la page (pas encore remise en page) ignorées jusqu'à la vraie
    public bool Full, ExitPending;
    bool FullSized(JsonObject r)
    {
        if (r == null || ((bool?)r["hidden"] ?? false)) return false;
        double k = f.Scale; return (double)r["w"]! * k >= f.ClientSize.Width - 4 && (double)r["h"]! * k >= f.ClientSize.Height - 4;
    }
    public void Rect(JsonObject r)
    {
        if (ExitPending) { if (FullSized(r)) return; ExitPending = false; }
        if (rect == null || rect.ToJsonString() != r?.ToJsonString()) lastRectAt = Environment.TickCount64;
        rect = r; if (f.InvokeRequired) f.BeginInvoke(Place); else Place(); }
    long holdUntil;
    public bool Holding => Environment.TickCount64 < holdUntil;
    // la coque place elle-même la vidéo pendant ms millisecondes, puis reprend la position donnée par la page
    public void Hold(int ms)
    {
        holdUntil = Math.Max(holdUntil, Environment.TickCount64 + ms);
        // fin du changement : vidéo replacée, puis la page retire son noir
        // puis attente que la position envoyée par la page ne bouge plus (0,1 s sans changement, 1,2 s au plus)
        long t0 = Environment.TickCount64;
        var t = new System.Windows.Forms.Timer { Interval = ms + 10 };
        t.Tick += (s, e) =>
        {
            if (Holding) { t.Interval = 30; return; }
            long now = Environment.TickCount64;
            if (!Full && (ExitPending || now - lastRectAt < 100) && now - t0 < 1500) { t.Interval = 30; return; }
            ExitPending = false;
            t.Stop(); t.Dispose(); Place(); Settled();
        };
        t.Start();
    }
    void Settled() { var t2 = new System.Windows.Forms.Timer { Interval = 20 }; t2.Tick += (s, e) => { t2.Stop(); t2.Dispose(); if (!Holding) f.Post(Msg(new JsonObject { ["moving"] = false })); }; t2.Start(); }
    public void Place()
    {
        if (f.IsDisposed || Holding) return;
        var r = rect; bool on = proc != null && r != null && !((bool?)r["hidden"] ?? false);
        if (!on) { if (f.Video.Visible) f.Video.Visible = false; return; }
        if (Full) { var fb = new Rectangle(Point.Empty, f.ClientSize); if (f.Video.Bounds != fb) { f.Video.Bounds = fb; FitChild(); } if (!f.Video.Visible) f.Video.Visible = true; return; }
        double k = f.Scale;
        int x = (int)Math.Floor((double)r["x"]! * k) - 2, y = (int)Math.Floor((double)r["y"]! * k) - 2;
        int x2 = (int)Math.Ceiling(((double)r["x"]! + (double)r["w"]!) * k) + 2, y2 = (int)Math.Ceiling(((double)r["y"]! + (double)r["h"]!) * k) + 2;
        x = Math.Max(0, x); y = Math.Max(0, y); x2 = Math.Min(f.ClientSize.Width, x2); y2 = Math.Min(f.ClientSize.Height, y2);
        var b = new Rectangle(x, y, Math.Max(1, x2 - x), Math.Max(1, y2 - y));
        if (f.Video.Bounds != b) { f.Video.Bounds = b; FitChild(); }
        if (!f.Video.Visible) f.Video.Visible = true;
    }

    // fenêtre de mpv dans le cadre : remise à la taille du cadre tout de suite (sinon bande noire après un changement de taille)
    // fenêtre de mpv au format exact de la vidéo, centrée dans le cadre (bandes noires autour) : même pendant un
    // redimensionnement, où Windows étire un instant la dernière image, l'image garde ses proportions
    double aspect;
    public void FitChild()
    {
        if (f.IsDisposed) return;
        int W = f.Video.Width, H = f.Video.Height, x = 0, y = 0, w = W, h = H; var ph = f.Video.Handle;
        if (aspect > 0 && W > 0 && H > 0)
        {
            if ((double)W / H > aspect) { w = (int)Math.Round(H * aspect); x = (W - w) / 2; } else { h = (int)Math.Round(W / aspect); y = (H - h) / 2; }
        }
        Natif.EnumChildWindows(ph, (c, l) => { if (Natif.GetParent(c) == ph) Natif.SetWindowPos(c, IntPtr.Zero, x, y, w, h, 0x0014); return true; }, IntPtr.Zero);
    }

    public void Stop()
    {
        var p = proc; proc = null;
        try { pipe?.Dispose(); } catch { }
        pipe = null; wr = null;
        if (p != null) { try { if (!p.HasExited) p.Kill(); } catch { } }
        if (!f.IsDisposed) { if (f.InvokeRequired) f.BeginInvoke(() => f.Video.Visible = false); else f.Video.Visible = false; }
    }
}
