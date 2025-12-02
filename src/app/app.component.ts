import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink } from '@angular/router';
import { GlobalTooltipComponent } from './ui/common/global-tooltip.component';
import { TournamentService } from './core/tournament.service';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, GlobalTooltipComponent],
  template: `
    <app-global-tooltip />

    <div class="min-h-screen bg-slate-50">
      <header *ngIf="auth.userProfile()" class="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center sticky top-0 z-50">
        <a routerLink="/" class="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
          <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">DM</div>
          <div>
            <h1 class="text-sm font-bold text-slate-800 leading-tight">DebateMate</h1>
            <p class="text-[10px] text-slate-500 uppercase tracking-wide font-bold">{{ auth.userProfile()?.role }} Mode</p>
          </div>
        </a>
        
        <div class="flex items-center gap-4">
          <a routerLink="/profile" class="flex items-center gap-2 text-right hover:bg-slate-50 px-2 py-1 rounded transition-colors">
            <div class="hidden sm:block">
                <div class="text-xs font-bold text-slate-700">{{ auth.userProfile()?.name }}</div>
                <div class="text-[10px] text-slate-400">View Profile</div>
            </div>
            <img [src]="auth.userProfile()?.photoURL || 'https://ui-avatars.com/api/?name=' + auth.userProfile()?.name" class="w-8 h-8 rounded-full border border-slate-200">
          </a>
          <button (click)="auth.logout()" class="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-2 rounded transition-colors">Log Out</button>
        </div>
      </header>

      <div *ngFor="let n of tournament.notifications()" class="bg-yellow-500 text-white px-4 py-2 text-center text-sm font-bold flex justify-between items-center sticky top-[60px] z-50 shadow-md">
          <div class="flex items-center gap-2 mx-auto"><span>🔔</span><span>{{ n.message }}</span></div>
          <a *ngIf="n.debateId" [routerLink]="['/tournament', n.tournamentId, 'round', n.debateId]" (click)="tournament.dismissNotification(n.id)" class="bg-white text-yellow-600 px-2 py-0.5 rounded text-xs hover:bg-slate-100 ml-2">Go to Round</a>
          <button (click)="tournament.dismissNotification(n.id)" class="hover:bg-yellow-600 p-1 rounded">&times;</button>
      </div>

      <router-outlet></router-outlet>
    </div>
  `
})
export class AppComponent {
  auth = inject(AuthService);
  tournament = inject(TournamentService);
}