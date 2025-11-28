import { Injectable, signal } from '@angular/core';

export interface Phase {
  id: string;   // Short code (e.g., "1AC")
  name: string; // Full display name
  time: number; // Duration in seconds
  hint: string; // Helper text for the judge
}

/**
 * Defines the 3 mutually exclusive states of the clock.
 * 'IDLE' means nothing is running.
 */
export type TimerType = 'SPEECH' | 'AFF_PREP' | 'NEG_PREP' | 'IDLE';

@Injectable({ providedIn: 'root' })
export class DebateService {
  // CONSTANTS
  readonly PREP_ALLOWANCE = 240; // 4 Minutes standard prep time
  
  // DATA: The structure of an LD Round
  readonly phases: Phase[] = [
    { id: '1AC', name: 'Affirmative Constructive', time: 360, hint: 'Aff presents Value, Criterion, and Contentions.' },
    { id: 'CX1', name: 'Cross-Ex (Neg Questions)', time: 180, hint: 'Neg clarifies arguments. No new arguments.' },
    { id: '1NC', name: 'Negative Constructive', time: 420, hint: 'Neg presents case and attacks Aff.' },
    { id: 'CX2', name: 'Cross-Ex (Aff Questions)', time: 180, hint: 'Aff questions Neg. Look for contradictions.' },
    { id: '1AR', name: '1st Aff Rebuttal', time: 240, hint: 'Aff must answer ALL Neg attacks here.' },
    { id: '2NR', name: 'Negative Rebuttal', time: 360, hint: 'Neg closing speech. Crystallize voting issues.' },
    { id: '2AR', name: '2nd Aff Rebuttal', time: 180, hint: 'Aff closing speech. Explain why Aff wins.' },
  ];

  // STATE: We use Signals for granular reactivity.
  // When these values change, only the specific parts of the UI listening to them update.
  currentPhase = signal<Phase>(this.phases[0]);
  
  // We maintain 3 separate banks of time.
  speechTimer = signal<number>(360);
  affPrep = signal<number>(this.PREP_ALLOWANCE);
  negPrep = signal<number>(this.PREP_ALLOWANCE);

  // This tracks WHICH of the 3 clocks is currently ticking down.
  activeTimer = signal<TimerType>('IDLE');

  private intervalId: any;

  constructor() {
    // We run a single interval every second. 
    // The tick() method decides which signal to decrement.
    this.intervalId = setInterval(() => {
      this.tick();
    }, 1000);
  }

  /**
   * The "Game Loop". Runs every 1 second.
   * Checks activeTimer state and updates the corresponding Signal.
   */
  private tick() {
    const type = this.activeTimer();

    if (type === 'SPEECH') {
      if (this.speechTimer() > 0) this.speechTimer.update(t => t - 1);
      else this.stop(); // Auto-stop when time hits 0
    } 
    else if (type === 'AFF_PREP') {
      if (this.affPrep() > 0) this.affPrep.update(t => t - 1);
      else this.stop();
    } 
    else if (type === 'NEG_PREP') {
      if (this.negPrep() > 0) this.negPrep.update(t => t - 1);
      else this.stop();
    }
  }

  // --- ACTIONS ---

  toggleSpeech() {
    // If running, stop. If stopped, set to SPEECH mode.
    this.activeTimer() === 'SPEECH' ? this.stop() : this.activeTimer.set('SPEECH');
  }

  toggleAffPrep() {
    this.activeTimer() === 'AFF_PREP' ? this.stop() : this.activeTimer.set('AFF_PREP');
  }

  toggleNegPrep() {
    this.activeTimer() === 'NEG_PREP' ? this.stop() : this.activeTimer.set('NEG_PREP');
  }

  stop() {
    this.activeTimer.set('IDLE');
  }

  /**
   * Switching phases resets the MAIN speech timer, but preserves Prep Time banks.
   */
  setPhase(phase: Phase) {
    this.stop();
    this.currentPhase.set(phase);
    this.speechTimer.set(phase.time);
  }

  /**
   * Utility: Converts 360 -> "6:00"
   */
  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }
}