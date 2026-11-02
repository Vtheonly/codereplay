import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Ajv, type ValidateFunction } from 'ajv';
import * as addFormatsModule from 'ajv-formats';
import type { FormatsPlugin } from 'ajv-formats';

// TS ≥5.6 under moduleResolution NodeNext types the CJS default export of
// ajv-formats as the module namespace. Route through the plugin type so this
// compiles identically on TS 5.5 through 5.9+.
const addFormats: FormatsPlugin = (addFormatsModule as unknown as { default: FormatsPlugin }).default;

export interface CodeChange {
  path: string;
  action: 'CREATE' | 'MODIFY' | 'DELETE' | 'RENAME';
  old_path?: string;
  content?: string;
  patch?: string;
}

export interface Step {
  step_id: number;
  title: string;
  commit_message: string;
  explanation: { markdown: string; diagram?: string; math?: string[] };
  code_changes: CodeChange[];
}

export interface Manifest {
  spec_version: '2.1';
  project_metadata: {
    name: string;
    scope_type: 'FULL' | 'PARTIAL';
    target_commit: string;
    scoped_paths: string[];
  };
  steps: Step[];
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

let validatorCache: Promise<ValidateFunction> | null = null;
function getValidator(): Promise<ValidateFunction> {
  if (!validatorCache) {
    validatorCache = (async () => {
      const schemaUrl = new URL('../../schema/codereplay-v2.1.schema.json', import.meta.url);
      const schema = JSON.parse(await readFile(fileURLToPath(schemaUrl), 'utf8'));
      return ajv.compile(schema);
    })();
  }
  return validatorCache;
}

export async function loadManifest(path: string): Promise<Manifest> {
  const raw = await readFile(path, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Manifest is not valid JSON: ${(e as Error).message}`);
  }
  const validate = await getValidator();
  if (!validate(parsed)) {
    const errs = (validate.errors ?? [])
      .map((e) => `  - ${e.instancePath || '/'}: ${e.message}`)
      .join('\n');
    throw new Error(`Manifest schema validation failed:\n${errs}`);
  }
  return parsed as Manifest;
}
