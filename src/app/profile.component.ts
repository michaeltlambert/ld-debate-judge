import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TournamentService, UserProfile } from './tournament.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 max-w-4xl mx-auto">
      <h1 class="text-2xl font-bold text-slate-800 mb-6">My Profile</h1>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Left: Identity Card -->
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

        <!-- Middle/Right: Join Tournament & Stats -->
        <div class="md:col-span-2 space-y-6">
        
           <!-- Join Tournament Section (If no tournament assigned) -->
           <div *ngIf="!tournament.tournamentId()" class="bg-blue-50 p-6 rounded-xl border border-blue-200">
               <h3 class="text-lg font-bold text-blue-800 mb-2">Join a Tournament</h3>
               <p class="text-sm text-blue-600 mb-4">Enter the 6-digit code provided by your administrator.</p>
               <div class="flex gap-2">
                  <input [(ngModel)]="joinCode" class="flex-1 p-2 border border-blue-300 rounded font-mono uppercase" placeholder="CODE">
                  <button (click)="join()" class="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700">Join</button>
               </div>
               <p *ngIf="joinError" class="text-xs text-red-500 mt-2 font-bold">{{ joinError }}</p>
           </div>

           <!-- Stats -->
           <div *ngIf="tournament.tournamentId()" class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
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

           <!-- History -->
           <div *ngIf="tournament.tournamentId()" class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 class="text-lg font-bold text-slate-700 mb-4">History</h3>
              <div class="space-y-3">
                 <div *ngFor="let item of getHistory()" class="border-b border-slate-100 pb-3 last:border-0">
                    <div class="flex justify-between text-sm mb-1">
                        <span class="font-bold text-slate-700">Round ID: {{ item.debateId.substring(0,6) }}</span>
                        <span class="text-xs text-slate-400">{{ item.timestamp | date:'short' }}</span>
                    </div>
                    <div class="text-xs text-slate-500 italic">"{{ item.rfd }}"</div>
                    <div class="mt-1">
                       <span class="text-[10px] font-bold px-2 py-0.5 rounded" 
                             [class.bg-green-100]="item.decision === 'Aff' ? 'text-green-700' : 'text-red-700'">
                             Vote: {{ item.decision }}
                       </span>
                    </div>
                 </div>
                 <div *ngIf="getHistory().length === 0" class="text-center text-slate-400 text-sm py-4">No history yet.</div>
              </div>
           </div>
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