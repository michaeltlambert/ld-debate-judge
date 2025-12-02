import { Component, inject, signal, computed, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TournamentService } from '../../core/tournament.service';
import { Debate, RoundType, RoundResult } from '../../core/models';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 max-w-7xl mx-auto">
      <header class="max-w-7xl mx-auto mb-8 flex justify-between items-center">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">{{ tournament.tournamentName() }}</h1>
          <div class="flex items-center gap-2 text-sm">
             <span class="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{{ tournament.tournamentId() }}</span>
             <span class="text-slate-400">|</span>
             <span class="text-slate-600 italic font-medium">{{ tournament.currentTournament()?.topic }}</span>
          </div>
        </div>
        <div class="flex items-center gap-4">
           <button (click)="backToList()" class="text-sm font-bold text-slate-500 hover:text-slate-800 underline">Switch Tournament</button>
           <button *ngIf="!tournament.isTournamentClosed()" (click)="closeTournament()" class="text-xs font-bold bg-red-50 text-red-600 px-3 py-2 rounded hover:bg-red-100 transition-colors border border-red-100">End Tournament</button>
           <button (click)="tournament.logout()" class="text-sm font-bold text-red-500 hover:text-red-700 underline ml-4">Log Out</button>
        </div>
      </header>

      <div *ngIf="tournament.isTournamentClosed()" class="max-w-7xl mx-auto bg-amber-50 border border-amber-200 p-4 rounded-lg mb-6 text-center text-amber-800 font-bold">
          This tournament is closed. All data is Read-Only.
      </div>
      
      <main class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div class="col-span-12 flex gap-4 mb-4 border-b border-slate-200">
            <button (click)="activeTab.set('Dashboard')" [class.border-slate-800]="activeTab()==='Dashboard'" class="pb-2 border-b-2 border-transparent font-bold text-sm">Rounds</button>
            <button (click)="activeTab.set('Bracket')" [class.border-slate-800]="activeTab()==='Bracket'" class="pb-2 border-b-2 border-transparent font-bold text-sm">Bracket</button>
        </div>
        
        <div *ngIf="activeTab() === 'Dashboard'" class="contents">
             <div class="lg:col-span-4 space-y-6">
                 <div *ngIf="!tournament.isTournamentClosed()" class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 class="font-bold text-slate-800 mb-4">Create Round</h2>
                    <div class="space-y-4">
                      <div class="p-3 bg-slate-50 border rounded text-xs text-slate-500 italic">Topic: {{ tournament.currentTournament()?.topic }}</div>
                      <div class="grid grid-cols-2 gap-2">
                        <select [(ngModel)]="roundType" class="w-full p-2 border rounded text-sm bg-white">
                            <option value="Prelim">Preliminary</option>
                            <option value="Elimination">Elimination</option>
                        </select>
                        <div *ngIf="roundType === 'Prelim'" class="flex items-center gap-2 bg-slate-50 border rounded px-2">
                          <span class="text-[10px] font-bold text-slate-500 uppercase">Round</span>
                          <input type="number" [(ngModel)]="roundNumber" min="1" class="w-full p-1.5 bg-transparent text-sm outline-none">
                        </div>
                        <select *ngIf="roundType === 'Elimination'" [(ngModel)]="roundStage" class="w-full p-2 border rounded text-sm bg-white">
                            <option value="Octofinals">Octofinals</option>
                            <option value="Quarterfinals">Quarterfinals</option>
                            <option value="Semifinals">Semifinals</option>
                            <option value="Finals">Finals</option>
                        </select>
                      </div>
                      <div class="space-y-2">
                        <label class="block text-xs font-bold text-blue-600 uppercase mb-1">Affirmative</label>
                        <select [(ngModel)]="selectedAffId" class="w-full p-2 border rounded text-sm bg-white"><option value="" disabled selected>Select Debater...</option><option *ngFor="let d of sortedDebaters()" [value]="d.id" [disabled]="d.status === 'Eliminated'" [class.text-red-400]="d.status === 'Eliminated'">{{ d.name }} {{ d.status === 'Eliminated' ? '(Eliminated)' : '' }}</option></select>
                      </div>
                      <div class="space-y-2">
                        <label class="block text-xs font-bold text-red-600 uppercase mb-1">Negative</label>
                        <select [(ngModel)]="selectedNegId" class="w-full p-2 border rounded text-sm bg-white"><option value="" disabled selected>Select Debater...</option><option *ngFor="let d of sortedDebaters()" [value]="d.id" [disabled]="d.status === 'Eliminated'" [class.text-red-400]="d.status === 'Eliminated'">{{ d.name }} {{ d.status === 'Eliminated' ? '(Eliminated)' : '' }}</option></select>
                      </div>
                      <button (click)="create()" class="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800" title="Create Matchup">Create Matchup</button>
                    </div>
                 </div>
                 <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 class="font-bold text-slate-800 mb-4">Participants</h2>
                    <div class="mb-4">
                        <h3 class="text-xs font-bold text-slate-500 uppercase mb-2">Debaters ({{ sortedDebaters().length }})</h3>
                        <div class="max-h-48 overflow-y-auto space-y-2">
                             <div *ngFor="let d of sortedDebaters()" class="flex justify-between text-sm p-2 bg-slate-50 rounded">
                                 <span [class.line-through]="d.status === 'Eliminated'" [class.text-slate-400]="d.status === 'Eliminated'">{{ d.name }}</span>
                                 <div class="flex gap-2">
                                     <button *ngIf="!tournament.isTournamentClosed()" (click)="toggleStatus(d)">{{ d.status === 'Eliminated' ? '❤️' : '💀' }}</button>
                                     <button *ngIf="!tournament.isTournamentClosed()" (click)="tournament.kickUser(d.id, 'Debater')" class="text-red-500">&times;</button>
                                 </div>
                             </div>
                        </div>
                    </div>
                    <div>
                        <h3 class="text-xs font-bold text-slate-500 uppercase mb-2">Judges ({{ sortedJudges().length }})</h3>
                        <div class="max-h-48 overflow-y-auto space-y-2">
                             <div *ngFor="let j of sortedJudges()" class="flex justify-between text-sm p-2 bg-slate-50 rounded">
                                 <span>{{ j.name }}</span>
                                 <button *ngIf="!tournament.isTournamentClosed()" (click)="tournament.kickUser(j.id, 'Judge')" class="text-red-500">&times;</button>
                             </div>
                        </div>
                    </div>
                 </div>
             </div>
             
             <div class="lg:col-span-8 space-y-6">
                <div *ngFor="let debate of sortedDebates()" class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 mb-4">
                     <div class="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                        <div>
                            <div class="flex items-center gap-3">
                                <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded">{{ debate.stage }}</span>
                                <h3 class="font-bold text-lg text-slate-800">{{ debate.topic }}</h3>
                            </div>
                            <div class="text-sm text-slate-500 mt-1">{{ debate.affName }} vs {{ debate.negName }}</div>
                        </div>
                        <div class="flex gap-2 items-center" *ngIf="!tournament.isTournamentClosed()">
                            <div class="relative" *ngIf="debate.status === 'Open'">
                                <select #assignSelect (change)="assign(debate.id, assignSelect.value); assignSelect.value=''" class="bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold py-2 px-3 rounded">
                                    <option value="" disabled selected>+ Add Judge</option>
                                    <option *ngFor="let judge of getUnassignedJudges(debate)" [value]="judge.id">{{ judge.name }}</option>
                                </select>
                            </div>
                            <button *ngIf="debate.status === 'Open'" (click)="tournament.finalizeRound(debate.id)" class="bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded">Finalize</button>
                            <button (click)="tournament.deleteDebate(debate.id)" class="text-slate-300 hover:text-red-500 p-2">Del</button>
                        </div>
                     </div>
                     <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div *ngFor="let judgeId of debate.judgeIds" class="bg-slate-50 rounded-lg p-3 border border-slate-200 relative group">
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-xs font-bold text-slate-700 flex items-center gap-2">{{ getJudgeName(judgeId) }}</span>
                                <button *ngIf="debate.status === 'Open' && !tournament.isTournamentClosed()" (click)="remove(debate.id, judgeId)" class="text-slate-300 hover:text-red-500 font-bold text-xs">Remove</button>
                            </div>
                            <div *ngIf="getResult(debate.id, judgeId) as res; else pending" (click)="selectedBallot.set(res)" class="cursor-pointer hover:bg-slate-100 p-2 rounded">
                                <span [class.text-blue-600]="res.decision === 'Aff'" [class.text-red-600]="res.decision === 'Neg'">Voted: {{ res.decision }}</span>
                            </div>
                            <ng-template #pending>
                                <div class="flex items-center justify-between w-full mt-2 pl-2">
                                    <span class="text-[10px] text-slate-400">Pending...</span>
                                    <button *ngIf="!tournament.isTournamentClosed()" (click)="tournament.sendNudge(judgeId, debate.id)" class="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded">🔔 Nudge</button>
                                </div>
                            </ng-template>
                        </div>
                    </div>
                </div>
             </div>
        </div>
      </main>
    </div>
  `
})
export class AdminComponent {
  tournament = inject(TournamentService);
  router = inject(Router);
  
  @Input() set tournamentId(val: string) { if(val) this.tournament.tournamentId.set(val); }

  newTopic = ''; selectedAffId = ''; selectedNegId = '';
  roundType: RoundType = 'Prelim';
  roundNumber = 1; roundStage = 'Quarterfinals'; 
  selectedBallot = signal<RoundResult | null>(null);
  activeTab = signal<'Dashboard' | 'Bracket'>('Dashboard');
  bracketStages = ['Octofinals', 'Quarterfinals', 'Semifinals', 'Finals'];

  sortedDebates = computed(() => this.tournament.debates().slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
  sortedDebaters = computed(() => {
     const stats = this.tournament.standings();
     return this.tournament.debaters().map(d => {
         const s = stats.find(stat => stat.id === d.id);
         return { ...d, wins: s?.wins || 0, losses: s?.losses || 0 };
     }).sort((a, b) => (b.wins - a.wins) || (a.losses - b.losses));
  });
  sortedJudges = computed(() => this.tournament.judges().slice().sort((a, b) => a.name.localeCompare(b.name)));

  create() { 
    const aff = this.tournament.debaters().find(d => d.id === this.selectedAffId);
    const neg = this.tournament.debaters().find(d => d.id === this.selectedNegId);
    const topic = this.tournament.currentTournament()?.topic || 'Untitled Round';
    let stageName = this.roundType === 'Prelim' ? `Round ${this.roundNumber}` : this.roundStage;
    if (aff && neg) {
      this.tournament.createDebate(topic, aff.id, aff.name, neg.id, neg.name, this.roundType, stageName);
    }
  }
  
  backToList() { this.tournament.tournamentId.set(null); this.router.navigate(['/tournaments']); }
  closeTournament() { if(confirm('Close?')) this.tournament.closeTournament(this.tournament.tournamentId()!); }
  assign(dId: string, jId: string) { this.tournament.assignJudge(dId, jId); }
  remove(dId: string, jId: string) { this.tournament.removeJudge(dId, jId); }
  toggleStatus(d: any) { this.tournament.toggleDebaterStatus(d.id, d.status); }
  getDebatesForStage(stage: string) { return this.tournament.debates().filter(d => d.type === 'Elimination' && d.stage === stage); }
  getWinner(dId: string) { return this.tournament.getWinner(dId); }
  getWinnerName(d: Debate) { const w = this.tournament.getWinner(d.id); return w === 'Aff' ? d.affName : (w === 'Neg' ? d.negName : 'None'); }
  getJudgeName(id: string) { return this.tournament.judges().find(j => j.id === id)?.name || 'Unknown'; }
  getUnassignedJudges(d: Debate) { return this.tournament.judges().filter(j => !d.judgeIds.includes(j.id)); }
  getResult(dId: string, jId: string) { return this.tournament.results().find(r => r.debateId === dId && r.judgeId === jId); }
  getDebate(id: string | undefined) { return this.tournament.debates().find(d => d.id === id); }
}