import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Required for inputs
import { PdfService } from './pdf.service';
import { TermComponent } from './term.component';

@Component({
  selector: 'app-ballot',
  standalone: true,
  imports: [CommonModule, TermComponent, FormsModule],
  template: `
    <div id="debate-ballot" class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      
      <div class="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
        <h2 class="font-bold text-slate-800 text-xl tracking-tight">Official Ballot</h2>
        <button (click)="toggleHints()" 
          class="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
          [ngClass]="showHints() ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'">
          {{ showHints() ? 'Hide Guidelines' : 'Show Guidelines' }}
        </button>
      </div>

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

      <div class="space-y-6">
        
        <div class="grid grid-cols-2 gap-6 relative">
          
          <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border border-slate-200 text-slate-400 font-bold text-xs px-2 py-1 rounded-full z-10 shadow-sm">VS</div>

          <div class="bg-slate-50 p-4 rounded-lg border transition-colors"
             [class.border-blue-500]="affPoints() > negPoints()"
             [class.border-slate-100]="affPoints() <= negPoints()">
            <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Affirmative Points</label>
            <div class="flex items-center gap-2">
              <input type="number" min="20" max="30" 
                [ngModel]="affPoints()" (ngModelChange)="setAff($event)"
                class="w-full text-center text-xl font-mono font-bold border border-slate-300 rounded p-2 focus:ring-2 focus:ring-blue-500 shadow-sm">
              <span class="text-xs text-slate-400 font-medium">/ 30</span>
            </div>
            <div *ngIf="affPoints() > negPoints()" class="text-[10px] text-center text-blue-600 font-bold uppercase mt-2 tracking-wider">High Point Winner</div>
          </div>

          <div class="bg-slate-50 p-4 rounded-lg border transition-colors"
             [class.border-red-500]="negPoints() > affPoints()"
             [class.border-slate-100]="negPoints() <= affPoints()">
            <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Negative Points</label>
             <div class="flex items-center gap-2">
              <input type="number" min="20" max="30" 
                [ngModel]="negPoints()" (ngModelChange)="setNeg($event)"
                class="w-full text-center text-xl font-mono font-bold border border-slate-300 rounded p-2 focus:ring-2 focus:ring-red-500 shadow-sm">
              <span class="text-xs text-slate-400 font-medium">/ 30</span>
            </div>
             <div *ngIf="negPoints() > affPoints()" class="text-[10px] text-center text-red-600 font-bold uppercase mt-2 tracking-wider">High Point Winner</div>
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase mb-2 flex justify-between">
            <span>Decision</span>
            <span *ngIf="isLowPointWin()" class="text-amber-600 bg-amber-50 px-2 rounded flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3 h-3"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" /></svg>
              Low Point Win Detected
            </span>
          </label>
          
          <div class="flex gap-3">
            <button (click)="manualOverride('Aff')" 
              [class]="decision() === 'Aff' ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-200' : 'bg-white text-slate-400 border-slate-200 opacity-50 hover:opacity-100'"
              class="flex-1 py-4 border-2 rounded-xl font-bold text-lg transition-all flex flex-col items-center justify-center gap-1 relative overflow-hidden">
              
              <svg *ngIf="decision() === 'Aff'" class="absolute -right-4 -bottom-4 w-24 h-24 text-blue-500 opacity-20 rotate-12" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              
              <span>Affirmative</span>
              <span *ngIf="decision() === 'Aff'" class="text-[10px] uppercase tracking-wider font-normal opacity-90">Winner</span>
            </button>
            
            <button (click)="manualOverride('Neg')" 
               [class]="decision() === 'Neg' ? 'bg-red-600 text-white border-red-600 ring-2 ring-red-200' : 'bg-white text-slate-400 border-slate-200 opacity-50 hover:opacity-100'"
              class="flex-1 py-4 border-2 rounded-xl font-bold text-lg transition-all flex flex-col items-center justify-center gap-1 relative overflow-hidden">
              
              <svg *ngIf="decision() === 'Neg'" class="absolute -right-4 -bottom-4 w-24 h-24 text-red-500 opacity-20 rotate-12" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              
              <span>Negative</span>
               <span *ngIf="decision() === 'Neg'" class="text-[10px] uppercase tracking-wider font-normal opacity-90">Winner</span>
            </button>
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Reason for Decision (RFD)</label>
          <textarea class="w-full h-32 border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 shadow-sm resize-none" placeholder="I voted for the {{decision() || '...'}} because..."></textarea>
        </div>
        
        <div class="pt-4 border-t border-slate-100">
          <button (click)="exportToPdf()" 
            [disabled]="!decision() || affPoints() === negPoints()"
            [class.opacity-50]="!decision() || affPoints() === negPoints()"
            class="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 flex items-center justify-center gap-3 shadow-lg transition-all">
            <span>Submit Official Ballot</span>
          </button>
          <p *ngIf="affPoints() === negPoints()" class="text-xs text-center text-red-500 mt-2 font-bold">
            Points cannot be tied in Lincoln-Douglas debate.
          </p>
        </div>
      </div>
    </div>
  `
})
export class BallotComponent {
  pdfService = inject(PdfService);
  showHints = signal(true);
  
  // Data State
  affPoints = signal(28);
  negPoints = signal(28);
  decision = signal<'Aff' | 'Neg' | null>(null);

  toggleHints() { this.showHints.update(v => !v); }

  // 1. Update Signals
  setAff(val: number) { 
    this.affPoints.set(val); 
    this.autoCalculateWinner(); 
  }
  
  setNeg(val: number) { 
    this.negPoints.set(val); 
    this.autoCalculateWinner(); 
  }

  // 2. Logic: The person with highest points WINS
  autoCalculateWinner() {
    if (this.affPoints() > this.negPoints()) {
      this.decision.set('Aff');
    } else if (this.negPoints() > this.affPoints()) {
      this.decision.set('Neg');
    } else {
      this.decision.set(null); // Reset on tie
    }
  }

  // 3. Allow manual override, but just update the signal
  manualOverride(winner: 'Aff' | 'Neg') {
    this.decision.set(winner);
  }

  // 4. Helper to detect if judge is doing a "Low Point Win"
  isLowPointWin(): boolean {
    if (this.decision() === 'Aff' && this.affPoints() < this.negPoints()) return true;
    if (this.decision() === 'Neg' && this.negPoints() < this.affPoints()) return true;
    return false;
  }

  exportToPdf() {
    this.pdfService.generateBallotPdf('debate-flow', 'debate-ballot');
  }
}