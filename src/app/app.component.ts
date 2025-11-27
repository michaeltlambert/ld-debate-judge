import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimerComponent } from './timer.component';
import { FlowComponent } from './flow.component';
import { BallotComponent } from './ballot.component';
import { GlobalTooltipComponent } from './global-tooltip.component'; // Import new component

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, TimerComponent, FlowComponent, BallotComponent, GlobalTooltipComponent], // Add to imports
  template: `
    <div class="min-h-screen bg-slate-50 flex flex-col h-screen overflow-hidden">
      
      <app-timer class="flex-none" />

      <main class="flex-1 p-4 overflow-hidden relative">
        <app-flow class="h-full block" />
      </main>

      <footer class="bg-white border-t border-slate-200 p-2 flex-none z-40">
        <div class="max-w-7xl mx-auto flex justify-between items-center">
          <div class="text-xs text-slate-400"><strong>DebateMate</strong> &copy; 2025</div>
          <button (click)="showBallot.set(!showBallot())" class="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-all">
            {{ showBallot() ? 'Hide Ballot' : 'Score Round' }}
          </button>
        </div>
        <div *ngIf="showBallot()" class="border-t border-slate-100 mt-2 p-4 bg-slate-50 max-h-[60vh] overflow-y-auto">
          <div class="max-w-3xl mx-auto"><app-ballot /></div>
        </div>
      </footer>

      <app-global-tooltip />

    </div>
  `
})
export class AppComponent {
  showBallot = signal(false);
}