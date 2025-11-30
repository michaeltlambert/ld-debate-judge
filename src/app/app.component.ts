import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimerComponent } from './timer.component';
import { FlowComponent } from './flow.component';
import { BallotComponent } from './ballot.component';
import { GlobalTooltipComponent } from './global-tooltip.component';
import { TournamentService } from './tournament.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, TimerComponent, FlowComponent, BallotComponent, GlobalTooltipComponent],
  template: `
    <div class="min-h-screen bg-slate-50 flex flex-col h-screen overflow-hidden">
      
      <!-- 1. Sticky Header Timer -->
      <app-timer class="flex-none" />

      <!-- 2. Main Workspace -->
      <main class="flex-1 overflow-hidden relative flex">
        
        <!-- Left Sidebar: Tournament History (Collapsible) -->
        <aside *ngIf="showHistory()" class="w-64 bg-slate-100 border-r border-slate-200 overflow-y-auto flex-none flex flex-col transition-all z-20">
          <div class="p-4 border-b border-slate-200 bg-white sticky top-0">
            <h3 class="font-bold text-slate-700">Tournament Log</h3>
            <p class="text-xs text-slate-500">Round {{ tournament.roundCounter() }} in progress</p>
          </div>
          
          <div class="flex-1 p-2 space-y-2">
            <div *ngIf="tournament.history().length === 0" class="text-center p-4 text-xs text-slate-400 italic">
              No previous rounds recorded.
            </div>

            <!-- CLICKABLE ROUND CARD -->
            <div *ngFor="let round of tournament.history()" 
                 (click)="tournament.loadRound(round)"
                 class="bg-white p-3 rounded shadow-sm border border-slate-200 relative group cursor-pointer hover:border-blue-300 hover:shadow-md transition-all">
              
              <div class="flex justify-between items-start pointer-events-none">
                <span class="text-xs font-bold text-slate-600">Rd {{ getRoundNumber(round) }}</span>
                <span class="text-[10px] text-slate-400">{{ round.timestamp | date:'shortTime' }}</span>
              </div>
              <div class="mt-1 font-bold text-sm pointer-events-none" 
                   [class.text-blue-600]="round.decision === 'Aff'"
                   [class.text-red-600]="round.decision === 'Neg'">
                Winner: {{ round.decision }}
              </div>
              <div class="text-xs text-slate-500 mt-1 pointer-events-none">
                Score: {{ round.affScore }} - {{ round.negScore }}
              </div>
              
              <button (click)="tournament.deleteRound(round.id); $event.stopPropagation()" 
                class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity p-1">
                &times;
              </button>
            </div>
          </div>

          <div class="p-2 border-t border-slate-200">
            <button (click)="tournament.clearHistory()" class="w-full text-xs text-red-400 hover:text-red-600 hover:bg-red-50 py-2 rounded">
              Clear Tournament History
            </button>
          </div>
        </aside>

        <!-- Center: Flow Sheet -->
        <div class="flex-1 overflow-hidden relative h-full">
           <!-- Toggle Sidebar Button -->
          <button (click)="toggleHistory()" class="absolute left-2 top-2 z-30 bg-white p-2 rounded-full shadow border border-slate-200 text-slate-500 hover:text-blue-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          
          <app-flow class="h-full block" />
        </div>

      </main>

      <!-- 3. Bottom Footer (Ballot) -->
      <footer class="bg-white border-t border-slate-200 p-2 flex-none z-40">
        <div class="max-w-7xl mx-auto flex justify-between items-center">
          <div class="text-xs text-slate-400 flex items-center gap-2">
            <strong>DebateMate</strong> 
            <span class="bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-mono">Round {{ tournament.roundCounter() }}</span>
          </div>
          
          <button (click)="showBallot.set(!showBallot())" 
            class="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 flex items-center gap-2 transition-all">
            <span>{{ showBallot() ? 'Hide Ballot' : 'Score Round' }}</span>
          </button>
        </div>

        <div *ngIf="showBallot()" class="border-t border-slate-100 mt-2 p-4 bg-slate-50 max-h-[60vh] overflow-y-auto">
          <div class="max-w-3xl mx-auto">
            <app-ballot />
          </div>
        </div>
      </footer>

      <app-global-tooltip />
    </div>
  `
})
export class AppComponent {
  tournament = inject(TournamentService);
  showBallot = signal(false);
  showHistory = signal(false);

  toggleHistory() {
    this.showHistory.update(v => !v);
  }

  getRoundNumber(round: any) {
    const index = this.tournament.history().indexOf(round);
    return this.tournament.history().length - index;
  }
}