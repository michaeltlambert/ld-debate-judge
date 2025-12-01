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
      
      <!-- If Debater, show only feedback list -->
      <div *ngIf="isDebater()" class="text-center">
         <h3 class="font-bold text-slate-700 mb-4">Judge Feedback</h3>
         <p class="text-slate-400 text-xs italic" *ngIf="getFeedback().length === 0">No ballots submitted for this round yet.</p>
         <div *ngFor="let res of getFeedback()" class="bg-slate-50 p-3 rounded border border-slate-200 mb-2 text-left">
            <div class="flex justify-between text-xs font-bold mb-1">
                <span class="text-slate-700">{{ res.judgeName }}</span>
                <span [class.text-blue-600]="res.decision === 'Aff'" [class.text-red-600]="res.decision === 'Neg'">Voted: {{ res.decision }}</span>
            </div>
            <div class="text-[10px] text-slate-500 mb-2">Points: {{ res.affScore }} vs {{ res.negScore }}</div>
            <p class="text-sm text-slate-600 italic">"{{ res.rfd }}"</p>
         </div>
      </div>

      <!-- If Judge, show scoring form -->
      <div *ngIf="!isDebater()">
          <div class="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
            <div class="flex flex-col">
              <h2 class="font-bold text-slate-800 text-xl tracking-tight">Official Ballot</h2>
              <span class="text-xs text-slate-500 font-mono" *ngIf="!isLocked()">Secure Submission</span>
              <span class="text-xs text-red-600 font-bold uppercase bg-red-50 px-2 py-1 rounded" *ngIf="isLocked()">Round Locked</span>
            </div>
            <button (click)="toggleHints()" class="text-xs font-semibold px-3 py-1.5 rounded-full transition-all" [ngClass]="showHints() ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'" aria-label="Toggle Judge Guidelines">{{ showHints() ? 'Hide Guidelines' : 'Show Guidelines' }}</button>
          </div>
          
          <div *ngIf="showHints()" class="mb-8 grid grid-cols-1 md:grid-cols-2 gap-3 transition-all">
             <div class="bg-indigo-50 border border-indigo-100 p-3 rounded text-xs text-indigo-900"><strong>1. Framework:</strong> Weigh <app-term lookup="Value Premise">Value</app-term> & <app-term lookup="Value Criterion">Criterion</app-term>.</div>
             <div class="bg-amber-50 border border-amber-100 p-3 rounded text-xs text-amber-900"><strong>2. Tabula Rasa:</strong> Judge only what is said. No bias.</div>
             <div class="bg-rose-50 border border-rose-100 p-3 rounded text-xs text-rose-900"><strong>3. Drops:</strong> <app-term lookup="Dropped">Dropped</app-term> args are true.</div>
             <div class="bg-emerald-50 border border-emerald-100 p-3 rounded text-xs text-emerald-900"><strong>4. Voters:</strong> Focus on final <app-term lookup="Voters">Voting Issues</app-term>.</div>
          </div>
          
          <div class="space-y-6">
            <div class="grid grid-cols-2 gap-6 relative">
              <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border border-slate-200 text-slate-400 font-bold text-xs px-2 py-1 rounded-full z-10 shadow-sm">VS</div>
              <div class="bg-slate-50 p-4 rounded-lg border transition-colors" [class.border-blue-500]="affPoints() > negPoints()" [class.border-slate-100]="affPoints() <= negPoints()">
                <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Affirmative Points</label>
                <div class="flex items-center gap-2"><input type="number" min="0" max="30" [ngModel]="affPoints()" (ngModelChange)="setAff($event)" (input)="checkInput($event, 'aff')" [disabled]="isLocked()" class="w-full text-center text-xl font-mono font-bold border border-slate-300 rounded p-2 focus:ring-2 focus:ring-blue-500 shadow-sm disabled:bg-slate-100" aria-label="Affirmative Points"><span class="text-xs text-slate-400 font-medium">/ 30</span></div>
                <div *ngIf="affPoints() > negPoints()" class="text-[10px] text-center text-blue-600 font-bold uppercase mt-2 tracking-wider">High Point Winner</div>
              </div>
              <div class="bg-slate-50 p-4 rounded-lg border transition-colors" [class.border-red-500]="negPoints() > affPoints()" [class.border-slate-100]="negPoints() <= affPoints()">
                <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Negative Points</label>
                 <div class="flex items-center gap-2"><input type="number" min="0" max="30" [ngModel]="negPoints()" (ngModelChange)="setNeg($event)" (input)="checkInput($event, 'neg')" [disabled]="isLocked()" class="w-full text-center text-xl font-mono font-bold border border-slate-300 rounded p-2 focus:ring-2 focus:ring-red-500 shadow-sm disabled:bg-slate-100" aria-label="Negative Points"><span class="text-xs text-slate-400 font-medium">/ 30</span></div>
                 <div *ngIf="negPoints() > affPoints()" class="text-[10px] text-center text-red-600 font-bold uppercase mt-2 tracking-wider">High Point Winner</div>
              </div>
            </div>
            
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Decision</label>
              <div class="flex gap-3">
                <button (click)="!isLocked() && manualOverride('Aff')" [class]="decision() === 'Aff' ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-200' : 'bg-white text-slate-400 border-slate-200 opacity-50 hover:opacity-100'" [class.opacity-50]="isLocked()" class="flex-1 py-4 border-2 rounded-xl font-bold text-lg transition-all flex flex-col items-center justify-center gap-1 relative overflow-hidden" aria-label="Vote for Affirmative"><span>Affirmative</span></button>
                <button (click)="!isLocked() && manualOverride('Neg')" [class]="decision() === 'Neg' ? 'bg-red-600 text-white border-red-600 ring-2 ring-red-200' : 'bg-white text-slate-400 border-slate-200 opacity-50 hover:opacity-100'" [class.opacity-50]="isLocked()" class="flex-1 py-4 border-2 rounded-xl font-bold text-lg transition-all flex flex-col items-center justify-center gap-1 relative overflow-hidden" aria-label="Vote for Negative"><span>Negative</span></button>
              </div>
            </div>
            
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Reason for Decision (RFD)</label>
              <textarea [(ngModel)]="rfdText" [disabled]="isLocked()" class="w-full h-32 border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 shadow-sm resize-none disabled:bg-slate-100" placeholder="I voted for the {{decision() || '...'}} because..." aria-label="Reason for Decision"></textarea>
            </div>
            
            <div class="pt-4 border-t border-slate-100 flex gap-4">
              <button (click)="exportToPdf()" class="flex-1 bg-white border border-slate-300 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-50 flex items-center justify-center gap-2" aria-label="Download PDF of Ballot"><span>Download PDF</span></button>
              <button *ngIf="!isLocked()" (click)="submitRound()" [disabled]="!decision() || affPoints() === negPoints()" [class.opacity-50]="!decision() || affPoints() === negPoints()" class="flex-[2] bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 flex items-center justify-center gap-3 shadow-lg transition-all" aria-label="Submit Ballot"><span>{{ isUpdate ? 'Update Ballot' : 'Submit Ballot' }}</span></button>
            </div>
            <p *ngIf="isLocked()" class="text-center text-xs text-slate-400 italic mt-2">Voting is closed for this round.</p>
          </div>
      </div>
    </div>
  `
})
export class BallotComponent {
  pdfService = inject(PdfService);
  tournament = inject(TournamentService);
  showHints = signal(true);
  affPoints = signal(28);
  negPoints = signal(28);
  decision = signal<'Aff' | 'Neg' | null>(null);
  rfdText = ''; 
  isUpdate = false;

  constructor() {
    effect(() => {
      const debateId = this.tournament.activeDebateId();
      const userId = this.tournament.userProfile()?.id;
      
      // Load existing ballot if found
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

  getFeedback() {
    const debateId = this.tournament.activeDebateId();
    return this.tournament.results().filter(r => r.debateId === debateId);
  }

  resetBallot() {
    this.isUpdate = false;
    this.affPoints.set(28);
    this.negPoints.set(28);
    this.decision.set(null);
    this.rfdText = '';
  }

  submitRound() {
    if (this.isLocked()) return;
    if (!this.decision()) return;
    const debateId = this.tournament.activeDebateId();
    if (!debateId) return;

    this.tournament.submitBallot(debateId, {
      affScore: this.affPoints(), negScore: this.negPoints(), decision: this.decision()!, rfd: this.rfdText
    }).then(() => {
      alert(this.isUpdate ? "Ballot Updated!" : "Ballot Submitted!");
      this.isUpdate = true;
    }).catch(e => alert(e.message));
  }

  toggleHints() { this.showHints.update(v => !v); }
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