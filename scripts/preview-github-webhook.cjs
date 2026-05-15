/**
 * GitHub PR webhook receiver for preview deploy/teardown (runs on the preview host).
 * Listens on 127.0.0.1:PREVIEW_WEBHOOK_PORT (default 9090). Edge nginx should proxy
 * POST /webhooks/github/preview here with the raw body unchanged for signature verification.
 *
 * Env:
 *   GITHUB_WEBHOOK_SECRET (required) — same value as GitHub webhook "Secret"
 *   PREVIEW_GITHUB_REPO (optional) — full name e.g. NetanelAlbert/EquipTrack; rejects other repos
 *   PREVIEW_WEBHOOK_ENV_FILE — path to shell env file for preview-github-webhook-exec.sh
 *   PREVIEW_WEBHOOK_LOG — log file path (optional)
 */
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PREVIEW_WEBHOOK_PORT || '9090');
const SECRET = process.env.GITHUB_WEBHOOK_SECRET;
const EXPECTED_REPO = process.env.PREVIEW_GITHUB_REPO || 'NetanelAlbert/EquipTrack';
const EXEC_SCRIPT = path.join(__dirname, 'preview-github-webhook-exec.sh');
const LOG_PATH = process.env.PREVIEW_WEBHOOK_LOG || '';

function logLine(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  if (LOG_PATH) {
    fs.appendFileSync(LOG_PATH, line);
  }
  // eslint-disable-next-line no-console
  console.error(line.trimEnd());
}

function verifySignature(rawBody, signatureHeader) {
  if (!SECRET || !signatureHeader) {
    return false;
  }
  const expected =
    'sha256=' +
    crypto.createHmac('sha256', SECRET).update(rawBody).digest('hex');
  const a = Buffer.from(signatureHeader, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function runExec(action, pr) {
  const logStream = LOG_PATH
    ? fs.createWriteStream(LOG_PATH, { flags: 'a' })
    : null;
  const child = spawn(
    'bash',
    [EXEC_SCRIPT, action, String(pr)],
    {
      detached: true,
      stdio: ['ignore', logStream || 'ignore', logStream || 'ignore'],
      env: { ...process.env },
    }
  );
  child.unref();
  if (logStream) {
    logStream.on('finish', () => logStream.close());
  }
}

const server = http.createServer((req, res) => {
  if (req.url !== '/webhooks/github/preview' || req.method !== 'POST') {
    res.writeHead(req.method === 'GET' && req.url === '/healthz' ? 200 : 404, {
      'Content-Type': 'text/plain',
    });
    res.end(req.method === 'GET' && req.url === '/healthz' ? 'ok' : 'Not found');
    return;
  }

  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const rawBody = Buffer.concat(chunks);
    const sig = req.headers['x-hub-signature-256'];
    if (!verifySignature(rawBody, sig)) {
      logLine('webhook: bad or missing signature');
      res.writeHead(401, { 'Content-Type': 'text/plain' });
      res.end('Unauthorized');
      return;
    }

    const event = req.headers['x-github-event'];
    if (event !== 'pull_request') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Ignored');
      return;
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Bad JSON');
      return;
    }

    const repoFull = payload.repository && payload.repository.full_name;
    if (repoFull && repoFull !== EXPECTED_REPO) {
      logLine(`webhook: wrong repository ${repoFull}`);
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Wrong repository');
      return;
    }

    const pr = payload.pull_request;
    if (!pr) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('No pull_request');
      return;
    }

    const base = pr.base && pr.base.ref;
    if (base !== 'main' && base !== 'develop') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Ignored base');
      return;
    }

    const action = payload.action;
    const num = pr.number;

    if (action === 'closed') {
      logLine(`webhook: teardown PR #${num}`);
      runExec('teardown', num);
      res.writeHead(202, { 'Content-Type': 'text/plain' });
      res.end('Teardown queued');
      return;
    }

    if (['opened', 'synchronize', 'reopened', 'ready_for_review'].includes(action)) {
      if (pr.draft === true) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Ignored draft');
        return;
      }
      logLine(`webhook: deploy PR #${num} action=${action}`);
      runExec('deploy', num);
      res.writeHead(202, { 'Content-Type': 'text/plain' });
      res.end('Deploy queued');
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('No-op');
  });
});

server.on('clientError', (err, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

if (!SECRET) {
  logLine('FATAL: GITHUB_WEBHOOK_SECRET is not set');
  process.exit(1);
}

server.listen(PORT, '127.0.0.1', () => {
  logLine(`preview-github-webhook listening on 127.0.0.1:${PORT}`);
});
