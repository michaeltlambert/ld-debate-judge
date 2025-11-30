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
        <h1 class="text-3xl font-bold text-slate-800 mb-2">Debate<span class="text-blue-600">Mate</span></h1>
        <p class="text-slate-500 mb-8">Lincoln-Douglas Adjudication System</p>
        <div class="space-y-6">
          <div>
            <label class="block text-sm font-bold text-slate-700 mb-2">Your Name</label>
            <input [(ngModel)]="name" type="text" placeholder="e.g. Jane Doe" 
              class="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-bold text-slate-700 mb-2">Role</label>
            <div class="grid grid-cols-3 gap-2">
              <button (click)="role = 'Debater'" 
                [class]="role === 'Debater' ? 'bg-purple-600 text-white ring-2 ring-purple-300' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'"
                class="p-3 rounded-xl font-bold transition-all border border-slate-200 text-sm">Debater</button>
              
              <button (click)="role = 'Judge'" 
                [class]="role === 'Judge' ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'"
                class="p-3 rounded-xl font-bold transition-all border border-slate-200 text-sm">Judge</button>
              
              <button (click)="role = 'Admin'" 
                [class]="role === 'Admin' ? 'bg-slate-800 text-white ring-2 ring-slate-400' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'"
                class="p-3 rounded-xl font-bold transition-all border border-slate-200 text-sm">Admin</button>
            </div>
          </div>
          <button (click)="enter()" [disabled]="!name" 
            class="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all">
            Enter Tournament
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
  enter() { if (this.name) this.tournament.setProfile(this.name, this.role); }
}