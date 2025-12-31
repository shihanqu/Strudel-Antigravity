import * as vscode from 'vscode';

export type OnEvent = ((message: string) => void);

class StrudelView implements vscode.WebviewViewProvider {

	public static readonly viewType = 'strudel.strudelView';

	public onReceiveStatus: OnEvent;
	public onReceiveWarning: OnEvent;
	public onReceiveError: OnEvent;
	public onReceiveLog: OnEvent;

	private _view?: vscode.WebviewView;

	constructor(private readonly _extensionUri: vscode.Uri) {
		this.onReceiveStatus = () => { throw new Error('Not implemented'); };
		this.onReceiveWarning = () => { throw new Error('Not implemented'); };
		this.onReceiveError = () => { throw new Error('Not implemented'); };
		this.onReceiveLog = () => { throw new Error('Not implemented'); };
	}

	public resolveWebviewView(webviewView: vscode.WebviewView): void {
		console.log('[StrudelView] resolveWebviewView called!');
		this._view = webviewView;

		console.log('[StrudelView] Setting webview options...');
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri],
		};

		console.log('[StrudelView] Setting webview HTML...');
		webviewView.webview.html = this.getWebviewHtml(webviewView.webview);
		console.log('[StrudelView] Webview HTML set');

		console.log('[StrudelView] Setting up message listener...');
		webviewView.webview.onDidReceiveMessage(msg => {
			console.log('[StrudelView] Received message from webview:', msg.type);
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
					console.error('[StrudelView] Unknown message type:', msg.type);
					throw new Error(`Received unknown message type: ${msg.type}`);
			}
		});
		console.log('[StrudelView] resolveWebviewView completed');
	}

	public updateTune(data: string): void {
		console.log('[StrudelView] updateTune called, data length:', data.length);
		console.log('[StrudelView] _view exists:', !!this._view);
		if (this._view) {
			console.log('[StrudelView] Posting update message to webview...');
			try {
				this._view.webview.postMessage({ command: 'update', data });
				console.log('[StrudelView] Update message posted successfully');
			} catch (e) {
				console.error('[StrudelView] postMessage failed:', e);
			}
		} else {
			console.warn('[StrudelView] No view available for updateTune');
		}
	}

	public playTune(): void {
		console.log('[StrudelView] playTune called');
		console.log('[StrudelView] _view exists:', !!this._view);
		if (this._view) {
			console.log('[StrudelView] Showing view...');
			try {
				this._view.show();
				console.log('[StrudelView] View shown');
			} catch (e) {
				console.error('[StrudelView] show() failed:', e);
			}
			console.log('[StrudelView] Posting play message to webview...');
			try {
				this._view.webview.postMessage({ command: 'play' });
				console.log('[StrudelView] Play message posted successfully');
			} catch (e) {
				console.error('[StrudelView] postMessage failed:', e);
			}
		} else {
			console.warn('[StrudelView] No view available for playTune');
		}
	}

	public stopTune(): void {
		console.log('[StrudelView] stopTune called');
		if (this._view) {
			try {
				this._view.webview.postMessage({ command: 'stop' });
				console.log('[StrudelView] Stop message posted successfully');
			} catch (e) {
				console.error('[StrudelView] postMessage failed:', e);
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
		<link href="${styleUri}" rel="stylesheet">
	</head>
	<body>
		<main class="strudel-layout">
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
</html>
		`;
	}
}

export default StrudelView;
