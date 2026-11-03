const http = require('http');
const fs = require('fs');
const path = require('path');
const { createAuditHandler } = require('./lib/audit-form');

const PORT = Number(process.env.PORT || process.argv[2]) || 5050;
const ROOT = path.resolve(__dirname);
const handleAudit = createAuditHandler({ root: ROOT });

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

const NO_CACHE = {
  'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/api/audit') return handleAudit(req, res);
  try { reqPath = decodeURIComponent(reqPath); }
  catch { res.writeHead(400); return res.end('400 Bad Request'); }
  // Source, configuration, tests and backups are not public website assets.
  if (reqPath.split(/[\\/]/).some(part => part.startsWith('.')) ||
      /^\/(?:audit|audit-private|lib|tests|integrations)(?:\/|$)/i.test(reqPath) ||
      /^\/(?:server\.js|README\.md)$/i.test(reqPath)) {
    res.writeHead(404); return res.end('404 Not Found');
  }
  if (reqPath === '/') reqPath = '/index.html';

  const filePath = path.resolve(ROOT, '.' + reqPath);
  if (!filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden');
  }
  const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }

    // Stream files and honour Range requests so videos can seek and load in parts.
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (range) {
      const start = range[1] ? Number(range[1]) : Math.max(0, stat.size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
      if (start >= stat.size || start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
        return res.end();
      }
      res.writeHead(206, {
        ...NO_CACHE,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Content-Length': end - start + 1
      });
      return fs.createReadStream(filePath, { start, end }).pipe(res);
    }

    res.writeHead(200, {
      ...NO_CACHE,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Content-Length': stat.size
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running at http://127.0.0.1:${PORT}/ with cache disabled.`);
});
