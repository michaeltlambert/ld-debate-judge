const fs = require('fs');
const path = require('path');

// --- 1. FILE DEFINITIONS ---
const files = [
  {
    path: '.postcssrc.json',
    content: `{
  "plugins": {
    "@tailwindcss/postcss": {}
  }
}`
  },
  {
    path: 'src/styles.css',
    content: `@import "tailwindcss";

@theme {
  --font-sans: "Inter", "system-ui", sans-serif;
}

body {
  @apply bg-slate-50 text-slate-900 font-sans;
}`
  },
  {
    path: 'README.md',
    content: `# DebateMate: Tournament Edition

## 📘 Project Overview
DebateMate is a real-time Lincoln-Douglas adjudication system. It features a tri-role interface:
1.  **Administrator:** Matches debaters, assigns judges, and tracks tournament standings (Wins/Losses).
2.  **Judge:** Receives assignments, times rounds, flows arguments, and submits ballots.
3.  **Debater:** Logs in to register, times their own rounds, and reviews feedback.

### **Tech Stack**
* **Framework:** Angular v21 (Signals Architecture)
* **Backend:** Firebase Firestore (Real-time Sync) & Auth (Anonymous)
* **Styling:** Tailwind CSS v4
* **Export:** PDF Generation (\`html-to-image\`)

## 🚀 Getting Started
1.  **Install:** \`npm install\`
2.  **Run:** \`npm start\`
3.  **Login:** Users must be logged in to appear in the Administrator's lists.
`
  },
  {
    path: 'src/main.ts',
    content: `import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';

(window as any).global = window;

bootstrapApplication(AppComponent)
  .catch((err) => console.error(err));
`
  },
  {
    path: 'src/app/glossary.data.ts',
    content: `export const DEBATE_TERMS: Record<string, string> = {
  'Value Premise': 'The core moral goal of the case (e.g., Justice, Liberty, Life). The "Why".',
  'Value Criterion': 'The measuring stick used to determine if the Value is achieved. The "How".',
  'Contentions': 'The main arguments or points of the case.',
  'Cross-Ex': 'A 3-minute questioning period. Used to clarify points or expose weaknesses.',
  'Prep Time': 'A bank of time (usually 4 mins) used to prepare speeches.',
  'Dropped': 'An argument that was ignored by the opponent. It is considered conceded/true.',
  'Extend': 'Carrying an argument through to the final speech.',
  'Turn': 'Using an opponent\\'s argument against them.',
  'Voters': 'The "Voting Issues." The 2-3 main reasons a debater believes they won.',
  'Crystallize': 'Summarizing the round into key winning points.',
  'Flow': 'The specific style of note-taking used to track arguments across columns.',
  'Tabula Rasa': 'Latin for "Blank Slate." The judge should ignore their own opinions.'
};`
  },
  {
    path: 'src/app/tournament.service.ts',
    content: `import { Injectable, signal, computed } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, updateDoc, 
  onSnapshot, setDoc, deleteDoc
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, 
  User, signInWithCustomToken, signOut 
} from 'firebase/auth';

// --- DATA MODELS ---
export interface Debate {
  id: string;
  topic: string;
  affId: string;
  affName: string;
  negId: string;
  negName: string;
  judgeIds: string[]; 
  status: 'Open' | 'Closed';
}

export interface UserProfile {
  id: string; 
  name: string;
  isOnline: boolean;
  role: 'Admin' | 'Judge' | 'Debater';
}

export interface RoundResult {
  id: string;
  debateId: string;
  judgeId: string;
  judgeName: string;
  affScore: number;
  negScore: number;
  decision: 'Aff' | 'Neg';
  rfd: string;
}

export interface DebaterStats {
  id: string;
  name: string;
  wins: number;
  losses: number;
}

@Injectable({ providedIn: 'root' })
export class TournamentService {
  user = signal<User | null>(null);
  userProfile = signal<UserProfile | null>(null);
  userRole = signal<'Admin' | 'Judge' | 'Debater'>('Debater');
  
  judges = signal<UserProfile[]>([]);
  debaters = signal<UserProfile[]>([]);
  debates = signal<Debate[]>([]);
  results = signal<RoundResult[]>([]);
  
  activeDebateId = signal<string | null>(null);

  standings = computed(() => {
    const stats: Record<string, DebaterStats> = {};
    this.debaters().forEach(d => {
      stats[d.id] = { id: d.id, name: d.name, wins: 0, losses: 0 };
    });
    
    // Iterate debates to calculate wins based on Majority Vote
    this.debates().forEach(debate => {
       const ballots = this.results().filter(r => r.debateId === debate.id);
       if (ballots.length === 0) return;

       let affVotes = 0;
       let negVotes = 0;
       ballots.forEach(b => b.decision === 'Aff' ? affVotes++ : negVotes++);

       // Only assign a win if a vote has occurred
       // Ensure stats objects exist 
       if (!stats[debate.affId]) stats[debate.affId] = { id: debate.affId, name: debate.affName, wins: 0, losses: 0 };
       if (!stats[debate.negId]) stats[debate.negId] = { id: debate.negId, name: debate.negName, wins: 0, losses: 0 };

       if (affVotes > negVotes) {
         stats[debate.affId].wins++;
         stats[debate.negId].losses++;
       } else if (negVotes > affVotes) {
         stats[debate.negId].wins++;
         stats[debate.affId].losses++;
       }
       // Ties (rare/impossible with odd judges) result in no win increment
    });

    return Object.values(stats).sort((a, b) => b.wins - a.wins);
  });

  private app: any;
  private db: any;
  private auth: any;
  private appId: string;

  // --- CONFIGURATION ---
  private firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "...",
    appId: "..."
  };

  constructor() {
    this.appId = (window as any).__app_id || 'default-app';
    const envConfig = (window as any).__firebase_config;
    
    try {
      if (envConfig) {
        this.app = initializeApp(JSON.parse(envConfig));
      } else if (this.firebaseConfig.apiKey !== "YOUR_API_KEY") {
        this.app = initializeApp(this.firebaseConfig);
      } else {
        throw new Error("No valid config");
      }
      
      this.db = getFirestore(this.app);
      this.auth = getAuth(this.app);
      this.initAuth();
      
    } catch(e) {
      console.warn("Firebase config not found. Running offline.");
      this.appId = 'demo-app';
    }
  }

  private async initAuth() {
    const initialToken = (window as any).__initial_auth_token;
    if (initialToken) await signInWithCustomToken(this.auth, initialToken);
    else await signInAnonymously(this.auth);

    onAuthStateChanged(this.auth, (u) => {
      this.user.set(u);
      if (u) {
        this.restoreSession(u.uid);
        this.startListeners();
      }
    });
  }

  private restoreSession(uid: string) {
    const savedName = localStorage.getItem('debate-user-name');
    const savedRole = localStorage.getItem('debate-user-role') as any;

    if (savedName && savedRole) {
      this.userRole.set(savedRole);
      this.userProfile.set({ id: uid, name: savedName, role: savedRole, isOnline: true });
      this.updateCloudProfile(uid, savedName, savedRole);
    }
  }

  private startListeners() {
    if (!this.db) return;
    onSnapshot(this.getCollection('judges'), (s) => this.judges.set(s.docs.map(d => ({id:d.id, ...d.data()} as UserProfile))));
    onSnapshot(this.getCollection('debaters'), (s) => this.debaters.set(s.docs.map(d => ({id:d.id, ...d.data()} as UserProfile))));
    onSnapshot(this.getCollection('debates'), (s) => this.debates.set(s.docs.map(d => ({id:d.id, ...d.data()} as Debate))));
    onSnapshot(this.getCollection('results'), (s) => this.results.set(s.docs.map(d => ({id:d.id, ...d.data()} as RoundResult))));
  }
  
  async setProfile(name: string, role: 'Admin' | 'Judge' | 'Debater') {
    let currentUser = this.user();
    if (!currentUser && this.auth) currentUser = this.auth.currentUser;
    const uid = currentUser?.uid || 'demo-' + Math.random().toString(36).substring(7);
    this.userRole.set(role);
    const profile: UserProfile = { id: uid, name, role, isOnline: true };
    localStorage.setItem('debate-user-name', name);
    localStorage.setItem('debate-user-role', role);
    this.userProfile.set(profile);
    this.updateCloudProfile(uid, name, role);
  }

  private async updateCloudProfile(uid: string, name: string, role: string) {
    if (this.db) {
      try {
        const collectionName = role === 'Debater' ? 'debaters' : (role === 'Judge' ? 'judges' : null);
        if (collectionName) {
          const ref = doc(this.db, 'artifacts', this.appId, 'public', 'data', collectionName, uid);
          await setDoc(ref, { id: uid, name, role, isOnline: true }, { merge: true });
        }
      } catch (e) { console.warn('Cloud sync failed', e); }
    }
  }

  async logout() {
    const profile = this.userProfile();
    if (profile && this.db) {
        const collectionName = profile.role === 'Debater' ? 'debaters' : (profile.role === 'Judge' ? 'judges' : null);
        if (collectionName) {
             try { await deleteDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', collectionName, profile.id)); } catch(e) {}
        }
    }
    if (this.auth) await signOut(this.auth);
    localStorage.removeItem('debate-user-name');
    localStorage.removeItem('debate-user-role');
    this.user.set(null);
    this.userProfile.set(null);
    this.activeDebateId.set(null);
  }

  async createDebate(topic: string, affId: string, affName: string, negId: string, negName: string) {
    if (!this.db) {
        this.debates.update(d => [...d, { id: 'loc-'+Date.now(), topic, affId, affName, negId, negName, judgeIds:[], status:'Open' }]);
        return;
    }
    await addDoc(this.getCollection('debates'), { topic, affId, affName, negId, negName, judgeIds: [], status: 'Open' });
  }

  async deleteDebate(debateId: string) {
    if (!this.db) {
        this.debates.update(d => d.filter(x => x.id !== debateId));
        return;
    }
    await deleteDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', 'debates', debateId));
  }

  async assignJudge(debateId: string, judgeId: string) {
    if (!this.db) return; 
    const debate = this.debates().find(d => d.id === debateId);
    if (!debate) return;
    const newJudges = [...new Set([...debate.judgeIds, judgeId])].slice(0, 3);
    const ref = doc(this.db, 'artifacts', this.appId, 'public', 'data', 'debates', debateId);
    await updateDoc(ref, { judgeIds: newJudges });
  }

  async removeJudge(debateId: string, judgeId: string) {
    if (!this.db) return;
    const debate = this.debates().find(d => d.id === debateId);
    if (!debate) return;
    const ref = doc(this.db, 'artifacts', this.appId, 'public', 'data', 'debates', debateId);
    await updateDoc(ref, { judgeIds: debate.judgeIds.filter(id => id !== judgeId) });
  }

  // Modified: Upsert ballot (update if exists, create if new)
  async submitBallot(debateId: string, result: Omit<RoundResult, 'id' | 'judgeId' | 'judgeName' | 'debateId'>) {
    const uid = this.user()?.uid || 'anon';
    const name = this.userProfile()?.name || 'Anonymous';
    const finalResult = { ...result, debateId, judgeId: uid, judgeName: name, timestamp: Date.now() };

    if (this.db) {
        // Use specific ID: debateId_judgeId to ensure 1 ballot per judge per round
        const ballotId = \`\${debateId}_\${uid}\`;
        const ref = doc(this.db, 'artifacts', this.appId, 'public', 'data', 'results', ballotId);
        await setDoc(ref, finalResult, { merge: true });
    } else {
        console.log('Ballot submitted locally (Offline Mode):', finalResult);
    }
  }
  
  private getCollection(name: string) {
    return collection(this.db, 'artifacts', this.appId, 'public', 'data', name);
  }

  getMyAssignments() {
    const uid = this.userProfile()?.id;
    if (!uid) return [];
    if (!this.db) return this.debates(); 
    
    return this.debates().filter(d => {
      const isJudge = d.judgeIds.includes(uid);
      // DEBATERS can also "see" their rounds to time them
      const isDebater = d.affId === uid || d.negId === uid;
      
      return (isJudge || isDebater) && d.status === 'Open';
    });
  }

  getMyDebaterRecord() {
    const uid = this.userProfile()?.id;
    if (!uid) return { wins: 0, losses: 0 };
    return this.standings().find(s => s.id === uid) || { id: uid, name: '', wins: 0, losses: 0 };
  }

  getWinner(debateId: string): 'Aff' | 'Neg' | 'Pending' {
    const ballots = this.results().filter(r => r.debateId === debateId);
    if (ballots.length === 0) return 'Pending';
    
    let aff = 0, neg = 0;
    ballots.forEach(b => b.decision === 'Aff' ? aff++ : neg++);
    
    if (aff > neg) return 'Aff';
    if (neg > aff) return 'Neg';
    return 'Pending'; // Tie or not enough votes
  }
}`
  },
  {
    path: 'src/app/login.component.ts',
    content: `import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TournamentService } from './tournament.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: \`
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
            <div class="grid grid-cols-3 gap-2" role="group" aria-label="Select User Role">
              <button (click)="role = 'Debater'" 
                [class]="role === 'Debater' ? 'bg-purple-600 text-white ring-2 ring-purple-300' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'"
                class="p-3 rounded-xl font-bold transition-all border border-slate-200 text-sm" aria-label="Login as Debater">Debater</button>
              
              <button (click)="role = 'Judge'" 
                [class]="role === 'Judge' ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'"
                class="p-3 rounded-xl font-bold transition-all border border-slate-200 text-sm" aria-label="Login as Judge">Judge</button>
              
              <button (click)="role = 'Admin'" 
                [class]="role === 'Admin' ? 'bg-slate-800 text-white ring-2 ring-slate-400' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'"
                class="p-3 rounded-xl font-bold transition-all border border-slate-200 text-sm" aria-label="Login as Administrator">Admin</button>
            </div>
          </div>
          <button (click)="enter()" [disabled]="!name" 
            class="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all cursor-pointer">
            Enter Tournament
          </button>
        </div>
      </div>
    </div>
  \`
})
export class LoginComponent {
  tournament = inject(TournamentService);
  name = '';
  role: 'Admin' | 'Judge' | 'Debater' = 'Debater';
  enter() { if (this.name) this.tournament.setProfile(this.name, this.role); }
}`
  },
  {
    path: 'src/app/admin.component.ts',
    content: `import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TournamentService, Debate } from './tournament.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: \`
    <div class="min-h-screen bg-slate-100 p-6">
      <header class="max-w-7xl mx-auto mb-8 flex justify-between items-center">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Tournament Administration</h1>
          <p class="text-slate-500">Welcome, {{ tournament.userProfile()?.name }}</p>
        </div>
        <div class="flex items-center gap-4">
          <button (click)="tournament.logout()" class="text-sm font-bold text-red-500 hover:text-red-700 underline" aria-label="Log Out">Log Out</button>
          <div class="flex items-center gap-2 text-sm bg-white px-3 py-1 rounded-full shadow-sm border border-slate-200">
            <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span>Live Sync Active</span>
          </div>
        </div>
      </header>

      <main class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <div class="lg:col-span-4 space-y-6">
          
          <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 class="font-bold text-slate-800 mb-4">Matchmaking</h2>
            <div class="space-y-4">
              <input [(ngModel)]="newTopic" placeholder="Resolved: (Topic)" class="w-full p-2 border rounded text-sm bg-slate-50" aria-label="Debate Topic">
              <div class="space-y-2">
                <label class="text-xs font-bold text-blue-600 uppercase">Affirmative</label>
                <select [(ngModel)]="selectedAffId" class="w-full p-2 border rounded text-sm bg-white" aria-label="Select Affirmative Debater">
                  <option value="" disabled selected>Select Debater...</option>
                  <option *ngFor="let d of tournament.debaters()" [value]="d.id">{{ d.name }}</option>
                </select>
              </div>
              <div class="space-y-2">
                <label class="text-xs font-bold text-red-600 uppercase">Negative</label>
                <select [(ngModel)]="selectedNegId" class="w-full p-2 border rounded text-sm bg-white" aria-label="Select Negative Debater">
                  <option value="" disabled selected>Select Debater...</option>
                  <option *ngFor="let d of tournament.debaters()" [value]="d.id">{{ d.name }}</option>
                </select>
              </div>
              <button (click)="create()" [disabled]="!newTopic || !selectedAffId || !selectedNegId"
                class="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800 disabled:opacity-50 mt-4 transition-all">
                Create Matchup
              </button>
            </div>
          </div>

          <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 class="font-bold text-slate-800 mb-4">Logged In Participants</h2>
            <div class="space-y-4">
              <div>
                <h3 class="text-xs font-bold text-slate-500 uppercase mb-2 flex justify-between">
                  <span>Judges</span><span class="bg-blue-100 text-blue-800 px-2 rounded">{{ tournament.judges().length }}</span>
                </h3>
                <div class="max-h-32 overflow-y-auto space-y-1">
                  <div *ngFor="let j of tournament.judges()" class="flex items-center gap-2 p-1.5 bg-slate-50 rounded text-sm">
                    <div class="w-2 h-2 bg-green-500 rounded-full"></div> {{ j.name }}
                  </div>
                  <div *ngIf="tournament.judges().length === 0" class="text-xs text-slate-400 italic">No judges online.</div>
                </div>
              </div>
              <hr class="border-slate-100">
              <div>
                <h3 class="text-xs font-bold text-slate-500 uppercase mb-2 flex justify-between">
                  <span>Debaters</span><span class="bg-purple-100 text-purple-800 px-2 rounded">{{ tournament.debaters().length }}</span>
                </h3>
                <div class="max-h-32 overflow-y-auto space-y-1">
                  <div *ngFor="let d of tournament.debaters()" class="flex items-center gap-2 p-1.5 bg-slate-50 rounded text-sm">
                    <div class="w-2 h-2 bg-purple-500 rounded-full"></div> {{ d.name }}
                  </div>
                  <div *ngIf="tournament.debaters().length === 0" class="text-xs text-slate-400 italic">No debaters online.</div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 class="font-bold text-slate-800 mb-4">Leaderboard</h2>
            <div class="overflow-hidden rounded-lg border border-slate-100">
              <table class="w-full text-sm">
                <thead class="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                  <tr><th class="p-2 text-left">Debater</th><th class="p-2 text-center">W</th><th class="p-2 text-center">L</th></tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr *ngFor="let s of tournament.standings()">
                    <td class="p-2 font-medium text-slate-700">{{ s.name }}</td>
                    <td class="p-2 text-center font-bold text-green-600">{{ s.wins }}</td>
                    <td class="p-2 text-center font-bold text-red-500">{{ s.losses }}</td>
                  </tr>
                  <tr *ngIf="tournament.standings().length === 0"><td colspan="3" class="p-4 text-center text-xs text-slate-400 italic">No results yet.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="lg:col-span-8 space-y-6">
          <h2 class="font-bold text-slate-700">Active Rounds</h2>
          <div *ngFor="let debate of tournament.debates()" class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div class="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
              <div>
                <div class="flex items-center gap-3">
                    <h3 class="font-bold text-lg text-slate-800">{{ debate.topic }}</h3>
                    <span *ngIf="getWinner(debate.id) !== 'Pending'" class="bg-yellow-100 text-yellow-800 text-[10px] px-2 py-0.5 rounded font-bold border border-yellow-200">
                        🏆 WINNER: {{ getWinnerName(debate) }}
                    </span>
                </div>
                <div class="text-sm text-slate-500 mt-1 flex items-center gap-3">
                  <span class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-bold">{{ debate.affName }}</span>
                  <span class="text-slate-300 font-bold">vs</span>
                  <span class="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-bold">{{ debate.negName }}</span>
                </div>
              </div>
              <div class="flex gap-2 items-center">
                <div class="relative">
                    <select #assignSelect (change)="assign(debate.id, assignSelect.value); assignSelect.value = ''" 
                      class="bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold py-2 px-3 rounded focus:outline-none hover:bg-slate-200 cursor-pointer" aria-label="Assign Judge">
                      <option value="" disabled selected>+ Add Judge</option>
                      <option *ngFor="let judge of getUnassignedJudges(debate)" [value]="judge.id">{{ judge.name }}</option>
                    </select>
                </div>
                <button (click)="tournament.deleteDebate(debate.id)" class="text-slate-300 hover:text-red-500 p-2" title="Delete Debate"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg></button>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div *ngFor="let judgeId of debate.judgeIds" class="bg-slate-50 rounded-lg p-3 border border-slate-200 relative group">
                <div class="flex justify-between items-center mb-1">
                  <span class="text-xs font-bold text-slate-700 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-green-500"></span> {{ getJudgeName(judgeId) }}</span>
                  <button (click)="remove(debate.id, judgeId)" class="text-slate-300 hover:text-red-500 font-bold text-xs" aria-label="Remove Judge">Remove</button>
                </div>
                <div *ngIf="getResult(debate.id, judgeId) as res; else pending" class="animate-in fade-in bg-white p-2 rounded border border-slate-100 mt-2">
                  <div class="flex justify-between text-xs font-bold mb-1">
                    <span [class.text-blue-600]="res.decision === 'Aff'" [class.text-red-600]="res.decision === 'Neg'">Voted: {{ res.decision }}</span>
                    <span class="text-slate-400">{{ res.affScore }}-{{ res.negScore }}</span>
                  </div>
                  <div class="text-[10px] text-slate-500 italic truncate">"{{ res.rfd }}"</div>
                </div>
                <ng-template #pending><div class="text-[10px] text-slate-400 mt-2 pl-4">Waiting for ballot...</div></ng-template>
              </div>
              <div *ngIf="debate.judgeIds.length === 0" class="col-span-2 text-center py-4 border-2 border-dashed border-slate-100 rounded-lg text-slate-300 text-xs italic">Waiting for judge assignment.</div>
            </div>
          </div>
          <div *ngIf="tournament.debates().length === 0" class="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300"><p class="text-slate-400">No active rounds.</p></div>
        </div>
      </main>
    </div>
  \`
})
export class AdminComponent {
  tournament = inject(TournamentService);
  newTopic = ''; selectedAffId = ''; selectedNegId = '';

  create() { 
    const aff = this.tournament.debaters().find(d => d.id === this.selectedAffId);
    const neg = this.tournament.debaters().find(d => d.id === this.selectedNegId);
    if (aff && neg) {
      this.tournament.createDebate(this.newTopic, aff.id, aff.name, neg.id, neg.name);
      this.newTopic = ''; this.selectedAffId = ''; this.selectedNegId = ''; 
    }
  }
  assign(debateId: string, judgeId: string) { this.tournament.assignJudge(debateId, judgeId); }
  remove(debateId: string, judgeId: string) { this.tournament.removeJudge(debateId, judgeId); }
  getJudgeName(id: string) { return this.tournament.judges().find(j => j.id === id)?.name || 'Unknown'; }
  getUnassignedJudges(debate: Debate) { return this.tournament.judges().filter(j => !debate.judgeIds.includes(j.id)); }
  getResult(debateId: string, judgeId: string) { return this.tournament.results().find(r => r.debateId === debateId && r.judgeId === judgeId); }
  
  getWinner(debateId: string) { return this.tournament.getWinner(debateId); }
  getWinnerName(debate: Debate) {
     const w = this.tournament.getWinner(debate.id);
     return w === 'Aff' ? debate.affName : (w === 'Neg' ? debate.negName : 'None');
  }
}`
  },
  {
    path: 'src/app/ballot.component.ts',
    content: `import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PdfService } from './pdf.service';
import { TermComponent } from './term.component';
import { TournamentService, RoundResult } from './tournament.service';

@Component({
  selector: 'app-ballot',
  standalone: true,
  imports: [CommonModule, TermComponent, FormsModule],
  template: \`
    <div id="debate-ballot" class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      
      <!-- If Debater, show only feedback list -->
      <div *ngIf="isDebater()" class="text-center">
         <h3 class="font-bold text-slate-700 mb-4">Judge Feedback</h3>
         <p class="text-slate-400 text-xs italic" *ngIf="getFeedback().length === 0">No ballots submitted for this round yet.</p>
         <div *ngFor="let res of getFeedback()" class="bg-slate-50 p-3 rounded border border-slate-200 mb-2 text-left">
            <div class="flex justify-between text-xs font-bold mb-1">
                <span class="text-slate-700">{{ res.judgeName }}</span>
                <span [class.text-blue-600]="res.decision === 'Aff'" [class.text-red-600]="res.decision === 'Neg'">Voted: {{ res.decision }}</span>
            </div>
            <div class="text-[10px] text-slate-500 mb-2">Points: {{ res.affScore }} vs {{ res.negScore }}</div>
            <p class="text-sm text-slate-600 italic">"{{ res.rfd }}"</p>
         </div>
      </div>

      <!-- If Judge, show scoring form -->
      <div *ngIf="!isDebater()">
          <div class="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
            <div class="flex flex-col">
              <h2 class="font-bold text-slate-800 text-xl tracking-tight">Official Ballot</h2>
              <span class="text-xs text-slate-500 font-mono">Secure Submission</span>
            </div>
            <button (click)="toggleHints()" class="text-xs font-semibold px-3 py-1.5 rounded-full transition-all" [ngClass]="showHints() ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'">{{ showHints() ? 'Hide Guidelines' : 'Show Guidelines' }}</button>
          </div>
          
          <div *ngIf="showHints()" class="mb-8 grid grid-cols-1 md:grid-cols-2 gap-3 transition-all">
             <div class="bg-indigo-50 border border-indigo-100 p-3 rounded text-xs text-indigo-900"><strong>1. Framework:</strong> Weigh <app-term lookup="Value Premise">Value</app-term> & <app-term lookup="Value Criterion">Criterion</app-term>.</div>
             <div class="bg-amber-50 border border-amber-100 p-3 rounded text-xs text-amber-900"><strong>2. Tabula Rasa:</strong> Judge only what is said. No bias.</div>
             <div class="bg-rose-50 border border-rose-100 p-3 rounded text-xs text-rose-900"><strong>3. Drops:</strong> <app-term lookup="Dropped">Dropped</app-term> args are true.</div>
             <div class="bg-emerald-50 border border-emerald-100 p-3 rounded text-xs text-emerald-900"><strong>4. Voters:</strong> Focus on final <app-term lookup="Voters">Voting Issues</app-term>.</div>
          </div>
          
          <div class="space-y-6">
            <div class="grid grid-cols-2 gap-6 relative">
              <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border border-slate-200 text-slate-400 font-bold text-xs px-2 py-1 rounded-full z-10 shadow-sm">VS</div>
              <div class="bg-slate-50 p-4 rounded-lg border transition-colors" [class.border-blue-500]="affPoints() > negPoints()" [class.border-slate-100]="affPoints() <= negPoints()">
                <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Affirmative Points</label>
                <div class="flex items-center gap-2"><input type="number" min="0" max="30" [ngModel]="affPoints()" (ngModelChange)="setAff($event)" (input)="checkInput($event, 'aff')" class="w-full text-center text-xl font-mono font-bold border border-slate-300 rounded p-2 focus:ring-2 focus:ring-blue-500 shadow-sm"><span class="text-xs text-slate-400 font-medium">/ 30</span></div>
              </div>
              <div class="bg-slate-50 p-4 rounded-lg border transition-colors" [class.border-red-500]="negPoints() > affPoints()" [class.border-slate-100]="negPoints() <= affPoints()">
                <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Negative Points</label>
                 <div class="flex items-center gap-2"><input type="number" min="0" max="30" [ngModel]="negPoints()" (ngModelChange)="setNeg($event)" (input)="checkInput($event, 'neg')" class="w-full text-center text-xl font-mono font-bold border border-slate-300 rounded p-2 focus:ring-2 focus:ring-red-500 shadow-sm"><span class="text-xs text-slate-400 font-medium">/ 30</span></div>
              </div>
            </div>
            
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Decision</label>
              <div class="flex gap-3">
                <button (click)="manualOverride('Aff')" [class]="decision() === 'Aff' ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-200' : 'bg-white text-slate-400 border-slate-200 opacity-50 hover:opacity-100'" class="flex-1 py-4 border-2 rounded-xl font-bold text-lg transition-all flex flex-col items-center justify-center gap-1 relative overflow-hidden"><span>Affirmative</span></button>
                <button (click)="manualOverride('Neg')" [class]="decision() === 'Neg' ? 'bg-red-600 text-white border-red-600 ring-2 ring-red-200' : 'bg-white text-slate-400 border-slate-200 opacity-50 hover:opacity-100'" class="flex-1 py-4 border-2 rounded-xl font-bold text-lg transition-all flex flex-col items-center justify-center gap-1 relative overflow-hidden"><span>Negative</span></button>
              </div>
            </div>
            
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Reason for Decision (RFD)</label>
              <textarea [(ngModel)]="rfdText" class="w-full h-32 border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 shadow-sm resize-none" placeholder="I voted for the {{decision() || '...'}} because..."></textarea>
            </div>
            
            <div class="pt-4 border-t border-slate-100 flex gap-4">
              <button (click)="exportToPdf()" class="flex-1 bg-white border border-slate-300 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-50 flex items-center justify-center gap-2"><span>Download PDF</span></button>
              <button (click)="submitRound()" [disabled]="!decision() || affPoints() === negPoints()" [class.opacity-50]="!decision() || affPoints() === negPoints()" class="flex-[2] bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 flex items-center justify-center gap-3 shadow-lg transition-all">{{ isUpdate ? 'Update Ballot' : 'Submit Ballot' }}</button>
            </div>
          </div>
      </div>
    </div>
  \`
})
export class BallotComponent {
  pdfService = inject(PdfService);
  tournament = inject(TournamentService);
  showHints = signal(true);
  affPoints = signal(28);
  negPoints = signal(28);
  decision = signal<'Aff' | 'Neg' | null>(null);
  rfdText = ''; 
  isUpdate = false;

  constructor() {
    effect(() => {
      const debateId = this.tournament.activeDebateId();
      const userId = this.tournament.userProfile()?.id;
      
      // Check if we have an existing result to load
      if (debateId && userId) {
          const existing = this.tournament.results().find(r => r.debateId === debateId && r.judgeId === userId);
          if (existing) {
              this.isUpdate = true;
              this.affPoints.set(existing.affScore);
              this.negPoints.set(existing.negScore);
              this.decision.set(existing.decision);
              this.rfdText = existing.rfd;
          } else {
              this.resetBallot();
          }
      }
    }, { allowSignalWrites: true });
  }

  isDebater() { return this.tournament.userRole() === 'Debater'; }

  getFeedback() {
    const debateId = this.tournament.activeDebateId();
    return this.tournament.results().filter(r => r.debateId === debateId);
  }

  resetBallot() {
    this.isUpdate = false;
    this.affPoints.set(28);
    this.negPoints.set(28);
    this.decision.set(null);
    this.rfdText = '';
  }

  submitRound() {
    if (!this.decision()) return;
    const debateId = this.tournament.activeDebateId();
    if (!debateId) return;
    this.tournament.submitBallot(debateId, {
      affScore: this.affPoints(), negScore: this.negPoints(), decision: this.decision()!, rfd: this.rfdText
    }).then(() => {
      alert(this.isUpdate ? "Ballot Updated!" : "Ballot Submitted!");
      // Keep them on the page to edit if needed
      this.isUpdate = true;
    });
  }

  toggleHints() { this.showHints.update(v => !v); }
  checkInput(event: Event, side: 'aff' | 'neg') {
    const input = event.target as HTMLInputElement;
    let val = parseFloat(input.value);
    if (val > 30) { input.value = '30'; val = 30; } else if (val < 0) { input.value = '0'; val = 0; }
    if (side === 'aff') this.setAff(val); else this.setNeg(val);
  }
  setAff(val: number) { this.affPoints.set(val); this.autoCalculateWinner(); }
  setNeg(val: number) { this.negPoints.set(val); this.autoCalculateWinner(); }
  autoCalculateWinner() {
    if (this.affPoints() > this.negPoints()) this.decision.set('Aff');
    else if (this.negPoints() > this.affPoints()) this.decision.set('Neg');
    else this.decision.set(null);
  }
  manualOverride(winner: 'Aff' | 'Neg') { this.decision.set(winner); }
  exportToPdf() { this.pdfService.generateBallotPdf('debate-flow', 'debate-ballot'); }
}`
  },
  {
    path: 'src/app/app.component.ts',
    content: `import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimerComponent } from './timer.component';
import { FlowComponent } from './flow.component';
import { BallotComponent } from './ballot.component';
import { GlobalTooltipComponent } from './global-tooltip.component';
import { LoginComponent } from './login.component';
import { AdminComponent } from './admin.component';
import { TournamentService } from './tournament.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, TimerComponent, FlowComponent, BallotComponent, GlobalTooltipComponent, LoginComponent, AdminComponent],
  template: \`
    <app-login *ngIf="!tournament.userProfile()" />
    <div *ngIf="tournament.userProfile()" class="min-h-screen bg-slate-50">
      
      <header *ngIf="!isAdmin()" class="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center sticky top-0 z-50">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">DM</div>
          <div>
            <h1 class="text-sm font-bold text-slate-800 leading-tight">DebateMate</h1>
            <p class="text-[10px] text-slate-500 uppercase tracking-wide font-bold">{{ tournament.userProfile()?.role }} Mode</p>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <div class="text-xs text-right hidden sm:block">
            <div class="font-bold text-slate-700">{{ tournament.userProfile()?.name }}</div>
            <div class="text-slate-400" *ngIf="isDebater()">Record: {{ getMyRecord().wins }}W - {{ getMyRecord().losses }}L</div>
          </div>
          <button (click)="tournament.logout()" class="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-2 rounded transition-colors" aria-label="Log Out">Log Out</button>
        </div>
      </header>

      <app-admin *ngIf="isAdmin()" />

      <!-- DEBATER / JUDGE VIEW -->
      <div *ngIf="!isAdmin()" class="h-[calc(100vh-64px)] flex flex-col">
        
        <!-- Dashboard -->
        <div *ngIf="!tournament.activeDebateId()" class="p-8 max-w-4xl mx-auto w-full">
          <!-- Debater Stats Panel -->
          <div *ngIf="isDebater()" class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8 flex items-center justify-around">
              <div class="text-center">
                 <div class="text-3xl font-bold text-green-600">{{ getMyRecord().wins }}</div>
                 <div class="text-xs font-bold text-slate-400 uppercase">Wins</div>
              </div>
              <div class="h-12 w-px bg-slate-100"></div>
              <div class="text-center">
                 <div class="text-3xl font-bold text-red-600">{{ getMyRecord().losses }}</div>
                 <div class="text-xs font-bold text-slate-400 uppercase">Losses</div>
              </div>
          </div>

          <h2 class="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
            {{ isDebater() ? 'Your Debates' : 'Judge Assignments' }}
          </h2>
          
          <div class="grid gap-4">
            <div *ngFor="let debate of tournament.getMyAssignments()" 
                 (click)="tournament.activeDebateId.set(debate.id)"
                 class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all group">
              <div class="flex justify-between">
                <span class="bg-slate-800 text-white text-xs font-bold px-2 py-1 rounded">ENTER ROUND</span>
                <span class="text-xs text-slate-400 group-hover:text-blue-600">Click to Open &rarr;</span>
              </div>
              <h3 class="text-xl font-bold text-slate-800 mt-3 mb-2">{{ debate.topic }}</h3>
              <div class="flex items-center gap-4 text-sm text-slate-600">
                <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-blue-500"></span> <strong>Aff:</strong> {{ debate.affName }}</div>
                <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-500"></span> <strong>Neg:</strong> {{ debate.negName }}</div>
              </div>
            </div>
            <div *ngIf="tournament.getMyAssignments().length === 0" class="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
              <p class="text-slate-400">No debates found.</p>
              <p class="text-xs text-slate-300 mt-1">Wait for the administrator to match you.</p>
            </div>
          </div>
          
          <!-- Debater Feedback Section -->
          <div *ngIf="isDebater()" class="mt-8">
             <h2 class="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Past Ballots & Feedback</h2>
             <div class="space-y-4">
                <div *ngFor="let res of getMyBallots()" class="bg-slate-50 p-4 rounded border border-slate-200">
                   <div class="flex justify-between text-xs font-bold mb-2">
                       <span class="text-slate-600">Judge: {{ res.judgeName }}</span>
                       <span [class.text-blue-600]="res.decision === 'Aff'" [class.text-red-600]="res.decision === 'Neg'">Vote: {{ res.decision }}</span>
                   </div>
                   <p class="text-sm text-slate-600 italic">"{{ res.rfd }}"</p>
                </div>
                <div *ngIf="getMyBallots().length === 0" class="text-xs text-slate-400 italic">No feedback received yet.</div>
             </div>
          </div>

        </div>

        <!-- Active Round View -->
        <div *ngIf="tournament.activeDebateId()" class="flex flex-col h-full overflow-hidden">
          <app-timer class="flex-none" />
          <div class="bg-slate-100 px-4 py-1 text-xs text-center border-b border-slate-200 flex justify-between items-center">
             <span class="font-bold text-slate-600">Topic: {{ getCurrentDebate()?.topic }}</span>
             <button (click)="tournament.activeDebateId.set(null)" class="text-red-500 hover:underline">Exit Round</button>
          </div>
          <main class="flex-1 p-4 overflow-hidden relative"><app-flow class="h-full block" /></main>
          <footer class="bg-white border-t border-slate-200 p-2 flex-none z-40">
            <div class="max-w-7xl mx-auto flex justify-between items-center">
              <div class="text-xs text-slate-400"><strong>DebateMate</strong> 2025</div>
              <button (click)="showBallot.set(!showBallot())" class="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-all">
                {{ isDebater() ? 'View Feedback' : 'Score Round' }}
              </button>
            </div>
            <div *ngIf="showBallot()" class="border-t border-slate-100 mt-2 p-4 bg-slate-50 max-h-[60vh] overflow-y-auto"><div class="max-w-3xl mx-auto"><app-ballot /></div></div>
          </footer>
        </div>
      </div>
      <app-global-tooltip />
    </div>
  \`
})
export class AppComponent {
  tournament = inject(TournamentService);
  showBallot = signal(false);
  
  isAdmin = computed(() => this.tournament.userRole() === 'Admin');
  isJudge = computed(() => this.tournament.userRole() === 'Judge');
  isDebater = computed(() => this.tournament.userRole() === 'Debater');

  getCurrentDebate() { return this.tournament.debates().find(d => d.id === this.tournament.activeDebateId()); }
  getMyRecord() { return this.tournament.getMyDebaterRecord(); }

  getMyBallots() {
    const uid = this.tournament.userProfile()?.id;
    if (!uid) return [];
    // Find all debates where I was a participant
    const myDebateIds = this.tournament.debates()
        .filter(d => d.affId === uid || d.negId === uid)
        .map(d => d.id);
    
    return this.tournament.results().filter(r => myDebateIds.includes(r.debateId));
  }
}`
  }
];

// --- 2. EXECUTION ---
console.log('📦 Starting DebateMate Installation...');

files.forEach(file => {
  const fullPath = path.join(__dirname, file.path);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, file.content);
  console.log(`✅ Created: ${file.path}`);
});

console.log('\n🎉 Files generated successfully!');
console.log('\n👉 NEXT STEPS:');
console.log('1. Run this command to install dependencies:');
console.log('   npm install tailwindcss @tailwindcss/postcss postcss html-to-image jspdf firebase');
console.log('2. Start the server:');
console.log('   npm start');