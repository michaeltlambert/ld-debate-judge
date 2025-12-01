import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TournamentService, UserProfile, RoundResult } from './tournament.service';
import { FlowComponent } from './flow.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowComponent],
  template: `
    <div class="p-6 max-w-6xl mx-auto">
      <h1 class="text-2xl font-bold text-slate-800 mb-6">My Profile</h1>
      
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <!-- Left: Identity & Contact -->
        <div class="lg:col-span-4 space-y-6">
            <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 text-center h-fit">
               <img [src]="profile()?.photoURL || 'https://ui-avatars.com/api/?name=' + profile()?.name" class="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-slate-100 shadow-inner">
               <h2 class="text-xl font-bold text-slate-800">{{ profile()?.name }}</h2>
               <p class="text-sm text-slate-500 mb-4">{{ profile()?.email }}</p>
               <span class="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold uppercase">{{ profile()?.role }}</span>
               
               <div class="mt-6 border-t border-slate-100 pt-4 text-left space-y-3">
                 <h3 class="text-xs font-bold text-slate-400 uppercase">Contact Info</h3>
                 <div>
                    <label class="text-[10px] text-slate-400 font-bold block">Phone</label>
                    <input [(ngModel)]="editPhone" class="w-full text-sm border-b border-slate-200 focus:border-blue-500 outline-none py-1" placeholder="Add phone number">
                 </div>
                 <div>
                    <label class="text-[10px] text-slate-400 font-bold block">Address</label>
                    <input [(ngModel)]="editAddress" class="w-full text-sm border-b border-slate-200 focus:border-blue-500 outline-none py-1" placeholder="Add address">
                 </div>
                 <button (click)="saveContact()" class="w-full bg-blue-600 text-white text-xs font-bold py-2 rounded mt-2 hover:bg-blue-700">Save Changes</button>
               </div>
            </div>

            <!-- Join/Switch Tournament -->
            <div class="bg-blue-50 p-6 rounded-xl border border-blue-200">
               <h3 class="text-lg font-bold text-blue-800 mb-2">Join / Switch Tournament</h3>
               <p class="text-sm text-blue-600 mb-4">Enter a 6-digit code to join a new tournament.</p>
               <div class="flex gap-2">
                  <input [(ngModel)]="joinCode" class="flex-1 p-2 border border-blue-300 rounded font-mono uppercase" placeholder="CODE">
                  <button (click)="join()" class="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700">Join</button>
               </div>
               <p *ngIf="joinError" class="text-xs text-red-500 mt-2 font-bold">{{ joinError }}</p>
           </div>
        </div>

        <!-- Right: History & Stats -->
        <div class="lg:col-span-8 space-y-6">
           <!-- Stats -->
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
                    <div class="text-3xl font-bold text-slate-800">{{ getHistory().length }}</div>
                    <div class="text-xs font-bold text-slate-500 uppercase">Rounds</div>
                 </div>
              </div>
           </div>

           <!-- Tournament History List -->
           <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div class="flex justify-between items-center mb-4">
                 <h3 class="text-lg font-bold text-slate-700">Match History</h3>
                 <div class="flex gap-2 text-xs">
                    <span class="px-2 py-1 rounded bg-slate-100 text-slate-500">Filter by Tournament:</span>
                    <button *ngFor="let tid of uniqueTournaments()" (click)="selectedTournamentId.set(tid)" 
                         [class]="selectedTournamentId() === tid ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
                         class="px-2 py-1 rounded font-bold transition-colors">
                         {{ tid }}
                    </button>
                    <button *ngIf="selectedTournamentId()" (click)="selectedTournamentId.set(null)" class="text-red-500 hover:underline ml-1">Clear</button>
                 </div>
              </div>

              <div class="space-y-3">
                 <div *ngFor="let item of filteredHistory()" (click)="viewingFlow.set(item)" class="border-b border-slate-100 pb-3 last:border-0 cursor-pointer hover:bg-slate-50 p-2 rounded transition-colors group">
                    <div class="flex justify-between text-sm mb-1">
                        <div>
                           <span class="font-bold text-slate-700">Round ID: {{ item.debateId.substring(0,6) }}</span>
                           <span class="ml-2 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono">{{ item.tournamentId }}</span>
                        </div>
                        <span class="text-xs text-slate-400">{{ item.timestamp | date:'short' }}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <div class="text-xs text-slate-500 italic truncate max-w-md">"{{ item.rfd }}"</div>
                        <div class="text-[10px] text-blue-500 group-hover:underline">View Flow &rarr;</div>
                    </div>
                    <div class="mt-1">
                       <span class="text-[10px] font-bold px-2 py-0.5 rounded" 
                             [class.bg-green-100]="item.decision === 'Aff' ? 'text-green-700' : 'text-red-700'">
                             Vote: {{ item.decision }} ({{item.affScore}}-{{item.negScore}})
                       </span>
                    </div>
                 </div>
                 <div *ngIf="filteredHistory().length === 0" class="text-center text-slate-400 text-sm py-4">No history found.</div>
              </div>
           </div>
        </div>
      </div>

      <!-- HISTORY MODAL -->
      <div *ngIf="viewingFlow()" class="fixed inset-0 bg-black/80 z-50 flex flex-col p-4 animate-in fade-in">
          <div class="bg-white rounded-t-xl p-4 flex justify-between items-center shrink-0">
             <div>
                 <h2 class="font-bold text-lg">Historical Record</h2>
                 <p class="text-xs text-slate-500">Judge: {{ viewingFlow()?.judgeName }} | Decision: {{ viewingFlow()?.decision }}</p>
             </div>
             <button (click)="viewingFlow.set(null)" class="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg font-bold text-sm">Close</button>
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
  
  joinCode = '';
  joinError = '';
  
  selectedTournamentId = signal<string | null>(null);
  viewingFlow = signal<RoundResult | null>(null);

  myStats() { return this.tournament.getMyDebaterRecord(); }

  // Raw history
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
  
  // Filtered History
  filteredHistory = computed(() => {
      const hist = this.getHistory();
      const filter = this.selectedTournamentId();
      if (filter) return hist.filter(h => h.tournamentId === filter);
      return hist;
  });

  uniqueTournaments = computed(() => [...new Set(this.getHistory().map(h => h.tournamentId))]);

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