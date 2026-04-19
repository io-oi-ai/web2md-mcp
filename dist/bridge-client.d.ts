/**
 * Minimal Extension Bridge client for the MCP server.
 * Replicates the core logic from packages/cli/src/bridge.ts without the CLI dependency.
 */
export interface BridgeResult {
    html: string;
    extractor: string;
}
export declare function fetchViaExtension(url: string, extensionId: string): Promise<BridgeResult>;
export declare function resolveExtensionId(apiBase: string, apiKey: string): Promise<string>;
export declare function closeBridgeServer(): void;
