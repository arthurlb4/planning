; Installateur de l'appli native (Inno Setup) : dans le profil de l'utilisateur, sans droits d'administrateur,
; raccourcis Bureau et menu Démarrer. Compilé par .github/workflows/natif.yml.
#define Ver GetEnv("APP_VERSION")
[Setup]
AppId={{8F3D2A61-6B1E-4C5A-9E2F-4C1B7D0A9E55}
AppName=Lecteur IPTV (natif)
AppVersion={#Ver}
AppPublisher=franceinfo planning
DefaultDirName={localappdata}\Programs\Lecteur IPTV natif
DefaultGroupName=Lecteur IPTV (natif)
PrivilegesRequired=lowest
DisableProgramGroupPage=yes
DisableDirPage=yes
DisableReadyPage=yes
OutputDir=..\..\build
OutputBaseFilename=Lecteur-IPTV-Natif-Installation
SetupIconFile=..\desktop\icon.ico
UninstallDisplayIcon={app}\LecteurIPTV.exe
Compression=lzma2/fast
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes

[Languages]
Name: "fr"; MessagesFile: "compiler:Languages\French.isl"

[Files]
Source: "..\..\build\app\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Lecteur IPTV (natif)"; Filename: "{app}\LecteurIPTV.exe"
Name: "{userdesktop}\Lecteur IPTV (natif)"; Filename: "{app}\LecteurIPTV.exe"

[Run]
Filename: "{app}\LecteurIPTV.exe"; Description: "Ouvrir le Lecteur IPTV"; Flags: nowait postinstall skipifsilent
; mise à jour par « Redémarrer et installer » (installation sans fenêtre) : l'appli est rouverte une fois tout installé
Filename: "{app}\LecteurIPTV.exe"; Flags: nowait; Check: Relancer

[Code]
function Relancer: Boolean;
begin
  Result := WizardSilent and (ExpandConstant('{param:RELANCE|0}') = '1');
end;
