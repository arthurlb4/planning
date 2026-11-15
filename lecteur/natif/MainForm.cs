using System.Diagnostics;
using System.Drawing;
using System.Net.NetworkInformation;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.Web.WebView2.Core;
using static LecteurNatif.Natif;

namespace LecteurNatif;

/* Fenêtre unique de l'appli :
   - en bas, un cadre (Video) où mpv dessine la vidéo ;
   - au-dessus, la page (WebView2, moteur d'Edge) dans une couche DirectComposition de la même fenêtre, fond transparent :
     là où la page est transparente (zone du lecteur), on voit la vidéo ; ses commandes et menus passent par-dessus.
   Windows assemble les deux couches : déplacement, redimensionnement, plein écran restent toujours calés.
   La souris est transmise à la page par la fenêtre (le cadre vidéo, désactivé, ne la prend jamais). */
/* Cadre de la vidéo : « transparent » pour la souris (elle passe à la fenêtre, donc à la page posée au-dessus) */
public class VideoPanel : Panel
{
    protected override void WndProc(ref Message m)
    {
        if (m.Msg == WM_NCHITTEST) { m.Result = (IntPtr)(-1); return; }   // HTTRANSPARENT
        base.WndProc(ref m);
    }
}

public class MainForm : Form
{
    const string PAGE = "https://franceinfoplanning.com/iptv/";
    static readonly Regex OWN = new(@"^https?://(www\.)?franceinfoplanning\.com/|^https://cdn\.jsdelivr\.net/|^https://planning-gcal\.|^https://([a-z0-9-]+\.)*(youtube(-nocookie)?\.com|ytimg\.com|googlevideo\.com|google\.com|gstatic\.com)/", RegexOptions.IgnoreCase);
    static readonly string DataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LecteurIPTVNatif");

    IDCompositionDevice dcomp; IDCompositionTarget target; IDCompositionVisual root;
    CoreWebView2CompositionController comp; CoreWebView2 web;
    public readonly VideoPanel Video = new() { BackColor = Color.Black, Visible = false };
    Mpv mpv; Backend backend;
    bool tracking; IntPtr cursor = IntPtr.Zero; bool wasMax;
    FormWindowState lastState = FormWindowState.Normal;

    public MainForm()
    {
        Text = "Lecteur IPTV";
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
        BackColor = Color.FromArgb(0x16, 0x16, 0x15);
        StartPosition = FormStartPosition.Manual;
        FormBorderStyle = FormBorderStyle.Sizable;
        MinimumSize = new Size(480, 520);
        Directory.CreateDirectory(DataDir);
        LoadBounds();
        Controls.Add(Video);
        mpv = new Mpv(this);
    }

    // ---------- fenêtre sans bord (les boutons sont ceux de la page) mais redimensionnable, agrandissable, ancrable
    protected override void WndProc(ref Message m)
    {
        switch (m.Msg)
        {
            case WM_NCCALCSIZE when m.WParam != IntPtr.Zero:
                if (IsZoomed(Handle))
                {   // agrandie : Windows déborde de l'écran de l'épaisseur du cadre ; on la ramène dans la zone de travail
                    var p = System.Runtime.InteropServices.Marshal.PtrToStructure<NCCALCSIZE_PARAMS>(m.LParam);
                    var mon = MonitorFromWindow(Handle, 2); var mi = new MONITORINFO { cbSize = System.Runtime.InteropServices.Marshal.SizeOf<MONITORINFO>() };
                    if (GetMonitorInfo(mon, ref mi)) p.r0 = mi.rcWork;
                    System.Runtime.InteropServices.Marshal.StructureToPtr(p, m.LParam, false);
                }
                m.Result = IntPtr.Zero; return;
            case WM_NCHITTEST:
                m.Result = (IntPtr)HitTest(m.LParam); return;
            case WM_SETCURSOR:
                if ((m.LParam.ToInt64() & 0xFFFF) == HTCLIENT && comp != null) { SetCursor(cursor != IntPtr.Zero ? cursor : LoadCursor(IntPtr.Zero, 32512)); m.Result = (IntPtr)1; return; }
                break;
        }
        if (comp != null && ((m.Msg >= WM_MOUSEFIRST && m.Msg <= WM_MOUSELAST) || m.Msg == WM_MOUSELEAVE)) { ForwardMouse(ref m); return; }
        base.WndProc(ref m);
    }

