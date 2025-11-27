import { Component, signal } from '@angular/core'; // added signal
import { CommonModule } from '@angular/common'; // added CommonModule
import { TimerComponent } from './timer.component';
import { FlowComponent } from './flow.component';
import { BallotComponent } from './ballot.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, TimerComponent, FlowComponent, BallotComponent],
  template: `
    <div class="min-h-screen bg-slate-50 flex flex-col h-screen overflow-hidden">
      
      <app-timer class="flex-none" />

      <main class="flex-1 p-4 overflow-hidden relative">
        <app-flow class="h-full block" />
      </main>

      <footer class="bg-white border-t border-slate-200 p-2 flex-none z-40">
        <div class="max-w-7xl mx-auto flex justify-between items-center">
          <div class="text-xs text-slate-400">
            <strong>DebateMate</strong> &copy; 2025
          </div>
          
          <button (click)="showBallot.set(!showBallot())" 
            class="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 flex items-center gap-2 transition-all">
            <span>{{ showBallot() ? 'Hide Ballot' : 'Open Ballot & Submit' }}</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" *ngIf="showBallot()" />
              <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" *ngIf="!showBallot()" />
            </svg>
          </button>
        </div>

        <div *ngIf="showBallot()" class="border-t border-slate-100 mt-2 p-4 bg-slate-50 max-h-[60vh] overflow-y-auto">
          <div class="max-w-3xl mx-auto">
            <app-ballot />
          </div>
        </div>
      </footer>

    </div>
  `
})
export class AppComponent {
  showBallot = signal(false);
}