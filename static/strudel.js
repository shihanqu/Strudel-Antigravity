import * as core from '@strudel/core';
import * as mini from '@strudel/mini';
import * as webaudio from '@strudel/webaudio';
import * as tonal from '@strudel/tonal';
import { registerSoundfonts } from '@strudel/soundfonts';
import { transpiler } from '@strudel/transpiler';
import { loadOrc, loadCsound } from '@strudel/csound';


const vscode = acquireVsCodeApi();
const ctx = webaudio.getAudioContext();

const domAudioToggle = /** @type {HTMLInputElement | null} */ (document.getElementById('strudel-audio-toggle'));
const domToggleLabel = document.getElementById('strudel-toggle-label');
const domInfoText = document.getElementById('strudel-info');
const toggleBaseLabel = domToggleLabel?.textContent ?? 'Audio Engine';
const ConnectionState = {
  Disconnected: 'disconnected',
  Connecting: 'connecting',
  Connected: 'connected',
  Disconnecting: 'disconnecting',
};
let connectionState = ConnectionState.Disconnected;

// Audio recording state
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let recordingDestination = null;

console.defaultLog = console.log.bind(console);
console.logs = [];

webaudio.initAudioOnFirstClick();
core.evalScope({ ...core.controls, loadOrc, loadCsound }, core, mini, webaudio, tonal);

// Add stubs to Pattern prototype to prevent errors from web-specific methods
// Note: 'csound' is now handled natively by the import above
const Pattern = core.Pattern || mini.Pattern;
if (Pattern && Pattern.prototype) {
  ['_punchcard', '_scope', '_piano', 'punchcard', 'scope', 'piano'].forEach(m => {
    if (!Pattern.prototype[m]) {
      Pattern.prototype[m] = function () { return this; };
    }
  });
}

console.log = function () {
  console.defaultLog.apply(console, arguments);
  console.logs.push(Array.from(arguments));
  vscode.postMessage({
    type: 'log',
    value: arguments[0]
  });
};

function setConnectionState(nextState) {
  connectionState = nextState;
  if (!domAudioToggle) {
    return;
  }

  const setLabel = (suffix) => {
    if (domToggleLabel) {
      domToggleLabel.textContent = toggleBaseLabel;
    }
    if (suffix) {
      domAudioToggle.setAttribute('aria-label', `${toggleBaseLabel} (${suffix})`);
    } else {
      domAudioToggle.removeAttribute('aria-label');
    }
  };

  domAudioToggle.indeterminate = false;

  switch (nextState) {
    case ConnectionState.Connecting:
      domAudioToggle.disabled = true;
      domAudioToggle.checked = true;
      domAudioToggle.indeterminate = true;
      setLabel('connecting…');
      break;
    case ConnectionState.Connected:
      domAudioToggle.disabled = false;
      domAudioToggle.checked = true;
      setLabel('on');
      break;
    case ConnectionState.Disconnecting:
      domAudioToggle.disabled = true;
      domAudioToggle.checked = false;
      domAudioToggle.indeterminate = true;
      setLabel('disconnecting…');
      break;
    default:
      domAudioToggle.disabled = false;
      domAudioToggle.checked = false;
      setLabel('off');
      break;
  }
}

setConnectionState(ConnectionState.Disconnected);

export async function prebake() {
  const ds = 'https://raw.githubusercontent.com/felixroos/dough-samples/main';

  console.log('[prebake] Registering synth sounds...');
  // Register lightweight built-ins
  try {
    webaudio.registerSynthSounds();
  } catch (e) {
    console.error('registerSynthSounds failed', e);
  }

  if (typeof webaudio.registerZZFXSounds === 'function') {
    try {
      webaudio.registerZZFXSounds();
    } catch (e) {
      console.error('registerZZFXSounds failed', e);
    }
  } else {
    console.warn('webaudio.registerZZFXSounds is not a function');
  }

  try {
    registerSoundfonts();
  } catch (e) {
    console.error('registerSoundfonts failed', e);
  }

  // Load standard sample maps (metadata only, very fast)
  console.log('[prebake] Loading sample maps...');
  await Promise.all([
    webaudio.samples(`${ds}/tidal-drum-machines.json`),
    webaudio.samples(`${ds}/piano.json`),
    webaudio.samples(`${ds}/Dirt-Samples.json`),
    webaudio.samples(`${ds}/EmuSP12.json`),
    webaudio.samples(`${ds}/vcsl.json`),
    webaudio.samples(`${ds}/mridangam.json`)
  ]).catch(e => console.error('Loading samples failed', e));

  console.log('[prebake] All standard sounds ready');
}

