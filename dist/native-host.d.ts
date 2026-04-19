#!/usr/bin/env node
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
export {};
