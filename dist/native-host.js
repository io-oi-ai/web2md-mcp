#!/usr/bin/env node
"use strict";
/**
 * Web2MD Native Messaging Host + Local TCP Relay
 *
 * Two roles:
 * 1. Native Messaging Host: Chrome launches this process, communicates via stdin/stdout
 * 2. TCP Relay: Listens on localhost:12315, forwards requests to the extension
 *
 * Flow:
 *   MCP Server ──TCP──► native-host ──NM stdout──► Chrome Extension
 *   MCP Server ◄──TCP── native-host ◄──NM stdin── Chrome Extension
 */
Object.defineProperty(exports, "__esModule", { value: true });
const node_net_1 = require("node:net");
const native_messaging_js_1 = require("./native-messaging.js");
const TCP_PORT = 12315;
// Pending requests: id → TCP socket that sent the request
const pending = new Map();
// ── NM Protocol (stdin/stdout ↔ Chrome Extension) ──────────────
function sendToExtension(msg) {
    const frame = (0, native_messaging_js_1.encodeMessage)(msg);
    process.stdout.write(frame);
}
// Messages FROM the extension (via NM stdin)
const nmReader = new native_messaging_js_1.NativeMessageReader((msg) => {
    const m = msg;
    // Route response back to the TCP client that made the request
    if (m.id && pending.has(m.id)) {
        const socket = pending.get(m.id);
        try {
            socket.write(JSON.stringify(msg) + '\n');
        }
        catch { /* socket closed */ }
        // Clean up on terminal messages
        if (m.type === 'convert_result' || m.type === 'error' || m.type === 'batch_complete' || m.type === 'pong') {
            pending.delete(m.id);
        }
    }
});
// Keep stdin open — Chrome NM communicates via this pipe
process.stdin.resume();
process.stdin.on('data', (chunk) => {
    nmReader.push(chunk);
});
process.stdin.on('end', () => {
    tcpServer.close();
    process.exit(0);
});
// Prevent unhandled errors from crashing the host
process.on('uncaughtException', () => { });
// Keep the process alive
setInterval(() => { }, 60000);
// ── TCP Server (localhost:12315 ↔ MCP Server) ──────────────────
const tcpServer = (0, node_net_1.createServer)((socket) => {
    let lineBuf = '';
    socket.on('data', (chunk) => {
        lineBuf += chunk.toString();
        let nl;
        while ((nl = lineBuf.indexOf('\n')) !== -1) {
            const line = lineBuf.slice(0, nl).trim();
            lineBuf = lineBuf.slice(nl + 1);
            if (!line)
                continue;
            try {
                const msg = JSON.parse(line);
                if (!msg.id)
                    msg.id = `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                pending.set(msg.id, socket);
                sendToExtension(msg);
            }
            catch {
                socket.write(JSON.stringify({ type: 'error', error: 'Invalid JSON' }) + '\n');
            }
        }
    });
    socket.on('close', () => {
        for (const [id, s] of pending) {
            if (s === socket)
                pending.delete(id);
        }
    });
    socket.on('error', () => { });
});
tcpServer.listen(TCP_PORT, '127.0.0.1', () => {
    sendToExtension({ type: 'host_ready', port: TCP_PORT, pid: process.pid });
});
tcpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        process.exit(0);
    }
    sendToExtension({ type: 'host_error', error: err.message });
});