// Tune variable - holds the current code being evaluated (needed for offset->line conversion)
let tune = ' ';
let lineOffset = 0;
let charOffset = 0;

// Global function to handle haps from all outputs (including CSound)
globalThis.__strudel_haps__ = (hap, deadline, duration, cps, t) => {
  if (hap.context && hap.context.locations && tune) {
    const batchedHaps = [];
    hap.context.locations.forEach(loc => {
      if (typeof loc.start === 'number' && typeof loc.end === 'number') {
        const startOffset = loc.start;
        const endOffset = loc.end;

        const linesBefore = tune.substring(0, startOffset).split('\n');
        const startLineRel = linesBefore.length - 1;
        const startColRel = linesBefore[linesBefore.length - 1].length;

        const endLinesBefore = tune.substring(0, endOffset).split('\n');
        const endLineRel = endLinesBefore.length - 1;
        const endColRel = endLinesBefore[endLinesBefore.length - 1].length;

        const startLine = startLineRel + lineOffset;
        let startCol = startColRel;
        if (startLineRel === 0) startCol += charOffset;

        const endLine = endLineRel + lineOffset;
        let endCol = endColRel;
        if (endLineRel === 0) endCol += charOffset;

        batchedHaps.push({ range: [startLine, startCol, endLine, endCol], duration });
      }
    });
    if (batchedHaps.length > 0) {
      vscode.postMessage({ type: 'haps', haps: batchedHaps });
    }
  }
};

// Wrap the default output (now just passes through, as __strudel_haps__ handles haps)
const wrappedOutput = async (hap, deadline, duration, cps, t) => {
  return webaudio.webaudioOutput(hap, deadline, duration, cps, t);
};

// return: {scheduler, evaluate, start, stop, pause, setCps, setPattern}
const repl = core.repl({
  defaultOutput: wrappedOutput,
  getTime: () => ctx.currentTime,
  transpiler
});

const initSound = async () => {
  webaudio.resetLoadedSounds();
  repl.scheduler.setCps(1);
  // Increase lookahead to prevent "past scheduling" errors on heavy patterns
  repl.scheduler.lookahead = 0.2;
  await prebake();
};

async function connect() {
  try {
    if (domInfoText) {
      domInfoText.style.display = 'block';
      domInfoText.innerText = '⏳ Loading Strudel soundbanks...';
    }

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    console.log('[connect] calling initSound()');
    await initSound(); // <-- actually wait

    vscode.postMessage({
      type: 'status',
      value: 'connected',
    });

    if (domInfoText) {
      domInfoText.innerText = '✅ Audio + samples ready';
    }

    return true;
  } catch (error) {
    vscode.postMessage({
      type: 'error',
      value: error.message,
    });
  }
  return false;
}

async function disconnectAudio() {
  try {
    stop();
    if (ctx.state === 'running') {
      await ctx.suspend();
    }
    vscode.postMessage({
      type: 'status',
      value: 'disconnected',
    });
    if (domInfoText) {
      domInfoText.style.display = 'block';
      domInfoText.innerText = '🔇 Audio disconnected';
    }
    return true;
  } catch (error) {
    vscode.postMessage({
      type: 'error',
      value: error.message,
    });
  }
  return false;
}


async function play() {
  if (webaudio.getAudioContext().state !== 'running') {
    setConnectionState(ConnectionState.Connecting);
    if (!(await connect())) {
      setConnectionState(ConnectionState.Disconnected);
      return false;
    }
    setConnectionState(ConnectionState.Connected);
  }

  try {
    repl.evaluate(tune);

    domInfoText.style.display = 'none';
    showPianoRoll(true);
    vscode.postMessage({
      type: 'status',
      value: 'playing'
    });
    return true;
  } catch (error) {
    vscode.postMessage({
      type: 'error',
      value: error.message
    });
  }
}



