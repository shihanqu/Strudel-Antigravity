import * as vscode from 'vscode';

// Interface for any Strudel webview (panel or view)
export interface IStrudelWebview {
	onReceiveStatus: (message: string) => void;
	onReceiveWarning: (message: string) => void;
	onReceiveError: (message: string) => void;
	onReceiveLog: (message: string) => void;
	updateTune(data: string): void;
	playTune(): void;
	stopTune(): void;
}

export enum Status {
	disconnected,
	connected,
	stopped,
	playing,
}

const EXAMPLES = ['amensister', 'arpoon', 'barry_harris', 'bass_fuge', 'belldub',
	'blippy_rhodes', 'bridge_is_over', 'caverave', 'chop', 'csound_demo', 'delay',
	'dinofunk', 'echo_piano', 'festival_of_fingers3', 'festival_of_fingers',
	'flatrave', 'giant_steps', 'good_times2', 'good_times', 'holy_flute', 'hyperpop',
	'jux_un_tollerei', 'lounge_sponge', 'melting_submarine', 'orbit', 'outro_music',
	'random_bells', 'sample_demo', 'sample_drums', 'sml1', 'swimming',
	'underground_plumber', 'waa2', 'wavy_kalimba', 'zeldas_rescue'];

class Strudel {
	public strudelStatusBar: vscode.StatusBarItem;
	private strudelView: IStrudelWebview;
	private logger: vscode.OutputChannel;
	private status: Status;
	private extensionUri: vscode.Uri;

	constructor(strudelView: IStrudelWebview, extensionUri: vscode.Uri) {
		this.strudelView = strudelView;
		this.extensionUri = extensionUri;

		this.logger = vscode.window.createOutputChannel('Strudel', 'strudelLog');
		this.strudelStatusBar = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Left, 100);
		this.status = Status.disconnected;
	}

	public init() {
		this.logger.show(true);
		this.updateStatus();
		this.strudelStatusBar.show();

		this.strudelView.onReceiveStatus = message => {
			this.status = (<any>Status)[message];
			this.updateStatus();
		};

		this.strudelView.onReceiveWarning = message => {
			vscode.window.showWarningMessage(message);
		};

		this.strudelView.onReceiveError = message => {
			vscode.window.showErrorMessage(message);
		};

		this.strudelView.onReceiveLog = message => {
			this.logger.appendLine(message.replace(/^%c/, ''));
		};
	}

	play() {
		console.log('[Strudel] play() called, status:', Status[this.status]);
		if (this.status === Status.disconnected) {
			console.log('[Strudel] Status is disconnected, showing warning');
			this.showConnectionWarning();
			return;
		}
		const content = this.getCurrentFileContent() || ' ';
		console.log('[Strudel] File content length:', content.length);
		console.log('[Strudel] Calling updateTune...');
		try {
			this.strudelView.updateTune(content);
			console.log('[Strudel] updateTune succeeded');
		} catch (e) {
			console.error('[Strudel] updateTune failed:', e);
		}
		console.log('[Strudel] Calling playTune...');
		try {
			this.strudelView.playTune();
			console.log('[Strudel] playTune succeeded');
		} catch (e) {
			console.error('[Strudel] playTune failed:', e);
		}
	}

	playSelection() {
		if (this.status === Status.disconnected) {
			this.showConnectionWarning();
			return;
		}
		this.strudelView.updateTune(this.getSelection() || ' ');
		this.strudelView.playTune();
	}

	update() {
		if (this.status === Status.disconnected) {
			this.showConnectionWarning();
			return;
		}
		this.strudelView.updateTune(this.getCurrentFileContent() || ' ');
	}

	stop() {
		if (this.status === Status.disconnected) {
			this.showConnectionWarning();
		}
		this.strudelView.stopTune();
	}

	public updateStatus() {
		vscode.commands.executeCommand('setContext', 'strudel.status', Status[this.status]);

		switch (this.status) {
			case Status.disconnected:
				this.strudelStatusBar.text = `$(debug-disconnect) Audio disconnected`;
				break;
			case Status.connected:
				this.strudelStatusBar.text = `$(pass) Audio connected`;
				break;
			case Status.stopped:
				this.strudelStatusBar.text = `$(mute) Stopped`;
				break;
			case Status.playing:
				this.strudelStatusBar.text = `$(unmute) Playing ${this.getCurrentFileName() || 'unknown tune'}`;
				break;
			default:
				console.error(`Unknow status ${this.status}`);
		}
	}

	public showConnectionWarning() {
		vscode.window.showWarningMessage('Please connect audio in the Strudel panel first (explorer tab).');
	}

	public getCurrentDocument(): vscode.TextDocument | undefined {
		const activeDocument = vscode.window.activeTextEditor?.document;
		if (activeDocument?.uri.scheme === 'file') {
			return activeDocument;
		}

		const fallback = vscode.window.visibleTextEditors.find(
			vte => vte.document.uri.scheme === 'file'
		);
		return fallback?.document;
	}

	public loadExamples(): void {
		const examplesItems = EXAMPLES.map(id => {
			return {
				id: id,
				label: (id.charAt(0).toUpperCase() + id.slice(1)).replaceAll('_', ' ')
			};
		});

		vscode.window.showQuickPick(examplesItems).then(item => {
			if (!item) {
				return;
			}
			const exampleUri = vscode.Uri.joinPath(this.extensionUri, 'examples', `${item.id}.str`);
			vscode.commands.executeCommand('vscode.open', exampleUri);
		});
	}

	public getSelection(): string | undefined {
		const editor = vscode.window.activeTextEditor;
		return editor?.document.getText(editor.selection);
	}

	public getCurrentFileName(): string | undefined {
		return this.getCurrentDocument()?.fileName.split('/').pop();
	}

	public getCurrentFileContent(): string | undefined {
		return this.getCurrentDocument()?.getText();
	}
}

export default Strudel;
