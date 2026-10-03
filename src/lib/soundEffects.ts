/**
 * High-definition Web Audio API sound synthesizers for Restaurant OS.
 * Zero external dependencies, zero latency, 100% offline & browser compatible.
 */

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

/**
 * Customer Order Confirmed Chime
 * An uplifting, warm 3-note harmonic arpeggio (C5 -> E5 -> G5 -> C6)
 * with soft marimba / celesta acoustics for customer delight.
 */
export function playCustomerOrderConfirmedSound() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    // Chime notes: C5 (523.25Hz), E5 (659.25Hz), G5 (783.99Hz), C6 (1046.5Hz)
    const notes = [
      { freq: 523.25, time: 0.0, duration: 0.6 },
      { freq: 659.25, time: 0.12, duration: 0.6 },
      { freq: 783.99, time: 0.24, duration: 0.7 },
      { freq: 1046.5, time: 0.36, duration: 1.1 },
    ]

    notes.forEach(({ freq, time, duration }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const filter = ctx.createBiquadFilter()

      // Soft warm sine/triangle blend
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + time)

      // Warm low-pass filter
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(2400, now + time)

      // Envelope: instant soft attack, gentle exponential decay
      const startTime = now + time
      gain.gain.setValueAtTime(0.001, startTime)
      gain.gain.linearRampToValueAtTime(0.22, startTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      osc.start(startTime)
      osc.stop(startTime + duration + 0.05)
    })
  } catch (err) {
    console.warn('Audio playback not permitted or not supported yet:', err)
  }
}

/**
 * Admin New Order Alert Bell
 * Resonant, crisp commercial service bell / POS chime ("Ding-Ding!")
 * Designed to cut through restaurant ambient noise and alert the kitchen/manager.
 */
export function playAdminNewOrderSound() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime

    // Double strike service bell: Strike 1 at 0s, Strike 2 at 0.16s
    const strikes = [
      { baseFreq: 1174.66, time: 0.0, duration: 0.75, vol: 0.35 }, // D6
      { baseFreq: 1567.98, time: 0.16, duration: 1.1, vol: 0.40 },  // G6
    ]

    strikes.forEach(({ baseFreq, time, duration, vol }) => {
      const startTime = now + time

      // Primary tone
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(baseFreq, startTime)

      gain1.gain.setValueAtTime(0.001, startTime)
      gain1.gain.linearRampToValueAtTime(vol, startTime + 0.008)
      gain1.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(startTime)
      osc1.stop(startTime + duration + 0.05)

      // Metallic overtone (characteristic of a counter service bell)
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'triangle'
      osc2.frequency.setValueAtTime(baseFreq * 2.76, startTime) // inharmonic metal resonance

      gain2.gain.setValueAtTime(0.001, startTime)
      gain2.gain.linearRampToValueAtTime(vol * 0.25, startTime + 0.005)
      gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.35)

      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(startTime)
      osc2.stop(startTime + 0.4)
    })
  } catch (err) {
    console.warn('Admin audio alert could not play:', err)
  }
}
