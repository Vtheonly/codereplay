import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import type { JsonRpcRequest, JsonRpcResponse } from './protocol.js';

export class McpClient {
  private stdin: Writable;
  private stdout: Readable;
  private nextId = 1;
  private pending = new Map<number | string, (r: JsonRpcResponse) => void>();
  private listeners = new Set<(r: JsonRpcResponse) => void>();
  private closed = false;

  constructor(stdin: Writable, stdout: Readable) {
    this.stdin = stdin;
    this.stdout = stdout;
    const rl = createInterface({ input: stdout, crlfDelay: Infinity });
    rl.on('line', (line) => {
      if (!line.trim()) return;
      let msg: JsonRpcResponse;
      try { msg = JSON.parse(line); } catch { return; }
      for (const l of this.listeners) l(msg);
      const resolver = this.pending.get(msg.id as number | string);
      if (resolver) {
        this.pending.delete(msg.id as number | string);
        resolver(msg);
      }
    });
    rl.on('close', () => { this.closed = true; });
  }

  request(method: string, params?: unknown): Promise<JsonRpcResponse> {
    const id = this.nextId++;
    const req: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
    return new Promise((resolve) => {
      if (this.closed) throw new Error('client closed');
      this.pending.set(id, resolve);
      this.stdin.write(JSON.stringify(req) + '\n');
    });
  }

  notify(method: string, params?: unknown): void {
    this.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
  }

  sendRaw(data: string): void {
    this.stdin.write(data);
  }

  onMessage(fn: (r: JsonRpcResponse) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  async initialize(): Promise<JsonRpcResponse> {
    const resp = await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'codereplay-test', version: '0.1.0' },
    });
    this.notify('notifications/initialized');
    return resp;
  }
}

export function withTimeout<T>(p: Promise<T>, ms: number, label = 'operation'): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms).unref?.()
    ),
  ]);
}
