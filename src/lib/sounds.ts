// Web Audio API sound utilities for notifications and calls.
// All functions are no-ops in SSR or when audio is unavailable.

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      audioCtx = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();
    }
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return audioCtx;
  } catch {
    return null;
  }
}

/** Call once on a user interaction to unlock the AudioContext early. */
export function unlockAudio(): void {
  getCtx();
}

/** Short chime — plays when a new message arrives. */
export function playPing(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // ignore
  }
}

let ringtoneTimer: ReturnType<typeof setInterval> | null = null;

function playRingCycle(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    // Classic dual-tone ring: two short bursts
    [[now, 0.4], [now + 0.5, 0.4]].forEach(([start, dur]) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.frequency.value = 480;
      osc2.frequency.value = 440;
      gain.gain.setValueAtTime(0.18, start as number);
      gain.gain.exponentialRampToValueAtTime(0.001, (start as number) + (dur as number));

      osc1.start(start as number);
      osc1.stop((start as number) + (dur as number));
      osc2.start(start as number);
      osc2.stop((start as number) + (dur as number));
    });
  } catch {
    // ignore
  }
}

/** Start looping ringtone (for incoming calls). Safe to call multiple times. */
export function startRingtone(): void {
  if (ringtoneTimer !== null) return;
  playRingCycle();
  ringtoneTimer = setInterval(playRingCycle, 3000);
}

/** Stop the ringtone started by startRingtone(). */
export function stopRingtone(): void {
  if (ringtoneTimer !== null) {
    clearInterval(ringtoneTimer);
    ringtoneTimer = null;
  }
}
