import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TournamentService } from './tournament.service';

@Component({
  selector: 'app-tournament-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-slate-100 p-8">
      <div class="max-w-4xl mx-auto">
         <header class="flex justify-between items-center mb-8">
            <div>
                <h1 class="text-3xl font-bold text-slate-800">Tournament Portal</h1>
                <p class="text-slate-500">Select an event to manage</p>
            </div>
            <button (click)="tournament.logout()" class="text-red-500 font-bold hover:underline">Log Out</button>
         </header>

         <!-- CREATE NEW -->
         <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
             <h2 class="font-bold text-slate-700 mb-4">Create New Tournament</h2>
             <div class="flex gap-4">
                <input [(ngModel)]="newName" class="flex-1 p-3 border rounded-lg text-sm" placeholder="Tournament Name (e.g. Winter Classic 2025)">
                <button (click)="create()" [disabled]="!newName" class="bg-blue-600 text-white px-6 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50">Launch</button>
             </div>
         </div>

         <!-- LIST -->
         <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <h2 class="font-bold text-slate-700 mb-4">All Tournaments</h2>
             <div *ngIf="tournament.myTournaments().length === 0" class="text-center py-8 text-slate-400 italic">No tournaments found. Create one above.</div>
             
             <div class="space-y-3">
                <div *ngFor="let t of tournament.myTournaments()" class="flex items-center justify-between p-4 border border-slate-100 rounded-lg hover:border-blue-200 transition-all group">
                    <div>
                        <div class="flex items-center gap-3">
                            <h3 class="font-bold text-lg text-slate-800">{{ t.name || 'Untitled Event' }}</h3>
                            <span class="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-500">{{ t.id }}</span>
                        </div>
                        <div class="text-xs text-slate-400 mt-1">Created: {{ t.createdAt | date }}</div>
                    </div>
                    
                    <div class="flex items-center gap-4">
                        <span class="text-xs font-bold uppercase px-2 py-1 rounded" 
                              [class.bg-green-100]="t.status === 'Active'" [class.text-green-700]="t.status === 'Active'"
                              [class.bg-gray-100]="t.status === 'Closed'" [class.text-gray-500]="t.status === 'Closed'">
                              {{ t.status }}
                        </span>
                        <button (click)="select(t.id, t.name)" class="bg-slate-800 text-white px-4 py-2 rounded text-sm font-bold hover:bg-slate-900">
                            {{ t.status === 'Closed' ? 'View Archive' : 'Manage' }}
                        </button>
                    </div>
                </div>
             </div>
         </div>
      </div>
    </div>
  `
})
export class TournamentListComponent {
  tournament = inject(TournamentService);
  newName = '';

  async create() {
      if (!this.newName) return;
      await this.tournament.createNewTournament(this.newName);
      this.newName = '';
  }

  select(tid: string, name: string) {
      this.tournament.selectTournament(tid, name);
  }
}