    int HitTest(IntPtr lp)
    {
        int sx = (short)(lp.ToInt64() & 0xFFFF), sy = (short)((lp.ToInt64() >> 16) & 0xFFFF);
        var pt = new POINT { X = sx, Y = sy }; ScreenToClient(Handle, ref pt);
        if (!IsZoomed(Handle) && WindowState != FormWindowState.Maximized)
        {
            uint dpi = GetDpiForWindow(Handle); int b = GetSystemMetricsForDpi(SM_CXSIZEFRAME, dpi) + GetSystemMetricsForDpi(SM_CXPADDEDBORDER, dpi);
            bool l = pt.X < b, r = pt.X >= ClientSize.Width - b, t = pt.Y < b, bo = pt.Y >= ClientSize.Height - b;
            if (t && l) return HTTOPLEFT; if (t && r) return HTTOPRIGHT; if (bo && l) return HTBOTTOMLEFT; if (bo && r) return HTBOTTOMRIGHT;
            if (l) return HTLEFT; if (r) return HTRIGHT; if (t) return HTTOP; if (bo) return HTBOTTOM;
        }
        if (comp != null)
        {   // zone de la page marquée « app-region: drag » (barre du haut) : déplacement de la fenêtre
            try { if (comp.GetNonClientRegionAtPoint(new Point(pt.X, pt.Y)) == CoreWebView2NonClientRegionKind.Caption) return HTCAPTION; } catch { }
        }
        return HTCLIENT;
    }

    void ForwardMouse(ref Message m)
    {
        long wp = m.WParam.ToInt64(), lp = m.LParam.ToInt64();
        var kind = (CoreWebView2MouseEventKind)m.Msg;
        if (m.Msg == WM_MOUSELEAVE) { tracking = false; comp.SendMouseInput(CoreWebView2MouseEventKind.Leave, 0, 0, Point.Empty); m.Result = IntPtr.Zero; return; }
        var pt = new POINT { X = (short)(lp & 0xFFFF), Y = (short)((lp >> 16) & 0xFFFF) };
        uint data = 0;
        if (m.Msg == WM_MOUSEWHEEL || m.Msg == WM_MOUSEHWHEEL) { ScreenToClient(Handle, ref pt); data = unchecked((uint)(short)((wp >> 16) & 0xFFFF)); }
        else if (m.Msg >= 0x20B && m.Msg <= 0x20D) data = (uint)((wp >> 16) & 0xFFFF);
        var keys = (CoreWebView2MouseEventVirtualKeys)(wp & 0xFFFF);
        if (m.Msg == 0x200 && !tracking) { var t = new TRACKMOUSEEVENT { cbSize = System.Runtime.InteropServices.Marshal.SizeOf<TRACKMOUSEEVENT>(), dwFlags = 2, hwndTrack = Handle }; tracking = TrackMouseEvent(ref t); }
        bool down = m.Msg == 0x201 || m.Msg == 0x204 || m.Msg == 0x207 || m.Msg == 0x20B, up = m.Msg == 0x202 || m.Msg == 0x205 || m.Msg == 0x208 || m.Msg == 0x20C;
        if (down) SetCapture(Handle);
        try { comp.SendMouseInput(kind, keys, data, new Point(pt.X, pt.Y)); } catch { }
        if (up && (wp & 0x73) == 0) ReleaseCapture();
        m.Result = IntPtr.Zero;
    }

