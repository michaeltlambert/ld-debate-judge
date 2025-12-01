import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TournamentService } from './tournament.service';

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

        <div class="space-y-5">
          <!-- Role Selection -->
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-2">I am a...</label>
            <div class="grid grid-cols-3 gap-2" role="group">
              <button (click)="role = 'Debater'" 
                [class]="role === 'Debater' ? 'bg-purple-600 text-white ring-2 ring-purple-300' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'"
                class="p-2 rounded-lg font-bold text-sm transition-all border border-slate-200 text-sm">Debater</button>
              <button (click)="role = 'Judge'" 
                [class]="role === 'Judge' ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'"
                class="p-2 rounded-lg font-bold text-sm transition-all border border-slate-200 text-sm">Judge</button>
              <button (click)="role = 'Admin'" 
                [class]="role === 'Admin' ? 'bg-slate-800 text-white ring-2 ring-slate-400' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'"
                class="p-2 rounded-lg font-bold text-sm transition-all border border-slate-200 text-sm">Admin</button>
            </div>
          </div>

          <!-- Name Input -->
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Your Name</label>
            <input [(ngModel)]="name" type="text" placeholder="e.g. Jane Doe" 
              class="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>

          <!-- Tournament Actions -->
          <div class="border-t border-slate-100 pt-4 mt-4">
            <!-- Admin Create/Join -->
            <div *ngIf="role === 'Admin'">
              <div class="flex items-center gap-2 mb-3">
                <button (click)="adminMode = 'Create'; tid = ''" 
                   [class]="adminMode === 'Create' ? 'text-blue-600 underline' : 'text-slate-400'" class="text-sm font-bold">Create New</button>
                <span class="text-slate-300">|</span>
                <button (click)="adminMode = 'Manage'" 
                   [class]="adminMode === 'Manage' ? 'text-blue-600 underline' : 'text-slate-400'" class="text-sm font-bold">Manage Existing</button>
              </div>
              
              <div *ngIf="adminMode === 'Manage'">
                 <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Tournament Code</label>
                 <input [(ngModel)]="tid" type="text" placeholder="e.g. A1B2C3" 
                   class="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono uppercase">
              </div>
              <div *ngIf="adminMode === 'Create'" class="text-xs text-slate-500 bg-blue-50 p-3 rounded">
                 A unique 6-digit code will be generated for your new tournament.
              </div>
            </div>

            <!-- Participant Join -->
            <div *ngIf="role !== 'Admin'">
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Tournament Code</label>
              <input [(ngModel)]="tid" type="text" placeholder="Get this from Admin" 
                class="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono uppercase">
            </div>
          </div>

          <button (click)="enter()" [disabled]="(!name || (role !== 'Admin' && !tid) || (role==='Admin' && adminMode === 'Manage' && !tid)) || loading" 
            class="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all cursor-pointer flex justify-center">
            <span *ngIf="!loading">{{ (role === 'Admin' && adminMode === 'Create') ? 'Launch Tournament' : 'Enter Tournament' }}</span>
            <span *ngIf="loading" class="animate-pulse">Connecting...</span>
          </button>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  tournament = inject(TournamentService);
  name = '';
  role: 'Admin' | 'Judge' | 'Debater' = 'Debater';
  adminMode: 'Create' | 'Manage' = 'Create';
  tid = '';
  errorMsg = '';
  loading = false;

  async enter() {
    this.errorMsg = '';
    
    // Auto-generate ID for new tournaments
    let targetTid = this.tid.toUpperCase();
    if (this.role === 'Admin' && this.adminMode === 'Create') {
        targetTid = Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    if (this.name && targetTid) {
      this.loading = true;
      try {
        await this.tournament.setProfile(this.name, this.role, targetTid);
      } catch (e: any) {
        this.errorMsg = e.message;
      } finally {
        this.loading = false;
      }
    }
  }
}