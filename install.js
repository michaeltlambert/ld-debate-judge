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
DebateMate is a real-time Lincoln-Douglas adjudication system. It allows multiple independent tournaments to run simultaneously using unique **Tournament IDs**.

### **Roles**
1.  **Tournament Admin:** Creates a tournament, gets a unique **Code**, matches debaters, and finalizes rounds.
2.  **Judge:** Enters the Tournament Code to join the pool, receives assignments, and submits ballots.
3.  **Debater:** Enters the Tournament Code, views pairings, and tracks their record.

### **Tech Stack**
* **Framework:** Angular v21 (Signals)
* **Backend:** Firebase Firestore (Filtered Queries)
* **Styling:** Tailwind CSS v4

## 🚀 Getting Started
1.  **Install:** \`npm install\`
2.  **Run:** \`npm start\`
3.  **Workflow:**
    * **Admin:** Select "Create Tournament" on login. Share the **6-character Code** displayed in the dashboard.
    * **Participants:** Enter Name, Role, and the **Code** to join.
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
    path: 'src/app/config.ts',
    content: `// --- APPLICATION CONFIGURATION ---

export const AppConfig = {
  // PASTE FIREBASE CONFIG HERE
  firebase: {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "...",
    appId: "..."
  },
  
  features: {
    enableOfflineMode: true,
    prepTimeSeconds: 240,
    maxJudgesPerRound: 3
  }
};`
  },
  {
    path: 'src/app/tournament.service.ts',
    content: `import { Injectable, signal, computed } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, updateDoc, 
  onSnapshot, setDoc, deleteDoc, query, where, getDocs
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, 
  User, signInWithCustomToken, signOut 
} from 'firebase/auth';
import { AppConfig } from './config';

// --- DATA MODELS ---
export interface Debate {
  id: string;
  tournamentId: string; // Scope
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
  tournamentId: string; // Scope
  name: string;
  isOnline: boolean;
  role: 'Admin' | 'Judge' | 'Debater';
}

