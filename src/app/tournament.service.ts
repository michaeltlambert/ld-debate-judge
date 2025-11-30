import { Injectable, signal, effect } from '@angular/core';

export interface RoundRecord {
  id: string;
  timestamp: number;
  affScore: number;
  negScore: number;
  decision: 'Aff' | 'Neg' | 'Tie';
  rfd: string;
  // Now storing the actual JSON strings for full restoration
  flowArgs: string; 
  flowFrameworks: string;
}

@Injectable({ providedIn: 'root' })
export class TournamentService {
  // State
  history = signal<RoundRecord[]>([]);
  roundCounter = signal<number>(1);
  
  // Signal to notify components to restore a specific round
  restoreRequest = signal<RoundRecord | null>(null);

  constructor() {
    this.loadHistory();
    effect(() => {
      localStorage.setItem('ld-tournament-history', JSON.stringify(this.history()));
    });
  }

  private loadHistory() {
    const data = localStorage.getItem('ld-tournament-history');
    if (data) {
      try {
        this.history.set(JSON.parse(data));
        this.roundCounter.set(this.history().length + 1);
      } catch (e) {
        console.error('Failed to load tournament history', e);
      }
    }
  }

  archiveRound(record: RoundRecord) {
    this.history.update(rounds => [record, ...rounds]);
    this.startNewRound();
  }

  startNewRound() {
    this.roundCounter.update(v => v + 1);
    this.restoreRequest.set(null); // Clear any active view
  }

  // Called when user clicks a history item
  loadRound(round: RoundRecord) {
    if(confirm(`Load Round #${this.getRoundNumber(round)}? This will overwrite your current notes.`)) {
      this.restoreRequest.set(round);
    }
  }

  deleteRound(id: string) {
    if(confirm('Delete this round record permanently?')) {
      this.history.update(rounds => rounds.filter(r => r.id !== id));
    }
  }

  clearHistory() {
    if(confirm('Start a completely new tournament? This deletes all history.')) {
      this.history.set([]);
      this.roundCounter.set(1);
      this.restoreRequest.set(null);
    }
  }

  // Helper to calculate "Round 1", "Round 2" based on history index
  getRoundNumber(round: RoundRecord) {
    const index = this.history().indexOf(round);
    return this.history().length - index;
  }
}