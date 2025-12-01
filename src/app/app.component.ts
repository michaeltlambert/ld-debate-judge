import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimerComponent } from './timer.component';
import { FlowComponent } from './flow.component';
import { BallotComponent } from './ballot.component';
import { GlobalTooltipComponent } from './global-tooltip.component';
import { LoginComponent } from './login.component';
import { AdminComponent } from './admin.component';
import { TournamentService } from './tournament.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, TimerComponent, FlowComponent, BallotComponent, GlobalTooltipComponent, LoginComponent, AdminComponent],
  template: `
    <app-login *ngIf="!tournament.userProfile()" />
    <div *ngIf="tournament.userProfile()" class="min-h-screen bg-slate-50">
      
      <!-- HEADER with Logout -->
      <header *ngIf="!isAdmin()" class="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center sticky top-0 z-50">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">DM</div>
          <div>
            <h1 class="text-sm font-bold text-slate-800 leading-tight">DebateMate</h1>
            <p class="text-[10px] text-slate-500 uppercase tracking-wide font-bold">{{ tournament.userProfile()?.role }} Mode</p>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <div class="text-xs text-right hidden sm:block">
            <!-- Safe navigation to prevent "Object is possibly undefined" errors -->
            <div class="font-bold text-slate-700">{{ tournament.userProfile()?.name }}</div>
            <div class="text-slate-400" *ngIf="isDebater()">Record: {{ getMyRecord().wins }}W - {{ getMyRecord().losses }}L</div>
          </div>
          <button (click)="tournament.logout()" class="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-2 rounded transition-colors" aria-label="Log Out">
            Log Out
          </button>
        </div>
      </header>

      <div *ngFor="let n of tournament.notifications()" class="bg-yellow-500 text-white px-4 py-2 text-center text-sm font-bold flex justify-between items-center sticky top-[60px] z-50 shadow-md animate-in slide-in-from-top">
         <div class="flex items-center gap-2 mx-auto">
           <span>🔔</span>
           <span>{{ n.message }}</span>
         </div>
         <button (click)="tournament.dismissNotification(n.id)" class="hover:bg-yellow-600 p-1 rounded">&times;</button>
      </div>

      <app-admin *ngIf="isAdmin()" />

      <!-- DEBATER / JUDGE VIEW -->
      <div *ngIf="!isAdmin()" class="h-[calc(100vh-64px)] flex flex-col">
        
        <!-- Dashboard -->
        <div *ngIf="!tournament.activeDebateId()" class="p-8 max-w-4xl mx-auto w-full">
          <div *ngIf="isDebater()" class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8 flex items-center justify-around">
              <div class="text-center">
                 <div class="text-3xl font-bold text-green-600">{{ getMyRecord().wins }}</div>
                 <div class="text-xs font-bold text-slate-400 uppercase">Wins</div>
              </div>
              <div class="h-12 w-px bg-slate-100"></div>
              <div class="text-center">
                 <div class="text-3xl font-bold text-red-600">{{ getMyRecord().losses }}</div>
                 <div class="text-xs font-bold text-slate-400 uppercase">Losses</div>
              </div>
          </div>

          <h2 class="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
            {{ isDebater() ? 'Your Debates' : 'Judge Assignments' }}
          </h2>
          
          <div class="grid gap-4">
            <div *ngFor="let debate of tournament.getMyAssignments()" 
                 (click)="tournament.activeDebateId.set(debate.id)"
                 class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all group">
              <div class="flex justify-between">
                <span class="bg-slate-800 text-white text-xs font-bold px-2 py-1 rounded">
                    {{ debate.status === 'Closed' ? 'CLOSED' : 'OPEN ROUND' }}
                </span>
                <span class="text-xs text-slate-400 group-hover:text-blue-600">Click to Open &rarr;</span>
              </div>
              <h3 class="text-xl font-bold text-slate-800 mt-3 mb-2">{{ debate.topic }}</h3>
              <div class="flex items-center gap-4 text-sm text-slate-600">
                <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-blue-500"></span> <strong>Aff:</strong> {{ debate.affName }}</div>
                <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-500"></span> <strong>Neg:</strong> {{ debate.negName }}</div>
              </div>
            </div>
            <div *ngIf="tournament.getMyAssignments().length === 0" class="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
              <p class="text-slate-400">No debates active.</p>
              <p class="text-xs text-slate-300 mt-1">Wait for the administrator.</p>
            </div>
          </div>
          
          <div *ngIf="isDebater() && getMyBallots().length > 0" class="mt-12">
             <h2 class="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Past Ballots & Feedback</h2>
             <div class="space-y-4">
                <div *ngFor="let res of getMyBallots()" class="bg-slate-50 p-4 rounded border border-slate-200">
                   <div class="flex justify-between text-xs font-bold mb-2">
                       <span class="text-slate-600">Judge: {{ res.judgeName }}</span>
                       <span [class.text-blue-600]="res.decision === 'Aff'" [class.text-red-600]="res.decision === 'Neg'">Vote: {{ res.decision }}</span>
                   </div>
                   <p class="text-sm text-slate-600 italic">"{{ res.rfd }}"</p>
                </div>
             </div>
          </div>
        </div>

        <!-- Active Round View -->
        <div *ngIf="tournament.activeDebateId()" class="flex flex-col h-full overflow-hidden">
          <app-timer class="flex-none" />
          <div class="bg-slate-100 px-4 py-1 text-xs text-center border-b border-slate-200 flex justify-between items-center">
             <span class="font-bold text-slate-600">Topic: {{ getCurrentDebate()?.topic }}</span>
             <button (click)="tournament.activeDebateId.set(null)" class="text-red-500 hover:underline">Exit Round</button>
          </div>
          <main class="flex-1 p-4 overflow-hidden relative"><app-flow class="h-full block" /></main>
          <footer class="bg-white border-t border-slate-200 p-2 flex-none z-40">
            <div class="max-w-7xl mx-auto flex justify-between items-center">
              <div class="text-xs text-slate-400"><strong>DebateMate</strong> 2025</div>
              <button (click)="showBallot.set(!showBallot())" class="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-all">
                {{ isDebater() ? 'View Feedback' : 'Score Round' }}
              </button>
            </div>
            <div *ngIf="showBallot()" class="border-t border-slate-100 mt-2 p-4 bg-slate-50 max-h-[60vh] overflow-y-auto"><div class="max-w-3xl mx-auto"><app-ballot /></div></div>
          </footer>
        </div>
      </div>
      <app-global-tooltip />
    </div>
  `
})
export class AppComponent {
  tournament = inject(TournamentService);
  showBallot = signal(false);
  
  isAdmin = computed(() => this.tournament.userRole() === 'Admin');
  isJudge = computed(() => this.tournament.userRole() === 'Judge');
  isDebater = computed(() => this.tournament.userRole() === 'Debater');

  getCurrentDebate() { return this.tournament.debates().find(d => d.id === this.tournament.activeDebateId()); }
  getMyRecord() { return this.tournament.getMyDebaterRecord(); }

  getMyBallots() {
    const uid = this.tournament.userProfile()?.id;
    if (!uid) return [];
    const myDebateIds = this.tournament.debates()
        .filter(d => d.affId === uid || d.negId === uid)
        .map(d => d.id);
    return this.tournament.results().filter(r => myDebateIds.includes(r.debateId));
  }
}