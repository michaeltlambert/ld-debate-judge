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
          <button (click)="tournament.logout()" class="text-sm font-bold text-red-500 hover:text-red-700 underline">Log Out</button>
          <div class="flex items-center gap-2 text-sm bg-white px-3 py-1 rounded-full shadow-sm border border-slate-200">
            <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span>Live Sync</span>
          </div>
        </div>
      </header>

      <main class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <!-- LEFT COLUMN: Matchmaking (4 Cols) -->
        <div class="lg:col-span-4 space-y-6">
          
          <!-- Create Debate -->
          <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 class="font-bold text-slate-800 mb-4">Matchmaking</h2>
            <div class="space-y-4">
              <input [(ngModel)]="newTopic" placeholder="Resolved: (Topic)" class="w-full p-2 border rounded text-sm bg-slate-50">
              
              <!-- Matchmaking Dropdowns -->
              <div class="space-y-2">
                <label class="text-xs font-bold text-blue-600 uppercase">Affirmative</label>
                <select [(ngModel)]="selectedAffId" class="w-full p-2 border rounded text-sm bg-white">
                  <option value="" disabled selected>Select Debater...</option>
                  <option *ngFor="let d of tournament.debaters()" [value]="d.id">{{ d.name }}</option>
                </select>
              </div>

              <div class="space-y-2">
                <label class="text-xs font-bold text-red-600 uppercase">Negative</label>
                <select [(ngModel)]="selectedNegId" class="w-full p-2 border rounded text-sm bg-white">
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

          <!-- Standings Leaderboard -->
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
          
          <div class="flex justify-between items-end">
            <h2 class="font-bold text-slate-700">Active Rounds</h2>
            <div class="text-xs text-slate-500"><span class="font-bold text-slate-900">{{ tournament.judges().length }}</span> Judges Online</div>
          </div>
          
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
              <div class="relative">
                <select #assignSelect (change)="assign(debate.id, assignSelect.value); assignSelect.value = ''" 
                  class="bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold py-2 px-3 rounded focus:outline-none hover:bg-slate-200 cursor-pointer">
                  <option value="" disabled selected>+ Add Judge</option>
                  <option *ngFor="let judge of getUnassignedJudges(debate)" [value]="judge.id">{{ judge.name }}</option>
                </select>
              </div>
            </div>

            <!-- Judge Status Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div *ngFor="let judgeId of debate.judgeIds" class="bg-slate-50 rounded-lg p-3 border border-slate-200 relative group">
                <div class="flex justify-between items-center mb-1">
                  <span class="text-xs font-bold text-slate-700 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-green-500"></span> {{ getJudgeName(judgeId) }}
                  </span>
                  <button (click)="remove(debate.id, judgeId)" class="text-slate-300 hover:text-red-500 font-bold text-xs">Remove</button>
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
    // Find names from the IDs
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