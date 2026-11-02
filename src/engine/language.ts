export function languageFromPath(p: string): string {
  const base = p.split('/').pop()?.toLowerCase() ?? '';
  if (base === 'dockerfile') return 'dockerfile';
  if (base === 'makefile') return 'makefile';
  const ext = base.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
    c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', hpp: 'cpp', cs: 'csharp',
    json: 'json', yml: 'yaml', yaml: 'yaml', toml: 'ini', ini: 'ini',
    md: 'markdown', html: 'html', css: 'css', scss: 'scss', sass: 'scss',
    sql: 'sql', sh: 'shell', bash: 'shell', zsh: 'shell',
    xml: 'xml', txt: 'plaintext',
  };
  return map[ext] ?? 'plaintext';
}
