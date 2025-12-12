import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router'; // Added Router
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
               <img [src]="profile()?.photoURL || 'https://ui-avatars.com/api/?name=' + profile()?.name" class="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-slate-100 shadow-inner">
               <h2 class="text-xl font-bold text-slate-800">{{ profile()?.name }}</h2>
               <p class="text-sm text-slate-500 mb-4">{{ profile()?.email }}</p>
               <span class="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold uppercase">{{ profile()?.role }}</span>
               
               <div *ngIf="profile()?.role === 'Admin'" 
                    (click)="goToAdmin()"
                    class="mt-6 border border-yellow-300 bg-yellow-100 p-3 rounded-lg cursor-pointer hover:bg-yellow-200 transition-colors">
                   <p class="text-xs font-bold text-yellow-800 uppercase flex items-center justify-center gap-2">
                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                           <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75a2.25 2.25 0 0 1 2.25 2.25v7.5a2.25 2.25 0 0 1-2.25 2.25h-9.75m-4.5 0A2.25 2.25 0 0 1 3.75 16.5V3.75a2.25 2.25 0 0 1 2.25-2.25h10.5a2.25 2.25 0 0 1 2.25 2.25v1.5a2.25 2.25 0 0 0-2.25-2.25H6a2.25 2.25 0 0 0-2.25 2.25v12.75Z" />
                       </svg>
                       Go to Admin Dashboard
                   </p>
               </div>

               <div class="mt-6 border-t border-slate-100 pt-4 text-left space-y-3">
                 <h3 class="text-xs font-bold text-slate-400 uppercase">Contact Info</h3>
                 <input [(ngModel)]="editPhone" class="w-full text-sm border-b border-slate-200 outline-none py-1" placeholder="Add phone number">
                 <input [(ngModel)]="editAddress" class="w-full text-sm border-b border-slate-200 outline-none py-1" placeholder="Add address">
                 <button (click)="saveContact()" class="w-full bg-blue-600 text-white text-xs font-bold py-2 rounded mt-2 hover:bg-blue-700 transition-colors">Save Changes</button>
               </div>
            </div>

            <div class="bg-blue-50 p-6 rounded-xl border border-blue-200">
               <h3 class="text-lg font-bold text-blue-800 mb-2">Join / Switch Tournament</h3>
               <div class="flex gap-2">
                  <input [(ngModel)]="joinCode" class="flex-1 p-2 border border-blue-300 rounded font-mono uppercase" placeholder="CODE">
                  <button (click)="join()" class="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 transition-colors">Join</button>
               </div>
               <p *ngIf="joinError" class="text-xs text-red-500 mt-2 font-bold">{{ joinError }}</p>
           </div>
        </div>

        <div class="lg:col-span-8 space-y-6">
           
           <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200" *ngIf="activeAssignments().length > 0">
              <h3 class="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> 
                  Active Assignments
              </h3>
              <div class="space-y-3">
                 <div *ngFor="let debate of activeAssignments()" 
                      (click)="openRound(debate.id)"
                      class="border border-blue-100 bg-blue-50 p-4 rounded-lg cursor-pointer hover:bg-blue-100 transition-all flex justify-between items-center group shadow-sm hover:shadow-md">
                    <div>
                       <div class="flex items-center gap-2 mb-1">
                          <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-200 text-blue-800">{{ debate.stage }}</span>
                          <h4 class="font-bold text-slate-800">{{ debate.topic }}</h4>
                       </div>
                       <div class="text-sm text-slate-600 flex items-center gap-3">
                          <span><span class="font-bold text-blue-700">Aff:</span> {{ debate.affName }}</span>
                          <span class="text-slate-300">|</span>
                          <span><span class="font-bold text-red-700">Neg:</span> {{ debate.negName }}</span>
                       </div>
                    </div>
                    <div class="text-blue-600 font-bold text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                        Enter Round <span>&rarr;</span>
                    </div>
                 </div>
              </div>
           </div>

           <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 class="text-lg font-bold text-slate-700 mb-4">Performance Stats</h3>
              <div class="grid grid-cols-3 gap-4 text-center">
                 <div class="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <div class="text-3xl font-bold text-slate-800">{{ myStats().wins }}</div>
                    <div class="text-xs font-bold text-slate-500 uppercase tracking-wider">Wins</div>
                 </div>
                 <div class="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <div class="text-3xl font-bold text-slate-800">{{ myStats().losses }}</div>
                    <div class="text-xs font-bold text-slate-500 uppercase tracking-wider">Losses</div>
                 </div>
                 <div class="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <div class="text-3xl font-bold text-slate-800">{{ filteredHistory().length }}</div>
                    <div class="text-xs font-bold text-slate-500 uppercase tracking-wider">Rounds</div>
                 </div>
              </div>
           </div>

           <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 class="text-lg font-bold text-slate-700 mb-4">Match History</h3>
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
                        <div class="text-[10px] text-blue-500 font-bold group-hover:underline">View Flow &rarr;</div>
                    </div>
                    <div class="mt-1">
                       <span class="text-[10px] font-bold px-2 py-0.5 rounded" 
                             [class.bg-green-100]="item.decision === 'Aff' ? 'text-green-700' : 'text-red-700'">
                             Vote: {{ item.decision }} ({{item.affScore}}-{{item.negScore}})
                       </span>
                    </div>
                 </div>
                 <div *ngIf="filteredHistory().length === 0" class="text-center text-slate-400 text-sm py-4 italic">No history found.</div>
              </div>
           </div>
        </div>
      </div>

      <div *ngIf="viewingFlow()" class="fixed inset-0 bg-black/80 z-50 flex flex-col p-4 animate-in fade-in">
          <div class="bg-white rounded-t-xl p-4 flex justify-between items-center shrink-0">
             <div>
                 <h2 class="font-bold text-lg">Historical Record</h2>
                 <p class="text-xs text-slate-500">Judge: {{ viewingFlow()?.judgeName }} | Decision: {{ viewingFlow()?.decision }}</p>
             </div>
             <button (click)="viewingFlow.set(null)" class="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg font-bold text-sm transition-colors">Close</button>
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
  router = inject(Router); // Inject Router for navigation
  profile = this.tournament.userProfile;
  
  editPhone = this.profile()?.phone || '';
  editAddress = this.profile()?.address || '';
  joinCode = ''; joinError = '';
  
  selectedTournamentId = signal<string | null>(null);
  viewingFlow = signal<RoundResult | null>(null);

  // Computed Signal for Active Assignments
  activeAssignments = computed(() => {
     // Get all assignments and filter for only those that are currently Open
     return this.tournament.getMyAssignments().filter(d => d.status === 'Open');
  });

  myStats() { return this.tournament.getMyDebaterRecord(); }
  
  // Action for Admin to navigate to the Admin Dashboard
  goToAdmin() {
    // Navigate to the list of tournaments (where they can create or view)
    this.router.navigate(['/tournaments']);
  }
  
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

  // Action to navigate to the debate room
  openRound(debateId: string) {
      const tid = this.tournament.tournamentId();
      if (tid) {
          this.router.navigate(['/tournament', tid, 'round', debateId]);
      }
  }

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