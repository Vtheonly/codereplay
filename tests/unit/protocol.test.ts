import { describe, it, expect } from 'vitest';
import { ErrorCodes, textResult, errorResult, MCP_PROTOCOL_VERSION } from '../../src/mcp/protocol.js';

describe('MCP protocol types', () => {
  it('uses the JSON-RPC 2.0 standard error codes', () => {
    expect(ErrorCodes.ParseError).toBe(-32700);
    expect(ErrorCodes.InvalidRequest).toBe(-32600);
    expect(ErrorCodes.MethodNotFound).toBe(-32601);
    expect(ErrorCodes.InvalidParams).toBe(-32602);
    expect(ErrorCodes.InternalError).toBe(-32603);
  });

  it('declares a valid MCP protocol version', () => {
    expect(MCP_PROTOCOL_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('textResult wraps a value as JSON text content', () => {
    const r = textResult({ foo: 'bar' });
    expect(r.isError).toBeUndefined();
    expect(r.content).toHaveLength(1);
    expect(r.content[0].type).toBe('text');
    expect(JSON.parse(r.content[0].text)).toEqual({ foo: 'bar' });
  });

  it('errorResult wraps a message and marks isError', () => {
    const r = errorResult('boom');
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toBe('boom');
  });
});