    // ---------- démarrage : serveur local (torrents, conversion), couche de composition, page
    protected override async void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        try { await Init(); }
        catch (Exception ex) { MessageBox.Show(this, "Démarrage impossible : " + ex.Message, "Lecteur IPTV", MessageBoxButtons.OK, MessageBoxIcon.Error); }
    }

    async Task Init()
    {
        Storage.MigrateFromElectron(Path.Combine(DataDir, "WebView2"));
        backend = new Backend();
        var portTask = backend.StartAsync();

        dcomp = CreateDevice();
        dcomp.CreateTargetForHwnd(Handle, true, out target);   // au-dessus du cadre vidéo
        dcomp.CreateVisual(out root);
        target.SetRoot(root);
        dcomp.Commit();

        var opts = new CoreWebView2EnvironmentOptions("--disable-web-security --allow-running-insecure-content --autoplay-policy=no-user-gesture-required "
            + "--enable-blink-features=AudioVideoTracks --disable-features=BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,LocalNetworkAccessChecks");
        var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(DataDir, "WebView2"), opts);
        comp = await env.CreateCoreWebView2CompositionControllerAsync(Handle);
        comp.RootVisualTarget = root;
        dcomp.Commit();
        comp.DefaultBackgroundColor = Color.Transparent;
        comp.Bounds = new Rectangle(Point.Empty, ClientSize);
        comp.IsVisible = true;
        comp.CursorChanged += (s, a) => { try { cursor = comp.Cursor; SetCursor(cursor); } catch { } };
        web = comp.CoreWebView2;
        web.Settings.IsNonClientRegionSupportEnabled = true;
        web.Settings.IsStatusBarEnabled = false;
        web.Settings.IsZoomControlEnabled = false;

        string remux = "";
        try { int port = await portTask; if (port > 0) remux = "http://127.0.0.1:" + port; } catch { }
        string shim;
        using (var st = typeof(MainForm).Assembly.GetManifestResourceStream("shim.js")!) using (var rd = new StreamReader(st)) shim = rd.ReadToEnd();
        var cfg = new JsonObject { ["remux"] = remux, ["version"] = "natif " + Application.ProductVersion.Split('+')[0], ["mpv"] = mpv.Available };
        await web.AddScriptToExecuteOnDocumentCreatedAsync(shim.Replace("__CFG__", cfg.ToJsonString()));

        web.WebMessageReceived += (s, a) => { try { OnMessage(a.TryGetWebMessageAsString()); } catch { } };
        // vers les serveurs IPTV : sans les en-têtes propres aux pages web (Origin, Referer), comme une appli de lecture
        web.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
        web.WebResourceRequested += (s, a) => { try { if (!OWN.IsMatch(a.Request.Uri) && !a.Request.Uri.StartsWith("http://127.0.0.1")) { a.Request.Headers.RemoveHeader("Origin"); a.Request.Headers.RemoveHeader("Referer"); } } catch { } };
        web.NewWindowRequested += (s, a) => { a.Handled = true; OpenExternal(a.Uri); };
        web.ContainsFullScreenElementChanged += (s, a) => SetFull(web.ContainsFullScreenElement);
        // page redemandée au site à chaque lancement (jamais une ancienne copie gardée en cache)
        web.NavigateWithWebResourceRequest(env.CreateWebResourceRequest(PAGE, "GET", null, "Cache-Control: no-cache\r\nPragma: no-cache"));
        comp.MoveFocus(CoreWebView2MoveFocusReason.Programmatic);
    }

    // ---------- messages de la page (window.desktop, voir shim.js)
    void OnMessage(string json)
    {
        var m = JsonNode.Parse(json)!.AsObject();
        string t = (string)m["t"]!;
        switch (t)
        {
            case "win":
                var a = (string)m["a"]!;
                if (a == "min") WindowState = FormWindowState.Minimized;
                else if (a == "max") WindowState = WindowState == FormWindowState.Maximized ? FormWindowState.Normal : FormWindowState.Maximized;
                else if (a == "close") Close();
                else if (a == "hold") mpv?.Hold(600);   // la page change de mise en page (plein écran) : la coque garde la vidéo en place
                break;
            case "mpvPlay":
                var id = (int)m["id"]!; var o = m["o"]!.AsObject();
                _ = mpv.PlayAsync(o).ContinueWith(x => Reply(id, x.IsCompletedSuccessfully ? x.Result : new JsonObject { ["error"] = "mpv" }), TaskScheduler.FromCurrentSynchronizationContext());
                break;
            case "mpvStop": mpv.Stop(); break;
            case "mpvRect": mpv.Rect(m["r"] as JsonObject); break;
            case "mpvCmd": mpv.Cmd(m["a"] as JsonArray); break;
            case "vpn": Post(new JsonObject { ["t"] = "vpn", ["v"] = Vpn((string)m["pat"] ?? "") }); break;
            case "vlc": Reply((int)m["id"]!, OpenVlc((string)m["url"], (string)m["name"])); break;
            case "fs": SetFull(!full); break;
        }
    }
    void Reply(int id, JsonNode v) => Post(new JsonObject { ["t"] = "res", ["id"] = id, ["v"] = v });
    public void Post(JsonObject o) { if (IsDisposed) return; if (InvokeRequired) { BeginInvoke(() => Post(o)); return; } try { web?.PostWebMessageAsJson(o.ToJsonString()); } catch { } }

    // conversion des coordonnées de la page (pixels CSS) en pixels de la fenêtre
    public double Scale => (comp?.RasterizationScale ?? 1.0) * (comp?.ZoomFactor ?? 1.0);

    // VPN actif : une carte réseau de VPN allumée (même règle que l'appli Electron)
    static readonly Regex VPN = new(@"cyberghost|wireguard|wintun|openvpn|tap-windows|\btap\b|\btun\b|vpn|nordlynx|proton|mullvad|surfshark", RegexOptions.IgnoreCase);
    static JsonObject Vpn(string pat)
    {
        Regex re = VPN; if (!string.IsNullOrWhiteSpace(pat)) re = new Regex(Regex.Escape(pat), RegexOptions.IgnoreCase);
        var all = new JsonArray(); string hit = "";
        try
        {
            foreach (var n in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (n.OperationalStatus != OperationalStatus.Up || n.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
                all.Add(n.Name);
                if (hit == "" && (re.IsMatch(n.Name) || re.IsMatch(n.Description))) hit = n.Name;
            }
        }
        catch { }
        return new JsonObject { ["on"] = hit != "", ["name"] = hit, ["all"] = all, ["pat"] = pat };
    }

    static bool OpenVlc(string url, string name)
    {
        if (url == null || !Regex.IsMatch(url, "^https?://", RegexOptions.IgnoreCase)) return false;
        foreach (var d in new[] { Environment.GetEnvironmentVariable("ProgramFiles"), Environment.GetEnvironmentVariable("ProgramFiles(x86)"), Environment.GetEnvironmentVariable("ProgramW6432") })
        {
            if (string.IsNullOrEmpty(d)) continue; var f = Path.Combine(d, "VideoLAN", "VLC", "vlc.exe");
            if (File.Exists(f)) { try { var psi = new ProcessStartInfo(f) { UseShellExecute = false }; psi.ArgumentList.Add(url); psi.ArgumentList.Add(":meta-title=" + (name ?? "")); Process.Start(psi); return true; } catch { return false; } }
        }
        return false;
    }
    static void OpenExternal(string url) { try { if (Regex.IsMatch(url ?? "", "^https?://", RegexOptions.IgnoreCase)) Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); } catch { } }

    // ---------- plein écran (F11 ou double-clic sur le lecteur : demandé par la page)
    bool full; Rectangle normalBounds, prevVideo; FormWindowState fullPrev;
    void SetFull(bool on)
    {
        if (on == full) return; full = on;
        // pendant le changement : la vidéo est placée par la coque (plein écran : tout l'écran ; retour : sa place d'avant),
        // les positions envoyées par la page pendant sa nouvelle mise en page sont ignorées un instant
        mpv?.Hold(450);
        if (on)
        {
            prevVideo = Video.Bounds; fullPrev = WindowState; normalBounds = Bounds;
            WindowState = FormWindowState.Normal; Bounds = Screen.FromControl(this).Bounds;
            if (Video.Visible) { Video.Bounds = new Rectangle(Point.Empty, ClientSize); mpv?.FitChild(); }
        }
        else
        {
            Bounds = normalBounds; WindowState = fullPrev;
            if (Video.Visible && prevVideo.Width > 0) { Video.Bounds = prevVideo; mpv?.FitChild(); }
        }
        Post(new JsonObject { ["t"] = "win", ["st"] = new JsonObject { ["max"] = WindowState == FormWindowState.Maximized, ["full"] = full } });
    }

    Size lastClient;
    protected override void OnResize(EventArgs e)
    {
        base.OnResize(e);
        // vidéo agrandie tout de suite dans la même proportion que la fenêtre (la page donne ensuite la zone exacte)
        if (Video.Visible && !(mpv?.Holding ?? false) && lastClient.Width > 0 && lastClient.Height > 0 && ClientSize.Width > 0 && ClientSize != lastClient)
        {
            double kx = (double)ClientSize.Width / lastClient.Width, ky = (double)ClientSize.Height / lastClient.Height; var v = Video.Bounds;
            Video.Bounds = new Rectangle((int)(v.X * kx), (int)(v.Y * ky), (int)Math.Ceiling(v.Width * kx), (int)Math.Ceiling(v.Height * ky));
            mpv?.FitChild();
        }
        if (ClientSize.Width > 0) lastClient = ClientSize;
        if (comp != null) comp.Bounds = new Rectangle(Point.Empty, ClientSize);
        bool max = WindowState == FormWindowState.Maximized;
        if (max != wasMax) { wasMax = max; Post(new JsonObject { ["t"] = "win", ["st"] = new JsonObject { ["max"] = max, ["full"] = full } }); }
        if (WindowState != FormWindowState.Minimized) lastState = WindowState;
        mpv?.Place();
    }
    protected override void OnMove(EventArgs e) { base.OnMove(e); try { comp?.NotifyParentWindowPositionChanged(); } catch { } }
    protected override void OnActivated(EventArgs e) { base.OnActivated(e); try { comp?.MoveFocus(CoreWebView2MoveFocusReason.Programmatic); } catch { } }
    protected override void OnFormClosing(FormClosingEventArgs e) { SaveBounds(); mpv.Stop(); backend?.Stop(); base.OnFormClosing(e); }

    // ---------- taille et position gardées d'une fois sur l'autre
    string StateFile => Path.Combine(DataDir, "fenetre.json");
    void LoadBounds()
    {
        Size = new Size(1400, 860);
        try
        {
            var j = JsonNode.Parse(File.ReadAllText(StateFile))!.AsObject();
            var b = new Rectangle((int)j["x"]!, (int)j["y"]!, (int)j["w"]!, (int)j["h"]!);
            var wa = Screen.FromRectangle(b).WorkingArea;
            if (b.Width >= 480 && b.Height >= 520 && wa.IntersectsWith(b)) Bounds = b; else CenterToScreen();
            if ((bool?)j["max"] == true) WindowState = FormWindowState.Maximized;
        }
        catch { StartPosition = FormStartPosition.CenterScreen; }
    }
    void SaveBounds()
    {
        try
        {
            var b = full ? normalBounds : WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
            File.WriteAllText(StateFile, new JsonObject { ["x"] = b.X, ["y"] = b.Y, ["w"] = b.Width, ["h"] = b.Height, ["max"] = WindowState == FormWindowState.Maximized }.ToJsonString());
        }
        catch { }
    }
}
