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
3.  **Debater:** Logs in to register for the tournament and view their own record.

### **Tech Stack**
* **Framework:** Angular v21 (Signals Architecture)
* **Backend:** Firebase Firestore (Real-time Sync) & Auth (Anonymous)
* **Styling:** Tailwind CSS v4
* **Export:** PDF Generation (\`html-to-image\`)

---

## 🏗 Data Architecture (Firestore)

### **Collections**
All data is stored under strict paths for security: \`/artifacts/{appId}/public/data/{collection}\`.

1.  **\`judges\`** & **\`debaters\`** (Profiles)
    * \`id\`: UID
    * \`name\`: Display Name
    * \`isOnline\`: Boolean status

2.  **\`debates\`**
    * \`topic\`: "Resolved: ..."
    * \`affId\` / \`negId\`: UIDs of the debaters
    * \`affName\` / \`negName\`: Cached names for display
    * \`judgeIds\`: Array of judge UIDs
    * \`status\`: 'Open' | 'Closed'

3.  **\`results\`** (Submitted Ballots)
    * \`debateId\`: Link to Debate
    * \`judgeId\`: Link to Judge
    * \`decision\`: 'Aff' | 'Neg' (Used to calculate W/L)

---

## 🚀 Getting Started
1.  **Install:** \`npm install\`
2.  **Run:** \`npm start\`
3.  **Login:** * **Debaters:** Log in first so your name appears in the Admin's list.
    * **Admin:** Log in to see the "Registered Debaters" list and create matches.
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
  onSnapshot, setDoc
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, 
  User, signInWithCustomToken, signOut 
} from 'firebase/auth';

// --- DATA MODELS ---
export interface Debate {
  id: string;
  topic: string;
  affId: string; // Debater UID
  affName: string;
  negId: string; // Debater UID
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
  
  // Collections
  judges = signal<UserProfile[]>([]);
  debaters = signal<UserProfile[]>([]);
  debates = signal<Debate[]>([]);
  results = signal<RoundResult[]>([]);
  
  activeDebateId = signal<string | null>(null);

  // Computed Standings (Leaderboard)
  standings = computed(() => {
    const stats: Record<string, DebaterStats> = {};
    
    // Initialize stats for all registered debaters
    this.debaters().forEach(d => {
      stats[d.id] = { id: d.id, name: d.name, wins: 0, losses: 0 };
    });

    // Calculate based on Results + Debate Link
    this.results().forEach(r => {
      const debate = this.debates().find(d => d.id === r.debateId);
      if (debate) {
        // Ensure stats objects exist (in case debater deleted but record remains)
        if (!stats[debate.affId]) stats[debate.affId] = { id: debate.affId, name: debate.affName, wins: 0, losses: 0 };
        if (!stats[debate.negId]) stats[debate.negId] = { id: debate.negId, name: debate.negName, wins: 0, losses: 0 };

        if (r.decision === 'Aff') {
          stats[debate.affId].wins++;
          stats[debate.negId].losses++;
        } else {
          stats[debate.negId].wins++;
          stats[debate.affId].losses++;
        }
      }
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
      this.userProfile.set({ id: uid, name: savedName, role: savedRole, isOnline: true });
    }
  }

  private startListeners() {
    if (!this.db) return;
    
    // Listen to Judges
    onSnapshot(this.getCollection('judges'), (snap) => {
      this.judges.set(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
    });

    // Listen to Debaters
    onSnapshot(this.getCollection('debaters'), (snap) => {
      this.debaters.set(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
    });

    // Listen to Debates
    onSnapshot(this.getCollection('debates'), (snap) => {
      this.debates.set(snap.docs.map(d => ({ id: d.id, ...d.data() } as Debate)));
    });

    // Listen to Results
    onSnapshot(this.getCollection('results'), (snap) => {
      this.results.set(snap.docs.map(d => ({ id: d.id, ...d.data() } as RoundResult)));
    });
  }
  
  async setProfile(name: string, role: 'Admin' | 'Judge' | 'Debater') {
    const uid = this.user()?.uid || 'demo-' + Math.random();
    const profile: UserProfile = { id: uid, name, role, isOnline: true };

    localStorage.setItem('debate-user-name', name);
    localStorage.setItem('debate-user-role', role);
    
    // Save to public directories for Admin visibility
    if (this.db && this.user()) {
      try {
        const collectionName = role === 'Debater' ? 'debaters' : (role === 'Judge' ? 'judges' : null);
        if (collectionName) {
          const ref = doc(this.db, 'artifacts', this.appId, 'public', 'data', collectionName, profile.id);
          await setDoc(ref, profile);
        }
      } catch (e) { console.warn('Offline mode: Profile not saved to cloud'); }
    }
    
    this.userProfile.set(profile);
  }

  async logout() {
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

  async submitBallot(debateId: string, result: Omit<RoundResult, 'id' | 'judgeId' | 'judgeName' | 'debateId'>) {
    const uid = this.user()?.uid || 'anon';
    const name = this.userProfile()?.name || 'Anonymous';
    const finalResult = { ...result, debateId, judgeId: uid, judgeName: name, timestamp: Date.now() };

    if (this.db) {
        await addDoc(this.getCollection('results'), finalResult);
    } else {
        console.log('Ballot submitted locally (Offline Mode):', finalResult);
    }
  }
  
  private getCollection(name: string) {
    return collection(this.db, 'artifacts', this.appId, 'public', 'data', name);
  }

  // --- HELPERS ---
  getMyAssignments() {
    const uid = this.userProfile()?.id;
    if (!uid) return [];
    if (!this.db) return this.debates(); // Demo mode shows all
    return this.debates().filter(d => {
      const isAssigned = d.judgeIds.includes(uid) && d.status === 'Open';
      const alreadyVoted = this.results().some(r => r.debateId === d.id && r.judgeId === uid);
      return isAssigned && !alreadyVoted;
    });
  }

  getMyDebaterRecord() {
    const uid = this.userProfile()?.id;
    if (!uid) return { wins: 0, losses: 0 };
    return this.standings().find(s => s.id === uid) || { id: uid, name: '', wins: 0, losses: 0 };
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
          <button (click)="tournament.logout()" class="text-sm font-bold text-red-500 hover:text-red-700 underline">Log Out</button>
          <div class="flex items-center gap-2 text-sm bg-white px-3 py-1 rounded-full shadow-sm border border-slate-200">
            <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span>Live Sync</span>
          </div>
        </div>
      </header>

      <main class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <!-- LEFT COLUMN: Matchmaking (4 Cols) -->
        <div class="lg:col-span-4 space-y-6">
          
          <!-- Create Debate -->
          <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 class="font-bold text-slate-800 mb-4">Matchmaking</h2>
            <div class="space-y-4">
              <input [(ngModel)]="newTopic" placeholder="Resolved: (Topic)" class="w-full p-2 border rounded text-sm bg-slate-50">
              
              <!-- Matchmaking Dropdowns -->
              <div class="space-y-2">
                <label class="text-xs font-bold text-blue-600 uppercase">Affirmative</label>
                <select [(ngModel)]="selectedAffId" class="w-full p-2 border rounded text-sm bg-white">
                  <option value="" disabled selected>Select Debater...</option>
                  <option *ngFor="let d of tournament.debaters()" [value]="d.id">{{ d.name }}</option>
                </select>
              </div>

              <div class="space-y-2">
                <label class="text-xs font-bold text-red-600 uppercase">Negative</label>
                <select [(ngModel)]="selectedNegId" class="w-full p-2 border rounded text-sm bg-white">
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

          <!-- Standings Leaderboard -->
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

        <!-- RIGHT COLUMN: Active Debates & Judges (8 Cols) -->
        <div class="lg:col-span-8 space-y-6">
          
          <div class="flex justify-between items-end">
            <h2 class="font-bold text-slate-700">Active Rounds</h2>
            <div class="text-xs text-slate-500"><span class="font-bold text-slate-900">{{ tournament.judges().length }}</span> Judges Online</div>
          </div>
          
          <div *ngFor="let debate of tournament.debates()" class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div class="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 class="font-bold text-lg text-slate-800">{{ debate.topic }}</h3>
                <div class="text-sm text-slate-500 mt-1 flex items-center gap-3">
                  <span class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-bold">{{ debate.affName }}</span>
                  <span class="text-slate-300 font-bold">vs</span>
                  <span class="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-bold">{{ debate.negName }}</span>
                </div>
              </div>
              <div class="relative">
                <select #assignSelect (change)="assign(debate.id, assignSelect.value); assignSelect.value = ''" 
                  class="bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold py-2 px-3 rounded focus:outline-none hover:bg-slate-200 cursor-pointer">
                  <option value="" disabled selected>+ Add Judge</option>
                  <option *ngFor="let judge of getUnassignedJudges(debate)" [value]="judge.id">{{ judge.name }}</option>
                </select>
              </div>
            </div>

            <!-- Judge Status Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div *ngFor="let judgeId of debate.judgeIds" class="bg-slate-50 rounded-lg p-3 border border-slate-200 relative group">
                <div class="flex justify-between items-center mb-1">
                  <span class="text-xs font-bold text-slate-700 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-green-500"></span> {{ getJudgeName(judgeId) }}
                  </span>
                  <button (click)="remove(debate.id, judgeId)" class="text-slate-300 hover:text-red-500 font-bold text-xs">Remove</button>
                </div>
                
                <div *ngIf="getResult(debate.id, judgeId) as res; else pending" class="animate-in fade-in bg-white p-2 rounded border border-slate-100 mt-2">
                  <div class="flex justify-between text-xs font-bold mb-1">
                    <span [class.text-blue-600]="res.decision === 'Aff'" [class.text-red-600]="res.decision === 'Neg'">Voted: {{ res.decision }}</span>
                    <span class="text-slate-400">{{ res.affScore }}-{{ res.negScore }}</span>
                  </div>
                  <div class="text-[10px] text-slate-500 italic truncate">"{{ res.rfd }}"</div>
                </div>
                <ng-template #pending>
                  <div class="text-[10px] text-slate-400 mt-2 pl-4">Waiting for ballot...</div>
                </ng-template>
              </div>
              <div *ngIf="debate.judgeIds.length === 0" class="col-span-2 text-center py-4 border-2 border-dashed border-slate-100 rounded-lg text-slate-300 text-xs italic">
                Waiting for judge assignment.
              </div>
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
  newTopic = ''; 
  selectedAffId = '';
  selectedNegId = '';

  create() { 
    // Find names from the IDs
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
}`
  },
  {
    path: 'src/app/tooltip.service.ts',
    content: `import { Injectable, signal } from '@angular/core';
import { DEBATE_TERMS } from './glossary.data';

@Injectable({ providedIn: 'root' })
export class TooltipService {
  text = signal<string>('');
  isVisible = signal<boolean>(false);
  coords = signal<{ x: number, y: number }>({ x: 0, y: 0 });

  show(lookupKey: string, rect: DOMRect) {
    const definition = DEBATE_TERMS[lookupKey] || DEBATE_TERMS[lookupKey.trim()] || 'Definition not found.';
    this.text.set(definition);
    this.coords.set({
      x: rect.left + (rect.width / 2),
      y: rect.bottom + 8 
    });
    this.isVisible.set(true);
  }

  hide() {
    this.isVisible.set(false);
  }
}`
  },
  {
    path: 'src/app/pdf.service.ts',
    content: `import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

@Injectable({ providedIn: 'root' })
export class PdfService {
  async generateBallotPdf(flowElementId: string, ballotElementId: string) {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const options = { backgroundColor: '#ffffff', pixelRatio: 2 };

      const ballotEl = document.getElementById(ballotElementId);
      if (!ballotEl) throw new Error(\`Element #\${ballotElementId} not found\`);

      const ballotImgData = await toPng(ballotEl, options);
      const ballotProps = pdf.getImageProperties(ballotImgData);
      const ballotImgHeight = (ballotProps.height * pdfWidth) / ballotProps.width;

      pdf.setFontSize(18);
      pdf.text('Official Debate Ballot', 10, 15);
      pdf.addImage(ballotImgData, 'PNG', 0, 25, pdfWidth, ballotImgHeight);

      pdf.addPage();
      const flowEl = document.getElementById(flowElementId);
      if (!flowEl) throw new Error(\`Element #\${flowElementId} not found\`);

      const originalOverflow = flowEl.style.overflow;
      flowEl.style.overflow = 'visible'; 

      const flowImgData = await toPng(flowEl, options);
      flowEl.style.overflow = originalOverflow;

      const flowProps = pdf.getImageProperties(flowImgData);
      const flowImgHeight = (flowProps.height * pdfWidth) / flowProps.width;

      pdf.text('Debate Flow / Notes', 10, 15);
      pdf.addImage(flowImgData, 'PNG', 0, 25, pdfWidth, flowImgHeight);

      pdf.save(\`Debate_Ballot_\${new Date().toISOString().slice(0,10)}.pdf\`);
    } catch (err) {
      console.error('Export Failed:', err);
      alert('Could not generate PDF. Please try again.\\nError: ' + err);
    }
  }
}`
  },
  {
    path: 'src/app/debate.service.ts',
    content: `import { Injectable, signal } from '@angular/core';

export interface Phase {
  id: string; name: string; time: number; hint: string;
}

export type TimerType = 'SPEECH' | 'AFF_PREP' | 'NEG_PREP' | 'IDLE';

@Injectable({ providedIn: 'root' })
export class DebateService {
  readonly PREP_ALLOWANCE = 240; 
  readonly phases: Phase[] = [
    { id: '1AC', name: 'Affirmative Constructive', time: 360, hint: 'Aff presents Value, Criterion, and Contentions.' },
    { id: 'CX1', name: 'Cross-Ex (Neg Questions)', time: 180, hint: 'Neg clarifies arguments. No new arguments.' },
    { id: '1NC', name: 'Negative Constructive', time: 420, hint: 'Neg presents case and attacks Aff.' },
    { id: 'CX2', name: 'Cross-Ex (Aff Questions)', time: 180, hint: 'Aff questions Neg. Look for contradictions.' },
    { id: '1AR', name: '1st Aff Rebuttal', time: 240, hint: 'Aff must answer ALL Neg attacks here.' },
    { id: '2NR', name: 'Negative Rebuttal', time: 360, hint: 'Neg closing speech. Crystallize voting issues.' },
    { id: '2AR', name: '2nd Aff Rebuttal', time: 180, hint: 'Aff closing speech. Explain why Aff wins.' },
  ];

  currentPhase = signal<Phase>(this.phases[0]);
  speechTimer = signal<number>(360);
  affPrep = signal<number>(this.PREP_ALLOWANCE);
  negPrep = signal<number>(this.PREP_ALLOWANCE);
  activeTimer = signal<TimerType>('IDLE');
  private intervalId: any;

  constructor() {
    this.intervalId = setInterval(() => { this.tick(); }, 1000);
  }

  private tick() {
    const type = this.activeTimer();
    if (type === 'SPEECH') {
      if (this.speechTimer() > 0) this.speechTimer.update(t => t - 1);
      else this.stop();
    } else if (type === 'AFF_PREP') {
      if (this.affPrep() > 0) this.affPrep.update(t => t - 1);
      else this.stop();
    } else if (type === 'NEG_PREP') {
      if (this.negPrep() > 0) this.negPrep.update(t => t - 1);
      else this.stop();
    }
  }

  toggleSpeech() { this.activeTimer() === 'SPEECH' ? this.stop() : this.activeTimer.set('SPEECH'); }
  toggleAffPrep() { this.activeTimer() === 'AFF_PREP' ? this.stop() : this.activeTimer.set('AFF_PREP'); }
  toggleNegPrep() { this.activeTimer() === 'NEG_PREP' ? this.stop() : this.activeTimer.set('NEG_PREP'); }
  stop() { this.activeTimer.set('IDLE'); }
  
  setPhase(phase: Phase) {
    this.stop();
    this.currentPhase.set(phase);
    this.speechTimer.set(phase.time);
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return \`\${m}:\${s < 10 ? '0' : ''}\${s}\`;
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
import { TournamentService } from './tournament.service';

@Component({
  selector: 'app-ballot',
  standalone: true,
  imports: [CommonModule, TermComponent, FormsModule],
  template: \`
    <div id="debate-ballot" class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
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
            <div *ngIf="affPoints() > negPoints()" class="text-[10px] text-center text-blue-600 font-bold uppercase mt-2 tracking-wider">High Point Winner</div>
          </div>
          <div class="bg-slate-50 p-4 rounded-lg border transition-colors" [class.border-red-500]="negPoints() > affPoints()" [class.border-slate-100]="negPoints() <= affPoints()">
            <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Negative Points</label>
             <div class="flex items-center gap-2"><input type="number" min="0" max="30" [ngModel]="negPoints()" (ngModelChange)="setNeg($event)" (input)="checkInput($event, 'neg')" class="w-full text-center text-xl font-mono font-bold border border-slate-300 rounded p-2 focus:ring-2 focus:ring-red-500 shadow-sm"><span class="text-xs text-slate-400 font-medium">/ 30</span></div>
             <div *ngIf="negPoints() > affPoints()" class="text-[10px] text-center text-red-600 font-bold uppercase mt-2 tracking-wider">High Point Winner</div>
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
          <button (click)="submitRound()" [disabled]="!decision() || affPoints() === negPoints()" [class.opacity-50]="!decision() || affPoints() === negPoints()" class="flex-[2] bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 flex items-center justify-center gap-3 shadow-lg transition-all"><span>Submit Ballot to Cloud</span></button>
        </div>
        <p *ngIf="affPoints() === negPoints()" class="text-xs text-center text-red-500 mt-2 font-bold">Points cannot be tied in Lincoln-Douglas debate.</p>
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

  constructor() {
    effect(() => {
      this.tournament.activeDebateId();
      setTimeout(() => this.resetBallot(), 0);
    }, { allowSignalWrites: true });
  }

  resetBallot() {
    this.affPoints.set(28);
    this.negPoints.set(28);
    this.decision.set(null);
    this.rfdText = '';
  }

  submitRound() {
    if (!this.decision()) return;
    const debateId = this.tournament.activeDebateId();
    if (!debateId) { alert("Error: No active debate found."); return; }
    this.tournament.submitBallot(debateId, {
      affScore: this.affPoints(), negScore: this.negPoints(), decision: this.decision()!, rfd: this.rfdText
    }).then(() => {
      alert("Ballot Submitted Successfully!");
      this.tournament.activeDebateId.set(null);
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
    path: 'src/app/flow.component.ts',
    content: `import { Component, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TermComponent } from './term.component';
import { TournamentService } from './tournament.service';

export interface DebateArgument {
  id: string; text: string; colIdx: number; status: 'open' | 'addressed' | 'dropped'; parentId: string | null; isVoter?: boolean;
}
interface ColumnDef { id: string; name: string; isCx: boolean; }
interface FrameworkData { value: string; criterion: string; }

@Component({
  selector: 'app-flow',
  standalone: true,
  imports: [CommonModule, FormsModule, TermComponent],
  template: \`
    <div id="debate-flow" class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h2 class="font-bold text-slate-700">Interactive Flow Sheet</h2>
          <p class="text-xs text-slate-500">Star <span class="text-purple-600 font-bold">★ Voting Issues</span> to track winning arguments.</p>
        </div>
        <button (click)="resetFlow()" class="text-xs text-red-400 hover:text-red-600 underline">Clear All</button>
      </div>
      <div class="flex-1 overflow-x-auto pb-12" (click)="closeMenus()"> 
        <div class="flex h-full min-w-max divide-x divide-slate-200 border border-slate-200 rounded-lg bg-slate-50">
          <div *ngFor="let col of columns; let i = index" class="flex flex-col group transition-all" [ngClass]="col.isCx ? 'w-64 bg-amber-50/50' : 'w-80 bg-slate-50'">
            <div class="p-3 text-center text-xs font-bold uppercase tracking-wider border-b border-slate-200 sticky top-0 z-20 shadow-sm" [ngClass]="col.isCx ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'">{{ col.name }}</div>
            <div class="flex-1 p-2 space-y-3 overflow-y-auto min-h-[400px]">
              <div *ngIf="['1AC', '1NC'].includes(col.id)" class="mb-4 p-3 rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/50">
                <div class="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2 text-center">Framework</div>
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-xs font-bold text-indigo-700 w-16 text-right"><app-term lookup="Value Premise">Value</app-term>:</span>
                  <input type="text" [(ngModel)]="frameworks()[col.id].value" (ngModelChange)="saveData()" placeholder="e.g. Justice" class="flex-1 text-sm font-bold text-indigo-900 bg-white border border-indigo-100 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-indigo-700 w-16 text-right"><app-term lookup="Value Criterion">Criterion</app-term>:</span>
                  <input type="text" [(ngModel)]="frameworks()[col.id].criterion" (ngModelChange)="saveData()" placeholder="e.g. Social Welfare" class="flex-1 text-sm font-medium text-indigo-800 bg-white border border-indigo-100 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                </div>
              </div>
              <div *ngFor="let arg of getArgsForCol(i)" class="relative p-3 rounded-lg border shadow-sm transition-all group/card" [ngClass]="{'bg-purple-50 border-purple-300 ring-1 ring-purple-200 shadow-md': arg.isVoter, 'bg-green-50 border-green-200 opacity-70': !arg.isVoter && arg.status === 'addressed', 'bg-red-50 border-red-200': !arg.isVoter && arg.status === 'dropped', 'bg-white border-slate-200': !arg.isVoter && arg.status === 'open'}">
                <div *ngIf="isLinkedToPrevious(arg)" class="absolute -left-3 top-4 w-3 h-[2px] bg-slate-300"></div>
                <div *ngIf="editingId() !== arg.id" (click)="editArg(arg.id, $event)" class="text-sm text-slate-800 whitespace-pre-wrap cursor-text min-h-[1.5rem]">{{ arg.text }}</div>
                <textarea *ngIf="editingId() === arg.id" [(ngModel)]="arg.text" (blur)="stopEditing()" (click)="$event.stopPropagation()" (keydown.enter)="$event.preventDefault(); stopEditing()" class="w-full text-sm p-1 border rounded focus:ring-2 focus:ring-blue-500 bg-white" autoFocus></textarea>
                <div class="mt-2 flex justify-between items-center opacity-0 group-hover/card:opacity-100 transition-opacity">
                  <div class="flex gap-1 items-center">
                    <button (click)="setDrop(arg); $event.stopPropagation()" title="Drop" class="p-1 hover:text-red-600 text-slate-400"><span class="font-bold text-xs">✕</span></button>
                    <button (click)="setAddressed(arg); $event.stopPropagation()" title="Address" class="p-1 hover:text-green-600 text-slate-400"><span class="font-bold text-xs">✓</span></button>
                    <div class="w-px h-3 bg-slate-200 mx-1"></div>
                    <button (click)="toggleVoter(arg); $event.stopPropagation()" class="p-1 transition-colors" [class]="arg.isVoter ? 'text-purple-600' : 'text-slate-300 hover:text-purple-500'"><svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clip-rule="evenodd" /></svg></button>
                    <div class="w-px h-3 bg-slate-200 mx-1"></div>
                    <button (click)="deleteArg(arg); $event.stopPropagation()" title="Delete" class="p-1 hover:text-slate-600 text-slate-300"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                  </div>
                  <div class="relative">
                    <button *ngIf="i < columns.length - 1" (click)="toggleLinkMenu(arg.id, $event)" class="text-xs px-2 py-1 rounded border font-medium flex items-center gap-1 transition-colors" [ngClass]="col.isCx ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'">Link ⤵</button>
                     <div *ngIf="activeLinkId() === arg.id" (click)="$event.stopPropagation()" class="absolute right-0 top-full mt-1 w-36 bg-white rounded shadow-lg border border-slate-200 z-50 flex flex-col py-1">
                      <button *ngFor="let target of getFutureColumns(i)" (click)="createLink(arg, target.idx)" class="text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 w-full">{{ target.name }}</button>
                    </div>
                  </div>
                </div>
                <div *ngIf="arg.status === 'dropped' && !arg.isVoter" class="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm z-10">DROP</div>
                <div *ngIf="arg.isVoter" class="absolute -top-2 -right-2 bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm z-10 flex items-center gap-1"><span>★</span> VOTER</div>
              </div>
              <div class="mt-2"><input type="text" [placeholder]="col.isCx ? '+ Note Admission...' : '+ New Point...'" (keydown.enter)="addArg($event, i)" class="w-full text-xs p-2 bg-transparent border border-dashed border-slate-300 rounded hover:bg-white focus:ring-2 focus:ring-blue-500 transition-all"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  \`
})
export class FlowComponent {
  tournament = inject(TournamentService);
  columns: ColumnDef[] = [
    { id: '1AC', name: '1. Affirmative Constructive', isCx: false },
    { id: 'CX1', name: 'Cross-Ex (Neg Questions)', isCx: true },
    { id: '1NC', name: '2. Negative Constructive', isCx: false },
    { id: 'CX2', name: 'Cross-Ex (Aff Questions)', isCx: true },
    { id: '1AR', name: '3. 1st Affirmative Rebuttal', isCx: false },
    { id: '2NR', name: '4. Negative Rebuttal', isCx: false },
    { id: '2AR', name: '5. 2nd Affirmative Rebuttal', isCx: false }
  ];
  arguments = signal<DebateArgument[]>([]);
  frameworks = signal<Record<string, FrameworkData>>({ '1AC': { value: '', criterion: '' }, '1NC': { value: '', criterion: '' } });
  editingId = signal<string | null>(null);
  activeLinkId = signal<string | null>(null);

  constructor() {
    this.loadData();
    effect(() => {
      localStorage.setItem('ld-flow-args', JSON.stringify(this.arguments()));
      localStorage.setItem('ld-flow-frameworks', JSON.stringify(this.frameworks()));
    });
    effect(() => {
      const activeId = this.tournament.activeDebateId();
      const lastDebateId = localStorage.getItem('ld-current-debate-id');
      if (activeId !== lastDebateId) {
        this.internalReset();
        if (activeId) localStorage.setItem('ld-current-debate-id', activeId);
        else localStorage.removeItem('ld-current-debate-id');
      }
    }, { allowSignalWrites: true });
  }

  internalReset() {
    this.arguments.set([]);
    this.frameworks.set({ '1AC': { value: '', criterion: '' }, '1NC': { value: '', criterion: '' } });
    this.editingId.set(null); this.activeLinkId.set(null);
    localStorage.setItem('ld-flow-args', '[]');
    localStorage.setItem('ld-flow-frameworks', JSON.stringify(this.frameworks()));
  }

  loadData() {
    try {
      const savedArgs = localStorage.getItem('ld-flow-args');
      const savedFrames = localStorage.getItem('ld-flow-frameworks');
      if (savedArgs) this.arguments.set(JSON.parse(savedArgs));
      if (savedFrames) this.frameworks.set(JSON.parse(savedFrames));
    } catch(e) { this.arguments.set([]); }
  }

  saveData() { localStorage.setItem('ld-flow-frameworks', JSON.stringify(this.frameworks())); }
  toggleVoter(arg: DebateArgument) { this.arguments.update(args => args.map(a => a.id === arg.id ? { ...a, isVoter: !a.isVoter } : a)); }
  createLink(originalArg: DebateArgument, targetIdx: number) { 
    this.updateArgStatus(originalArg.id, 'addressed');
    const isSkip = targetIdx > originalArg.colIdx + 1;
    const sourceName = this.columns[originalArg.colIdx].id; 
    const sourceIsCx = this.columns[originalArg.colIdx].isCx;
    let prefix = 'Ref:';
    if (sourceIsCx) prefix = 'Grant in CX:'; else if (isSkip) prefix = \`Ref (\${sourceName}):\`;
    this.arguments.update(args => [...args, { id: crypto.randomUUID(), text: \`\${prefix} "\${originalArg.text.substring(0, 15)}..."\`, colIdx: targetIdx, status: 'open', parentId: originalArg.id, isVoter: false }]);
    this.activeLinkId.set(null);
  }
  addArg(event: any, colIdx: number) { 
    const text = event.target.value.trim();
    if (!text) return;
    this.arguments.update(args => [...args, { id: crypto.randomUUID(), text, colIdx, status: 'open', parentId: null, isVoter: false }]);
    event.target.value = '';
  }
  getArgsForCol(idx: number) { return this.arguments().filter(a => a.colIdx === idx); }
  getFutureColumns(currentIdx: number) { return this.columns.map((col, idx) => ({ name: col.id, isCx: col.isCx, idx })).filter(c => c.idx > currentIdx); }
  isLinkedToPrevious(arg: DebateArgument): boolean { if (!arg.parentId) return false; const parent = this.arguments().find(a => a.id === arg.parentId); return parent ? (arg.colIdx === parent.colIdx + 1) : false; }
  toggleLinkMenu(id: string, e: Event) { e.stopPropagation(); this.activeLinkId.set(this.activeLinkId() === id ? null : id); }
  closeMenus() { this.activeLinkId.set(null); }
  deleteArg(arg: DebateArgument) { if (confirm('Delete note?')) this.arguments.update(args => args.filter(a => a.id !== arg.id)); }
  setDrop(arg: DebateArgument) { this.updateArgStatus(arg.id, 'dropped'); }
  setAddressed(arg: DebateArgument) { this.updateArgStatus(arg.id, 'addressed'); }
  updateArgStatus(id: string, status: any) { this.arguments.update(args => args.map(a => a.id === id ? { ...a, status } : a)); }
  editArg(id: string, e: Event) { e.stopPropagation(); this.editingId.set(id); }
  stopEditing() { this.editingId.set(null); }
  resetFlow() { if(confirm('Clear all notes?')) this.internalReset(); }
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
      
      <!-- HEADER with Logout -->
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
          <button (click)="tournament.logout()" class="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-2 rounded transition-colors">
            Log Out
          </button>
        </div>
      </header>

      <!-- ADMIN VIEW -->
      <app-admin *ngIf="isAdmin()" />

      <!-- DEBATER VIEW -->
      <div *ngIf="isDebater()" class="p-8 max-w-4xl mx-auto">
        <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
          <div class="w-20 h-20 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-4">
            {{ tournament.userProfile()?.name.charAt(0) }}
          </div>
          <h2 class="text-2xl font-bold text-slate-800">Welcome, {{ tournament.userProfile()?.name }}</h2>
          <p class="text-slate-500 mb-6">You are registered as a Debater.</p>
          
          <div class="grid grid-cols-2 gap-4 max-w-sm mx-auto mb-8">
            <div class="bg-green-50 p-4 rounded-xl border border-green-100">
              <div class="text-2xl font-bold text-green-600">{{ getMyRecord().wins }}</div>
              <div class="text-xs font-bold text-green-800 uppercase">Wins</div>
            </div>
            <div class="bg-red-50 p-4 rounded-xl border border-red-100">
              <div class="text-2xl font-bold text-red-600">{{ getMyRecord().losses }}</div>
              <div class="text-xs font-bold text-red-800 uppercase">Losses</div>
            </div>
          </div>

          <div class="text-sm text-slate-400 italic">
            Wait for the administrator to pair you in a round.<br>
            Your results will appear here automatically.
          </div>
        </div>
      </div>

      <!-- JUDGE VIEW -->
      <div *ngIf="isJudge()" class="h-[calc(100vh-64px)] flex flex-col">
        
        <!-- B1. JUDGE DASHBOARD (Select Round) -->
        <div *ngIf="!tournament.activeDebateId()" class="p-8 max-w-4xl mx-auto w-full">
          <h2 class="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Your Assignments</h2>
          
          <div class="grid gap-4">
            <div *ngFor="let debate of tournament.getMyAssignments()" 
                 (click)="tournament.activeDebateId.set(debate.id)"
                 class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all group">
              <div class="flex justify-between">
                <span class="bg-slate-800 text-white text-xs font-bold px-2 py-1 rounded">OPEN ROUND</span>
                <span class="text-xs text-slate-400 group-hover:text-blue-600">Click to Start &rarr;</span>
              </div>
              <h3 class="text-xl font-bold text-slate-800 mt-3 mb-2">{{ debate.topic }}</h3>
              <div class="flex items-center gap-4 text-sm text-slate-600">
                <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-blue-500"></span> <strong>Aff:</strong> {{ debate.affName }}</div>
                <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-500"></span> <strong>Neg:</strong> {{ debate.negName }}</div>
              </div>
            </div>

            <div *ngIf="tournament.getMyAssignments().length === 0" class="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
              <p class="text-slate-400">No debates assigned.</p>
              <p class="text-xs text-slate-300 mt-1">Please wait for the administrator.</p>
            </div>
          </div>
        </div>

        <!-- B2. JUDGING INTERFACE (Timer/Flow/Ballot) -->
        <div *ngIf="tournament.activeDebateId()" class="flex flex-col h-full overflow-hidden">
          <app-timer class="flex-none" />
          <div class="bg-slate-100 px-4 py-1 text-xs text-center border-b border-slate-200 flex justify-between items-center">
             <span class="font-bold text-slate-600">Judging: {{ getCurrentDebate()?.topic }}</span>
             <button (click)="tournament.activeDebateId.set(null)" class="text-red-500 hover:underline">Exit Round</button>
          </div>
          <main class="flex-1 p-4 overflow-hidden relative"><app-flow class="h-full block" /></main>
          <footer class="bg-white border-t border-slate-200 p-2 flex-none z-40">
            <div class="max-w-7xl mx-auto flex justify-between items-center">
              <div class="text-xs text-slate-400"><strong>DebateMate</strong> 2025</div>
              <button (click)="showBallot.set(!showBallot())" class="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-all">{{ showBallot() ? 'Hide Ballot' : 'Score Round' }}</button>
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