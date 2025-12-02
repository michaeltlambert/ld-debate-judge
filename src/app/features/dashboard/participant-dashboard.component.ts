import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TournamentService } from '../../core/tournament.service';

@Component({
  selector: 'app-participant-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-8 max-w-4xl mx-auto w-full">
      <h2 class="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Your Assignments</h2>
      <div class="grid gap-4">
        <div *ngFor="let debate of tournament.getMyAssignments()" 
             (click)="openRound(debate.id)"
             class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all">
          <div class="flex justify-between">
            <span class="bg-slate-800 text-white text-xs font-bold px-2 py-1 rounded">{{ debate.status }}</span>
            <span class="text-xs text-slate-400">Click to Open &rarr;</span>
          </div>
          <h3 class="text-xl font-bold text-slate-800 mt-3 mb-2">{{ debate.topic }}</h3>
          <div class="flex items-center gap-4 text-sm text-slate-600">
            <div><strong>Aff:</strong> {{ debate.affName }}</div>
            <div><strong>Neg:</strong> {{ debate.negName }}</div>
          </div>
        </div>
        <div *ngIf="tournament.getMyAssignments().length === 0" class="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
          No debates active.
        </div>
      </div>
    </div>
  `
})
export class ParticipantDashboardComponent {
  tournament = inject(TournamentService);
  router = inject(Router);

  openRound(debateId: string) {
    const tid = this.tournament.tournamentId();
    if (tid) this.router.navigate(['/tournament', tid, 'round', debateId]);
  }
}