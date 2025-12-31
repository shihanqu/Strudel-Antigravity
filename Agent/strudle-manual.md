# Strudel Notation Study Guide

This document summarizes the core syntax and concepts of Strudel (a Javascript port of TidalCycles) for use by AI agents and live coders.

## 1. Core Concept: Cycles & Time
Strudel is time-based and cyclic. Everything happens within "cycles".
- `setcps(n)`: Sets the global Cycles Per Second. Example: `setcps(0.5)` is 0.5 cycles per second (120 BPM if 1 cycle = 1 bar of 4/4).

## 2. Basic Pattern Generation
Patterns are the building blocks. They generate streams of events ("haps").

### The `s()` or `sound()` function
Trigger samples by name or synthesis engines.
```javascript
// Play a bass drum, then snare, then hi-hat, then snare in one cycle
s("bd sd hh sd")
```

### The `note()` function
Trigger melodic notes. Can serve as input to `s()` if using a synth or multisample instrument.
- Supports Note Names: `note("c3 a#3 db4")`
- Supports MIDI Numbers: `note("60 62 64")`
- Supports Frequencies: `freq("220 440")`
```javascript
// Play notes C, E, G, B using a piano sound
note("c e g b").s("piano")
```

## 3. Mini-Notation (The String Language)
The string inside `s("...")` or `note("...")` uses a special "mini-notation" to define rhythm and structure.

| Symbol | Name | Description | Example | Effect |
| :--- | :--- | :--- | :--- | :--- |
| `space` | Sequence | `Sequence` | `"a b"` | Plays 'a' then 'b' equally spaced in the cycle. |
| `~` | Rest | `Rest` | `"a ~ b"` | 'a', then silence, then 'b'. |
| `[]` | Group | `Subdivision` | `"a [b c]"` | 'a' takes half cycle; 'b' and 'c' share the other half (quarter each). |
| `*` | Speed | `Multiplication` | `"a*2"` | Plays 'a' twice in the duration of one 'a'. |
| `/` | Slow | `Division` | `"a/2"` | Plays 'a' half as fast (takes 2 cycles). |
| `!` | Repeat | `Replication` | `"a!3"` | Same as `"a a a"`. |
| `@` | Weight | `Elongation` | `"a@2 b"` | 'a' is twice as long as 'b' (2/3 vs 1/3 of total). |
| `< >` | Cycle | `Alternation` | `"a <b c>"` | Cycle 1: 'a b'. Cycle 2: 'a c'. |
| `,` | Poly | `Polyphony` | `"[a b, c d e]"` | Plays 'a b' sequence AND 'c d e' sequence simultaneously. |
| `?` | Prob | `Degrade` | `"a?"` | Randomly drops 'a' (50% chance). `"a?0.1"` for 10% drop chance. |
| `|` | Choice | `Random Choice`| `"[a|b|c]"` | Pick one of a, b, or c at random per event. |

### Random Generation
Instead of a `.rand()` method, use pattern generators:
- `irand(n)`: Generates random integers from 0 to n-1. Example: `note(irand(12))`
- `rand`: Generates random floats between 0 and 1. Example: `s("bd").gain(rand)`

### Common Rhythms
```javascript
// Euclidean Rhythm: Play 3 events distributed over 8 steps
s("bd(3,8)") 

// Polymeter: Different sequence lengths shifting against each other
s("{bd sd, hh hh hh}")

// Chords (in note strings)
note("[c, e, g]") // Play C, E, G simultaneously
```

## 4. Tonal & Melodic Tools
Strudel has powerful theory tools.

### Chords and Scales
```javascript
// Play chords
chord("Cm7 F7 BbM7")

// Voicing (spreads notes for better voice leading)
chord("Cm7 F7 BbM7").voicing()

// Scales
note("0 2 4 6").scale("C:minor") // Maps indices to C minor scale

// Arpeggiator
note("c3m7").arp("updown")
```

## 5. Synthesis & Sampling

