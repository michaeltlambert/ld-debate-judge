import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PdfService } from './pdf.service';
import { TermComponent } from './term.component';
import { TournamentService } from './tournament.service';

@Component({
  selector: 'app-ballot',
  standalone: true,
  imports: [CommonModule, TermComponent, FormsModule],
  template: `
    <div id="debate-ballot" class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      
      <!-- Header -->
      <div class="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
        <div class="flex flex-col">
          <h2 class="font-bold text-slate-800 text-xl tracking-tight">Official Ballot</h2>
          <span class="text-xs text-slate-500 font-mono">
            <!-- Dynamic Label based on History Mode -->
            <span *ngIf="isHistorical()" class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">HISTORY VIEW</span>
            <span *ngIf="!isHistorical()">Round #{{ tournament.roundCounter() }}</span>
          </span>
        </div>
        
        <button (click)="toggleHints()" 
          class="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
          [ngClass]="showHints() ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'">
          {{ showHints() ? 'Hide Guidelines' : 'Show Guidelines' }}
        </button>
      </div>

      <!-- Hints (Collapsible) -->
      <div *ngIf="showHints()" class="mb-8 grid grid-cols-1 md:grid-cols-2 gap-3 transition-all">
        <div class="bg-indigo-50 border border-indigo-100 p-3 rounded text-xs text-indigo-900">
          <strong>1. Framework:</strong> Weigh <app-term lookup="Value Premise">Value</app-term> & <app-term lookup="Value Criterion">Criterion</app-term>.
        </div>
        <div class="bg-amber-50 border border-amber-100 p-3 rounded text-xs text-amber-900">
          <strong>2. Tabula Rasa:</strong> Judge only what is said. No bias.
        </div>
        <div class="bg-rose-50 border border-rose-100 p-3 rounded text-xs text-rose-900">
          <strong>3. Drops:</strong> <app-term lookup="Dropped">Dropped</app-term> args are true.
        </div>
        <div class="bg-emerald-50 border border-emerald-100 p-3 rounded text-xs text-emerald-900">
          <strong>4. Voters:</strong> Focus on final <app-term lookup="Voters">Voting Issues</app-term>.
        </div>
      </div>

      <!-- SCORING SECTION -->
      <div class="space-y-6">
        
        <!-- Points Grid -->
        <div class="grid grid-cols-2 gap-6 relative">
          <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border border-slate-200 text-slate-400 font-bold text-xs px-2 py-1 rounded-full z-10 shadow-sm">VS</div>
          
          <!-- AFF Points -->
          <div class="bg-slate-50 p-4 rounded-lg border transition-colors"
             [class.border-blue-500]="affPoints() > negPoints()"
             [class.border-slate-100]="affPoints() <= negPoints()">
            <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Affirmative Points</label>
            <div class="flex items-center gap-2">
              <input type="number" min="0" max="30" 
                [ngModel]="affPoints()" 
                (ngModelChange)="setAff($event)" 
                (input)="checkInput($event, 'aff')"
                [disabled]="isHistorical()"
                class="w-full text-center text-xl font-mono font-bold border border-slate-300 rounded p-2 focus:ring-2 focus:ring-blue-500 shadow-sm disabled:bg-slate-200 disabled:text-slate-500">
              <span class="text-xs text-slate-400 font-medium">/ 30</span>
            </div>
            <div *ngIf="affPoints() > negPoints()" class="text-[10px] text-center text-blue-600 font-bold uppercase mt-2 tracking-wider">High Point Winner</div>
          </div>

          <!-- NEG Points -->
          <div class="bg-slate-50 p-4 rounded-lg border transition-colors"
             [class.border-red-500]="negPoints() > affPoints()"
             [class.border-slate-100]="negPoints() <= affPoints()">
            <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Negative Points</label>
             <div class="flex items-center gap-2">
              <input type="number" min="0" max="30" 
                [ngModel]="negPoints()" 
                (ngModelChange)="setNeg($event)" 
                (input)="checkInput($event, 'neg')"
                [disabled]="isHistorical()"
                class="w-full text-center text-xl font-mono font-bold border border-slate-300 rounded p-2 focus:ring-2 focus:ring-red-500 shadow-sm disabled:bg-slate-200 disabled:text-slate-500">
              <span class="text-xs text-slate-400 font-medium">/ 30</span>
            </div>
             <div *ngIf="negPoints() > affPoints()" class="text-[10px] text-center text-red-600 font-bold uppercase mt-2 tracking-wider">High Point Winner</div>
          </div>
        </div>

        <!-- Decision -->
        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Decision</label>
          <div class="flex gap-3">
            <button (click)="!isHistorical() && manualOverride('Aff')" 
              [class]="decision() === 'Aff' ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-200' : 'bg-white text-slate-400 border-slate-200 opacity-50 hover:opacity-100'"
              [class.cursor-not-allowed]="isHistorical()"
              class="flex-1 py-4 border-2 rounded-xl font-bold text-lg transition-all flex flex-col items-center justify-center gap-1 relative overflow-hidden">
              <svg *ngIf="decision() === 'Aff'" class="absolute -right-4 -bottom-4 w-24 h-24 text-blue-500 opacity-20 rotate-12" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              <span>Affirmative</span>
            </button>
            <button (click)="!isHistorical() && manualOverride('Neg')" 
              [class]="decision() === 'Neg' ? 'bg-red-600 text-white border-red-600 ring-2 ring-red-200' : 'bg-white text-slate-400 border-slate-200 opacity-50 hover:opacity-100'"
              [class.cursor-not-allowed]="isHistorical()"
              class="flex-1 py-4 border-2 rounded-xl font-bold text-lg transition-all flex flex-col items-center justify-center gap-1 relative overflow-hidden">
              <svg *ngIf="decision() === 'Neg'" class="absolute -right-4 -bottom-4 w-24 h-24 text-red-500 opacity-20 rotate-12" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              <span>Negative</span>
            </button>
          </div>
        </div>

        <!-- RFD -->
        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Reason for Decision (RFD)</label>
          <textarea [(ngModel)]="rfdText" 
            [disabled]="isHistorical()"
            class="w-full h-32 border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 shadow-sm resize-none disabled:bg-slate-100 disabled:text-slate-600" 
            placeholder="I voted for the {{decision() || '...'}} because..."></textarea>
        </div>
        
        <!-- Actions -->
        <div class="pt-4 border-t border-slate-100 flex gap-4">
          <button (click)="exportToPdf()" 
            class="flex-1 bg-white border border-slate-300 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-50 flex items-center justify-center gap-2">
            <span>Download PDF</span>
          </button>
          
          <!-- Submit Button (Hidden in History Mode) -->
          <button *ngIf="!isHistorical()" (click)="submitRound()" 
            [disabled]="!decision() || affPoints() === negPoints()"
            [class.opacity-50]="!decision() || affPoints() === negPoints()"
            class="flex-[2] bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 flex items-center justify-center gap-3 shadow-lg transition-all">
            <span>Submit & Start Next Round</span>
          </button>

          <!-- Return Button (Visible in History Mode) -->
          <button *ngIf="isHistorical()" (click)="tournament.startNewRound()" 
            class="flex-[2] bg-amber-500 text-white font-bold py-3 rounded-xl hover:bg-amber-600 flex items-center justify-center gap-3 shadow-lg transition-all">
            <span>Return to Current Round</span>
          </button>
        </div>
        
        <p *ngIf="affPoints() === negPoints() && !isHistorical()" class="text-xs text-center text-red-500 mt-2 font-bold">
            Points cannot be tied in Lincoln-Douglas debate.
        </p>
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
  isHistorical = signal(false);

  constructor() {
    // 1. Listen for new rounds (Reset)
    effect(() => {
      this.tournament.roundCounter(); 
      setTimeout(() => this.resetBallot(), 0);
    }, { allowSignalWrites: true });

    // 2. Listen for history requests (Restore)
    effect(() => {
      const record = this.tournament.restoreRequest();
      if (record) {
        this.isHistorical.set(true);
        this.affPoints.set(record.affScore);
        this.negPoints.set(record.negScore);
        this.decision.set(record.decision as any);
        this.rfdText = record.rfd;
      } else {
        this.isHistorical.set(false);
      }
    }, { allowSignalWrites: true });
  }

  resetBallot() {
    this.affPoints.set(28);
    this.negPoints.set(28);
    this.decision.set(null);
    this.rfdText = '';
    this.isHistorical.set(false);
  }

  submitRound() {
    if (!this.decision()) return;

    // Capture the exact state of the flow from localStorage
    const flowData = localStorage.getItem('ld-flow-args') || '[]';
    const frameworkData = localStorage.getItem('ld-flow-frameworks') || '{}';

    this.tournament.archiveRound({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      affScore: this.affPoints(),
      negScore: this.negPoints(),
      decision: this.decision()!,
      rfd: this.rfdText,
      flowArgs: flowData,       // SAVING FLOW
      flowFrameworks: frameworkData // SAVING FRAMEWORK
    });
  }

  toggleHints() { this.showHints.update(v => !v); }
  
  checkInput(event: Event, side: 'aff' | 'neg') {
    const input = event.target as HTMLInputElement;
    let val = parseFloat(input.value);
    if (val > 30) { input.value = '30'; val = 30; }
    else if (val < 0) { input.value = '0'; val = 0; }
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