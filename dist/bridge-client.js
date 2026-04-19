"use strict";
/**
 * Minimal Extension Bridge client for the MCP server.
 * Replicates the core logic from packages/cli/src/bridge.ts without the CLI dependency.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchViaExtension = fetchViaExtension;
exports.resolveExtensionId = resolveExtensionId;
exports.closeBridgeServer = closeBridgeServer;
const node_http_1 = require("node:http");
const node_child_process_1 = require("node:child_process");
const BRIDGE_PORT = 27832;
const BRIDGE_TIMEOUT = 60000;
let _server = null;
let _serverStarted = false;
let _pendingResolve = null;
let _pendingReject = null;
let _pendingTimeout = null;
function openBrowser(url) {
    const platform = process.platform;
    const cmd = platform === 'darwin' ? `open "${url}"` :
        platform === 'win32' ? `start "" "${url}"` :
            `xdg-open "${url}"`;
    (0, node_child_process_1.exec)(cmd, () => { });
}
function buildBridgePage(extensionId, targetUrl) {
    return `<!DOCTYPE html><html><head><title>Web2MD Bridge</title></head><body>
<p id="s">Connecting to Web2MD extension...</p>
<script>
const eid=${JSON.stringify(extensionId)},url=${JSON.stringify(targetUrl)},port=${BRIDGE_PORT};
function s(m){document.getElementById('s').textContent=m;}
function post(body){fetch('http://localhost:'+port+'/result',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}
if(!chrome||!chrome.runtime){s('Extension API unavailable');post({error:'Chrome extension API not available'});}
else{s('Extracting...');chrome.runtime.sendMessage(eid,{type:'BRIDGE_CONVERT',url},(r)=>{
  if(chrome.runtime.lastError){const e=chrome.runtime.lastError.message||'Extension not found';s('Error: '+e);post({error:e});return;}
  if(!r||!r.success){const e=(r&&r.error)||'Unknown error';s('Error: '+e);post({error:e});return;}
  s('Sending...');post({html:r.html,extractor:r.extractor||'generic'}).then(()=>s('Done! Close this tab.'));
});}
</script></body></html>`;
}
function ensureBridgeServer() {
    if (_serverStarted && _server)
        return Promise.resolve();
    return new Promise((resolve, reject) => {
        _server = (0, node_http_1.createServer)((req, res) => {
            if (req.method === 'GET' && req.url?.startsWith('/bridge')) {
                const params = new URLSearchParams(req.url.slice('/bridge'.length));
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(buildBridgePage(params.get('eid') || '', params.get('url') || ''));
                return;
            }
            if (req.method === 'POST' && req.url === '/result') {
                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end('{"ok":true}');
                let body = '';
                req.on('data', c => { body += c; });
                req.on('end', () => {
                    if (_pendingTimeout)
                        clearTimeout(_pendingTimeout);
                    const rv = _pendingResolve;
                    const rj = _pendingReject;
                    _pendingResolve = _pendingReject = _pendingTimeout = null;
                    if (!rv || !rj)
                        return;
                    try {
                        const d = JSON.parse(body);
                        if (d.error)
                            rj(new Error(`Bridge error: ${d.error}`));
                        else if (d.html)
                            rv({ html: d.html, extractor: d.extractor || 'generic' });
                        else
                            rj(new Error('Bridge returned empty response'));
                    }
                    catch {
                        rj(new Error('Bridge returned invalid JSON'));
                    }
                });
                return;
            }
            if (req.method === 'OPTIONS') {
                res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,GET,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
                res.end();
                return;
            }
            res.writeHead(404);
            res.end();
        });
        _server.listen(BRIDGE_PORT, '127.0.0.1', () => { _serverStarted = true; resolve(); });
        _server.on('error', (e) => {
            reject(e.code === 'EADDRINUSE'
                ? new Error(`Port ${BRIDGE_PORT} in use. Is another web2md bridge running?`)
                : e);
        });
    });
}
async function fetchViaExtension(url, extensionId) {
    await ensureBridgeServer();
    return new Promise((resolve, reject) => {
        _pendingResolve = resolve;
        _pendingReject = reject;
        _pendingTimeout = setTimeout(() => {
            _pendingResolve = _pendingReject = _pendingTimeout = null;
            reject(new Error('Bridge timeout: extension did not respond within 60s'));
        }, BRIDGE_TIMEOUT);
        const bridgeUrl = `http://localhost:${BRIDGE_PORT}/bridge?eid=${encodeURIComponent(extensionId)}&url=${encodeURIComponent(url)}`;
        openBrowser(bridgeUrl);
    });
}
async function resolveExtensionId(apiBase, apiKey) {
    const envId = process.env.WEB2MD_EXTENSION_ID;
    if (envId)
        return envId;
    const res = await fetch(`${apiBase}/extension-id`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
    });
    if (res.status === 404)
        throw new Error('No extension registered. Open web2md.org in Chrome with the extension installed.');
    if (!res.ok)
        throw new Error(`Failed to look up extension ID: ${res.status}`);
    const { extensionId } = await res.json();
    return extensionId;
}
function closeBridgeServer() {
    if (_server) {
        _server.close();
        _server = null;
        _serverStarted = false;
    }
}
