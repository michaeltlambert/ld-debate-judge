import { Component, inject, signal, effect, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PdfService } from '../../core/pdf.service';
import { Debate, RoundResult } from '../../core/models';

@Component({
  selector: 'app-ballot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div id="debate-ballot" class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div *ngIf="!isDebater()">
          <div class="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
            <h2 class="font-bold text-slate-800 text-xl">Ballot</h2>
            <span *ngIf="locked()" class="text-red-600 font-bold uppercase text-xs">Locked</span>
          </div>
          
          <div class="flex justify-end mb-2 gap-2">
              <button (click)="exportToPdf()" class="text-xs font-bold px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">📄 Export PDF</button>
              <button (click)="toggleHints()" class="text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all">
                  {{ showHints() ? 'Hide Guidelines' : 'Show Guidelines' }}
              </button>
          </div>
          
          <div *ngIf="showHints()" class="mb-6 grid grid-cols-1 md:grid-cols-2 gap-2 transition-all">
             <div class="bg-indigo-50 border border-indigo-100 p-2 rounded text-[10px] text-indigo-900"><strong>Framework:</strong> Value & Criterion</div>
             <div class="bg-amber-50 border border-amber-100 p-2 rounded text-[10px] text-amber-900"><strong>Tabula Rasa:</strong> No bias</div>
          </div>

          <div class="grid grid-cols-2 gap-6 mb-6">
             <div>
                <label class="block text-xs font-bold text-slate-500 uppercase mb-1 text-center">Aff ({{ debate()?.affName }})</label>
                <input type="number" [ngModel]="affPoints()" (ngModelChange)="validateAndSet('aff', $event)" [disabled]="locked()" class="w-full border p-2 rounded text-center font-bold text-xl">
             </div>
             <div>
                <label class="block text-xs font-bold text-slate-500 uppercase mb-1 text-center">Neg ({{ debate()?.negName }})</label>
                <input type="number" [ngModel]="negPoints()" (ngModelChange)="validateAndSet('neg', $event)" [disabled]="locked()" class="w-full border p-2 rounded text-center font-bold text-xl">
             </div>
          </div>
          
          <div class="flex gap-4 mb-6">
             <button (click)="!locked() && decision.set('Aff')" [class]="decision() === 'Aff' ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'" class="flex-1 py-4 rounded-xl font-bold transition-all flex flex-col items-center justify-center">
                <span class="text-xs uppercase opacity-70">Affirmative</span>
                <span class="text-lg">{{ debate()?.affName }}</span>
             </button>
             <button (click)="!locked() && decision.set('Neg')" [class]="decision() === 'Neg' ? 'bg-red-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'" class="flex-1 py-4 rounded-xl font-bold transition-all flex flex-col items-center justify-center">
                <span class="text-xs uppercase opacity-70">Negative</span>
                <span class="text-lg">{{ debate()?.negName }}</span>
             </button>
          </div>
          
          <textarea [(ngModel)]="rfdText" [disabled]="locked()" class="w-full h-32 border rounded p-2 text-sm" placeholder="Reason for Decision"></textarea>
          <button *ngIf="!locked()" (click)="submit()" class="w-full mt-4 bg-slate-900 text-white font-bold py-3 rounded hover:bg-slate-800" title="Submit Ballot">Submit Ballot</button>
      </div>
      
      <div *ngIf="isDebater()" class="text-center text-slate-400 italic py-8">
          Submitting ballots is restricted to Judges. Use the dashboard to view feedback.
      </div>
    </div>
  `
})
export class BallotComponent {
  pdfService = inject(PdfService);
  debate = input<Debate | undefined>();
  existingResult = input<RoundResult | undefined>();
  isDebater = input<boolean>(false);
  locked = input<boolean>(false);
  onSubmit = output<any>();

  affPoints = signal(28);
  negPoints = signal(28);
  decision = signal<'Aff' | 'Neg' | null>(null);
  rfdText = ''; 
  showHints = signal(true);

  constructor() {
    effect(() => {
        const res = this.existingResult();
        if (res) {
            this.affPoints.set(res.affScore);
            this.negPoints.set(res.negScore);
            this.decision.set(res.decision);
            this.rfdText = res.rfd;
        }
    });
  }

  toggleHints() { this.showHints.update(v => !v); }

  submit() {
    if (this.locked()) return;
    if (!this.decision()) return;
    this.onSubmit.emit({
      affScore: this.affPoints(),
      negScore: this.negPoints(),
      decision: this.decision()!,
      rfd: this.rfdText
    });
  }
  
  validateAndSet(side: 'aff' | 'neg', val: number) {
    let cleanVal = val;
    if (cleanVal > 30) cleanVal = 30;
    if (cleanVal < 0) cleanVal = 0;
    if (side === 'aff') this.affPoints.set(cleanVal); else this.negPoints.set(cleanVal);
    this.autoCalculateWinner();
  }

  private autoCalculateWinner() {
    if (this.affPoints() > this.negPoints()) this.decision.set('Aff');
    else if (this.negPoints() > this.affPoints()) this.decision.set('Neg');
    else this.decision.set(null);
  }

  exportToPdf() { 
    this.pdfService.generateBallotPdf('debate-flow', 'debate-ballot'); 
  }
}