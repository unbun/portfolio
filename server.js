// Zero-dependency static server. Run with `npm start` (or `npm run dev` to auto-restart on changes).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const RESOURCES_DIR = path.join(__dirname, 'resources');

// Clean URLs for the three pages.
const ROUTES = {
  '/': 'index.html',
  '/experience': 'experience.html',
  '/projects': 'projects.html',
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  res.end(body);
}

function serveFile(res, filePath, status = 200, headers = {}) {
  fs.readFile(filePath, (err, data) => {
    if (err) return notFound(res);
    res.writeHead(status, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      ...headers,
    });
    res.end(data);
  });
}

// Serves a file from `root`, refusing anything that resolves outside it.
function serveFrom(root, rel, res, headers) {
  const filePath = path.normalize(path.join(root, rel));
  if (!filePath.startsWith(root + path.sep)) return notFound(res);
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return notFound(res);
    serveFile(res, filePath, 200, headers && headers(filePath));
  });
}

function notFound(res) {
  const page = path.join(PUBLIC_DIR, '404.html');
  fs.readFile(page, (err, data) => {
    if (err) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    send(res, 404, data, MIME['.html']);
  });
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method not allowed', 'text/plain; charset=utf-8');
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'Bad request', 'text/plain; charset=utf-8');
  }

  // Pages use relative links, so normalize "/experience/" to "/experience".
  if (pathname.length > 1 && pathname.endsWith('/')) {
    res.writeHead(301, { Location: pathname.replace(/\/+$/, '') || '/' });
    return res.end();
  }

  const route = ROUTES[pathname];
  if (route) return serveFile(res, path.join(PUBLIC_DIR, route));

  // Downloadable documents (resume, papers) live in resources/.
  if (pathname.startsWith('/resources/')) {
    return serveFrom(RESOURCES_DIR, pathname.slice('/resources/'.length), res, (fp) => ({
      'Content-Disposition': `attachment; filename="${path.basename(fp).replace(/"/g, '')}"`,
    }));
  }

  serveFrom(PUBLIC_DIR, pathname, res);
});

server.listen(PORT, () => {
  console.log(`Portfolio running at http://localhost:${PORT}`);
});
