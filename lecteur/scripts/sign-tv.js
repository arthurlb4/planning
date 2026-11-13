// Signe l'appli télé (projet Tizen) et prépare le paquet d'installation Windows, sans VS Code ni Tizen Studio :
// certificat d'auteur « Tizen » créé ici, certificat de distribution public de Tizen, outil sdb de Samsung.
// Mêmes bibliothèques que l'extension VS Code « Tizen TV » de Samsung.
// Usage (Windows) : node lecteur/scripts/sign-tv.js <dossier du projet Tizen> <dossier de sortie>
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { TizenCertManager, ProfileManager, TVWebApp } = require('@tizentv/webide-common-tizentv');
const tools = require('@tizentv/tools');

(async () => {
  const [proj, out] = process.argv.slice(2).map(p => path.resolve(p));
  fs.mkdirSync(out, { recursive: true });
  const res = path.resolve(out, '..', 'tizen-resource');
  fs.mkdirSync(path.join(res, 'Author'), { recursive: true });

  const certs = new TizenCertManager(res);
  await certs.init();
  const password = crypto.randomBytes(12).toString('hex');
  certs.createCert({ keyFileName: 'lecteur', authorName: 'Lecteur IPTV', authorPassword: password,
    countryInfo: '', stateInfo: '', cityInfo: '', organizationInfo: '', departmentInfo: '', emailInfo: '' });
  const keyFile = path.join(certs.authorPath, 'lecteur.p12');
  if (!fs.existsSync(keyFile)) throw new Error('Certificat d\'auteur non créé : ' + keyFile);

  const profiles = new ProfileManager(res);
  await profiles.registerProfile('lecteur', { authorCA: certs.getTizenDeveloperCA(), authorCertPath: keyFile, authorPassword: password },
    certs.getTizenDistributorProfile('public'));
  profiles.setActivateProfile('lecteur');

  const app = new TVWebApp('LecteurIPTV', proj, 'LectIPTVfr');   // même identifiant que config.xml
  await app.buildWidget(profiles.profilePath, []);
  const wgt = path.join(proj, 'LecteurIPTV.wgt');
  if (!fs.existsSync(wgt)) throw new Error('Paquet non créé : ' + wgt);
  fs.copyFileSync(wgt, path.join(out, 'LecteurIPTV.wgt'));

  // sdb (outil d'installation sur la télé) et ses bibliothèques
  const sdb = await tools.getSdbPath();
  const dir = path.dirname(sdb);
  for (const f of fs.readdirSync(dir)) if (/^sdb(\.exe)?$/i.test(f) || /\.dll$/i.test(f)) fs.copyFileSync(path.join(dir, f), path.join(out, f));
  console.log('OK   ' + out + ' : ' + fs.readdirSync(out).join(', '));
})().catch(e => { console.error(e); process.exit(1); });
