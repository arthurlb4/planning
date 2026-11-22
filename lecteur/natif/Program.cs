namespace LecteurNatif;
static class Program
{
    /* Version portable : un fichier « portable.txt » à côté de l'appli (mis dans le .zip). Réglages, listes et historique
       gardés dans le dossier « donnees » à côté d'elle (rien dans Windows) ; pas de mise à jour automatique, seulement
       l'annonce d'une nouvelle version à télécharger. */
    public static readonly bool Portable = File.Exists(Path.Combine(AppContext.BaseDirectory, "portable.txt"));
    [STAThread]
    static void Main()
    {
        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
        Application.EnableVisualStyles();
        Application.Run(new MainForm());
    }
}
