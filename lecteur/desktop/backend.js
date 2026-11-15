// Serveur local de l'appli native (lecteur/natif) : le même que celui de l'appli Electron (remux.js : conversion des films,
// torrents, chaînes par VLC), lancé par Node fourni avec l'appli. Donne son port sur la sortie standard ; s'arrête avec l'appli.
const path = require('path'), fs = require('fs'), { execFile } = require('child_process');
const startRemux = require('./remux');
function ffmpegPath() { try { return require('ffmpeg-static'); } catch (e) { return 'ffmpeg'; } }
function findVlc() {
  const env = process.env, dirs = [env.ProgramFiles, env['ProgramFiles(x86)'], env.ProgramW6432, env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs')].filter(Boolean);
  for (const d of dirs) { const f = path.join(d, 'VideoLAN', 'VLC', 'vlc.exe'); if (fs.existsSync(f)) return Promise.resolve(f); }
  if (process.platform !== 'win32') return Promise.resolve('');
  return new Promise(res => execFile('reg', ['query', 'HKLM\\SOFTWARE\\VideoLAN\\VLC', '/v', 'InstallDir'], { windowsHide: true }, (err, out) => {
    const m = !err && String(out).match(/InstallDir\s+REG_SZ\s+(.+)/); const f = m && path.join(m[1].trim(), 'vlc.exe');
    res(f && fs.existsSync(f) ? f : '');
  }));
}
Promise.resolve(startRemux(ffmpegPath(), findVlc)).then(port => process.stdout.write(JSON.stringify({ port }) + '\n'));
process.stdin.on('end', () => process.exit(0)); process.stdin.resume();
