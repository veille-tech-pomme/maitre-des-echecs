// Proxy HTTP local → site en ligne (WebKit du box n'a pas TLS)
import http from 'node:http';
const TARGET = process.env.TARGET || 'https://veille-tech-pomme.github.io';
http.createServer(async (req, res) => {
  try {
    const r = await fetch(TARGET + req.url, { headers: { 'user-agent': 'e2e' } });
    const h = {}; r.headers.forEach((v, k) => { if (!/encoding|length|connection/.test(k)) h[k] = v; });
    res.writeHead(r.status, h); res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) { res.writeHead(502); res.end(String(e)); }
}).listen(+process.env.PORT || 8099);
