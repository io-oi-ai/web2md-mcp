"use strict";
/**
 * Chrome Native Messaging wire protocol:
 * Each message is prefixed with a 4-byte little-endian uint32 length header,
 * followed by UTF-8 JSON payload.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NativeMessageReader = void 0;
exports.encodeMessage = encodeMessage;
function encodeMessage(obj) {
    const json = JSON.stringify(obj);
    const payload = Buffer.from(json, 'utf-8');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(payload.length, 0);
    return Buffer.concat([header, payload]);
}
class NativeMessageReader {
    buf = Buffer.alloc(0);
    onMessage;
    constructor(onMessage) {
        this.onMessage = onMessage;
    }
    push(chunk) {
        this.buf = Buffer.concat([this.buf, chunk]);
        this.drain();
    }
    drain() {
        while (this.buf.length >= 4) {
            const len = this.buf.readUInt32LE(0);
            if (this.buf.length < 4 + len)
                break;
            const json = this.buf.subarray(4, 4 + len).toString('utf-8');
            this.buf = this.buf.subarray(4 + len);
            try {
                this.onMessage(JSON.parse(json));
            }
            catch {
                // skip malformed messages
            }
        }
    }
}
exports.NativeMessageReader = NativeMessageReader;
