import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TournamentService, Debate } from './tournament.service';

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
          <button (click)="tournament.logout()" class="text-sm font-bold text-red-500 hover:text-red-700 underline" aria-label="Log Out">Log Out</button>
          <div class="flex items-center gap-2 text-sm bg-white px-3 py-1 rounded-full shadow-sm border border-slate-200">
            <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span>Live Sync Active</span>
          </div>
        </div>
      </header>

      <main class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <!-- LEFT COLUMN: Matchmaking & Participants -->
        <div class="lg:col-span-4 space-y-6">
          
          <!-- Create Debate -->
          <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 class="font-bold text-slate-800 mb-4">Matchmaking</h2>
            <div class="space-y-4">
              <input [(ngModel)]="newTopic" placeholder="Resolved: (Topic)" class="w-full p-2 border rounded text-sm bg-slate-50" aria-label="Debate Topic">
              
              <div class="space-y-2">
                <label class="text-xs font-bold text-blue-600 uppercase">Affirmative</label>
                <select [(ngModel)]="selectedAffId" class="w-full p-2 border rounded text-sm bg-white" aria-label="Select Affirmative Debater">
                  <option value="" disabled selected>Select Debater...</option>
                  <option *ngFor="let d of tournament.debaters()" [value]="d.id">{{ d.name }}</option>
                </select>
              </div>

              <div class="space-y-2">
                <label class="text-xs font-bold text-red-600 uppercase">Negative</label>
                <select [(ngModel)]="selectedNegId" class="w-full p-2 border rounded text-sm bg-white" aria-label="Select Negative Debater">
                  <option value="" disabled selected>Select Debater...</option>
                  <option *ngFor="let d of tournament.debaters()" [value]="d.id">{{ d.name }}</option>
                </select>
              </div>

              <button (click)="create()" [disabled]="!newTopic || !selectedAffId || !selectedNegId"
                class="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800 disabled:opacity-50 mt-4 transition-all">
                Create Matchup
              </button>
            </div>
          </div>

          <!-- Logged In Participants -->
          <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 class="font-bold text-slate-800 mb-4">Logged In Participants</h2>
            
            <div class="space-y-4">
              <div>
                <h3 class="text-xs font-bold text-slate-500 uppercase mb-2 flex justify-between">
                  <span>Judges</span>
                  <span class="bg-blue-100 text-blue-800 px-2 rounded">{{ tournament.judges().length }}</span>
                </h3>
                <div class="max-h-32 overflow-y-auto space-y-1">
                  <div *ngFor="let j of tournament.judges()" class="flex items-center gap-2 p-1.5 bg-slate-50 rounded text-sm">
                    <div class="w-2 h-2 bg-green-500 rounded-full"></div> {{ j.name }}
                  </div>
                  <div *ngIf="tournament.judges().length === 0" class="text-xs text-slate-400 italic">No judges online.</div>
                </div>
              </div>

              <hr class="border-slate-100">

              <div>
                <h3 class="text-xs font-bold text-slate-500 uppercase mb-2 flex justify-between">
                  <span>Debaters</span>
                  <span class="bg-purple-100 text-purple-800 px-2 rounded">{{ tournament.debaters().length }}</span>
                </h3>
                <div class="max-h-32 overflow-y-auto space-y-1">
                  <div *ngFor="let d of tournament.debaters()" class="flex items-center gap-2 p-1.5 bg-slate-50 rounded text-sm">
                    <div class="w-2 h-2 bg-purple-500 rounded-full"></div> {{ d.name }}
                  </div>
                  <div *ngIf="tournament.debaters().length === 0" class="text-xs text-slate-400 italic">No debaters online.</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Standings -->
          <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 class="font-bold text-slate-800 mb-4">Leaderboard</h2>
            <div class="overflow-hidden rounded-lg border border-slate-100">
              <table class="w-full text-sm">
                <thead class="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                  <tr><th class="p-2 text-left">Debater</th><th class="p-2 text-center">W</th><th class="p-2 text-center">L</th></tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr *ngFor="let s of tournament.standings()">
                    <td class="p-2 font-medium text-slate-700">{{ s.name }}</td>
                    <td class="p-2 text-center font-bold text-green-600">{{ s.wins }}</td>
                    <td class="p-2 text-center font-bold text-red-500">{{ s.losses }}</td>
                  </tr>
                  <tr *ngIf="tournament.standings().length === 0"><td colspan="3" class="p-4 text-center text-xs text-slate-400 italic">No results yet.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN: Active Debates & Judges (8 Cols) -->
        <div class="lg:col-span-8 space-y-6">
          <h2 class="font-bold text-slate-700">Active Rounds</h2>
          
          <div *ngFor="let debate of tournament.debates()" class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div class="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 class="font-bold text-lg text-slate-800">{{ debate.topic }}</h3>
                <div class="text-sm text-slate-500 mt-1 flex items-center gap-3">
                  <span class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-bold">{{ debate.affName }}</span>
                  <span class="text-slate-300 font-bold">vs</span>
                  <span class="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-bold">{{ debate.negName }}</span>
                </div>
              </div>
              <div class="flex gap-2 items-center">
                <div class="relative">
                    <select #assignSelect (change)="assign(debate.id, assignSelect.value); assignSelect.value = ''" 
                      class="bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold py-2 px-3 rounded focus:outline-none hover:bg-slate-200 cursor-pointer" aria-label="Assign Judge">
                      <option value="" disabled selected>+ Add Judge</option>
                      <option *ngFor="let judge of getUnassignedJudges(debate)" [value]="judge.id">{{ judge.name }}</option>
                    </select>
                </div>
                <button (click)="tournament.deleteDebate(debate.id)" class="text-slate-300 hover:text-red-500 p-2" title="Delete Debate">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                </button>
              </div>
            </div>

            <!-- Judge Status Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div *ngFor="let judgeId of debate.judgeIds" class="bg-slate-50 rounded-lg p-3 border border-slate-200 relative group">
                <div class="flex justify-between items-center mb-1">
                  <span class="text-xs font-bold text-slate-700 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-green-500"></span> {{ getJudgeName(judgeId) }}
                  </span>
                  <button (click)="remove(debate.id, judgeId)" class="text-slate-300 hover:text-red-500 font-bold text-xs" aria-label="Remove Judge">Remove</button>
                </div>
                
                <div *ngIf="getResult(debate.id, judgeId) as res; else pending" class="animate-in fade-in bg-white p-2 rounded border border-slate-100 mt-2">
                  <div class="flex justify-between text-xs font-bold mb-1">
                    <span [class.text-blue-600]="res.decision === 'Aff'" [class.text-red-600]="res.decision === 'Neg'">Voted: {{ res.decision }}</span>
                    <span class="text-slate-400">{{ res.affScore }}-{{ res.negScore }}</span>
                  </div>
                  <div class="text-[10px] text-slate-500 italic truncate">"{{ res.rfd }}"</div>
                </div>
                <ng-template #pending>
                  <div class="text-[10px] text-slate-400 mt-2 pl-4">Waiting for ballot...</div>
                </ng-template>
              </div>
              <div *ngIf="debate.judgeIds.length === 0" class="col-span-2 text-center py-4 border-2 border-dashed border-slate-100 rounded-lg text-slate-300 text-xs italic">
                Waiting for judge assignment.
              </div>
            </div>
          </div>
          
          <div *ngIf="tournament.debates().length === 0" class="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300"><p class="text-slate-400">No active rounds.</p></div>
        </div>
      </main>
    </div>
  `
})
export class AdminComponent {
  tournament = inject(TournamentService);
  newTopic = ''; 
  selectedAffId = '';
  selectedNegId = '';

  create() { 
    const aff = this.tournament.debaters().find(d => d.id === this.selectedAffId);
    const neg = this.tournament.debaters().find(d => d.id === this.selectedNegId);
    if (aff && neg) {
      this.tournament.createDebate(this.newTopic, aff.id, aff.name, neg.id, neg.name);
      this.newTopic = ''; this.selectedAffId = ''; this.selectedNegId = ''; 
    }
  }

  assign(debateId: string, judgeId: string) { this.tournament.assignJudge(debateId, judgeId); }
  remove(debateId: string, judgeId: string) { this.tournament.removeJudge(debateId, judgeId); }
  getJudgeName(id: string) { return this.tournament.judges().find(j => j.id === id)?.name || 'Unknown'; }
  getUnassignedJudges(debate: Debate) { return this.tournament.judges().filter(j => !debate.judgeIds.includes(j.id)); }
  getResult(debateId: string, judgeId: string) { return this.tournament.results().find(r => r.debateId === debateId && r.judgeId === judgeId); }
}