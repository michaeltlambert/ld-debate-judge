import { Component, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PdfService } from './pdf.service';
import { TermComponent } from './term.component';
import { TournamentService, RoundResult } from './tournament.service';

@Component({
  selector: 'app-ballot',
  standalone: true,
  imports: [CommonModule, TermComponent, FormsModule],
  template: `
    <div id="debate-ballot" class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <!-- Condensed ballot logic for brevity -->
      <div *ngIf="!isDebater()">
          <div class="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
            <h2 class="font-bold text-slate-800 text-xl">Ballot</h2>
            <span *ngIf="isLocked()" class="text-red-600 font-bold uppercase text-xs">Locked</span>
          </div>
          <div class="flex justify-end mb-2">
              <button (click)="toggleHints()" class="text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all" title="Show/Hide guidelines">
                  {{ showHints() ? 'Hide Guidelines' : 'Show Guidelines' }}
              </button>
          </div>
          
          <div *ngIf="showHints()" class="mb-6 grid grid-cols-1 md:grid-cols-2 gap-2 transition-all">
             <div class="bg-indigo-50 border border-indigo-100 p-2 rounded text-[10px] text-indigo-900"><strong>Framework:</strong> Value & Criterion</div>
             <div class="bg-amber-50 border border-amber-100 p-2 rounded text-[10px] text-amber-900"><strong>Tabula Rasa:</strong> No bias</div>
          </div>

          <div class="grid grid-cols-2 gap-6 mb-6">
             <input type="number" [(ngModel)]="affPoints" [disabled]="isLocked()" class="border p-2 rounded text-center font-bold text-xl">
             <input type="number" [(ngModel)]="negPoints" [disabled]="isLocked()" class="border p-2 rounded text-center font-bold text-xl">
          </div>
          <div class="flex gap-4 mb-6">
             <button (click)="!isLocked() && decision.set('Aff')" [class]="decision() === 'Aff' ? 'bg-blue-600 text-white' : 'bg-slate-100'" class="flex-1 py-3 rounded font-bold">Affirmative</button>
             <button (click)="!isLocked() && decision.set('Neg')" [class]="decision() === 'Neg' ? 'bg-red-600 text-white' : 'bg-slate-100'" class="flex-1 py-3 rounded font-bold">Negative</button>
          </div>
          <textarea [(ngModel)]="rfdText" [disabled]="isLocked()" class="w-full h-32 border rounded p-2 text-sm" placeholder="Reason for Decision"></textarea>
          <button *ngIf="!isLocked()" (click)="submitRound()" class="w-full mt-4 bg-slate-900 text-white font-bold py-3 rounded hover:bg-slate-800" title="Submit Ballot">Submit Ballot</button>
      </div>
      <div *ngIf="isDebater()" class="text-center text-slate-400 italic py-8">
          Submitting ballots is restricted to Judges. Use the dashboard to view feedback.
      </div>
    </div>
  `
})
export class BallotComponent {
  pdfService = inject(PdfService);
  tournament = inject(TournamentService);
  affPoints = signal(28);
  negPoints = signal(28);
  decision = signal<'Aff' | 'Neg' | null>(null);
  rfdText = ''; 
  isUpdate = false;
  
  // Re-added missing signal
  showHints = signal(true);

  constructor() {
    effect(() => {
      const debateId = this.tournament.activeDebateId();
      const userId = this.tournament.userProfile()?.id;
      if (debateId && userId) {
          const existing = this.tournament.results().find(r => r.debateId === debateId && r.judgeId === userId);
          if (existing) {
              this.isUpdate = true;
              this.affPoints.set(existing.affScore);
              this.negPoints.set(existing.negScore);
              this.decision.set(existing.decision);
              this.rfdText = existing.rfd;
          } else {
              this.resetBallot();
          }
      }
    }, { allowSignalWrites: true });
  }

  isDebater() { return this.tournament.userRole() === 'Debater'; }
  isLocked() { 
      const d = this.tournament.debates().find(x => x.id === this.tournament.activeDebateId());
      return d?.status === 'Closed';
  }

  resetBallot() {
    this.isUpdate = false;
    this.affPoints.set(28);
    this.negPoints.set(28);
    this.decision.set(null);
    this.rfdText = '';
  }

  toggleHints() { this.showHints.update(v => !v); }

  submitRound() {
    if (this.isLocked()) return;
    if (!this.decision()) return;
    const debateId = this.tournament.activeDebateId();
    if (!debateId) return;

    this.tournament.submitBallot(this.tournament.activeDebateId()!, {
      affScore: this.affPoints(), negScore: this.negPoints(), decision: this.decision()!, rfd: this.rfdText, timestamp: Date.now()
    }).then(() => {
      alert(this.isUpdate ? "Ballot Updated!" : "Ballot Submitted!");
      this.isUpdate = true;
    }).catch(e => alert(e.message));
  }
  
  // Helper methods for template actions
  checkInput(event: Event, side: 'aff' | 'neg') {
    const input = event.target as HTMLInputElement;
    let val = parseFloat(input.value);
    if (val > 30) { input.value = '30'; val = 30; } else if (val < 0) { input.value = '0'; val = 0; }
    if (side === 'aff') this.setAff(val); else this.setNeg(val);
  }
  setAff(val: number) { this.affPoints.set(val); this.autoCalculateWinner(); }
  setNeg(val: number) { this.negPoints.set(val); this.autoCalculateWinner(); }
  autoCalculateWinner() {
    if (this.affPoints() > this.negPoints()) this.decision.set('Aff');
    else if (this.negPoints() > this.affPoints()) this.decision.set('Neg');
    else this.decision.set(null);
  }
  manualOverride(winner: 'Aff' | 'Neg') { this.decision.set(winner); }
  exportToPdf() { this.pdfService.generateBallotPdf('debate-flow', 'debate-ballot'); }
}