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
process.on('disconnect', () => process.exit(0));          // appli fermée : on s'arrête (fichiers gardés, voir torrent.js)
