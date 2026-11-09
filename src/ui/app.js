/* global marked, mermaid, katex, monaco, require */

const state = {
  session: null,
  steps: [],
  currentStep: null,
  currentFileIndex: 0,
  diffEditor: null,
};

marked.setOptions({ gfm: true, breaks: false });
mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });

require.config({
  paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs' },
});

async function bootstrap() {
  const session = await fetch('/api/session').then((r) => r.json());
  state.session = session;
  state.steps = session.steps;

  document.getElementById('project-name').textContent = session.project_name;
  document.getElementById('session-meta').innerHTML = `
    <span class="badge ${session.verified ? 'ok' : 'bad'}">
      ${session.verified ? '✓ verified' : '⚠ unverified'}
    </span>
    <span class="badge">${session.scope_type}</span>
    <span class="badge">${session.steps.length} steps</span>
  `;

  renderStepList();

  require(['vs/editor/editor.main'], () => {
    state.diffEditor = monaco.editor.createDiffEditor(document.getElementById('diff'), {
      theme: 'vs-dark',
      automaticLayout: true,
      readOnly: true,
      renderSideBySide: true,
      ignoreTrimWhitespace: false,
      renderOverviewRuler: true,
      originalEditable: false,
    });
    if (state.steps.length > 0) selectStep(state.steps[0].step_id);
  });
}

function renderStepList() {
  const list = document.getElementById('step-list');
  list.innerHTML = '';
  for (const s of state.steps) {
    const li = document.createElement('li');
    li.textContent = `[${s.step_id}] ${s.title}`;
    li.dataset.stepId = String(s.step_id);
    li.onclick = () => selectStep(s.step_id);
    list.appendChild(li);
  }
}

async function selectStep(id) {
  state.currentStep = await fetch(`/api/steps/${id}`).then((r) => r.json());
  state.currentFileIndex = 0;

  document.querySelectorAll('#step-list li').forEach((li) => {
    li.classList.toggle('active', Number(li.dataset.stepId) === id);
  });
  document.getElementById('step-title').textContent =
    `Step ${state.currentStep.step_id}: ${state.currentStep.title}`;

  renderFileTabs();
  renderFileDiff();
  renderExplanation();
}

function renderFileTabs() {
  const tabs = document.getElementById('file-tabs');
  tabs.innerHTML = '';
  state.currentStep.files.forEach((f, i) => {
    const t = document.createElement('button');
    let label = f.path;
    if (f.action === 'RENAME') label = `${f.old_path} → ${f.path}`;
    else if (f.action === 'CREATE') label = `＋ ${f.path}`;
    else if (f.action === 'DELETE') label = `－ ${f.path}`;
    t.textContent = label;
    t.className = 'tab' + (i === state.currentFileIndex ? ' active' : '');
    t.onclick = () => {
      state.currentFileIndex = i;
      renderFileTabs();
      renderFileDiff();
    };
    tabs.appendChild(t);
  });
}

function renderFileDiff() {
  if (!state.diffEditor) return;
  const file = state.currentStep.files[state.currentFileIndex];
  const editor = state.diffEditor;

  // Dispose previous models to avoid leaks
  const oldModel = editor.getModel()?.original;
  const newModel = editor.getModel()?.modified;
  oldModel?.dispose();
  newModel?.dispose();

  if (!file) {
    editor.setModel({
      original: monaco.editor.createModel('', 'plaintext'),
      modified: monaco.editor.createModel('', 'plaintext'),
    });
    return;
  }
  editor.setModel({
    original: monaco.editor.createModel(file.old_content ?? '', file.language),
    modified: monaco.editor.createModel(file.new_content ?? '', file.language),
  });
}

function renderExplanation() {
  const ex = state.currentStep.explanation || {};

  document.getElementById('md').innerHTML = marked.parse(ex.markdown || '');

  const diagramEl = document.getElementById('diagram');
  diagramEl.innerHTML = '';
  if (ex.diagram) {
    const id = 'mermaid-' + Math.random().toString(36).slice(2);
    mermaid.render(id, ex.diagram)
      .then(({ svg }) => { diagramEl.innerHTML = svg; })
      .catch((err) => {
        diagramEl.innerHTML = `<pre class="error">Mermaid error: ${err.message}</pre>`;
      });
  }

  const mathEl = document.getElementById('math');
  mathEl.innerHTML = '';
  if (Array.isArray(ex.math) && ex.math.length) {
    for (const tex of ex.math) {
      const div = document.createElement('div');
      div.className = 'math-block';
      mathEl.appendChild(div);
      try {
        katex.render(tex, div, { displayMode: true, throwOnError: false });
      } catch (err) {
        div.textContent = `KaTeX error: ${err.message}`;
      }
    }
  }
}

document.getElementById('prev').onclick = () => {
  const idx = state.steps.findIndex((s) => s.step_id === state.currentStep?.step_id);
  if (idx > 0) selectStep(state.steps[idx - 1].step_id);
};
document.getElementById('next').onclick = () => {
  const idx = state.steps.findIndex((s) => s.step_id === state.currentStep?.step_id);
  if (idx >= 0 && idx < state.steps.length - 1) selectStep(state.steps[idx + 1].step_id);
};
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') document.getElementById('prev').click();
  if (e.key === 'ArrowRight') document.getElementById('next').click();
});

bootstrap().catch((err) => {
  document.body.innerHTML = `<pre class="fatal">Bootstrap failed:\n${err.stack || err.message}</pre>`;
});
