import { Component, inject, effect, signal } from '@angular/core';
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

        <!-- TABS -->
        <div class="flex border-b border-slate-200 mb-6">
           <button (click)="tab = 'login'" [class]="tab === 'login' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'" class="flex-1 pb-2 border-b-2 font-bold text-sm transition-colors">Sign In</button>
           <button (click)="tab = 'register'" [class]="tab === 'register' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'" class="flex-1 pb-2 border-b-2 font-bold text-sm transition-colors">Create Account</button>
        </div>

        <div class="space-y-6">
          
          <!-- FORM -->
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

              <!-- Registration Only Fields -->
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

                  <div *ngIf="role === 'Admin'" class="bg-blue-50 p-3 rounded border border-blue-100">
                      <div class="flex gap-2 mb-2 text-xs font-bold">
                         <button (click)="adminMode='Create'; tid=genTid()" [class.text-blue-600]="adminMode==='Create'" class="hover:underline">Create New</button>
                         <span>|</span>
                         <button (click)="adminMode='Manage'; tid=''" [class.text-blue-600]="adminMode==='Manage'" class="hover:underline">Manage Existing</button>
                      </div>
                      <input *ngIf="adminMode==='Manage'" [(ngModel)]="tid" placeholder="Tournament Code" class="w-full p-2 text-sm border rounded">
                      <div *ngIf="adminMode==='Create'" class="text-center">
                         <div class="text-xl font-mono font-bold text-blue-700">{{ tid }}</div>
                         <p class="text-[10px] text-slate-400">New Code</p>
                      </div>
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
  
  name = '';
  email = '';
  password = '';
  role: 'Admin' | 'Judge' | 'Debater' = 'Debater';
  adminMode: 'Create' | 'Manage' = 'Create';
  tid = '';
  
  errorMsg = '';
  loading = false;

  constructor() {
      this.genTid();
  }

  genTid() {
      if (this.role === 'Admin' && this.adminMode === 'Create') {
          this.tid = Math.random().toString(36).substring(2, 8).toUpperCase();
      }
      return this.tid;
  }

  async submit() {
      this.loading = true;
      this.errorMsg = '';

      // Validation
      if (!this.email.includes('@')) {
          this.errorMsg = "Please enter a valid email.";
          this.loading = false;
          return;
      }
      if (this.password.length < 6) {
          this.errorMsg = "Password must be at least 6 characters.";
          this.loading = false;
          return;
      }

      try {
          if (this.tab === 'login') {
              await this.tournament.loginWithEmail(this.email, this.password);
          } else {
              if (!this.name) throw new Error("Name required");
              
              // Admin doesn't need a code initially for the portal
              const targetTid = this.tid ? this.tid.toUpperCase() : null;
              
              await this.tournament.registerWithEmail(this.email, this.password, this.name, this.role, targetTid);
          }
      } catch (e: any) {
          console.error("Auth Error:", e);
          if (e.code === 'auth/email-already-in-use') this.errorMsg = "Email already registered.";
          else if (e.code === 'auth/weak-password') this.errorMsg = "Password is too weak.";
          else if (e.code === 'auth/operation-not-allowed') this.errorMsg = "Email/Password login is disabled in Firebase Console.";
          else if (e.code === 'auth/invalid-email') this.errorMsg = "Invalid email address.";
          else if (e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') this.errorMsg = "Incorrect email or password.";
          else this.errorMsg = e.message;
      } finally {
          this.loading = false;
      }
  }
}