import * as vscode from 'vscode';

let panel: vscode.WebviewPanel | undefined;
let isRecording = false;

// Decoration type for hap highlighting (persistent, reused)
// Decoration type for hap highlighting (match Strudel REPL white-boxed look)
const hapDecorationType = vscode.window.createTextEditorDecorationType({
  backgroundColor: 'rgba(255, 255, 255, 0.15)',
  border: '1px solid rgba(255, 255, 255, 0.85)',
  borderRadius: '2px',
  after: {
    margin: '0 0 0 -1px',
  }
});

// Track active hap decorations with their timeout IDs for cleanup
interface ActiveHap {
  range: vscode.Range;
  timeout: ReturnType<typeof setTimeout>;
}
let activeHaps: Map<string, ActiveHap> = new Map();

// Duration for hap highlight in milliseconds
const HAP_HIGHLIGHT_DURATION = 300;

function rangeKey(range: vscode.Range): string {
  return `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
}

let updateTimeout: NodeJS.Timeout | undefined;

function requestUpdate() {
  if (updateTimeout) return;
  updateTimeout = setTimeout(() => {
    updateTimeout = undefined;
    const ranges = Array.from(activeHaps.values()).map(h => h.range);
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.languageId === 'strudel' ||
        editor.document.fileName.endsWith('.strudel') ||
        editor.document.fileName.endsWith('.str')) {
        editor.setDecorations(hapDecorationType, ranges);
      }
    }
  }, 16); // Sync to approx 60fps
}

interface HapData {
  range: [number, number, number, number];
  duration: number;
}

function handleHapsMessage(haps: HapData[]) {
  haps.forEach(hap => {
    const [startLine, startCol, endLine, endCol] = hap.range;
    const vscodeRange = new vscode.Range(startLine, startCol, endLine, endCol);
    const key = rangeKey(vscodeRange);

    // If this range already has an active hap, clear the old timeout
    const existing = activeHaps.get(key);
    if (existing) {
      clearTimeout(existing.timeout);
    }

    // Use provided duration (seconds -> ms), fallback to default
    const highlightDuration = Math.max((hap.duration || 0.3) * 1000, 50);

    const timeout = setTimeout(() => {
      activeHaps.delete(key);
      requestUpdate();
    }, highlightDuration);

    activeHaps.set(key, { range: vscodeRange, timeout });
  });

  requestUpdate();
}

function clearAllHapDecorations() {
  // Clear all timeouts
  for (const hap of activeHaps.values()) {
    clearTimeout(hap.timeout);
  }
  activeHaps.clear();

  // Clear decorations on all visible strudel editors
  for (const editor of vscode.window.visibleTextEditors) {
    if (editor.document.languageId === 'strudel' ||
      editor.document.fileName.endsWith('.strudel') ||
      editor.document.fileName.endsWith('.str')) {
      editor.setDecorations(hapDecorationType, []);
    }
  }
}

export function activate(context: vscode.ExtensionContext): void {
  console.log('[Strudel] Extension activated!');

  // Status Bar
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.text = '$(debug-disconnect) Strudel Disconnected';
  statusBar.command = 'strudel.openPanel';
  statusBar.tooltip = 'Click to open Strudel REPL';
  statusBar.show();
  context.subscriptions.push(statusBar);

  // Output channel for logs
  const logger = vscode.window.createOutputChannel('Strudel');

  function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const strudelScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'strudel.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'static', 'strudel.css'));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body { 
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #eee; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
      margin: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      overflow: hidden;
    }
    h1 { color: #a855f7; margin: 0 0 20px 0; font-size: 24px; align-self: flex-start; }
    .strudel-layout { 
      width: 100%; 
      max-width: 100%; 
      height: 100%;
      display: flex; 
      flex-direction: column; 
      gap: 20px; 
    }
    
    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 20px;
      width: 100%;
    }

    .io-toggle { display: flex; align-items: center; gap: 15px; }
    .toggle-switch { position: relative; display: inline-block; width: 50px; height: 28px; }
    .toggle-switch input { opacity: 0; width: 0; height: 0; }
    .slider {
      position: absolute; cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: #444; transition: .3s; border-radius: 28px;
    }
    .slider:before {
      position: absolute; content: "";
      height: 20px; width: 20px; left: 4px; bottom: 4px;
      background-color: white; transition: .3s; border-radius: 50%;
    }
    input:checked + .slider { background-color: #a855f7; }
    input:checked + .slider:before { transform: translateX(22px); }
    .toggle-label { font-size: 14px; font-weight: 500; color: #8b949e; }

    .controls { display: flex; gap: 10px; flex-wrap: wrap; }

    /* Responsive: stack elements when panel is narrow */
    @media (max-width: 300px) {
      .top-bar {
        flex-direction: column;
        align-items: flex-start;
      }
      .controls {
        flex-direction: column;
        width: 100%;
      }
      .btn {
        width: 100%;
        justify-content: center;
      }
    }
    .btn {
      background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%);
      color: white; border: none;
      padding: 10px 20px; border-radius: 8px;
      cursor: pointer; font-size: 14px; font-weight: 600;
      display: flex; align-items: center; gap: 8px;
      transition: transform 0.1s, opacity 0.2s;
    }
    .btn:hover { opacity: 0.9; transform: translateY(-1px); }
    .btn:active { transform: translateY(0); }
    .btn.stop { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
    .btn.record { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }
    .btn.record.active { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); animation: pulse 2s infinite; }
    
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.7; }
      100% { opacity: 1; }
    }

    .status-text { 
      background: rgba(255,255,255,0.05); 
      padding: 12px; border-radius: 8px;
      font-family: monospace; margin: 0;
      width: 100%; font-size: 13px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    
    .code-preview {
      background: #0d1117; 
      border: 1px solid #30363d;
      border-radius: 8px; 
      padding: 15px;
      flex-grow: 1;
      width: 100%;
      overflow-y: auto;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 12px; 
      white-space: pre-wrap;
      color: #8b949e;
    }
  </style>
</head>
<body>
  <main class="strudel-layout">
    <div class="top-bar">
      <h1>Strudel Control</h1>
      <div class="io-toggle">
        <span class="toggle-label" id="strudel-toggle-label">Audio Engine</span>
        <label class="toggle-switch">
          <input type="checkbox" id="strudel-audio-toggle" />
          <span class="slider" aria-hidden="true"></span>
        </label>
      </div>
    </div>

    <div class="controls">
      <button class="btn" id="play-btn"><span>▶️</span> Play</button>
      <button class="btn stop" id="stop-btn"><span>⏹️</span> Stop</button>
      <button class="btn record" id="record-btn"><span>⏺️</span> Record</button>
    </div>

    <p class="status-text" id="strudel-info">Connect audio and press Play to start.</p>
    
    <div class="code-preview" id="code-preview">No code loaded.</div>
  </main>
  
  <script type="module" src="${strudelScriptUri}"></script>
  <script>
    let pendingCode = null;
    let isRecording = false;
    
    window.addEventListener('message', function(event) {
      const msg = event.data;
      if (msg.command === 'update') {
        pendingCode = msg.data;
        const preview = document.getElementById('code-preview');
        if (preview) {
          preview.textContent = msg.data;
        }
      } else if (msg.command === 'setRecording') {
        isRecording = msg.value;
        const btn = document.getElementById('record-btn');
        if (isRecording) {
          btn.classList.add('active');
          btn.innerHTML = '<span>⏹️</span> Stop Rec';
        } else {
          btn.classList.remove('active');
          btn.innerHTML = '<span>⏺️</span> Record';
        }
      }
    });
    
    document.getElementById('play-btn').addEventListener('click', function() {
      if (pendingCode) {
        window.postMessage({ command: 'update', data: pendingCode }, '*');
      }
    });
    
    document.getElementById('stop-btn').addEventListener('click', function() {
      window.postMessage({ command: 'stop' }, '*');
    });

    document.getElementById('record-btn').addEventListener('click', function() {
      if (isRecording) {
        window.postMessage({ command: 'stopRecording' }, '*');
      } else {
        window.postMessage({ command: 'startRecording' }, '*');
      }
    });
  </script>
</body>
</html>`;
  }

  function createPanel() {
    if (panel) {
      panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    console.log('[Strudel] Creating panel...');
    panel = vscode.window.createWebviewPanel(
      'strudelRepl', 'Strudel Control', vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [context.extensionUri] }
    );

    panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);

    panel.webview.onDidReceiveMessage(async msg => {
      if (msg.type === 'log') logger.appendLine(msg.value);
      else if (msg.type === 'error') vscode.window.showErrorMessage('Strudel: ' + msg.value);
      else if (msg.type === 'haps') {
        // Handle batched hap events for real-time highlighting
        handleHapsMessage(msg.haps);
      }
      else if (msg.type === 'hap') {
        // Fallback for single hap messages
        handleHapsMessage([{ range: msg.range, duration: msg.duration }]);
      }
      else if (msg.type === 'recording_complete') {
        // Save the recorded audio
        try {
          const data = new Uint8Array(msg.data);
          const defaultName = `strudel-recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;

          const saveUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(defaultName),
            filters: { 'WebM Audio': ['webm'], 'All Files': ['*'] }
          });

          if (saveUri) {
            await vscode.workspace.fs.writeFile(saveUri, data);
            vscode.window.showInformationMessage(`Recording saved to ${saveUri.fsPath}`);
          }
        } catch (error) {
          vscode.window.showErrorMessage('Failed to save recording: ' + (error as Error).message);
        }
      }
      else if (msg.type === 'status') {
        if (msg.value === 'playing') {
          statusBar.text = isRecording ? '$(record) Recording...' : '$(unmute) Playing';
          statusBar.tooltip = 'Click to show Strudel REPL';
        } else if (msg.value === 'connected') {
          statusBar.text = '$(pass) Audio Connected';
        } else if (msg.value === 'stopped') {
          statusBar.text = '$(mute) Stopped';
          clearAllHapDecorations();  // Clear highlighting when stopped
        } else if (msg.value === 'recording') {
          isRecording = true;
          statusBar.text = '$(record) Recording...';
          panel?.webview.postMessage({ command: 'setRecording', value: true });
        } else if (msg.value === 'recording_stopped') {
          isRecording = false;
          statusBar.text = '$(mute) Stopped';
          panel?.webview.postMessage({ command: 'setRecording', value: false });
        } else {
          statusBar.text = '$(debug-disconnect) Disconnected';
          clearAllHapDecorations();  // Clear highlighting when disconnected
        }
      }
    });

    panel.onDidDispose(() => {
      panel = undefined;
      statusBar.text = '$(debug-disconnect) Strudel Disconnected';
    });

    console.log('[Strudel] Panel created');
  }

  function flash(editor: vscode.TextEditor, range: vscode.Range | undefined) {
    console.log('[Strudel] Flashing editor...');
    const flashDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(50, 255, 50, 0.5)',
      borderRadius: '4px'
    });

    if (!range) {
      const fullRange = new vscode.Range(0, 0, editor.document.lineCount, 0);
      editor.setDecorations(flashDecorationType, [fullRange]);
    } else {
      editor.setDecorations(flashDecorationType, [range]);
    }

    setTimeout(() => {
      editor.setDecorations(flashDecorationType, []);
      flashDecorationType.dispose();
    }, 200);
  }

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('strudel.play', () => {
      console.log('[Strudel] Play command');
      createPanel();
      const editor = vscode.window.activeTextEditor;
      if (editor && panel) {
        const code = editor.document.getText();
        console.log('[Strudel] Sending full file, length:', code.length);
        panel.webview.postMessage({
          command: 'update',
          data: code,
          lineOffset: 0,
          charOffset: 0
        });
        flash(editor, undefined);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('strudel.update', () => {
      vscode.commands.executeCommand('strudel.play');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('strudel.play_selection', () => {
      console.log('[Strudel] Play selection command');
      createPanel();
      const editor = vscode.window.activeTextEditor;
      if (editor && panel) {
        const selection = editor.selection;
        let code = '';
        let range: vscode.Range | undefined;

        if (!selection.isEmpty) {
          code = editor.document.getText(selection);
          range = selection;
        } else {
          const line = editor.document.lineAt(editor.selection.active.line);
          code = line.text;
          range = line.range;
        }

        console.log('[Strudel] Sending selection');
        panel.webview.postMessage({
          command: 'update',
          data: code,
          lineOffset: range.start.line,
          charOffset: range.start.character
        });
        flash(editor, range);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('strudel.stop', () => {
      console.log('[Strudel] Stop command');
      if (panel) {
        panel.webview.postMessage({ command: 'stop' });
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('strudel.openPanel', () => {
      console.log('[Strudel] Open panel command');
      createPanel();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('strudel.toggleRecording', () => {
      console.log('[Strudel] Toggle recording command');
      if (!panel) {
        vscode.window.showWarningMessage('Please open the Strudel panel and connect audio first');
        return;
      }
      if (isRecording) {
        panel.webview.postMessage({ command: 'stopRecording' });
      } else {
        panel.webview.postMessage({ command: 'startRecording' });
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('strudel.update', () => {
      vscode.commands.executeCommand('strudel.play');
    })
  );

  console.log('[Strudel] All commands registered');
}

export function deactivate(): void { }