### Built-in Synths
Default is `triangle`. Change with `.s()`.
- Waveforms: `triangle`, `sawtooth`, `square`, `sine`
- Advanced: `supersaw` (rich, detuned saws), `sub`, `hoover`
- Noise: `white`, `pink`, `brown`, `crackle`
- Wavetable: `s("wt_flute")` (prepend `wt_` to sample name)

### Sampling
Strudel has a massive sample library.
- **Banks**: Access specific drum machines.
  ```javascript
  s("bd sd").bank("RolandTR909")
  ```
- **Slicing**:
  ```javascript
  s("breaks").chop(8) // Chop sample into 8 parts
  s("breaks").slice(8, "0 1 2 3") // Play specific slices
  ```
- **Manipulation**:
  - `.speed(n)`: Playback speed (2=double, -1=reverse).
  - `.begin(0).end(0.5)`: Play only first half.
  - `.loopAt(2)`: Stretch sample to fit exactly 2 cycles.

## 6. Effects & Oscillators
Chain methods to transform the sound. Parameters accept patterns/oscillators.

### Oscillators (LFOs)
- `sine`, `triangle`, `saw`, `square` (e.g., `sine.slow(4)`)
- `perlin` (random smooth noise)

### Audio Effects
- **Dynamics**: `.gain(n)`, `.compressor()`, `.amp(n)`
- **Filters**: 
  - `.lpf(freq)` (Low pass), `.hpf(freq)` (High pass), `.bpf(freq)` (Band pass)
  - `.lpq(n)` (Resonance)
  - `.vowel("a e i o u")`
- **Time/Space**:
  - `.delay(time)`. Params: `.delaytime(t)`, `.delayfeedback(f)`
  - `.room(amount)`. Params: `.roomsize(n)`
- **Spectral/Color**:
  - `.crush(n)` (Bitcrush), `.shape(n)` (Distortion), `.phaser(n)`

### Pattern Transformations
- `.fast(n)` / `.slow(n)`: Change speed.
- `.every(n, function)`: Apply function every n cycles.
- `.sometimes(function)`: Apply function randomly (50%).
- `.jux(function)`: Juxtapose (Original in Left, Transformed in Right).
- `.mask(pattern)`: Enable/disable pattern based on a binary pattern.

### Conditional Playback with `.mask()`
Use `.mask()` to control when a pattern plays. There is **no global `cycle` variable** in Strudel.
```javascript
// Play only during cycles 9-16 (silent for first 8, active for next 8, silent again)
note("c3 e3 g3").s("sine").mask("<0!8 1!8 0!8>")

// Alternate: play every other cycle
s("bd sd").mask("<1 0>")
```

```javascript
// Example: LFO on filter cutoff
s("sawtooth").lpf(sine.range(500, 2000).slow(4))

// Example: Randomly speed up events
s("bd sd").sometimes(x => x.fast(2))
```

## 7. Structure & Orbits
- **Stacking**: Use `stack()` or `$` to play multiple patterns.
- **Orbits**: Separate audio chains. By default, everything shares Orbit 0 (and its reverb/delay). Use `.orbit(1)` to give a track its own effects chain.

```javascript
stack(
  s("bd(3,8)").orbit(0),             // Main drums
  s("hh*8").orbit(1).delay(0.5)      // Hi-hats with own delay
)
```

## 8. Useful Snippets

**House Beat**
```javascript
stack(
  s("bd!4"),
  s("~ hh ~ hh"),
  s("~ sd ~ sd")
).setcps(120/60/4)
```

**Generative Melody**
```javascript
note(irand(8))        // Random integers 0-7
  .scale("C:minor")   // Map to scale
  .s("triangle")
  .delay(0.5)
```

**Breakbeat Chopping**
```javascript
s("breaks")
  .loopAt(1)          // Fit to 1 cycle
  .chop(8)            // Cut into 8 pieces
  .scramble()         // Shuffle the pieces
```
