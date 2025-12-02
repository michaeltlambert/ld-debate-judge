import { Routes } from '@angular/router';
import { LoginComponent } from './features/login/login.component';
import { TournamentListComponent } from './features/dashboard/tournament-list.component';
import { AdminComponent } from './features/admin/admin.component';
import { ProfileComponent } from './features/profile/profile.component';
import { DebateLayoutComponent } from './features/debate/debate-layout.component';
import { ParticipantDashboardComponent } from './features/dashboard/participant-dashboard.component';
import { inject } from '@angular/core';
import { AuthService } from './core/auth.service';
import { Router } from '@angular/router';

const authGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.userProfile()) return true;
  return router.parseUrl('/login');
};

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { 
    path: '', 
    canActivate: [authGuard],
    children: [
      { path: 'tournaments', component: TournamentListComponent },
      { path: 'admin/:tournamentId', component: AdminComponent },
      { path: 'profile', component: ProfileComponent },
      { path: 'dashboard', component: ParticipantDashboardComponent },
      { path: 'tournament/:tournamentId/round/:debateId', component: DebateLayoutComponent }
    ]
  }
];