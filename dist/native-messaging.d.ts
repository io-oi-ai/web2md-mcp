/**
 * Chrome Native Messaging wire protocol:
 * Each message is prefixed with a 4-byte little-endian uint32 length header,
 * followed by UTF-8 JSON payload.
 */
export declare function encodeMessage(obj: unknown): Buffer;
export declare class NativeMessageReader {
    private buf;
    private onMessage;
    constructor(onMessage: (msg: unknown) => void);
    push(chunk: Buffer): void;
    private drain;
}
