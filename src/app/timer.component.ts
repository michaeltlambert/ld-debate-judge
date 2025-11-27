import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DebateService } from './debate.service';
import { TermComponent } from './term.component'; // Import

@Component({
  selector: 'app-timer',
  standalone: true,
  imports: [CommonModule, TermComponent], // Add to imports
  template: `
    <div class="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
      <div class="max-w-[1920px] mx-auto px-4 py-2">
        
        <div class="flex items-center justify-between gap-4">
          
          <div class="flex items-center gap-3 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 min-w-[140px]">
            <div class="flex flex-col">
              <span class="text-[10px] font-bold text-blue-600 uppercase tracking-wide">
                <app-term lookup="Prep Time" position="bottom">Aff Prep</app-term>
              </span>
              <span class="font-mono text-xl font-bold text-slate-700 leading-none">
                {{ debate.formatTime(debate.affPrep()) }}
              </span>
            </div>
            <button (click)="debate.toggleAffPrep()" class="ml-auto text-blue-600 hover:bg-blue-100 p-1 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clip-rule="evenodd" /></svg>
            </button>
          </div>

          <div class="flex-1 flex items-center justify-center gap-6">
            <div class="bg-slate-900 text-white px-6 py-1 rounded-lg flex items-center gap-4 shadow-md min-w-[200px] justify-center">
              <span class="font-mono text-4xl font-bold tracking-tighter" [class.text-emerald-400]="debate.activeTimer() === 'SPEECH'">
                {{ debate.formatTime(debate.speechTimer()) }}
              </span>
              <button (click)="debate.toggleSpeech()" class="hover:text-emerald-400">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm14.024-.983a1.125 1.125 0 010 1.966l-5.603 3.113A1.125 1.125 0 019 15.113V8.887c0-.857.921-1.4 1.671-.983l5.603 3.113z" clip-rule="evenodd" /></svg>
              </button>
            </div>
          </div>

          <div class="flex items-center gap-3 bg-red-50 px-3 py-1 rounded-lg border border-red-100 min-w-[140px]">
            <button (click)="debate.toggleNegPrep()" class="text-red-600 hover:bg-red-100 p-1 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clip-rule="evenodd" /></svg>
            </button>
            <div class="flex flex-col items-end">
              <span class="text-[10px] font-bold text-red-600 uppercase tracking-wide">
                 <app-term lookup="Prep Time" position="bottom">Neg Prep</app-term>
              </span>
              <span class="font-mono text-xl font-bold text-slate-700 leading-none">
                {{ debate.formatTime(debate.negPrep()) }}
              </span>
            </div>
          </div>

        </div>

        <div class="flex justify-center gap-1 mt-2 overflow-x-auto pb-1">
           <button *ngFor="let p of debate.phases" (click)="debate.setPhase(p)"
            class="text-[10px] font-bold px-3 py-1 rounded-full border transition-all whitespace-nowrap"
            [class]="debate.currentPhase().id === p.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'">
            {{ p.id }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class TimerComponent {
  debate = inject(DebateService);
}