import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TournamentService } from '../../core/tournament.service';
import { FlowComponent } from '../../ui/flow/flow.component';
import { RoundResult } from '../../core/models';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowComponent],
  template: `
    <div class="p-6 max-w-6xl mx-auto">
      <h1 class="text-2xl font-bold text-slate-800 mb-6">My Profile</h1>
      
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div class="lg:col-span-4 space-y-6">
            <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 text-center h-fit">
               <h2 class="text-xl font-bold text-slate-800">{{ profile()?.name }}</h2>
               <p class="text-sm text-slate-500 mb-4">{{ profile()?.email }}</p>
               <span class="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold uppercase">{{ profile()?.role }}</span>
               
               <div class="mt-6 border-t border-slate-100 pt-4 text-left space-y-3">
                 <h3 class="text-xs font-bold text-slate-400 uppercase">Contact Info</h3>
                 <input [(ngModel)]="editPhone" class="w-full text-sm border-b border-slate-200 outline-none py-1" placeholder="Add phone number">
                 <input [(ngModel)]="editAddress" class="w-full text-sm border-b border-slate-200 outline-none py-1" placeholder="Add address">
                 <button (click)="saveContact()" class="w-full bg-blue-600 text-white text-xs font-bold py-2 rounded mt-2">Save Changes</button>
               </div>
            </div>

            <div class="bg-blue-50 p-6 rounded-xl border border-blue-200">
               <h3 class="text-lg font-bold text-blue-800 mb-2">Join / Switch Tournament</h3>
               <div class="flex gap-2">
                  <input [(ngModel)]="joinCode" class="flex-1 p-2 border border-blue-300 rounded font-mono uppercase" placeholder="CODE">
                  <button (click)="join()" class="bg-blue-600 text-white px-4 py-2 rounded font-bold">Join</button>
               </div>
               <p *ngIf="joinError" class="text-xs text-red-500 mt-2 font-bold">{{ joinError }}</p>
           </div>
        </div>

        <div class="lg:col-span-8 space-y-6">
           <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 class="text-lg font-bold text-slate-700 mb-4">Performance Stats</h3>
              <div class="grid grid-cols-3 gap-4 text-center">
                 <div class="p-4 bg-slate-50 rounded-lg">
                    <div class="text-3xl font-bold text-slate-800">{{ myStats().wins }}</div>
                    <div class="text-xs font-bold text-slate-500 uppercase">Wins</div>
                 </div>
                 <div class="p-4 bg-slate-50 rounded-lg">
                    <div class="text-3xl font-bold text-slate-800">{{ myStats().losses }}</div>
                    <div class="text-xs font-bold text-slate-500 uppercase">Losses</div>
                 </div>
                 <div class="p-4 bg-slate-50 rounded-lg">
                    <div class="text-3xl font-bold text-slate-800">{{ filteredHistory().length }}</div>
                    <div class="text-xs font-bold text-slate-500 uppercase">Rounds</div>
                 </div>
              </div>
           </div>

           <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 class="text-lg font-bold text-slate-700 mb-4">Match History</h3>
              <div class="space-y-3">
                 <div *ngFor="let item of filteredHistory()" (click)="viewingFlow.set(item)" class="border-b border-slate-100 pb-3 cursor-pointer hover:bg-slate-50 p-2 rounded transition-colors">
                    <div class="flex justify-between text-sm mb-1">
                        <span class="font-bold text-slate-700">Round ID: {{ item.debateId.substring(0,6) }}</span>
                        <span class="text-xs text-slate-400">{{ item.timestamp | date:'short' }}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <div class="text-xs text-slate-500 italic truncate">"{{ item.rfd }}"</div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <div *ngIf="viewingFlow()" class="fixed inset-0 bg-black/80 z-50 flex flex-col p-4">
          <div class="bg-white rounded-t-xl p-4 flex justify-between items-center shrink-0">
             <div>
                 <h2 class="font-bold text-lg">Historical Record</h2>
                 <p class="text-xs text-slate-500">Judge: {{ viewingFlow()?.judgeName }}</p>
             </div>
             <button (click)="viewingFlow.set(null)" class="bg-slate-100 px-4 py-2 rounded-lg font-bold text-sm">Close</button>
          </div>
          <div class="bg-slate-100 flex-1 overflow-hidden rounded-b-xl relative">
              <app-flow [viewOnlyFlow]="{ args: viewingFlow()?.flow || [], frameworks: viewingFlow()?.frameworks || {} }" class="h-full block" />
          </div>
      </div>
    </div>
  `
})
export class ProfileComponent {
  tournament = inject(TournamentService);
  profile = this.tournament.userProfile;
  
  editPhone = this.profile()?.phone || '';
  editAddress = this.profile()?.address || '';
  joinCode = ''; joinError = '';
  
  selectedTournamentId = signal<string | null>(null);
  viewingFlow = signal<RoundResult | null>(null);

  myStats() { return this.tournament.getMyDebaterRecord(); }

  getHistory() {
     const uid = this.profile()?.id;
     if (!uid) return [];
     if (this.profile()?.role === 'Judge') {
         return this.tournament.results().filter(r => r.judgeId === uid);
     } else {
         const myDebates = this.tournament.debates().filter(d => d.affId === uid || d.negId === uid).map(d => d.id);
         return this.tournament.results().filter(r => myDebates.includes(r.debateId));
     }
  }
  
  filteredHistory = computed(() => {
      const hist = this.getHistory();
      const filter = this.selectedTournamentId();
      if (filter) return hist.filter(h => h.tournamentId === filter);
      return hist;
  });

  async join() {
      if (!this.joinCode) return;
      this.joinError = '';
      try {
          await this.tournament.joinTournament(this.joinCode.toUpperCase());
          alert("Successfully joined tournament!");
          this.joinCode = '';
      } catch (e: any) {
          this.joinError = e.message;
      }
  }

  saveContact() {
      this.tournament.updatePersonalInfo({ phone: this.editPhone, address: this.editAddress });
      alert('Profile updated!');
  }
}