function stop() {
  try {
    repl.stop();
    showPianoRoll(false);
    vscode.postMessage({
      type: 'status',
      value: 'stopped'
    });
    return true;
  } catch (error) {
    vscode.postMessage({
      type: 'error',
      value: error.message
    });
  }
  return false;
}

function showPianoRoll(shouldShow) {
  const domPianoroll = document.getElementById('test-canvas');
  if (domPianoroll) {
    domPianoroll.style.display = shouldShow ? 'block' : 'none';
  }
}

// Audio Recording Functions
function startRecording() {
  if (isRecording) return;

  try {
    const audioCtx = webaudio.getAudioContext();
    if (audioCtx.state !== 'running') {
      vscode.postMessage({ type: 'error', value: 'Audio must be connected to record' });
      return;
    }

    // Create a destination node to capture audio
    recordingDestination = audioCtx.createMediaStreamDestination();

    // Connect the main output to both speakers and recorder
    // We need to tap into the audio graph - connect destination to our recorder
    audioCtx.destination.connect && audioCtx.destination;

    // Alternative: create gain node as a tap point
    // For now, we'll use the simpler approach of recording from destination

    // Set up MediaRecorder
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    mediaRecorder = new MediaRecorder(recordingDestination.stream, { mimeType });
    recordedChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(recordedChunks, { type: mimeType });
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Send the audio data to the extension
      vscode.postMessage({
        type: 'recording_complete',
        data: Array.from(uint8Array),  // Convert to regular array for JSON
        mimeType: mimeType,
        extension: mimeType.includes('opus') ? 'webm' : 'webm'
      });

      isRecording = false;
      vscode.postMessage({ type: 'status', value: 'recording_stopped' });
    };

    mediaRecorder.start(100); // Collect data every 100ms
    isRecording = true;
    vscode.postMessage({ type: 'status', value: 'recording' });
    console.log('[Recording] Started');

  } catch (error) {
    vscode.postMessage({ type: 'error', value: 'Recording failed: ' + error.message });
  }
}

function stopRecording() {
  if (!isRecording || !mediaRecorder) return;

  try {
    mediaRecorder.stop();
    console.log('[Recording] Stopped');
  } catch (error) {
    vscode.postMessage({ type: 'error', value: 'Stop recording failed: ' + error.message });
  }
}

domAudioToggle?.addEventListener('change', async event => {
  const toggle = /** @type {HTMLInputElement} */ (event.target);
  const shouldConnect = toggle.checked;

  if (shouldConnect) {
    if (connectionState === ConnectionState.Connected || connectionState === ConnectionState.Connecting) {
      return;
    }

    setConnectionState(ConnectionState.Connecting);
    if (await connect()) {
      setConnectionState(ConnectionState.Connected);
      return;
    }

    setConnectionState(ConnectionState.Disconnected);
    toggle.checked = false;
    if (domInfoText) {
      domInfoText.innerText = '❌ Error connecting audio, see "Strudel" output';
    }
    return;
  }

  if (connectionState === ConnectionState.Disconnected || connectionState === ConnectionState.Disconnecting) {
    return;
  }

  setConnectionState(ConnectionState.Disconnecting);
  if (await disconnectAudio()) {
    setConnectionState(ConnectionState.Disconnected);
    return;
  }

  setConnectionState(ConnectionState.Connected);
  toggle.checked = true;
  vscode.postMessage({
    type: 'warning',
    value: 'Unable to disconnect audio. See "Strudel" output for details.',
  });
});

window.addEventListener('message', async event => {
  const message = event.data;
  switch (message.command) {
    case 'play':
      await play();
      break;
    case 'update':
      tune = message.data;
      lineOffset = message.lineOffset || 0;
      charOffset = message.charOffset || 0;
      await play();
      break;
    case 'stop':
      stop();
      break;
    case 'startRecording':
      startRecording();
      break;
    case 'stopRecording':
      stopRecording();
      break;
  }
});
