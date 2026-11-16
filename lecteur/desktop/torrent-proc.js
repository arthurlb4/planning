// Processus du client torrent (lancé par remux.js, en priorité basse) : sert /torrent/… sur un port local et l'annonce au
// processus principal ; s'arrête avec lui.
const http = require('http');
const handle = require('./torrent');
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!handle(req, res, u)) { res.statusCode = 404; res.end(); }
});
srv.listen(0, '127.0.0.1', () => { if (process.send) process.send({ port: srv.address().port }); });
// appli fermée : torrents confiés à qBittorrent (voir torrent.js), puis on s'arrête ; au plus 90 s
process.on('disconnect', () => { setTimeout(() => process.exit(0), 90e3).unref(); Promise.resolve(handle.finish && handle.finish()).catch(() => {}).then(() => process.exit(0)); });
