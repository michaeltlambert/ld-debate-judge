import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TournamentService } from '../../core/tournament.service';

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

         <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
             <h2 class="font-bold text-slate-700 mb-4">Create New Tournament</h2>
             <div class="flex flex-col gap-4">
                <input [(ngModel)]="newName" class="w-full p-3 border rounded-lg text-sm" placeholder="Tournament Name">
                <input [(ngModel)]="newTopic" class="w-full p-3 border rounded-lg text-sm" placeholder="Debate Topic">
                <button (click)="create()" [disabled]="!newName || !newTopic" class="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50">Launch Tournament</button>
             </div>
         </div>

         <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <h2 class="font-bold text-slate-700 mb-4">All Tournaments</h2>
             <div class="space-y-3">
                <div *ngFor="let t of tournament.myTournaments()" class="flex items-center justify-between p-4 border border-slate-100 rounded-lg hover:border-blue-200 transition-all">
                    <div>
                        <div class="flex items-center gap-3">
                            <h3 class="font-bold text-lg text-slate-800">{{ t.name }}</h3>
                            <span class="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-500">{{ t.id }}</span>
                        </div>
                        <div class="text-xs text-slate-500 italic mt-1">{{ t.topic }}</div>
                    </div>
                    <button (click)="select(t.id, t.name)" class="bg-slate-800 text-white px-4 py-2 rounded text-sm font-bold">Manage</button>
                </div>
             </div>
         </div>
      </div>
    </div>
  `
})
export class TournamentListComponent {
  tournament = inject(TournamentService);
  router = inject(Router);
  newName = ''; newTopic = '';

  async create() {
      if (!this.newName || !this.newTopic) return;
      const name = this.newName;
      const tid = await this.tournament.createNewTournament(name, this.newTopic);
      this.select(tid, name);
  }

  select(tid: string, name: string) {
      this.tournament.selectTournament(tid, name);
      this.router.navigate(['/admin', tid]);
  }
}