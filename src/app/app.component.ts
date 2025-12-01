import { Component, signal, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimerComponent } from './timer.component';
import { FlowComponent } from './flow.component';
import { BallotComponent } from './ballot.component';
import { GlobalTooltipComponent } from './global-tooltip.component';
import { LoginComponent } from './login.component';
import { AdminComponent } from './admin.component';
import { ProfileComponent } from './profile.component';
import { TournamentListComponent } from './tournament-list.component';
import { TournamentService } from './tournament.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, TimerComponent, FlowComponent, BallotComponent, GlobalTooltipComponent, LoginComponent, AdminComponent, ProfileComponent, TournamentListComponent],
  template: `
    <!-- 1. NO USER -> LOGIN -->
    <app-login *ngIf="!tournament.userProfile()" />
    
    <!-- 2. LOGGED IN -->
    <div *ngIf="tournament.userProfile()" class="min-h-screen bg-slate-50">
      
      <!-- 2A. ADMIN & NO TOURNAMENT SELECTED -> LIST -->
      <app-tournament-list *ngIf="isAdmin() && !tournament.tournamentId()" />

      <!-- 2B. ADMIN & TOURNAMENT SELECTED -> DASHBOARD -->
      <app-admin *ngIf="isAdmin() && tournament.tournamentId()" />

      <!-- 2C. PARTICIPANT VIEW -->
      <div *ngIf="!isAdmin()">
          <!-- Header -->
          <header class="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center sticky top-0 z-50">
            <div class="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" (click)="showProfile.set(false)">
              <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">DM</div>
              <div>
                <h1 class="text-sm font-bold text-slate-800 leading-tight">DebateMate</h1>
                <p class="text-[10px] text-slate-500 uppercase tracking-wide font-bold">{{ tournament.userProfile()?.role }} Mode</p>
              </div>
            </div>
            <div class="flex items-center gap-4">
              <!-- Profile Trigger -->
              <button (click)="showProfile.set(true)" class="flex items-center gap-2 text-right hover:bg-slate-50 px-2 py-1 rounded transition-colors">
                <div class="hidden sm:block">
                   <div class="text-xs font-bold text-slate-700">{{ tournament.userProfile()?.name }}</div>
                   <div class="text-[10px] text-slate-400">View Profile</div>
                </div>
                <img [src]="tournament.userProfile()?.photoURL || 'https://ui-avatars.com/api/?name=' + tournament.userProfile()?.name" class="w-8 h-8 rounded-full border border-slate-200">
              </button>
              <button (click)="tournament.logout()" class="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-2 rounded transition-colors" aria-label="Log Out">
                Log Out
              </button>
            </div>
          </header>

          <div *ngFor="let n of tournament.notifications()" class="bg-yellow-500 text-white px-4 py-2 text-center text-sm font-bold flex justify-between items-center sticky top-[60px] z-50 shadow-md animate-in slide-in-from-top">
             <div class="flex items-center gap-2 mx-auto"><span>🔔</span><span>{{ n.message }}</span></div>
             <button (click)="tournament.dismissNotification(n.id)" class="hover:bg-yellow-600 p-1 rounded">&times;</button>
          </div>

          <!-- ROUTING -->
          <app-profile *ngIf="showProfile() || (!isAdmin() && !tournament.tournamentId())" />

          <div *ngIf="!showProfile() && tournament.tournamentId()" class="h-[calc(100vh-64px)] flex flex-col">
             <div *ngIf="!tournament.activeDebateId()" class="p-8 max-w-4xl mx-auto w-full">
                  <h2 class="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Your Assignments</h2>
                  <div class="grid gap-4">
                    <div *ngFor="let debate of tournament.getMyAssignments()" (click)="tournament.activeDebateId.set(debate.id)"
                         class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all group">
                      <div class="flex justify-between">
                        <span class="bg-slate-800 text-white text-xs font-bold px-2 py-1 rounded">{{ debate.status === 'Closed' ? 'CLOSED' : 'OPEN ROUND' }}</span>
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
             </div>

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
                      <button (click)="showBallot.set(!showBallot())" class="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-all">{{ isDebater() ? 'View Feedback' : 'Score Round' }}</button>
                    </div>
                    <div *ngIf="showBallot()" class="border-t border-slate-100 mt-2 p-4 bg-slate-50 max-h-[60vh] overflow-y-auto"><div class="max-w-3xl mx-auto"><app-ballot /></div></div>
                  </footer>
             </div>
          </div>
      </div>
      <app-global-tooltip />
    </div>
  `
})
export class AppComponent {
  tournament = inject(TournamentService);
  showBallot = signal(false);
  showProfile = signal(false);
  
  isAdmin = computed(() => this.tournament.userRole() === 'Admin');
  isJudge = computed(() => this.tournament.userRole() === 'Judge');
  isDebater = computed(() => this.tournament.userRole() === 'Debater');

  constructor() {
     // Auto-redirect to profile if no tournament ID is set for non-admins
     effect(() => {
        const user = this.tournament.userProfile();
        if (user && !this.isAdmin() && !this.tournament.tournamentId()) {
            this.showProfile.set(true);
        }
     }, { allowSignalWrites: true });
  }

  getCurrentDebate() { return this.tournament.debates().find(d => d.id === this.tournament.activeDebateId()); }
}