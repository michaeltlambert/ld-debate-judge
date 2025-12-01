import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TournamentService, Debate, RoundType, RoundStage, UserProfile } from './tournament.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 max-w-7xl mx-auto">
      <header class="max-w-7xl mx-auto mb-8 flex justify-between items-center">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">{{ tournament.tournamentName() }}</h1>
          <p class="text-slate-500">Code: <span class="font-mono font-bold text-blue-600">{{ tournament.tournamentId() }}</span></p>
        </div>
        <div class="flex items-center gap-4">
           <button (click)="backToList()" class="text-sm font-bold text-slate-500 hover:text-slate-800 underline">Switch Tournament</button>
           
           <!-- Close Tournament -->
           <button *ngIf="!tournament.isTournamentClosed()" (click)="closeTournament()" class="text-xs font-bold bg-red-50 text-red-600 px-3 py-2 rounded hover:bg-red-100 transition-colors border border-red-100">End Tournament</button>
           <div *ngIf="tournament.isTournamentClosed()" class="text-xs font-bold bg-gray-100 text-gray-500 px-3 py-2 rounded border border-gray-200">ARCHIVED</div>
           
           <button (click)="tournament.logout()" class="text-sm font-bold text-red-500 hover:text-red-700 underline ml-4">Log Out</button>
        </div>
      </header>

      <div *ngIf="tournament.isTournamentClosed()" class="max-w-7xl mx-auto bg-amber-50 border border-amber-200 p-4 rounded-lg mb-6 text-center text-amber-800 font-bold">
          This tournament is closed. All data is Read-Only.
      </div>

      <main class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <!-- DASHBOARD TAB -->
        <div *ngIf="activeTab() === 'Dashboard'" class="contents">
             <div class="lg:col-span-4 space-y-6">
                 <div *ngIf="!tournament.isTournamentClosed()" class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 class="font-bold text-slate-800 mb-4">Create Round</h2>
                    <div class="space-y-4">
                      <input [(ngModel)]="newTopic" placeholder="Resolved: (Topic)" class="w-full p-2 border rounded text-sm bg-slate-50">
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
                        <select [(ngModel)]="selectedAffId" class="w-full p-2 border rounded text-sm bg-white"><option *ngFor="let d of tournament.debaters()" [value]="d.id">{{ d.name }}</option></select>
                      </div>
                      <div class="space-y-2">
                        <select [(ngModel)]="selectedNegId" class="w-full p-2 border rounded text-sm bg-white"><option *ngFor="let d of tournament.debaters()" [value]="d.id">{{ d.name }}</option></select>
                      </div>
                      <button (click)="create()" class="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800">Create Matchup</button>
                    </div>
                 </div>
                 
                 <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 class="font-bold text-slate-800 mb-4">Participants</h2>
                    <div class="max-h-64 overflow-y-auto space-y-2">
                         <div *ngFor="let d of tournament.debaters()" class="flex justify-between text-sm p-2 bg-slate-50 rounded">
                             <span>{{ d.name }}</span>
                             <div class="flex gap-2">
                                 <button *ngIf="!tournament.isTournamentClosed()" (click)="toggleStatus(d)">{{ d.status === 'Eliminated' ? '❤️' : '💀' }}</button>
                                 <button *ngIf="!tournament.isTournamentClosed()" (click)="tournament.kickUser(d.id, 'Debater')" class="text-red-500">&times;</button>
                             </div>
                         </div>
                         <div *ngFor="let j of tournament.judges()" class="flex justify-between text-sm p-2 bg-slate-50 rounded">
                             <span>{{ j.name }} (J)</span>
                             <button *ngIf="!tournament.isTournamentClosed()" (click)="tournament.kickUser(j.id, 'Judge')" class="text-red-500">&times;</button>
                         </div>
                    </div>
                 </div>
             </div>
             
             <div class="lg:col-span-8 space-y-6">
                <div class="flex gap-4 mb-4 border-b border-slate-200">
                    <button (click)="activeTab.set('Dashboard')" [class.border-slate-800]="activeTab()==='Dashboard'" class="pb-2 border-b-2 border-transparent font-bold text-sm">Rounds</button>
                    <button (click)="activeTab.set('Bracket')" [class.border-slate-800]="activeTab()==='Bracket'" class="pb-2 border-b-2 border-transparent font-bold text-sm">Bracket</button>
                </div>

                <div *ngFor="let debate of tournament.debates()" class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 mb-4">
                     <div class="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                        <div>
                            <div class="flex items-center gap-3">
                                <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded" [ngClass]="debate.type === 'Elimination' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'">{{ debate.stage }}</span>
                                <h3 class="font-bold text-lg text-slate-800">{{ debate.topic }}</h3>
                                <span *ngIf="debate.status === 'Closed' && getWinner(debate.id) !== 'Pending'" class="bg-yellow-100 text-yellow-800 text-[10px] px-2 py-0.5 rounded font-bold border border-yellow-200">🏆 WINNER: {{ getWinnerName(debate) }}</span>
                            </div>
                            <div class="text-sm text-slate-500 mt-1">{{ debate.affName }} vs {{ debate.negName }}</div>
                        </div>
                        <div class="flex gap-2 items-center" *ngIf="!tournament.isTournamentClosed()">
                            <div class="relative" *ngIf="debate.status === 'Open'">
                                <select #assignSelect (change)="assign(debate.id, assignSelect.value); assignSelect.value=''" class="bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold py-2 px-3 rounded focus:outline-none hover:bg-slate-200 cursor-pointer">
                                    <option value="" disabled selected>+ Add Judge</option>
                                    <option *ngFor="let judge of getUnassignedJudges(debate)" [value]="judge.id">{{ judge.name }}</option>
                                </select>
                            </div>
                            <button *ngIf="debate.status === 'Open'" (click)="tournament.finalizeRound(debate.id)" class="bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded hover:bg-slate-900">Finalize</button>
                            <button (click)="tournament.deleteDebate(debate.id)" class="text-slate-300 hover:text-red-500 p-2" title="Delete Debate"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg></button>
                        </div>
                     </div>
                     <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div *ngFor="let judgeId of debate.judgeIds" class="bg-slate-50 rounded-lg p-3 border border-slate-200 relative group">
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-xs font-bold text-slate-700 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-green-500"></span> {{ getJudgeName(judgeId) }}</span>
                                <button *ngIf="debate.status === 'Open' && !tournament.isTournamentClosed()" (click)="remove(debate.id, judgeId)" class="text-slate-300 hover:text-red-500 font-bold text-xs">Remove</button>
                            </div>
                            <div *ngIf="getResult(debate.id, judgeId) as res; else pending" class="animate-in fade-in bg-white p-2 rounded border border-slate-100 mt-2">
                                <div class="flex justify-between text-xs font-bold mb-1">
                                    <span [class.text-blue-600]="res.decision === 'Aff'" [class.text-red-600]="res.decision === 'Neg'">Voted: {{ res.decision }}</span>
                                </div>
                                <div class="grid grid-cols-2 gap-2 text-center my-1">
                                     <div class="bg-blue-50 rounded px-1"><span class="text-[10px] font-bold text-blue-600">AFF</span><span class="text-sm font-bold text-slate-700 block leading-none">{{ res.affScore }}</span></div>
                                     <div class="bg-red-50 rounded px-1"><span class="text-[10px] font-bold text-red-600">NEG</span><span class="text-sm font-bold text-slate-700 block leading-none">{{ res.negScore }}</span></div>
                                </div>
                            </div>
                            <ng-template #pending>
                                <div class="flex items-center justify-between w-full mt-2 pl-2">
                                    <span class="text-[10px] text-slate-400">Pending...</span>
                                    <button *ngIf="!tournament.isTournamentClosed()" (click)="tournament.sendNudge(judgeId)" class="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200 font-bold flex items-center gap-1">🔔 Nudge</button>
                                </div>
                            </ng-template>
                        </div>
                         <div *ngIf="debate.judgeIds.length === 0" class="col-span-2 text-center py-4 border-2 border-dashed border-slate-100 rounded-lg text-slate-300 text-xs italic">Waiting for judges.</div>
                    </div>
                </div>
             </div>
        </div>

        <!-- BRACKET TAB -->
        <div *ngIf="activeTab() === 'Bracket'" class="lg:col-span-12">
           <div class="flex gap-4 mb-4 border-b border-slate-200">
               <button (click)="activeTab.set('Dashboard')" class="pb-2 border-b-2 border-transparent font-bold text-sm">Rounds</button>
               <button (click)="activeTab.set('Bracket')" class="pb-2 border-b-2 border-slate-800 font-bold text-sm">Bracket</button>
           </div>
           <div class="w-full overflow-x-auto pb-8">
               <div class="flex gap-8 min-w-max">
                  <div *ngFor="let stage of bracketStages" class="w-64 flex-none space-y-4">
                      <h3 class="font-bold text-center text-slate-500 uppercase tracking-widest text-xs mb-4 sticky top-0 bg-slate-100 py-2">{{ stage }}</h3>
                      <div *ngFor="let d of getDebatesForStage(stage)" class="bg-white border border-slate-200 rounded-lg shadow-sm p-3 relative">
                          <div class="text-[10px] text-slate-400 mb-2 truncate font-mono">{{ d.topic }}</div>
                          <div class="space-y-1">
                             <div class="flex justify-between p-1 rounded text-xs font-bold" [class.bg-green-100]="d.status === 'Closed' && getWinner(d.id) === 'Aff'"><span>{{ d.affName }}</span><span *ngIf="d.status === 'Closed' && getWinner(d.id) === 'Aff'">✓</span></div>
                             <div class="flex justify-between p-1 rounded text-xs font-bold" [class.bg-green-100]="d.status === 'Closed' && getWinner(d.id) === 'Neg'"><span>{{ d.negName }}</span><span *ngIf="d.status === 'Closed' && getWinner(d.id) === 'Neg'">✓</span></div>
                          </div>
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
  newTopic = ''; selectedAffId = ''; selectedNegId = '';
  roundType: RoundType = 'Prelim';
  roundNumber = 1; 
  roundStage = 'Quarterfinals'; 
  
  activeTab = signal<'Dashboard' | 'Bracket'>('Dashboard');
  bracketStages = ['Octofinals', 'Quarterfinals', 'Semifinals', 'Finals'];

  create() { 
    const aff = this.tournament.debaters().find(d => d.id === this.selectedAffId);
    const neg = this.tournament.debaters().find(d => d.id === this.selectedNegId);
    let stageName = this.roundType === 'Prelim' ? `Round ${this.roundNumber}` : this.roundStage;
    if (aff && neg) {
      this.tournament.createDebate(this.newTopic, aff.id, aff.name, neg.id, neg.name, this.roundType, stageName);
    }
  }
  
  backToList() {
      this.tournament.tournamentId.set(null); // Clears ID to trigger list view
  }
  
  closeTournament() { if(confirm('Close this tournament?')) this.tournament.closeTournament(this.tournament.tournamentId()!); }
  assign(debateId: string, judgeId: string) { this.tournament.assignJudge(debateId, judgeId); }
  remove(debateId: string, judgeId: string) { this.tournament.removeJudge(debateId, judgeId); }
  toggleStatus(debater: UserProfile) { this.tournament.toggleDebaterStatus(debater.id, debater.status); }
  getDebatesForStage(stage: string) { return this.tournament.debates().filter(d => d.type === 'Elimination' && d.stage === stage); }
  getWinner(debateId: string) { return this.tournament.getWinner(debateId); }
  getWinnerName(debate: Debate) {
     const w = this.tournament.getWinner(debate.id);
     return w === 'Aff' ? debate.affName : (w === 'Neg' ? debate.negName : 'None');
  }
  getJudgeName(id: string) { return this.tournament.judges().find(j => j.id === id)?.name || 'Unknown'; }
  getUnassignedJudges(debate: Debate) { return this.tournament.judges().filter(j => !debate.judgeIds.includes(j.id)); }
  getResult(debateId: string, judgeId: string) { return this.tournament.results().find(r => r.debateId === debateId && r.judgeId === judgeId); }
}