import { Injectable, signal, computed } from '@angular/core';

export interface Phase {
  id: string;
  name: string;
  time: number;
  hint: string;
}

// Define which timer is currently ticking
export type TimerType = 'SPEECH' | 'AFF_PREP' | 'NEG_PREP' | 'IDLE';

@Injectable({ providedIn: 'root' })
export class DebateService {
  // Constants
  readonly PREP_ALLOWANCE = 240; // 4 Minutes standard LD prep
  
  readonly phases: Phase[] = [
    { id: '1AC', name: 'Aff Constructive', time: 360, hint: 'Aff presents Value, Criterion, and Contentions.' },
    { id: 'CX1', name: 'Cross-Ex (Neg asks)', time: 180, hint: 'Neg clarifies arguments. No new arguments.' },
    { id: '1NC', name: 'Neg Constructive', time: 420, hint: 'Neg presents case and attacks Aff.' },
    { id: 'CX2', name: 'Cross-Ex (Aff asks)', time: 180, hint: 'Aff questions Neg. Look for contradictions.' },
    { id: '1AR', name: '1st Aff Rebuttal', time: 240, hint: 'Aff must answer ALL Neg attacks here.' },
    { id: '2NR', name: 'Neg Rebuttal', time: 360, hint: 'Neg closing speech. Crystallize voting issues.' },
    { id: '2AR', name: '2nd Aff Rebuttal', time: 180, hint: 'Aff closing speech. Explain why Aff wins.' },
  ];

  // State Signals
  currentPhase = signal<Phase>(this.phases[0]);
  
  // Three separate time banks
  speechTimer = signal<number>(360);
  affPrep = signal<number>(this.PREP_ALLOWANCE);
  negPrep = signal<number>(this.PREP_ALLOWANCE);

  // Tracks which timer is active
  activeTimer = signal<TimerType>('IDLE');

  private intervalId: any;

  constructor() {
    // The central heartbeat of the app
    this.intervalId = setInterval(() => {
      this.tick();
    }, 1000);
  }

  private tick() {
    const type = this.activeTimer();

    if (type === 'SPEECH') {
      if (this.speechTimer() > 0) this.speechTimer.update(t => t - 1);
      else this.stop();
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

  // --- Actions ---

  toggleSpeech() {
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

  setPhase(phase: Phase) {
    this.stop();
    this.currentPhase.set(phase);
    this.speechTimer.set(phase.time);
  }

  // Helper for formatting mm:ss
  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }
}