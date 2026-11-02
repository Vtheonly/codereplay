import { createInterface } from 'node:readline';
import { TOOLS } from './tools.js';
import {
  ErrorCodes, MCP_PROTOCOL_VERSION,
  type JsonRpcRequest, type JsonRpcResponse, type JsonRpcNotification,
} from './protocol.js';

const SERVER_INFO = { name: 'codereplay', version: '0.1.0' };

export interface ServerOptions {
  stdin?: NodeJS.ReadableStream;
  stdout?: NodeJS.WritableStream;
  cwd?: string;
  log?: (msg: string) => void;
}

export function startMcpServer(opts: ServerOptions = {}): () => void {
  const stdin = opts.stdin ?? process.stdin;
  const stdout = opts.stdout ?? process.stdout;
  const cwd = opts.cwd ?? process.cwd();
  const log = opts.log ?? ((m) => process.stderr.write(m + '\n'));

  const rl = createInterface({ input: stdin as NodeJS.ReadableStream, crlfDelay: Infinity });

  const send = (msg: JsonRpcResponse | JsonRpcNotification): void => {
    (stdout as NodeJS.WritableStream).write(JSON.stringify(msg) + '\n');
  };

  const handleRequest = async (req: JsonRpcRequest): Promise<void> => {
    try {
      switch (req.method) {
        case 'initialize':
          send({
            jsonrpc: '2.0',
            id: req.id,
            result: {
              protocolVersion: MCP_PROTOCOL_VERSION,
              capabilities: { tools: { listChanged: false } },
              serverInfo: SERVER_INFO,
            },
          });
          return;

        case 'ping':
          send({ jsonrpc: '2.0', id: req.id, result: {} });
          return;

        case 'tools/list':
          send({
            jsonrpc: '2.0',
            id: req.id,
            result: {
              tools: TOOLS.map((t) => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema,
              })),
            },
          });
          return;

        case 'tools/call': {
          const params = req.params as { name?: string; arguments?: unknown } | undefined;
          if (!params || typeof params.name !== 'string') {
            send({
              jsonrpc: '2.0',
              id: req.id,
              error: { code: ErrorCodes.InvalidParams, message: 'missing tool name' },
            });
            return;
          }
          const tool = TOOLS.find((t) => t.name === params.name);
          if (!tool) {
            send({
              jsonrpc: '2.0',
              id: req.id,
              error: { code: ErrorCodes.InvalidParams, message: `unknown tool: ${params.name}` },
            });
            return;
          }
          try {
            const result = await tool.handler(params.arguments, { cwd });
            send({ jsonrpc: '2.0', id: req.id, result });
          } catch (e) {
            // Tool *handler* errors become tool results (isError:true), not RPC errors
            send({
              jsonrpc: '2.0',
              id: req.id,
              result: {
                content: [{ type: 'text', text: `Error: ${(e as Error).message}` }],
                isError: true,
              },
            });
          }
          return;
        }

        default:
          send({
            jsonrpc: '2.0',
            id: req.id,
            error: { code: ErrorCodes.MethodNotFound, message: `unknown method: ${req.method}` },
          });
      }
    } catch (e) {
      send({
        jsonrpc: '2.0',
        id: req.id ?? null,
        error: { code: ErrorCodes.InternalError, message: (e as Error).message },
      });
    }
  };

  rl.on('line', (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      send({
        jsonrpc: '2.0',
        id: null,
        error: { code: ErrorCodes.ParseError, message: 'invalid JSON' },
      });
      return;
    }
    const obj = parsed as Record<string, unknown>;
    if (obj.jsonrpc !== '2.0' || typeof obj.method !== 'string') {
      send({
        jsonrpc: '2.0',
        id: (obj.id as string | number) ?? null,
        error: { code: ErrorCodes.InvalidRequest, message: 'not a JSON-RPC 2.0 request' },
      });
      return;
    }
    // Notification (no id) — silently accept, no response
    if (!('id' in obj) || obj.id === undefined) {
      log(`[notif] ${obj.method}`);
      return;
    }
    void handleRequest(obj as unknown as JsonRpcRequest);
  });

  return () => { rl.close(); };
}
