import { Component, inject, effect, signal, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TimerComponent } from '../../ui/timer/timer.component';
import { FlowComponent } from '../../ui/flow/flow.component';
import { BallotComponent } from '../../ui/ballot/ballot.component';
import { TournamentService } from '../../core/tournament.service';
import { DebateService } from '../../core/debate.service';

@Component({
  selector: 'app-debate-layout',
  standalone: true,
  imports: [CommonModule, TimerComponent, FlowComponent, BallotComponent],
  template: `
    <div class="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        <app-timer class="flex-none" 
            [phases]="debateService.phases"
            [currentPhase]="debateService.currentPhase()"
            [activeTimer]="debateService.activeTimer()"
            [speechTimer]="debateService.speechTimer()"
            [affPrep]="debateService.affPrep()"
            [negPrep]="debateService.negPrep()"
            (toggleSpeech)="debateService.toggleSpeech()"
            (toggleAffPrep)="debateService.toggleAffPrep()"
            (toggleNegPrep)="debateService.toggleNegPrep()"
            (setPhase)="debateService.setPhase($event)"
        />
        
        <div class="bg-slate-100 px-4 py-1 text-xs text-center border-b border-slate-200 flex justify-between items-center">
            <span class="font-bold text-slate-600">Topic: {{ currentDebate()?.topic }}</span>
            <button (click)="exitRound()" class="text-red-500 hover:underline">Exit Round</button>
        </div>

        <main class="flex-1 p-4 overflow-hidden relative">
            <app-flow class="h-full block" 
                (flowChange)="tournament.currentFlow.set($event)"
                (frameworksChange)="tournament.currentFrameworks.set($event)"
            />
        </main>

        <footer class="bg-white border-t border-slate-200 p-2 flex-none z-40">
            <div class="max-w-7xl mx-auto flex justify-between items-center">
                <div class="text-xs text-slate-400"><strong>DebateMate</strong> 2025</div>
                <button (click)="showBallot.set(!showBallot())" 
                        class="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-all">
                    {{ isDebater() ? 'View Feedback' : 'Score Round' }}
                </button>
            </div>
            <div *ngIf="showBallot()" class="border-t border-slate-100 mt-2 p-4 bg-slate-50 max-h-[60vh] overflow-y-auto">
                <div class="max-w-3xl mx-auto">
                    <app-ballot 
                        [debate]="currentDebate()"
                        [existingResult]="existingResult()"
                        [isDebater]="!!isDebater()"
                        [locked]="currentDebate()?.status === 'Closed'"
                        (onSubmit)="submitBallot($event)"
                    />
                </div>
            </div>
        </footer>
    </div>
  `
})
export class DebateLayoutComponent {
  tournament = inject(TournamentService);
  debateService = inject(DebateService);
  router = inject(Router);
  
  tournamentId = input<string>('');
  debateId = input<string>('');
  showBallot = signal(false);

  currentDebate = computed(() => {
    const activeId = this.tournament.activeDebateId();
    return this.tournament.debates().find(d => d.id === activeId);
  });

  existingResult = computed(() => {
      const debateId = this.tournament.activeDebateId();
      const userId = this.tournament.userProfile()?.id;
      return this.tournament.results().find(r => r.debateId === debateId && r.judgeId === userId);
  });

  constructor() {
    effect(() => {
      const tId = this.tournamentId();
      const dId = this.debateId();
      if (tId) this.tournament.tournamentId.set(tId);
      if (dId) this.tournament.activeDebateId.set(dId);
    });
  }

  isDebater() { return this.tournament.userRole() === 'Debater'; }
  exitRound() { this.router.navigate(['/']); }

  submitBallot(payload: any) {
      const debateId = this.tournament.activeDebateId();
      if(debateId) {
          this.tournament.submitBallot(debateId, payload).then(() => {
              alert("Ballot Submitted!");
          }).catch((e:any) => alert(e.message));
      }
  }
}