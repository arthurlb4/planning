namespace LecteurNatif;

/* Premier lancement : réglages et listes de l'appli Electron repris (même site, même format de stockage Chromium) :
   %APPDATA%\Lecteur IPTV\{Local Storage, IndexedDB} → profil WebView2 de cette appli. */
static class Storage
{
    public static void MigrateFromElectron(string udf)
    {
        try
        {
            string src = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Lecteur IPTV");
            string dst = Path.Combine(udf, "EBWebView", "Default");
            if (!Directory.Exists(src) || Directory.Exists(Path.Combine(dst, "Local Storage"))) return;
            foreach (var d in new[] { "Local Storage", "IndexedDB" })
            {
                var s = Path.Combine(src, d); if (Directory.Exists(s)) Copy(s, Path.Combine(dst, d));
            }
        }
        catch { }
    }
    static void Copy(string from, string to)
    {
        Directory.CreateDirectory(to);
        foreach (var f in Directory.GetFiles(from)) { var n = Path.GetFileName(f); if (n == "LOCK") continue; try { File.Copy(f, Path.Combine(to, n), true); } catch { } }
        foreach (var d in Directory.GetDirectories(from)) Copy(d, Path.Combine(to, Path.GetFileName(d)));
    }
}