export interface RoundResult {
  id: string;
  tournamentId: string; // Scope
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

export interface Notification {
  id: string;
  tournamentId: string;
  recipientId: string;
  message: string;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class TournamentService {
  user = signal<User | null>(null);
  userProfile = signal<UserProfile | null>(null);
  userRole = signal<'Admin' | 'Judge' | 'Debater'>('Debater');
  
  // Current Scope
  tournamentId = signal<string | null>(null);
  
  // Collections (Filtered by tournamentId)
  judges = signal<UserProfile[]>([]);
  debaters = signal<UserProfile[]>([]);
  debates = signal<Debate[]>([]);
  results = signal<RoundResult[]>([]);
  notifications = signal<Notification[]>([]);
  
  activeDebateId = signal<string | null>(null);

  // Standings (Scoped to current tournament)
  standings = computed(() => {
    const stats: Record<string, DebaterStats> = {};
    this.debaters().forEach(d => {
      stats[d.id] = { id: d.id, name: d.name, wins: 0, losses: 0 };
    });

    this.debates().forEach(debate => {
      if (debate.status !== 'Closed') return;
      if (!stats[debate.affId]) stats[debate.affId] = { id: debate.affId, name: debate.affName, wins: 0, losses: 0 };
      if (!stats[debate.negId]) stats[debate.negId] = { id: debate.negId, name: debate.negName, wins: 0, losses: 0 };

      const ballots = this.results().filter(r => r.debateId === debate.id);
      let affVotes = 0;
      let negVotes = 0;
      ballots.forEach(b => b.decision === 'Aff' ? affVotes++ : negVotes++);

      if (affVotes > negVotes) { stats[debate.affId].wins++; stats[debate.negId].losses++; } 
      else if (negVotes > affVotes) { stats[debate.negId].wins++; stats[debate.affId].losses++; }
    });

    return Object.values(stats).sort((a, b) => b.wins - a.wins);
  });

  private app: any;
  private db: any;
  private auth: any;
  private appId: string;
  private profileUnsubscribe: (() => void) | null = null;
  private notificationUnsubscribe: (() => void) | null = null;

  constructor() {
    this.appId = (window as any).__app_id || 'default-app';
    try {
      if (AppConfig.firebase.apiKey !== "YOUR_API_KEY") {
        this.app = initializeApp(AppConfig.firebase);
      } else {
        const envConfig = (window as any).__firebase_config;
        if (envConfig) this.app = initializeApp(JSON.parse(envConfig));
        else throw new Error("No valid config");
      }
      this.db = getFirestore(this.app);
      this.auth = getAuth(this.app);
      this.initAuth();
    } catch(e) {
      console.warn("Offline Mode active:", e);
      this.appId = 'demo-app';
    }
  }

  private async initAuth() {
    const initialToken = (window as any).__initial_auth_token;
    if (initialToken) await signInWithCustomToken(this.auth, initialToken);
    else await signInAnonymously(this.auth);

    onAuthStateChanged(this.auth, (u) => {
      this.user.set(u);
      if (u) this.restoreSession(u.uid);
    });
  }

  private restoreSession(uid: string) {
    const savedName = localStorage.getItem('debate-user-name');
    const savedRole = localStorage.getItem('debate-user-role') as any;
    const savedTid = localStorage.getItem('debate-tournament-id');

    if (savedName && savedRole && savedTid) {
      this.tournamentId.set(savedTid);
      this.userRole.set(savedRole);
      this.userProfile.set({ id: uid, tournamentId: savedTid, name: savedName, role: savedRole, isOnline: true });
      this.updateCloudProfile(uid, savedName, savedRole, savedTid);
      this.watchMyProfile(uid, savedRole);
      this.watchNotifications(uid);
      this.startListeners(savedTid);
    }
  }

  private startListeners(tid: string) {
    if (!this.db) return;
    console.log('[DebateMate] Listening to Tournament:', tid);
    
    // All queries are filtered by tournamentId
    const qJudges = query(this.getCollection('judges'), where('tournamentId', '==', tid));
    onSnapshot(qJudges, (s) => this.judges.set(s.docs.map(d => ({id:d.id, ...d.data()} as UserProfile))));

    const qDebaters = query(this.getCollection('debaters'), where('tournamentId', '==', tid));
    onSnapshot(qDebaters, (s) => this.debaters.set(s.docs.map(d => ({id:d.id, ...d.data()} as UserProfile))));

    const qDebates = query(this.getCollection('debates'), where('tournamentId', '==', tid));
    onSnapshot(qDebates, (s) => this.debates.set(s.docs.map(d => ({id:d.id, ...d.data()} as Debate))));

    const qResults = query(this.getCollection('results'), where('tournamentId', '==', tid));
    onSnapshot(qResults, (s) => this.results.set(s.docs.map(d => ({id:d.id, ...d.data()} as RoundResult))));
  }
  
  async setProfile(name: string, role: 'Admin' | 'Judge' | 'Debater', tid: string) {
    let currentUser = this.user();
    if (!currentUser && this.auth) currentUser = this.auth.currentUser;
    const uid = currentUser?.uid || 'demo-' + Math.random().toString(36).substring(7);
    
    // Validate Unique Name within this Tournament
    const taken = await this.isNameTaken(name, tid);
    if (taken) throw new Error(\`Name "\${name}" is already taken in this tournament.\`);

    this.userRole.set(role);
    this.tournamentId.set(tid);
    
    const profile: UserProfile = { id: uid, tournamentId: tid, name, role, isOnline: true };

    localStorage.setItem('debate-user-name', name);
    localStorage.setItem('debate-user-role', role);
    localStorage.setItem('debate-tournament-id', tid);
    
    this.userProfile.set(profile);
    await this.updateCloudProfile(uid, name, role, tid);
    
    this.watchMyProfile(uid, role);
    this.watchNotifications(uid);
    this.startListeners(tid);
  }

  private async isNameTaken(name: string, tid: string): Promise<boolean> {
    if (!this.db) return false;
    const qJ = query(this.getCollection('judges'), where('tournamentId', '==', tid), where('name', '==', name));
    const sJ = await getDocs(qJ);
    if (!sJ.empty) return true;
    const qD = query(this.getCollection('debaters'), where('tournamentId', '==', tid), where('name', '==', name));
    const sD = await getDocs(qD);
    return !sD.empty;
  }

  private async updateCloudProfile(uid: string, name: string, role: string, tid: string) {
    if (this.db) {
      try {
        const collectionName = role === 'Debater' ? 'debaters' : (role === 'Judge' ? 'judges' : null);
        if (collectionName) {
          const ref = doc(this.db, 'artifacts', this.appId, 'public', 'data', collectionName, uid);
          await setDoc(ref, { id: uid, tournamentId: tid, name, role, isOnline: true }, { merge: true });
        }
      } catch (e) {}
    }
  }

  private watchMyProfile(uid: string, role: string) {
    if (!this.db || role === 'Admin') return;
    const collectionName = role === 'Debater' ? 'debaters' : (role === 'Judge' ? 'judges' : null);
    if (!collectionName) return;
    if (this.profileUnsubscribe) this.profileUnsubscribe();
    
    const ref = doc(this.db, 'artifacts', this.appId, 'public', 'data', collectionName, uid);
    this.profileUnsubscribe = onSnapshot(ref, (docSnap) => {
        if (!docSnap.exists() && this.userProfile()) this.logout();
    });
  }

  private watchNotifications(uid: string) {
    if (!this.db) return;
    if (this.notificationUnsubscribe) this.notificationUnsubscribe();
    const ref = this.getCollection('notifications');
    const q = query(ref, where('recipientId', '==', uid));
    this.notificationUnsubscribe = onSnapshot(q, (snapshot) => {
      this.notifications.set(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
    });
  }

  async sendNudge(judgeId: string) {
    if (!this.db) return;
    await addDoc(this.getCollection('notifications'), {
      tournamentId: this.tournamentId(),
      recipientId: judgeId,
      message: "Please submit your ballot for the current round!",
      timestamp: Date.now()
    });
  }

  async dismissNotification(id: string) {
    if (!this.db) { this.notifications.update(n => n.filter(x => x.id !== id)); return; }
    await deleteDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', 'notifications', id));
  }

  async logout() {
    if (this.profileUnsubscribe) this.profileUnsubscribe();
    if (this.notificationUnsubscribe) this.notificationUnsubscribe();
    
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
    localStorage.removeItem('debate-tournament-id');
    
    this.user.set(null);
    this.userProfile.set(null);
    this.tournamentId.set(null);
    this.activeDebateId.set(null);
    
    this.judges.set([]);
    this.debaters.set([]);
    this.debates.set([]);
    this.results.set([]);
  }

  async kickUser(userId: string, role: 'Judge' | 'Debater') {
      if (!this.db) return;
      const collectionName = role === 'Debater' ? 'debaters' : 'judges';
      await deleteDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', collectionName, userId));
  }

  async createDebate(topic: string, affId: string, affName: string, negId: string, negName: string) {
    const tid = this.tournamentId() || 'demo';
    const debate = { 
        tournamentId: tid, 
        topic, affId, affName, negId, negName, judgeIds: [], status: 'Open' as const 
    };
    if (!this.db) { 
        // FIX: Add 'id' property and cast to Debate to satisfy TS
        this.debates.update(d => [...d, { id: 'loc-'+Date.now(), ...debate } as Debate]); 
        return; 
    }
    await addDoc(this.getCollection('debates'), debate);
  }

  async deleteDebate(debateId: string) {
    if (!this.db) { this.debates.update(d => d.filter(x => x.id !== debateId)); return; }
    await deleteDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', 'debates', debateId));
  }

  async finalizeRound(debateId: string) {
    if (!this.db) { this.debates.update(d => d.map(x => x.id === debateId ? {...x, status: 'Closed'} : x)); return; }
    const ref = doc(this.db, 'artifacts', this.appId, 'public', 'data', 'debates', debateId);
    await updateDoc(ref, { status: 'Closed' });
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

  async submitBallot(debateId: string, result: Omit<RoundResult, 'id' | 'judgeId' | 'judgeName' | 'debateId' | 'tournamentId'>) {
    const debate = this.debates().find(d => d.id === debateId);
    if (debate?.status === 'Closed') throw new Error("Round is closed.");

    const uid = this.user()?.uid || 'anon';
    const name = this.userProfile()?.name || 'Anonymous';
    const tid = this.tournamentId() || 'demo';
    const finalResult = { 
        ...result, 
        tournamentId: tid,
        debateId, judgeId: uid, judgeName: name, timestamp: Date.now() 
    };

    if (this.db) {
        const ballotId = \`\${debateId}_\${uid}\`;
        const ref = doc(this.db, 'artifacts', this.appId, 'public', 'data', 'results', ballotId);
        await setDoc(ref, finalResult, { merge: true });
    }
  }
  
  private getCollection(name: string) {
    return collection(this.db, 'artifacts', this.appId, 'public', 'data', name);
  }

  // --- HELPERS ---
  getMyAssignments() {
    const uid = this.userProfile()?.id;
    if (!uid) return [];
    if (!this.db) return this.debates(); 
    return this.debates().filter(d => {
      const isJudge = d.judgeIds.includes(uid);
      const isDebater = d.affId === uid || d.negId === uid;
      if (this.userRole() === 'Debater') return isJudge || isDebater;
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
    return 'Pending'; 
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
        <h1 class="text-3xl font-bold text-slate-800 mb-1">Debate<span class="text-blue-600">Mate</span></h1>
        <p class="text-slate-500 mb-6">Tournament Portal</p>
        
        <div *ngIf="errorMsg" class="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm font-bold animate-pulse">
            {{ errorMsg }}
        </div>

        <div class="space-y-5">
          <!-- Role Selection -->
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-2">I am a...</label>
            <div class="grid grid-cols-3 gap-2" role="group">
              <button (click)="role = 'Debater'" 
                [class]="role === 'Debater' ? 'bg-purple-600 text-white ring-2 ring-purple-300' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'"
                class="p-2 rounded-lg font-bold text-sm transition-all border border-slate-200 text-sm">Debater</button>
              <button (click)="role = 'Judge'" 
                [class]="role === 'Judge' ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'"
                class="p-2 rounded-lg font-bold text-sm transition-all border border-slate-200 text-sm">Judge</button>
              <button (click)="role = 'Admin'" 
                [class]="role === 'Admin' ? 'bg-slate-800 text-white ring-2 ring-slate-400' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'"
                class="p-2 rounded-lg font-bold text-sm transition-all border border-slate-200 text-sm">Admin</button>
            </div>
          </div>

          <!-- Name Input -->
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Your Name</label>
            <input [(ngModel)]="name" type="text" placeholder="e.g. Jane Doe" 
              class="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>

          <!-- Tournament Actions -->
          <div class="border-t border-slate-100 pt-4 mt-4">
            <!-- Admin Create/Join -->
            <div *ngIf="role === 'Admin'">
              <div class="flex items-center gap-2 mb-3">
                <button (click)="adminMode = 'Create'; tid = ''" 
                   [class]="adminMode === 'Create' ? 'text-blue-600 underline' : 'text-slate-400'" class="text-sm font-bold">Create New</button>
                <span class="text-slate-300">|</span>
                <button (click)="adminMode = 'Manage'" 
                   [class]="adminMode === 'Manage' ? 'text-blue-600 underline' : 'text-slate-400'" class="text-sm font-bold">Manage Existing</button>
              </div>
              
              <div *ngIf="adminMode === 'Manage'">
                 <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Tournament Code</label>
                 <input [(ngModel)]="tid" type="text" placeholder="e.g. A1B2C3" 
                   class="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono uppercase">
              </div>
              <div *ngIf="adminMode === 'Create'" class="text-xs text-slate-500 bg-blue-50 p-3 rounded">
                 A unique 6-digit code will be generated for your new tournament.
              </div>
            </div>

            <!-- Participant Join -->
            <div *ngIf="role !== 'Admin'">
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Tournament Code</label>
              <input [(ngModel)]="tid" type="text" placeholder="Get this from Admin" 
                class="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono uppercase">
            </div>
          </div>

          <button (click)="enter()" [disabled]="(!name || (role !== 'Admin' && !tid) || (role==='Admin' && adminMode === 'Manage' && !tid)) || loading" 
            class="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all cursor-pointer flex justify-center">
            <span *ngIf="!loading">{{ (role === 'Admin' && adminMode === 'Create') ? 'Launch Tournament' : 'Enter Tournament' }}</span>
            <span *ngIf="loading" class="animate-pulse">Connecting...</span>
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
  adminMode: 'Create' | 'Manage' = 'Create';
  tid = '';
  errorMsg = '';
  loading = false;

  async enter() {
    this.errorMsg = '';
    
    // Auto-generate ID for new tournaments
    let targetTid = this.tid.toUpperCase();
    if (this.role === 'Admin' && this.adminMode === 'Create') {
        targetTid = Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    if (this.name && targetTid) {
      this.loading = true;
      try {
        await this.tournament.setProfile(this.name, this.role, targetTid);
      } catch (e: any) {
        this.errorMsg = e.message;
      } finally {
        this.loading = false;
      }
    }
  }
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
          <div class="bg-white px-4 py-2 rounded-lg shadow-sm border border-blue-200 flex flex-col items-center">
             <span class="text-[10px] font-bold text-slate-400 uppercase">Tournament Code</span>
             <span class="text-xl font-mono font-bold text-blue-600 tracking-widest select-all">{{ tournament.tournamentId() }}</span>
          </div>
          <button (click)="tournament.logout()" class="text-sm font-bold text-red-500 hover:text-red-700 underline" aria-label="Log Out">Log Out</button>
          <div class="flex items-center gap-2 text-sm bg-white px-3 py-1 rounded-full shadow-sm border border-slate-200">
            <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span>Live Sync Active</span>
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
              <input [(ngModel)]="newTopic" placeholder="Resolved: (Topic)" class="w-full p-2 border rounded text-sm bg-slate-50" aria-label="Debate Topic">
              
              <!-- Matchmaking Dropdowns -->
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

          <!-- Lists Panel: Judges & Debaters -->
          <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 class="font-bold text-slate-800 mb-4">Logged In Participants</h2>
            
            <div class="space-y-4">
              <!-- Active Judges -->
              <div>
                <h3 class="text-xs font-bold text-slate-500 uppercase mb-2 flex justify-between">
                  <span>Judges</span>
                  <span class="bg-blue-100 text-blue-800 px-2 rounded">{{ tournament.judges().length }}</span>
                </h3>
                <div class="max-h-32 overflow-y-auto space-y-1">
                  <div *ngFor="let j of tournament.judges()" class="flex items-center justify-between p-1.5 bg-slate-50 rounded text-sm">
                    <div class="flex items-center gap-2"><div class="w-2 h-2 bg-green-500 rounded-full"></div> {{ j.name }}</div>
                    <button (click)="tournament.kickUser(j.id, 'Judge')" class="text-slate-300 hover:text-red-500" title="Kick User"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg></button>
                  </div>
                  <div *ngIf="tournament.judges().length === 0" class="text-xs text-slate-400 italic">No judges online.</div>
                </div>
              </div>

              <hr class="border-slate-100">

              <!-- Active Debaters -->
              <div>
                <h3 class="text-xs font-bold text-slate-500 uppercase mb-2 flex justify-between">
                  <span>Debaters</span>
                  <span class="bg-purple-100 text-purple-800 px-2 rounded">{{ tournament.debaters().length }}</span>
                </h3>
                <div class="max-h-32 overflow-y-auto space-y-1">
                  <div *ngFor="let d of tournament.debaters()" class="flex items-center justify-between p-1.5 bg-slate-50 rounded text-sm">
                    <div class="flex items-center gap-2"><div class="w-2 h-2 bg-purple-500 rounded-full"></div> {{ d.name }}</div>
                    <button (click)="tournament.kickUser(d.id, 'Debater')" class="text-slate-300 hover:text-red-500" title="Kick User"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg></button>
                  </div>
                  <div *ngIf="tournament.debaters().length === 0" class="text-xs text-slate-400 italic">No debaters online.</div>
                </div>
              </div>
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
                <div class="flex items-center gap-3">
                    <h3 class="font-bold text-lg text-slate-800">{{ debate.topic }}</h3>
                    <span *ngIf="debate.status === 'Closed'" class="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded font-bold uppercase border border-gray-200">Finalized</span>
                    <span *ngIf="debate.status === 'Closed' && getWinner(debate.id) !== 'Pending'" class="bg-yellow-100 text-yellow-800 text-[10px] px-2 py-0.5 rounded font-bold border border-yellow-200">
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
                <div class="relative" *ngIf="debate.status === 'Open'">
                    <select #assignSelect (change)="assign(debate.id, assignSelect.value); assignSelect.value = ''" 
                      class="bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold py-2 px-3 rounded focus:outline-none hover:bg-slate-200 cursor-pointer" aria-label="Assign Judge">
                      <option value="" disabled selected>+ Add Judge</option>
                      <option *ngFor="let judge of getUnassignedJudges(debate)" [value]="judge.id">{{ judge.name }}</option>
                    </select>
                </div>
                <button *ngIf="debate.status === 'Open'" (click)="tournament.finalizeRound(debate.id)" class="bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded hover:bg-slate-900">Finalize</button>
                <button (click)="tournament.deleteDebate(debate.id)" class="text-slate-300 hover:text-red-500 p-2" title="Delete Debate"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg></button>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div *ngFor="let judgeId of debate.judgeIds" class="bg-slate-50 rounded-lg p-3 border border-slate-200 relative group">
                <div class="flex justify-between items-center mb-1">
                  <span class="text-xs font-bold text-slate-700 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-green-500"></span> {{ getJudgeName(judgeId) }}
                  </span>
                  <button *ngIf="debate.status === 'Open'" (click)="remove(debate.id, judgeId)" class="text-slate-300 hover:text-red-500 font-bold text-xs" aria-label="Remove Judge">Remove</button>
                </div>
                
                <div *ngIf="getResult(debate.id, judgeId) as res; else pending" class="animate-in fade-in bg-white p-2 rounded border border-slate-100 mt-2">
                  <div class="flex justify-between text-xs font-bold mb-1">
                    <span [class.text-blue-600]="res.decision === 'Aff'" [class.text-red-600]="res.decision === 'Neg'">Voted: {{ res.decision }}</span>
                  </div>
                  <div class="grid grid-cols-2 gap-2 text-center my-1">
                     <div class="bg-blue-50 rounded px-1"><span class="text-[10px] font-bold text-blue-600">AFF</span><span class="text-sm font-bold text-slate-700 block leading-none">{{ res.affScore }}</span></div>
                     <div class="bg-red-50 rounded px-1"><span class="text-[10px] font-bold text-red-600">NEG</span><span class="text-sm font-bold text-slate-700 block leading-none">{{ res.negScore }}</span></div>
                  </div>
                  <div class="text-[10px] text-slate-500 italic truncate mt-1">"{{ res.rfd }}"</div>
                </div>
                <ng-template #pending>
                  <div class="flex items-center justify-between w-full mt-2 pl-2">
                     <span class="text-[10px] text-slate-400">Pending...</span>
                     <button (click)="tournament.sendNudge(judgeId)" class="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200 font-bold flex items-center gap-1">🔔 Nudge</button>
                  </div>
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
    path: 'src/app/global-tooltip.component.ts',
    content: `import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipService } from './tooltip.service';

@Component({
  selector: 'app-global-tooltip',
  standalone: true,
  imports: [CommonModule],
  template: \`
    <div *ngIf="svc.isVisible()"
         class="fixed z-[9999] pointer-events-none transition-opacity duration-200"
         [style.top.px]="svc.coords().y"
         [style.left.px]="svc.coords().x"
         style="transform: translateX(-50%);">
      <div class="bg-slate-900 text-white text-xs p-3 rounded-lg shadow-2xl border border-slate-700 w-48 relative animate-in fade-in zoom-in-95 duration-100">
        <div class="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45 border-t border-l border-slate-700"></div>
        <span class="font-bold block mb-1 text-slate-300 uppercase text-[10px] tracking-wider">Definition</span>
        <p class="leading-relaxed">{{ svc.text() }}</p>
      </div>
    </div>
  \`
})
export class GlobalTooltipComponent {
  svc = inject(TooltipService);
}`
  },
  {
    path: 'src/app/term.component.ts',
    content: `import { Component, Input, ElementRef, ViewChild, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipService } from './tooltip.service';

@Component({
  selector: 'app-term',
  standalone: true,
  imports: [CommonModule],
  template: \`
    <span #trigger (mouseenter)="onEnter()" (mouseleave)="onLeave()"
          class="cursor-help underline decoration-dotted decoration-slate-400 underline-offset-4 decoration-2 hover:text-blue-600 hover:decoration-blue-400 transition-colors">
      <ng-content></ng-content>
    </span>
  \`
})
export class TermComponent {
  @Input() lookup: string = ''; 
  @ViewChild('trigger') trigger!: ElementRef;
  tooltipService = inject(TooltipService);
  onEnter() { const rect = this.trigger.nativeElement.getBoundingClientRect(); this.tooltipService.show(this.lookup, rect); }
  onLeave() { this.tooltipService.hide(); }
  @HostListener('window:scroll') onScroll() { this.tooltipService.hide(); }
}`
  },
  {
    path: 'src/app/timer.component.ts',
    content: `import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DebateService } from './debate.service';
import { TermComponent } from './term.component';

@Component({
  selector: 'app-timer',
  standalone: true,
  imports: [CommonModule, TermComponent],
  template: \`
    <div class="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
      <div class="max-w-[1920px] mx-auto px-4 py-2">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-3 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 min-w-[140px]">
            <div class="flex flex-col">
              <span class="text-[10px] font-bold text-blue-600 uppercase tracking-wide"><app-term lookup="Prep Time">Aff Prep</app-term></span>
              <span class="font-mono text-xl font-bold text-slate-700 leading-none">{{ debate.formatTime(debate.affPrep()) }}</span>
            </div>
            <button (click)="debate.toggleAffPrep()" class="ml-auto text-blue-600 hover:bg-blue-100 p-1 rounded-full" aria-label="Toggle Affirmative Prep">
               <svg *ngIf="debate.activeTimer() !== 'AFF_PREP'" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clip-rule="evenodd" /></svg>
               <svg *ngIf="debate.activeTimer() === 'AFF_PREP'" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path fill-rule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clip-rule="evenodd" /></svg>
            </button>
          </div>
          <div class="flex-1 flex items-center justify-center gap-6">
            <div class="bg-slate-900 text-white px-6 py-1 rounded-lg flex items-center gap-4 shadow-md min-w-[200px] justify-center">
              <span class="font-mono text-4xl font-bold tracking-tighter" [class.text-emerald-400]="debate.activeTimer() === 'SPEECH'">{{ debate.formatTime(debate.speechTimer()) }}</span>
              <button (click)="debate.toggleSpeech()" class="hover:text-emerald-400 transition-colors" aria-label="Toggle Speech Timer">
                <svg *ngIf="debate.activeTimer() !== 'SPEECH'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm14.024-.983a1.125 1.125 0 010 1.966l-5.603 3.113A1.125 1.125 0 019 15.113V8.887c0-.857.921-1.4 1.671-.983l5.603 3.113z" clip-rule="evenodd" /></svg>
                <svg *ngIf="debate.activeTimer() === 'SPEECH'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM9 8.25a.75.75 0 00-.75.75v6c0 .414.336.75.75.75h.75a.75.75 0 00.75-.75V9a.75.75 0 00-.75-.75H9zm5.25 0a.75.75 0 00-.75.75v6c0 .414.336.75.75.75H15a.75.75 0 00.75-.75V9a.75.75 0 00-.75-.75h-.75z" clip-rule="evenodd" /></svg>
              </button>
            </div>
          </div>
          <div class="flex items-center gap-3 bg-red-50 px-3 py-1 rounded-lg border border-red-100 min-w-[140px]">
            <button (click)="debate.toggleNegPrep()" class="text-red-600 hover:bg-red-100 p-1 rounded-full" aria-label="Toggle Negative Prep">
              <svg *ngIf="debate.activeTimer() !== 'NEG_PREP'" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clip-rule="evenodd" /></svg>
              <svg *ngIf="debate.activeTimer() === 'NEG_PREP'" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path fill-rule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clip-rule="evenodd" /></svg>
            </button>
            <div class="flex flex-col items-end">
              <span class="text-[10px] font-bold text-red-600 uppercase tracking-wide"><app-term lookup="Prep Time">Neg Prep</app-term></span>
              <span class="font-mono text-xl font-bold text-slate-700 leading-none">{{ debate.formatTime(debate.negPrep()) }}</span>
            </div>
          </div>
        </div>
        <div class="flex justify-center gap-1 mt-2 overflow-x-auto pb-1">
           <button *ngFor="let p of debate.phases" (click)="debate.setPhase(p)" class="text-[10px] font-bold px-3 py-1 rounded-full border transition-all whitespace-nowrap" [class]="debate.currentPhase().id === p.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'">{{ p.id }}</button>
        </div>
      </div>
    </div>
  \`
})
export class TimerComponent {
  debate = inject(DebateService);
}`
  },
  {
    path: 'src/app/ballot.component.ts',
    content: `import { Component, inject, signal, effect, computed } from '@angular/core';
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
              <span class="text-xs text-slate-500 font-mono" *ngIf="!isLocked()">Secure Submission</span>
              <span class="text-xs text-red-600 font-bold uppercase bg-red-50 px-2 py-1 rounded" *ngIf="isLocked()">Round Locked</span>
            </div>
            <button (click)="toggleHints()" class="text-xs font-semibold px-3 py-1.5 rounded-full transition-all" [ngClass]="showHints() ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'" aria-label="Toggle Judge Guidelines">{{ showHints() ? 'Hide Guidelines' : 'Show Guidelines' }}</button>
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
                <div class="flex items-center gap-2"><input type="number" min="0" max="30" [ngModel]="affPoints()" (ngModelChange)="setAff($event)" (input)="checkInput($event, 'aff')" [disabled]="isLocked()" class="w-full text-center text-xl font-mono font-bold border border-slate-300 rounded p-2 focus:ring-2 focus:ring-blue-500 shadow-sm disabled:bg-slate-100" aria-label="Affirmative Points"><span class="text-xs text-slate-400 font-medium">/ 30</span></div>
                <div *ngIf="affPoints() > negPoints()" class="text-[10px] text-center text-blue-600 font-bold uppercase mt-2 tracking-wider">High Point Winner</div>
              </div>
              <div class="bg-slate-50 p-4 rounded-lg border transition-colors" [class.border-red-500]="negPoints() > affPoints()" [class.border-slate-100]="negPoints() <= affPoints()">
                <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Negative Points</label>
                 <div class="flex items-center gap-2"><input type="number" min="0" max="30" [ngModel]="negPoints()" (ngModelChange)="setNeg($event)" (input)="checkInput($event, 'neg')" [disabled]="isLocked()" class="w-full text-center text-xl font-mono font-bold border border-slate-300 rounded p-2 focus:ring-2 focus:ring-red-500 shadow-sm disabled:bg-slate-100" aria-label="Negative Points"><span class="text-xs text-slate-400 font-medium">/ 30</span></div>
                 <div *ngIf="negPoints() > affPoints()" class="text-[10px] text-center text-red-600 font-bold uppercase mt-2 tracking-wider">High Point Winner</div>
              </div>
            </div>
            
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Decision</label>
              <div class="flex gap-3">
                <button (click)="!isLocked() && manualOverride('Aff')" [class]="decision() === 'Aff' ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-200' : 'bg-white text-slate-400 border-slate-200 opacity-50 hover:opacity-100'" [class.opacity-50]="isLocked()" class="flex-1 py-4 border-2 rounded-xl font-bold text-lg transition-all flex flex-col items-center justify-center gap-1 relative overflow-hidden" aria-label="Vote for Affirmative"><span>Affirmative</span></button>
                <button (click)="!isLocked() && manualOverride('Neg')" [class]="decision() === 'Neg' ? 'bg-red-600 text-white border-red-600 ring-2 ring-red-200' : 'bg-white text-slate-400 border-slate-200 opacity-50 hover:opacity-100'" [class.opacity-50]="isLocked()" class="flex-1 py-4 border-2 rounded-xl font-bold text-lg transition-all flex flex-col items-center justify-center gap-1 relative overflow-hidden" aria-label="Vote for Negative"><span>Negative</span></button>
              </div>
            </div>
            
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Reason for Decision (RFD)</label>
              <textarea [(ngModel)]="rfdText" [disabled]="isLocked()" class="w-full h-32 border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 shadow-sm resize-none disabled:bg-slate-100" placeholder="I voted for the {{decision() || '...'}} because..." aria-label="Reason for Decision"></textarea>
            </div>
            
            <div class="pt-4 border-t border-slate-100 flex gap-4">
              <button (click)="exportToPdf()" class="flex-1 bg-white border border-slate-300 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-50 flex items-center justify-center gap-2" aria-label="Download PDF of Ballot"><span>Download PDF</span></button>
              <button *ngIf="!isLocked()" (click)="submitRound()" [disabled]="!decision() || affPoints() === negPoints()" [class.opacity-50]="!decision() || affPoints() === negPoints()" class="flex-[2] bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 flex items-center justify-center gap-3 shadow-lg transition-all" aria-label="Submit Ballot"><span>{{ isUpdate ? 'Update Ballot' : 'Submit Ballot' }}</span></button>
            </div>
            <p *ngIf="isLocked()" class="text-center text-xs text-slate-400 italic mt-2">Voting is closed for this round.</p>
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
      
      // Load existing ballot if found
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
  isLocked() { 
      const d = this.tournament.debates().find(x => x.id === this.tournament.activeDebateId());
      return d?.status === 'Closed';
  }

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
    if (this.isLocked()) return;
    if (!this.decision()) return;
    const debateId = this.tournament.activeDebateId();
    if (!debateId) return;

    this.tournament.submitBallot(debateId, {
      affScore: this.affPoints(), negScore: this.negPoints(), decision: this.decision()!, rfd: this.rfdText
    }).then(() => {
      alert(this.isUpdate ? "Ballot Updated!" : "Ballot Submitted!");
      this.isUpdate = true;
    }).catch(e => alert(e.message));
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
  id: string; text: string; colIdx: number; status: 'open' | 'addressed' | 'dropped'; parentId: string | null; isVoter?: boolean; comments?: string;
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
        <button (click)="resetFlow()" class="text-xs text-red-400 hover:text-red-600 underline" aria-label="Clear All Notes">Clear All</button>
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
                  <input type="text" [(ngModel)]="frameworks()[col.id].value" (ngModelChange)="saveData()" placeholder="e.g. Justice" class="flex-1 text-sm font-bold text-indigo-900 bg-white border border-indigo-100 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500" aria-label="Value Premise">
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-indigo-700 w-16 text-right"><app-term lookup="Value Criterion">Criterion</app-term>:</span>
                  <input type="text" [(ngModel)]="frameworks()[col.id].criterion" (ngModelChange)="saveData()" placeholder="e.g. Social Welfare" class="flex-1 text-sm font-medium text-indigo-800 bg-white border border-indigo-100 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500" aria-label="Value Criterion">
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
                <div class="mt-1 pt-1 border-t border-slate-100/50">
                   <input [(ngModel)]="arg.comments" (ngModelChange)="persistArgs()" placeholder="Add note..." class="w-full text-[10px] p-0.5 bg-transparent border-none focus:ring-0 placeholder:text-slate-300 text-slate-500 italic">
                </div>
              </div>
              <div class="mt-2"><input type="text" [placeholder]="col.isCx ? '+ Note Admission...' : '+ New Point...'" (keydown.enter)="addArg($event, i)" class="w-full text-xs p-2 bg-transparent border border-dashed border-slate-300 rounded hover:bg-white focus:ring-2 focus:ring-blue-500 transition-all" aria-label="Add new argument"></div>
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
  persistArgs() { this.arguments.update(a => [...a]); }
  toggleVoter(arg: DebateArgument) { this.arguments.update(args => args.map(a => a.id === arg.id ? { ...a, isVoter: !a.isVoter } : a)); }
  createLink(originalArg: DebateArgument, targetIdx: number) { 
    this.updateArgStatus(originalArg.id, 'addressed');
    const isSkip = targetIdx > originalArg.colIdx + 1;
    const sourceName = this.columns[originalArg.colIdx].id; 
    const sourceIsCx = this.columns[originalArg.colIdx].isCx;
    let prefix = 'Ref:';
    if (sourceIsCx) prefix = 'Grant in CX:'; else if (isSkip) prefix = \`Ref (\${sourceName}):\`;
    this.arguments.update(args => [...args, { id: crypto.randomUUID(), text: \`\${prefix} "\${originalArg.text.substring(0, 15)}..."\`, colIdx: targetIdx, status: 'open', parentId: originalArg.id, isVoter: false, comments: '' }]);
    this.activeLinkId.set(null);
  }
  addArg(event: any, colIdx: number) { 
    const text = event.target.value.trim();
    if (!text) return;
    this.arguments.update(args => [...args, { id: crypto.randomUUID(), text, colIdx, status: 'open', parentId: null, isVoter: false, comments: '' }]);
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
            <!-- Safe navigation to prevent "Object is possibly undefined" errors -->
            <div class="font-bold text-slate-700">{{ tournament.userProfile()?.name }}</div>
            <div class="text-slate-400" *ngIf="isDebater()">Record: {{ getMyRecord().wins }}W - {{ getMyRecord().losses }}L</div>
          </div>
          <button (click)="tournament.logout()" class="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-2 rounded transition-colors" aria-label="Log Out">
            Log Out
          </button>
        </div>
      </header>

      <div *ngFor="let n of tournament.notifications()" class="bg-yellow-500 text-white px-4 py-2 text-center text-sm font-bold flex justify-between items-center sticky top-[60px] z-50 shadow-md animate-in slide-in-from-top">
         <div class="flex items-center gap-2 mx-auto">
           <span>🔔</span>
           <span>{{ n.message }}</span>
         </div>
         <button (click)="tournament.dismissNotification(n.id)" class="hover:bg-yellow-600 p-1 rounded">&times;</button>
      </div>

      <app-admin *ngIf="isAdmin()" />

      <!-- DEBATER / JUDGE VIEW -->
      <div *ngIf="!isAdmin()" class="h-[calc(100vh-64px)] flex flex-col">
        
        <!-- Dashboard -->
        <div *ngIf="!tournament.activeDebateId()" class="p-8 max-w-4xl mx-auto w-full">
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
                <span class="bg-slate-800 text-white text-xs font-bold px-2 py-1 rounded">
                    {{ debate.status === 'Closed' ? 'CLOSED' : 'OPEN ROUND' }}
                </span>
                <span class="text-xs text-slate-400 group-hover:text-blue-600">Click to Open &rarr;</span>
              </div>
              <h3 class="text-xl font-bold text-slate-800 mt-3 mb-2">{{ debate.topic }}</h3>
              <div class="flex items-center gap-4 text-sm text-slate-600">
                <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-blue-500"></span> <strong>Aff:</strong> {{ debate.affName }}</div>
                <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-500"></span> <strong>Neg:</strong> {{ debate.negName }}</div>
              </div>
            </div>
            <div *ngIf="tournament.getMyAssignments().length === 0" class="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
              <p class="text-slate-400">No debates active.</p>
              <p class="text-xs text-slate-300 mt-1">Wait for the administrator.</p>
            </div>
          </div>
          
          <div *ngIf="isDebater() && getMyBallots().length > 0" class="mt-12">
             <h2 class="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Past Ballots & Feedback</h2>
             <div class="space-y-4">
                <div *ngFor="let res of getMyBallots()" class="bg-slate-50 p-4 rounded border border-slate-200">
                   <div class="flex justify-between text-xs font-bold mb-2">
                       <span class="text-slate-600">Judge: {{ res.judgeName }}</span>
                       <span [class.text-blue-600]="res.decision === 'Aff'" [class.text-red-600]="res.decision === 'Neg'">Vote: {{ res.decision }}</span>
                   </div>
                   <p class="text-sm text-slate-600 italic">"{{ res.rfd }}"</p>
                </div>
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