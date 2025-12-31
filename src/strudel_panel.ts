import * as vscode from 'vscode';

export type OnEvent = ((message: string) => void);

/**
 * StrudelPanel - Uses WebviewPanel instead of WebviewViewProvider
 * for better compatibility with web-based VS Code environments
 */
class StrudelPanel {
    public static readonly viewType = 'strudel.strudelPanel';

    public onReceiveStatus: OnEvent;
    public onReceiveWarning: OnEvent;
    public onReceiveError: OnEvent;
    public onReceiveLog: OnEvent;

    private _panel?: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _context: vscode.ExtensionContext;

    constructor(extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
        this._extensionUri = extensionUri;
        this._context = context;
        this.onReceiveStatus = () => { console.log('[StrudelPanel] onReceiveStatus not set'); };
        this.onReceiveWarning = () => { console.log('[StrudelPanel] onReceiveWarning not set'); };
        this.onReceiveError = () => { console.log('[StrudelPanel] onReceiveError not set'); };
        this.onReceiveLog = () => { console.log('[StrudelPanel] onReceiveLog not set'); };
    }

    public createOrShow(): void {
        console.log('[StrudelPanel] createOrShow called');

        // If panel exists, reveal it
        if (this._panel) {
            console.log('[StrudelPanel] Panel exists, revealing...');
            this._panel.reveal(vscode.ViewColumn.Beside);
            return;
        }

        // Create a new panel
        console.log('[StrudelPanel] Creating new panel...');
        try {
            this._panel = vscode.window.createWebviewPanel(
                StrudelPanel.viewType,
                'Strudel',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [this._extensionUri],
                }
            );
            console.log('[StrudelPanel] Panel created successfully');

            // Set the HTML content
            console.log('[StrudelPanel] Setting HTML content...');
            this._panel.webview.html = this.getWebviewHtml(this._panel.webview);
            console.log('[StrudelPanel] HTML content set');

            // Handle messages from the webview
            console.log('[StrudelPanel] Setting up message listener...');
            this._panel.webview.onDidReceiveMessage(
                msg => {
                    console.log('[StrudelPanel] Received message:', msg.type);
                    switch (msg.type) {
                        case 'status':
                            this.onReceiveStatus(msg.value);
                            return;
                        case 'warning':
                            this.onReceiveWarning(msg.value);
                            return;
                        case 'error':
                            this.onReceiveError(msg.value);
                            return;
                        case 'log':
                            this.onReceiveLog(msg.value);
                            return;
                        default:
                            console.warn('[StrudelPanel] Unknown message type:', msg.type);
                    }
                },
                undefined,
                this._context.subscriptions
            );

            // Handle panel disposal
            this._panel.onDidDispose(
                () => {
                    console.log('[StrudelPanel] Panel disposed');
                    this._panel = undefined;
                },
                undefined,
                this._context.subscriptions
            );

            console.log('[StrudelPanel] createOrShow completed');
        } catch (e) {
            console.error('[StrudelPanel] Failed to create panel:', e);
            vscode.window.showErrorMessage(`Failed to create Strudel panel: ${e}`);
        }
    }

    public updateTune(data: string): void {
        console.log('[StrudelPanel] updateTune called, data length:', data.length);
        if (this._panel) {
            console.log('[StrudelPanel] Posting update message...');
            try {
                this._panel.webview.postMessage({ command: 'update', data });
                console.log('[StrudelPanel] Update message posted');
            } catch (e) {
                console.error('[StrudelPanel] postMessage failed:', e);
            }
        } else {
            console.warn('[StrudelPanel] No panel available, creating one...');
            this.createOrShow();
            // Try again after a short delay
            setTimeout(() => {
                if (this._panel) {
                    this._panel.webview.postMessage({ command: 'update', data });
                }
            }, 100);
        }
    }

    public playTune(): void {
        console.log('[StrudelPanel] playTune called');
        if (this._panel) {
            console.log('[StrudelPanel] Posting play message...');
            try {
                this._panel.webview.postMessage({ command: 'play' });
                console.log('[StrudelPanel] Play message posted');
            } catch (e) {
                console.error('[StrudelPanel] postMessage failed:', e);
            }
        } else {
            console.warn('[StrudelPanel] No panel available for playTune');
        }
    }

    public stopTune(): void {
        console.log('[StrudelPanel] stopTune called');
        if (this._panel) {
            try {
                this._panel.webview.postMessage({ command: 'stop' });
                console.log('[StrudelPanel] Stop message posted');
            } catch (e) {
                console.error('[StrudelPanel] postMessage failed:', e);
            }
        }
    }

    private getWebviewHtml(webview: vscode.Webview): string {
        const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'dist', 'strudel.js');
        const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

        const stylePathMainPath = vscode.Uri.joinPath(this._extensionUri, 'static', 'strudel.css');
        const styleUri = webview.asWebviewUri(stylePathMainPath);

        return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${styleUri}" rel="stylesheet">
    <style>
      body { padding: 20px; background: #1e1e1e; color: #fff; }
      .strudel-layout { max-width: 400px; margin: 0 auto; }
      h1 { font-size: 24px; margin-bottom: 20px; }
    </style>
  </head>
  <body>
    <main class="strudel-layout">
      <h1>🎵 Strudel</h1>
      <div class="io-toggle">
        <label class="toggle-switch">
          <input type="checkbox" id="strudel-audio-toggle" />
          <span class="slider" aria-hidden="true"></span>
        </label>
        <span class="toggle-label" id="strudel-toggle-label">Audio Engine</span>
      </div>
      <p class="status-text" id="strudel-info" style="display: none"></p>
    </main>
    <script type="module" src="${scriptUri}"></script>
  </body>
</html>`;
    }
}

export default StrudelPanel;
