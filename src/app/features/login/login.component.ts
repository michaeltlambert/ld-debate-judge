import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TournamentService } from '../../core/tournament.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div class="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-200">
        <h1 class="text-3xl font-bold text-slate-800 mb-1">Debate<span class="text-blue-600">Mate</span></h1>
        <p class="text-slate-500 mb-6">Tournament Portal</p>
        
        <div *ngIf="errorMsg" class="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm font-bold animate-pulse">
            {{ errorMsg }}
        </div>

        <div class="flex border-b border-slate-200 mb-6">
           <button (click)="tab = 'login'" [class]="tab === 'login' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'" class="flex-1 pb-2 border-b-2 font-bold text-sm transition-colors">Sign In</button>
           <button (click)="tab = 'register'" [class]="tab === 'register' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'" class="flex-1 pb-2 border-b-2 font-bold text-sm transition-colors">Create Account</button>
        </div>

        <div class="space-y-6">
          <div class="space-y-4">
              <div *ngIf="tab === 'register'">
                <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                <input [(ngModel)]="name" class="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                <input [(ngModel)]="email" type="email" class="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
                <input [(ngModel)]="password" type="password" class="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              </div>
              <div *ngIf="tab === 'register'" class="space-y-4">
                  <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1">I am a...</label>
                    <div class="grid grid-cols-3 gap-2">
                      <button (click)="role = 'Debater'" [class]="role === 'Debater' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'" class="p-2 rounded text-xs font-bold transition-all">Debater</button>
                      <button (click)="role = 'Judge'" [class]="role === 'Judge' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'" class="p-2 rounded text-xs font-bold transition-all">Judge</button>
                      <button (click)="role = 'Admin'" [class]="role === 'Admin' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'" class="p-2 rounded text-xs font-bold transition-all">Admin</button>
                    </div>
                  </div>
                  <div *ngIf="role !== 'Admin'">
                     <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Tournament Code (Optional)</label>
                     <input [(ngModel)]="tid" placeholder="Enter code to join immediately" class="w-full p-3 border border-slate-300 rounded-lg text-sm font-mono uppercase">
                  </div>
              </div>
          </div>

          <button (click)="submit()" [disabled]="loading" 
            class="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all cursor-pointer flex justify-center items-center gap-2">
            <span *ngIf="!loading">{{ tab === 'login' ? 'Sign In' : 'Create Account' }}</span>
            <span *ngIf="loading" class="animate-pulse">Processing...</span>
          </button>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  tournament = inject(TournamentService);
  tab: 'login' | 'register' = 'login';
  name = ''; email = ''; password = '';
  role: 'Admin' | 'Judge' | 'Debater' = 'Debater';
  tid = ''; errorMsg = ''; loading = false;

  async submit() {
      this.loading = true; this.errorMsg = '';
      try {
          if (this.tab === 'login') {
              await this.tournament.loginWithEmail(this.email, this.password);
          } else {
              if (!this.name) throw new Error("Name required");
              const targetTid = this.tid ? this.tid.toUpperCase() : null;
              await this.tournament.registerWithEmail(this.email, this.password, this.name, this.role, targetTid);
          }
      } catch (e: any) {
          this.errorMsg = e.message;
      } finally {
          this.loading = false;
      }
  }
}