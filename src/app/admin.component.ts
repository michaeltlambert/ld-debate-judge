import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TournamentService, Debate, RoundType, RoundStage, UserProfile } from './tournament.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-slate-100 p-6">
      <header class="max-w-7xl mx-auto mb-8 flex justify-between items-center">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Tournament Administration</h1>
          <p class="text-slate-500">Welcome, {{ tournament.userProfile()?.name }}</p>
        </div>
        <div class="flex items-center gap-4">
          <button (click)="activeTab.set('Dashboard')" [class]="activeTab() === 'Dashboard' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'" class="px-4 py-2 rounded font-bold text-sm transition-colors">Dashboard</button>
          <button (click)="activeTab.set('Bracket')" [class]="activeTab() === 'Bracket' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'" class="px-4 py-2 rounded font-bold text-sm transition-colors">Bracket</button>
          <div class="bg-white px-4 py-2 rounded-lg shadow-sm border border-blue-200 flex flex-col items-center ml-4">
             <span class="text-[10px] font-bold text-slate-400 uppercase">Code</span>
             <span class="text-xl font-mono font-bold text-blue-600 tracking-widest select-all">{{ tournament.tournamentId() }}</span>
          </div>
          <button (click)="tournament.logout()" class="text-sm font-bold text-red-500 hover:text-red-700 underline ml-4">Log Out</button>
        </div>
      </header>

      <main class="max-w-7xl mx-auto">
        
        <!-- DASHBOARD TAB -->
        <div *ngIf="activeTab() === 'Dashboard'" class="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <!-- LEFT COLUMN -->
            <div class="lg:col-span-4 space-y-6">
              <!-- Create Debate -->
              <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 class="font-bold text-slate-800 mb-4">Create Round</h2>
                <div class="space-y-4">
                  <input [(ngModel)]="newTopic" placeholder="Resolved: (Topic)" class="w-full p-2 border rounded text-sm bg-slate-50">
                  
                  <div class="grid grid-cols-2 gap-2">
                    <select [(ngModel)]="roundType" class="w-full p-2 border rounded text-sm bg-white">
                        <option value="Prelim">Preliminary</option>
                        <option value="Elimination">Elimination</option>
                    </select>
                    
                    <!-- Dynamic Input for Round Number/Stage -->
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
                    <label class="text-xs font-bold text-blue-600 uppercase">Affirmative</label>
                    <select [(ngModel)]="selectedAffId" class="w-full p-2 border rounded text-sm bg-white">
                      <option value="" disabled selected>Select Debater...</option>
                      <option *ngFor="let d of tournament.debaters()" [value]="d.id" [class.text-red-400]="d.status === 'Eliminated'">
                        {{ d.name }} {{ d.status === 'Eliminated' ? '(OUT)' : '' }}
                      </option>
                    </select>
                  </div>
                  <div class="space-y-2">
                    <label class="text-xs font-bold text-red-600 uppercase">Negative</label>
                    <select [(ngModel)]="selectedNegId" class="w-full p-2 border rounded text-sm bg-white">
                      <option value="" disabled selected>Select Debater...</option>
                      <option *ngFor="let d of tournament.debaters()" [value]="d.id" [class.text-red-400]="d.status === 'Eliminated'">
                         {{ d.name }} {{ d.status === 'Eliminated' ? '(OUT)' : '' }}
                      </option>
                    </select>
                  </div>
                  <button (click)="create()" [disabled]="!newTopic || !selectedAffId || !selectedNegId"
                    class="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800 disabled:opacity-50 mt-4 transition-all">
                    Create Matchup
                  </button>
                </div>
              </div>

              <!-- Participants List -->
              <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 class="font-bold text-slate-800 mb-4">Participants</h2>
                <div class="space-y-4">
                  <div>
                    <h3 class="text-xs font-bold text-slate-500 uppercase mb-2 flex justify-between">
                      <span>Judges</span><span class="bg-blue-100 text-blue-800 px-2 rounded">{{ tournament.judges().length }}</span>
                    </h3>
                    <div class="max-h-32 overflow-y-auto space-y-1">
                      <div *ngFor="let j of tournament.judges()" class="flex items-center justify-between p-1.5 bg-slate-50 rounded text-sm">
                        <div class="flex items-center gap-2"><div class="w-2 h-2 bg-green-500 rounded-full"></div> {{ j.name }}</div>
                        <button (click)="tournament.kickUser(j.id, 'Judge')" class="text-slate-300 hover:text-red-500" title="Kick User">&times;</button>
                      </div>
                    </div>
                  </div>
                  <hr class="border-slate-100">
                  <div>
                    <h3 class="text-xs font-bold text-slate-500 uppercase mb-2 flex justify-between">
                      <span>Debaters</span><span class="bg-purple-100 text-purple-800 px-2 rounded">{{ tournament.debaters().length }}</span>
                    </h3>
                    <div class="max-h-32 overflow-y-auto space-y-1">
                      <div *ngFor="let d of tournament.debaters()" class="flex items-center justify-between p-1.5 bg-slate-50 rounded text-sm">
                        <div class="flex items-center gap-2">
                             <div class="w-2 h-2 rounded-full" [class.bg-purple-500]="!d.status || d.status === 'Active'" [class.bg-red-500]="d.status === 'Eliminated'"></div> 
                             <span [class.line-through]="d.status === 'Eliminated'" [class.text-slate-400]="d.status === 'Eliminated'">{{ d.name }}</span>
                        </div>
                        <div class="flex gap-2">
                           <!-- Manual Elimination Toggle -->
                           <button (click)="toggleStatus(d)" class="text-xs hover:scale-110 transition-transform" [title]="d.status === 'Eliminated' ? 'Reinstate' : 'Eliminate'">
                              {{ d.status === 'Eliminated' ? '❤️' : '💀' }}
                           </button>
                           <button (click)="tournament.kickUser(d.id, 'Debater')" class="text-slate-300 hover:text-red-500" title="Kick User">&times;</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- RIGHT COLUMN: Debates -->
            <div class="lg:col-span-8 space-y-6">
                <h2 class="font-bold text-slate-700">Active Rounds</h2>
                <div *ngFor="let debate of tournament.debates()" class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <div class="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                        <div>
                            <div class="flex items-center gap-3">
                                <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded" 
                                      [ngClass]="debate.type === 'Elimination' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'">
                                      {{ debate.stage }}
                                </span>
                                <h3 class="font-bold text-lg text-slate-800">{{ debate.topic }}</h3>
                                <span *ngIf="debate.status === 'Closed'" class="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded font-bold uppercase border border-gray-200">Finalized</span>
                                <span *ngIf="debate.status === 'Closed' && getWinner(debate.id) !== 'Pending'" class="bg-yellow-100 text-yellow-800 text-[10px] px-2 py-0.5 rounded font-bold border border-yellow-200">
                                    🏆 WINNER: {{ getWinnerName(debate) }}
                                </span>
                            </div>
                            <div class="text-sm text-slate-500 mt-1 flex items-center gap-3">
                                <span class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-bold">{{ debate.affName }}</span>
                                <span class="text-slate-300 font-bold">vs</span>
                                <span class="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-bold">{{ debate.negName }}</span>
                            </div>
                        </div>
                        <div class="flex gap-2 items-center">
                            <div class="relative" *ngIf="debate.status === 'Open'">
                                <select #assignSelect (change)="assign(debate.id, assignSelect.value); assignSelect.value = ''" class="bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold py-2 px-3 rounded">
                                    <option value="" disabled selected>+ Add Judge</option>
                                    <option *ngFor="let judge of getUnassignedJudges(debate)" [value]="judge.id">{{ judge.name }}</option>
                                </select>
                            </div>
                            <button *ngIf="debate.status === 'Open'" (click)="tournament.finalizeRound(debate.id)" class="bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded hover:bg-slate-900">Finalize</button>
                            <button (click)="tournament.deleteDebate(debate.id)" class="text-slate-300 hover:text-red-500 p-2" title="Delete Debate">&times;</button>
                        </div>
                    </div>
                    
                    <!-- Judge Status -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div *ngFor="let judgeId of debate.judgeIds" class="bg-slate-50 rounded-lg p-3 border border-slate-200 relative group">
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-xs font-bold text-slate-700 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-green-500"></span> {{ getJudgeName(judgeId) }}</span>
                                <button *ngIf="debate.status === 'Open'" (click)="remove(debate.id, judgeId)" class="text-slate-300 hover:text-red-500 font-bold text-xs">Remove</button>
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
                                    <button (click)="tournament.sendNudge(judgeId)" class="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200 font-bold flex items-center gap-1">🔔 Nudge</button>
                                </div>
                            </ng-template>
                        </div>
                         <div *ngIf="debate.judgeIds.length === 0" class="col-span-2 text-center py-4 border-2 border-dashed border-slate-100 rounded-lg text-slate-300 text-xs italic">Waiting for judges.</div>
                    </div>
                </div>
                <div *ngIf="tournament.debates().length === 0" class="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300"><p class="text-slate-400">No active rounds.</p></div>
            </div>
        </div>

        <!-- BRACKET TAB -->
        <div *ngIf="activeTab() === 'Bracket'" class="w-full overflow-x-auto pb-8">
           <div class="flex gap-8 min-w-max">
              <!-- Columns for Stages -->
              <div *ngFor="let stage of bracketStages" class="w-64 flex-none space-y-4">
                  <h3 class="font-bold text-center text-slate-500 uppercase tracking-widest text-xs mb-4 sticky top-0 bg-slate-100 py-2">{{ stage }}</h3>
                  
                  <div *ngFor="let d of getDebatesForStage(stage)" class="bg-white border border-slate-200 rounded-lg shadow-sm p-3 relative">
                      <!-- Connectors (Visual CSS only for simplicity) -->
                      <div class="text-[10px] text-slate-400 mb-2 truncate font-mono">{{ d.topic }}</div>
                      
                      <!-- Matchup -->
                      <div class="space-y-1">
                         <div class="flex justify-between p-1 rounded text-xs font-bold" 
                              [class.bg-green-100]="d.status === 'Closed' && getWinner(d.id) === 'Aff'"
                              [class.text-green-800]="d.status === 'Closed' && getWinner(d.id) === 'Aff'"
                              [class.opacity-50]="d.status === 'Closed' && getWinner(d.id) === 'Neg'">
                            <span>{{ d.affName }}</span>
                            <span *ngIf="d.status === 'Closed' && getWinner(d.id) === 'Aff'">✓</span>
                         </div>
                         <div class="flex justify-between p-1 rounded text-xs font-bold" 
                              [class.bg-green-100]="d.status === 'Closed' && getWinner(d.id) === 'Neg'"
                              [class.text-green-800]="d.status === 'Closed' && getWinner(d.id) === 'Neg'"
                              [class.opacity-50]="d.status === 'Closed' && getWinner(d.id) === 'Aff'">
                            <span>{{ d.negName }}</span>
                            <span *ngIf="d.status === 'Closed' && getWinner(d.id) === 'Neg'">✓</span>
                         </div>
                      </div>
                  </div>
                  <div *ngIf="getDebatesForStage(stage).length === 0" class="text-center text-xs text-slate-300 italic border-2 border-dashed border-slate-200 rounded p-4">
                      No matches
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
  roundNumber = 1; // For Prelims
  roundStage = 'Quarterfinals'; // For Elimination
  
  activeTab = signal<'Dashboard' | 'Bracket'>('Dashboard');
  bracketStages = ['Octofinals', 'Quarterfinals', 'Semifinals', 'Finals'];

  create() { 
    const aff = this.tournament.debaters().find(d => d.id === this.selectedAffId);
    const neg = this.tournament.debaters().find(d => d.id === this.selectedNegId);
    
    // Determine Stage Name
    let stageName = '';
    if (this.roundType === 'Prelim') {
        stageName = `Round ${this.roundNumber}`;
    } else {
        stageName = this.roundStage;
    }

    if (aff && neg) {
      this.tournament.createDebate(this.newTopic, aff.id, aff.name, neg.id, neg.name, this.roundType, stageName);
      this.newTopic = ''; this.selectedAffId = ''; this.selectedNegId = ''; 
    }
  }

  assign(debateId: string, judgeId: string) { this.tournament.assignJudge(debateId, judgeId); }
  remove(debateId: string, judgeId: string) { this.tournament.removeJudge(debateId, judgeId); }
  getJudgeName(id: string) { return this.tournament.judges().find(j => j.id === id)?.name || 'Unknown'; }
  getUnassignedJudges(debate: Debate) { return this.tournament.judges().filter(j => !debate.judgeIds.includes(j.id)); }
  getResult(debateId: string, judgeId: string) { return this.tournament.results().find(r => r.debateId === debateId && r.judgeId === judgeId); }
  getWinner(debateId: string) { return this.tournament.getWinner(debateId); }
  getWinnerName(debate: Debate) {
     const w = this.tournament.getWinner(debate.id);
     return w === 'Aff' ? debate.affName : (w === 'Neg' ? debate.negName : 'None');
  }
  
  toggleStatus(debater: UserProfile) {
     this.tournament.toggleDebaterStatus(debater.id, debater.status);
  }

  getDebatesForStage(stage: string) {
      return this.tournament.debates().filter(d => d.type === 'Elimination' && d.stage === stage);
  }
}