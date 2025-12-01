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
  @apply bg-slate-50 text-slate-900 font-sans antialiased;
}

/* Custom scrollbar for flow sheet */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: transparent; 
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1; 
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #94a3b8; 
}`
  },
  {
    path: 'README.md',
    content: `# DebateMate: Tournament Edition

## 📘 Project Overview
DebateMate is a real-time Lincoln-Douglas adjudication system designed for high usability and strict tournament management.

### **Features**
* **Multi-Tournament Architecture:** Admins can create, switch between, and archive multiple independent tournaments.
* **Strict Authentication:** Secure Email/Password login with persistent user profiles.
* **Real-Time Flow:** Judges and Debaters can track arguments and add comments live.
* **Automated Scoring:** Ballots automatically determine the winner based on point totals.
* **Tournament Brackets:** Visual tracking of elimination rounds.
* **PDF Export:** Judges can download their flow and ballot for records.
* **Historical Records:** Judges can view past ballots and flow sheets from their profile.

## 🔧 Configuration
Update \`src/app/config.ts\` with your API Keys.

## 🚀 Getting Started
1.  **Install:** \`npm install\`
2.  **Run:** \`npm start\`
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
    content: `export const AppConfig = {
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
    path: 'src/app/tournament.service.ts',
    content: `import { Injectable, signal, computed } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, updateDoc, 
  onSnapshot, setDoc, deleteDoc, query, where, getDocs, getDoc
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, 
  User, signInWithCustomToken, signOut, 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile
} from 'firebase/auth';
import { AppConfig } from './config';

export type RoundType = 'Prelim' | 'Elimination';
export type RoundStage = string;

export interface DebateArgument {
  id: string; text: string; colIdx: number; status: 'open' | 'addressed' | 'dropped'; parentId: string | null; isVoter?: boolean; comments?: string;
}
export interface FrameworkData { value: string; criterion: string; }

export interface TournamentMeta {
  id: string;
  name: string;
  ownerId: string;
  status: 'Active' | 'Closed';
  createdAt: number;
}

export interface Debate {
  id: string;
  tournamentId: string; 
  topic: string;
  type: RoundType;       
  stage: RoundStage;     
  affId: string;
  affName: string;
  negId: string;
  negName: string;
  judgeIds: string[]; 
  status: 'Open' | 'Closed';
  createdAt: number; // Added for sorting
}

export interface UserProfile {
  id: string; 
  tournamentId?: string | null; 
  name: string;
  email?: string;
  photoURL?: string;
  address?: string;
  phone?: string;
  isOnline: boolean;
  role: 'Admin' | 'Judge' | 'Debater';
  status?: 'Active' | 'Eliminated'; 
}

export interface RoundResult {
  id: string;
  tournamentId: string; 
  debateId: string;
  judgeId: string;
  judgeName: string;
  affScore: number;
  negScore: number;
  decision: 'Aff' | 'Neg';
  rfd: string;
  timestamp: number;
  flow?: DebateArgument[]; 
  frameworks?: Record<string, FrameworkData>;
}

export interface DebaterStats {
  id: string;
  name: string;
  wins: number;
  losses: number;
  status: 'Active' | 'Eliminated';
}

export interface Notification {
  id: string;
  tournamentId: string;
  recipientId: string;
  message: string;
  debateId?: string;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class TournamentService {
  user = signal<User | null>(null);
  userProfile = signal<UserProfile | null>(null);
  userRole = signal<'Admin' | 'Judge' | 'Debater'>('Debater');
  
  tournamentId = signal<string | null>(null);
  tournamentName = signal<string>(''); 
  
  judges = signal<UserProfile[]>([]);
  debaters = signal<UserProfile[]>([]);
  debates = signal<Debate[]>([]);
  results = signal<RoundResult[]>([]);
  notifications = signal<Notification[]>([]);
  
  myTournaments = signal<TournamentMeta[]>([]);
  
  currentTournamentStatus = computed(() => {
      const tid = this.tournamentId();
      return this.myTournaments().find(t => t.id === tid)?.status || 'Active';
  });
  
  isTournamentClosed = computed(() => this.currentTournamentStatus() === 'Closed');
  
  activeDebateId = signal<string | null>(null);
  
  currentFlow = signal<DebateArgument[]>([]);
  currentFrameworks = signal<Record<string, FrameworkData>>({});

  standings = computed(() => {
    const stats: Record<string, DebaterStats> = {};
    this.debaters().forEach(d => {
      stats[d.id] = { id: d.id, name: d.name, wins: 0, losses: 0, status: d.status || 'Active' };
    });

    this.debates().forEach(debate => {
      if (debate.status !== 'Closed') return;
      if (!stats[debate.affId]) stats[debate.affId] = { id: debate.affId, name: debate.affName, wins: 0, losses: 0, status: 'Active' };
      if (!stats[debate.negId]) stats[debate.negId] = { id: debate.negId, name: debate.negName, wins: 0, losses: 0, status: 'Active' };

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
  private tournamentUnsubscribe: (() => void) | null = null;
  private collectionUnsubscribes: (() => void)[] = [];

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
    if (initialToken && !this.auth.currentUser) await signInWithCustomToken(this.auth, initialToken);

    onAuthStateChanged(this.auth, (u) => {
      this.user.set(u);
      if (u) {
        if (!this.restoreSession(u.uid)) {
             this.recoverProfile(u.uid);
        }
      }
    });
  }

  // --- AUTH METHODS ---
  async registerWithEmail(email: string, pass: string, name: string, role: any, tid: string | null) {
     if (!this.auth) {
         await this.setProfile(name, role, tid);
         return;
     }
     if (tid) {
         const taken = await this.isNameTaken(name, tid);
         if (taken) throw new Error(\`Name "\${name}" is already taken.\`);
     }
     const cred = await createUserWithEmailAndPassword(this.auth, email, pass);
     await updateProfile(cred.user, { displayName: name });
     await this.setProfile(name, role, tid);
  }

  async loginWithEmail(email: string, pass: string) {
      if (!this.auth) throw new Error("Email Login requires Firebase config.");
      await signInWithEmailAndPassword(this.auth, email, pass);
  }

  private restoreSession(uid: string): boolean {
    const savedName = localStorage.getItem('debate-user-name');
    const savedRole = localStorage.getItem('debate-user-role') as any;
    const savedTid = localStorage.getItem('debate-tournament-id');
    const savedTName = localStorage.getItem('debate-tournament-name') || '';

    if (savedName && savedRole) {
       this.activateSession(uid, savedName, savedRole, savedTid, savedTName);
       return true;
    }
    return false;
  }

  private async recoverProfile(uid: string) {
      if (!this.db) return;
      const collections = ['judges', 'debaters', 'admins'];
      for (const col of collections) {
          const snap = await getDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', col, uid));
          if (snap.exists()) {
              const data = snap.data() as UserProfile;
              this.activateSession(uid, data.name, data.role, data.tournamentId, '');
              if (data.tournamentId) {
                  getDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', 'tournaments', data.tournamentId))
                    .then(t => { if(t.exists()) this.tournamentName.set((t.data() as any).name); });
              }
              return;
          }
      }
  }

  private activateSession(uid: string, name: string, role: any, tid: string | null | undefined, tName: string) {
      if (tid) this.tournamentId.set(tid); else this.tournamentId.set(null);
      if (tName) this.tournamentName.set(tName);

      this.userRole.set(role);
      this.userProfile.set({ id: uid, tournamentId: tid || null, name: name, role: role, isOnline: true });
      
      this.updateCloudProfile(uid, name, role, tid);
      
      if (tid) {
        this.watchMyProfile(uid, role);
        this.watchNotifications(uid);
        this.startListeners(tid);
      }
      
      if (role === 'Admin') this.fetchMyTournaments(uid);
  }
  
  async setProfile(name: string, role: 'Admin' | 'Judge' | 'Debater', tid: string | null, tName: string = '') {
    let currentUser = this.user();
    if (!currentUser && this.auth) currentUser = this.auth.currentUser;
    const uid = currentUser?.uid || 'demo-' + Math.random().toString(36).substring(7);
    
    if (!this.userProfile() && tid) {
        const taken = await this.isNameTaken(name, tid);
        if (taken && !currentUser) throw new Error(\`Name "\${name}" is already taken.\`);
    }

    this.userRole.set(role);
    if (tid) this.tournamentId.set(tid); else this.tournamentId.set(null);
    if (tName) this.tournamentName.set(tName);
    
    const profile: UserProfile = { id: uid, tournamentId: tid || null, name, role, isOnline: true, status: 'Active' };
    localStorage.setItem('debate-user-name', name);
    localStorage.setItem('debate-user-role', role);
    if (tid) localStorage.setItem('debate-tournament-id', tid); else localStorage.removeItem('debate-tournament-id');
    if (tName) localStorage.setItem('debate-tournament-name', tName);
    
    this.userProfile.set(profile);
    await this.updateCloudProfile(uid, name, role, tid);
    
    if (role === 'Admin') {
        await this.createTournamentRecord(tid || 'demo', uid); 
        this.fetchMyTournaments(uid);
    }

    if (tid) {
      this.watchMyProfile(uid, role);
      this.watchNotifications(uid);
      this.startListeners(tid);
    }
  }

  private async createTournamentRecord(tid: string, uid: string) {
      if (!this.db || tid === 'demo') return;
      const ref = doc(this.db, 'artifacts', this.appId, 'public', 'data', 'tournaments', tid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
          await setDoc(ref, { id: tid, ownerId: uid, status: 'Active', createdAt: Date.now() });
      }
  }

  private fetchAllTournaments() {
      if (!this.db) {
          this.myTournaments.update((t: TournamentMeta[]) => [...t, { id: this.tournamentId() || 'demo', name: 'Demo', ownerId: 'me', status: 'Active', createdAt: Date.now() }]);
          return;
      }
      const q = query(this.getCollection('tournaments')); 
      if (this.tournamentUnsubscribe) this.tournamentUnsubscribe();
      this.tournamentUnsubscribe = onSnapshot(q, (s) => {
          this.myTournaments.set(s.docs.map(d => d.data() as TournamentMeta));
      });
  }

  private fetchMyTournaments(uid: string) {
      if (!this.db) {
          this.myTournaments.set([{ id: this.tournamentId() || 'demo', name: 'Demo Tournament', ownerId: uid, status: 'Active', createdAt: Date.now() }]);
          return;
      }
      const q = query(this.getCollection('tournaments'), where('ownerId', '==', uid));
      if (this.tournamentUnsubscribe) this.tournamentUnsubscribe();
      this.tournamentUnsubscribe = onSnapshot(q, (s) => {
          this.myTournaments.set(s.docs.map(d => d.data() as TournamentMeta));
      });
  }

  async createNewTournament(name: string) {
      const tid = Math.random().toString(36).substring(2, 8).toUpperCase();
      if (!this.db) {
          this.myTournaments.update((t: TournamentMeta[]) => [...t, { id: tid, name, ownerId: this.userProfile()!.id, status: 'Active', createdAt: Date.now() }]);
          return tid;
      }
      const ref = doc(this.db, 'artifacts', this.appId, 'public', 'data', 'tournaments', tid);
      await setDoc(ref, { 
          id: tid, 
          name: name,
          ownerId: this.userProfile()!.id, 
          status: 'Active', 
          createdAt: Date.now() 
      });
      return tid;
  }

  async selectTournament(tid: string, name: string) {
      this.tournamentId.set(tid);
      this.tournamentName.set(name);
      localStorage.setItem('debate-tournament-id', tid);
      localStorage.setItem('debate-tournament-name', name);
      
      this.activeDebateId.set(null);
      this.judges.set([]);
      this.debaters.set([]);
      this.debates.set([]);
      this.results.set([]);
      
      this.startListeners(tid);
      const p = this.userProfile();
      if (p) await this.updateCloudProfile(p.id, p.name, p.role, tid);
  }

  async closeTournament(tid: string) {
      if (!this.db) {
          this.myTournaments.update((t: TournamentMeta[]) => t.map(x => x.id === tid ? { ...x, status: 'Closed' } : x));
          return;
      }
      await updateDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', 'tournaments', tid), { status: 'Closed' });
  }

  async updatePersonalInfo(data: Partial<UserProfile>) {
      const current = this.userProfile();
      if (!current) return;
      const updated = { ...current, ...data };
      this.userProfile.set(updated);
      await this.updateCloudProfile(current.id, updated.name, current.role, current.tournamentId);
  }

  private async updateCloudProfile(uid: string, name: string, role: string, tid: string | null | undefined) {
    if (this.db) {
      try {
        const collectionName = role === 'Debater' ? 'debaters' : (role === 'Judge' ? 'judges' : 'admins');
        const ref = doc(this.db, 'artifacts', this.appId, 'public', 'data', collectionName, uid);
        await setDoc(ref, { id: uid, tournamentId: tid || null, name, role, isOnline: true, status: 'Active' }, { merge: true });
      } catch (e) {}
    }
  }
  
  private stopListeners() {
      this.collectionUnsubscribes.forEach(u => u());
      this.collectionUnsubscribes = [];
  }

  private startListeners(tid: string) {
    if (!this.db) return;
    this.stopListeners(); 
    
    const qJudges = query(this.getCollection('judges'), where('tournamentId', '==', tid));
    this.collectionUnsubscribes.push(onSnapshot(qJudges, (s) => this.judges.set(s.docs.map(d => ({id:d.id, ...d.data()} as UserProfile)))));
    
    const qDebaters = query(this.getCollection('debaters'), where('tournamentId', '==', tid));
    this.collectionUnsubscribes.push(onSnapshot(qDebaters, (s) => this.debaters.set(s.docs.map(d => ({id:d.id, ...d.data()} as UserProfile)))));
    
    const qDebates = query(this.getCollection('debates'), where('tournamentId', '==', tid));
    this.collectionUnsubscribes.push(onSnapshot(qDebates, (s) => this.debates.set(s.docs.map(d => ({id:d.id, ...d.data()} as Debate)))));
    
    const qResults = query(this.getCollection('results'), where('tournamentId', '==', tid));
    this.collectionUnsubscribes.push(onSnapshot(qResults, (s) => this.results.set(s.docs.map(d => ({id:d.id, ...d.data()} as RoundResult)))));
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
    const tid = this.tournamentId();
    if (!tid) return;
    await addDoc(this.getCollection('notifications'), { 
        tournamentId: tid, 
        recipientId: judgeId, 
        message: "Please submit your ballot!", 
        debateId: this.activeDebateId(),
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
    if (this.tournamentUnsubscribe) this.tournamentUnsubscribe();
    this.stopListeners();
    
    const profile = this.userProfile();
    if (profile && this.db) {
        const collectionName = profile.role === 'Debater' ? 'debaters' : (profile.role === 'Judge' ? 'judges' : null);
        if (collectionName) try { await deleteDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', collectionName, profile.id)); } catch(e) {}
    }
    if (this.auth) await signOut(this.auth);
    localStorage.clear();
    this.user.set(null);
    this.userProfile.set(null);
    this.tournamentId.set(null);
    this.tournamentName.set('');
    this.activeDebateId.set(null);
    this.myTournaments.set([]);
  }

  async kickUser(userId: string, role: 'Judge' | 'Debater') {
      if (!this.db) return;
      if (this.isTournamentClosed()) return;
      const collectionName = role === 'Debater' ? 'debaters' : 'judges';
      await deleteDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', collectionName, userId));
  }

  async toggleDebaterStatus(debaterId: string, currentStatus: string | undefined) {
    if (this.isTournamentClosed()) return;
    const newStatus = currentStatus === 'Eliminated' ? 'Active' : 'Eliminated';
    if (this.db) {
        const ref = doc(this.db, 'artifacts', this.appId, 'public', 'data', 'debaters', debaterId);
        await updateDoc(ref, { status: newStatus });
    }
  }

  async createDebate(topic: string, affId: string, affName: string, negId: string, negName: string, type: RoundType, stage: RoundStage) {
    if (this.isTournamentClosed()) return;
    const tid = this.tournamentId();
    if (!tid) throw new Error("No tournament context found.");
    const debate = { tournamentId: tid, topic, affId, affName, negId, negName, judgeIds: [], status: 'Open' as const, type, stage, createdAt: Date.now() };
    if (!this.db) { this.debates.update(d => [...d, { id: 'loc-'+Date.now(), ...debate } as Debate]); return; }
    await addDoc(this.getCollection('debates'), debate);
  }

  async deleteDebate(debateId: string) {
    if (this.isTournamentClosed()) return;
    if (!this.db) { this.debates.update(d => d.filter(x => x.id !== debateId)); return; }
    await deleteDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', 'debates', debateId));
  }

  async finalizeRound(debateId: string) {
    if (this.isTournamentClosed()) return;
    const winner = this.getWinner(debateId);
    const debate = this.debates().find(d => d.id === debateId);
    if (!debate) return;
    if (debate.type === 'Elimination' && winner !== 'Pending') {
        const loserId = winner === 'Aff' ? debate.negId : debate.affId;
        if (this.db) await updateDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', 'debaters', loserId), { status: 'Eliminated' });
    }
    if (!this.db) { this.debates.update(d => d.map(x => x.id === debateId ? {...x, status: 'Closed'} : x)); return; }
    await updateDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', 'debates', debateId), { status: 'Closed' });
  }

  async assignJudge(debateId: string, judgeId: string) {
    if (this.isTournamentClosed()) return;
    if (!this.db) return; 
    const debate = this.debates().find(d => d.id === debateId);
    if (!debate) return;
    const newJudges = [...new Set([...debate.judgeIds, judgeId])].slice(0, 3);
    await updateDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', 'debates', debateId), { judgeIds: newJudges });
    
    // Notify Judge
    await addDoc(this.getCollection('notifications'), { 
        tournamentId: this.tournamentId()!, 
        recipientId: judgeId, 
        message: \`You have been assigned to judge: \${debate.topic}\`, 
        debateId: debateId,
        timestamp: Date.now() 
    });
  }

  async removeJudge(debateId: string, judgeId: string) {
    if (this.isTournamentClosed()) return;
    if (!this.db) return;
    const debate = this.debates().find(d => d.id === debateId);
    if (!debate) return;
    await updateDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', 'debates', debateId), { judgeIds: debate.judgeIds.filter(id => id !== judgeId) });
  }

  async submitBallot(debateId: string, result: Omit<RoundResult, 'id' | 'judgeId' | 'judgeName' | 'debateId' | 'tournamentId'>) {
    const debate = this.debates().find(d => d.id === debateId);
    if (debate?.status === 'Closed' || this.isTournamentClosed()) throw new Error("Round is closed.");
    const uid = this.user()?.uid || 'anon';
    const name = this.userProfile()?.name || 'Anonymous';
    const tid = this.tournamentId();
    if (!tid) throw new Error("No tournament context.");

    // Include current flow if available
    const flow = this.currentFlow();
    const frameworks = this.currentFrameworks();

    const finalResult = { ...result, tournamentId: tid, debateId, judgeId: uid, judgeName: name, timestamp: Date.now(), flow, frameworks };
    if (this.db) {
        const ballotId = \`\${debateId}_\${uid}\`;
        await setDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', 'results', ballotId), finalResult, { merge: true });
    }
  }
  
  // Join an existing tournament
  async joinTournament(code: string) {
      const profile = this.userProfile();
      if (!profile) return;
      if (!this.db) return; 
      
      // Check if tournament exists
      const snap = await getDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', 'tournaments', code));
      if (!snap.exists()) throw new Error("Tournament code not found.");

      const taken = await this.isNameTaken(profile.name, code);
      if (taken) throw new Error(\`Name "\${profile.name}" is already used in this tournament.\`);

      await this.setProfile(profile.name, profile.role, code, (snap.data() as any).name);
  }
  
  private getCollection(name: string) { return collection(this.db, 'artifacts', this.appId, 'public', 'data', name); }

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

  getMyDebaterRecord(): DebaterStats {
    const uid = this.userProfile()?.id;
    // STRICT RETURN: Always returns DebaterStats object
    if (!uid) return { id: 'unknown', name: 'Guest', wins: 0, losses: 0, status: 'Active' };
    
    const stats = this.standings().find(s => s.id === uid);
    return stats || { id: uid, name: this.userProfile()?.name || 'Guest', wins: 0, losses: 0, status: 'Active' };
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
    content: `import { Component, inject, effect, signal } from '@angular/core';
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
  \`
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
}`
  },
  {
    path: 'src/app/tournament-list.component.ts',
    content: `import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TournamentService } from './tournament.service';

@Component({
  selector: 'app-tournament-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: \`
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
  \`
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
}`
  },
  {
    path: 'src/app/app.component.ts',
    content: `import { Component, signal, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimerComponent } from './timer.component';
import { FlowComponent } from './flow.component';
import { BallotComponent } from './ballot.component';
import { GlobalTooltipComponent } from './global-tooltip.component';
import { LoginComponent } from './login.component';
import { AdminComponent } from './admin.component';
import { ProfileComponent } from './profile.component';
import { TournamentListComponent } from './tournament-list.component';
import { TournamentService } from './tournament.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, TimerComponent, FlowComponent, BallotComponent, GlobalTooltipComponent, LoginComponent, AdminComponent, ProfileComponent, TournamentListComponent],
  template: \`
    <!-- 1. NO USER -> LOGIN -->
    <app-login *ngIf="!tournament.userProfile()" />
    
    <!-- 2. LOGGED IN -->
    <div *ngIf="tournament.userProfile()" class="min-h-screen bg-slate-50">
      
      <!-- 2A. ADMIN & NO TOURNAMENT SELECTED -> LIST -->
      <app-tournament-list *ngIf="isAdmin() && !tournament.tournamentId()" />

      <!-- 2B. ADMIN & TOURNAMENT SELECTED -> DASHBOARD -->
      <app-admin *ngIf="isAdmin() && tournament.tournamentId()" />

      <!-- 2C. PARTICIPANT VIEW -->
      <div *ngIf="!isAdmin()">
          <!-- Header -->
          <header class="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center sticky top-0 z-50">
            <div class="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" (click)="showProfile.set(false)">
              <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">DM</div>
              <div>
                <h1 class="text-sm font-bold text-slate-800 leading-tight">DebateMate</h1>
                <p class="text-[10px] text-slate-500 uppercase tracking-wide font-bold">{{ tournament.userProfile()?.role }} Mode</p>
              </div>
            </div>
            <div class="flex items-center gap-4">
              <!-- Profile Trigger -->
              <button (click)="showProfile.set(true)" class="flex items-center gap-2 text-right hover:bg-slate-50 px-2 py-1 rounded transition-colors" title="View Profile">
                <div class="hidden sm:block">
                   <div class="text-xs font-bold text-slate-700">{{ tournament.userProfile()?.name }}</div>
                   <div class="text-[10px] text-slate-400">View Profile</div>
                </div>
                <img [src]="tournament.userProfile()?.photoURL || 'https://ui-avatars.com/api/?name=' + tournament.userProfile()?.name" class="w-8 h-8 rounded-full border border-slate-200">
              </button>
              <button (click)="tournament.logout()" class="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-2 rounded transition-colors" aria-label="Log Out" title="Log Out">
                Log Out
              </button>
            </div>
          </header>

          <div *ngFor="let n of tournament.notifications()" class="bg-yellow-500 text-white px-4 py-2 text-center text-sm font-bold flex justify-between items-center sticky top-[60px] z-50 shadow-md animate-in slide-in-from-top">
             <div class="flex items-center gap-2 mx-auto"><span>🔔</span><span>{{ n.message }}</span></div>
             <button *ngIf="n.debateId" (click)="tournament.activeDebateId.set(n.debateId); tournament.dismissNotification(n.id)" class="bg-white text-yellow-600 px-2 py-0.5 rounded text-xs hover:bg-slate-100 ml-2" title="Go to debate round">Go to Round</button>
             <button (click)="tournament.dismissNotification(n.id)" class="hover:bg-yellow-600 p-1 rounded" title="Dismiss notification">&times;</button>
          </div>

          <!-- ROUTING -->
          <app-profile *ngIf="showProfile() || (!isAdmin() && !tournament.tournamentId())" />

          <div *ngIf="!showProfile() && tournament.tournamentId()" class="h-[calc(100vh-64px)] flex flex-col">
             <div *ngIf="!tournament.activeDebateId()" class="p-8 max-w-4xl mx-auto w-full">
                  <h2 class="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Your Assignments</h2>
                  <div class="grid gap-4">
                    <div *ngFor="let debate of tournament.getMyAssignments()" (click)="tournament.activeDebateId.set(debate.id)"
                         class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all group">
                      <div class="flex justify-between">
                        <span class="bg-slate-800 text-white text-xs font-bold px-2 py-1 rounded">{{ debate.status === 'Closed' ? 'CLOSED' : 'OPEN ROUND' }}</span>
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
             </div>

             <div *ngIf="tournament.activeDebateId()" class="flex flex-col h-full overflow-hidden">
                  <app-timer class="flex-none" />
                  <div class="bg-slate-100 px-4 py-1 text-xs text-center border-b border-slate-200 flex justify-between items-center">
                     <span class="font-bold text-slate-600">Topic: {{ getCurrentDebate()?.topic }}</span>
                     <button (click)="tournament.activeDebateId.set(null)" class="text-red-500 hover:underline" title="Return to Dashboard">Exit Round</button>
                  </div>
                  <main class="flex-1 p-4 overflow-hidden relative"><app-flow class="h-full block" /></main>
                  <footer class="bg-white border-t border-slate-200 p-2 flex-none z-40">
                    <div class="max-w-7xl mx-auto flex justify-between items-center">
                      <div class="text-xs text-slate-400"><strong>DebateMate</strong> 2025</div>
                      <button (click)="showBallot.set(!showBallot())" class="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-all" title="View/Edit Ballot">{{ isDebater() ? 'View Feedback' : 'Score Round' }}</button>
                    </div>
                    <div *ngIf="showBallot()" class="border-t border-slate-100 mt-2 p-4 bg-slate-50 max-h-[60vh] overflow-y-auto"><div class="max-w-3xl mx-auto"><app-ballot /></div></div>
                  </footer>
             </div>
          </div>
      </div>
      <app-global-tooltip />
    </div>
  \`
})
export class AppComponent {
  tournament = inject(TournamentService);
  showBallot = signal(false);
  showProfile = signal(false);
  
  isAdmin = computed(() => this.tournament.userRole() === 'Admin');
  isJudge = computed(() => this.tournament.userRole() === 'Judge');
  isDebater = computed(() => this.tournament.userRole() === 'Debater');

  constructor() {
     // Auto-redirect to profile if no tournament ID is set for non-admins
     effect(() => {
        const user = this.tournament.userProfile();
        if (user && !this.isAdmin() && !this.tournament.tournamentId()) {
            this.showProfile.set(true);
        }
     }, { allowSignalWrites: true });
  }

  getCurrentDebate() { return this.tournament.debates().find(d => d.id === this.tournament.activeDebateId()); }
}`
  },
  {
    path: 'src/app/admin.component.ts',
    content: `import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TournamentService, Debate, RoundType, RoundStage, UserProfile, RoundResult } from './tournament.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: \`
    <div class="p-6 max-w-7xl mx-auto">
      <header class="max-w-7xl mx-auto mb-8 flex justify-between items-center">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">{{ tournament.tournamentName() }}</h1>
          <p class="text-slate-500">Code: <span class="font-mono font-bold text-blue-600" title="Copy to share">{{ tournament.tournamentId() }}</span></p>
        </div>
        <div class="flex items-center gap-4">
           <button (click)="backToList()" class="text-sm font-bold text-slate-500 hover:text-slate-800 underline" title="Switch Tournament">Switch Tournament</button>
           
           <!-- Close Tournament -->
           <button *ngIf="!tournament.isTournamentClosed()" (click)="closeTournament()" class="text-xs font-bold bg-red-50 text-red-600 px-3 py-2 rounded hover:bg-red-100 transition-colors border border-red-100" title="End Tournament">End Tournament</button>
           <div *ngIf="tournament.isTournamentClosed()" class="text-xs font-bold bg-gray-100 text-gray-500 px-3 py-2 rounded border border-gray-200">ARCHIVED</div>
           
           <button (click)="tournament.logout()" class="text-sm font-bold text-red-500 hover:text-red-700 underline ml-4" title="Log Out">Log Out</button>
        </div>
      </header>

      <div *ngIf="tournament.isTournamentClosed()" class="max-w-7xl mx-auto bg-amber-50 border border-amber-200 p-4 rounded-lg mb-6 text-center text-amber-800 font-bold">
          This tournament is closed. All data is Read-Only.
      </div>
      
      <!-- Ballot Modal -->
      <div *ngIf="selectedBallot()" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" (click)="selectedBallot.set(null)">
        <div class="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6" (click)="$event.stopPropagation()">
           <div class="flex justify-between items-start mb-4">
              <div>
                  <h3 class="text-lg font-bold text-slate-800">Ballot Details</h3>
                  <p class="text-sm text-slate-500">Judge: {{ selectedBallot()?.judgeName }}</p>
              </div>
              <button (click)="selectedBallot.set(null)" class="text-slate-400 hover:text-slate-600">&times;</button>
           </div>
           
           <div class="grid grid-cols-2 gap-4 mb-4">
              <div class="p-3 rounded bg-blue-50 text-center border border-blue-100">
                  <div class="text-xs font-bold text-blue-600 uppercase">Affirmative</div>
                  <div class="text-xs text-blue-800 font-medium mb-1 truncate">{{ getDebate(selectedBallot()?.debateId)?.affName }}</div>
                  <div class="text-2xl font-bold text-slate-800">{{ selectedBallot()?.affScore }}</div>
              </div>
              <div class="p-3 rounded bg-red-50 text-center border border-red-100">
                  <div class="text-xs font-bold text-red-600 uppercase">Negative</div>
                   <div class="text-xs text-red-800 font-medium mb-1 truncate">{{ getDebate(selectedBallot()?.debateId)?.negName }}</div>
                  <div class="text-2xl font-bold text-slate-800">{{ selectedBallot()?.negScore }}</div>
              </div>
           </div>
           
           <div class="mb-4">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Decision</span>
              <div class="font-bold text-lg" [ngClass]="selectedBallot()?.decision === 'Aff' ? 'text-blue-600' : 'text-red-600'">
                  Voted for: {{ selectedBallot()?.decision }}
              </div>
           </div>

           <div>
              <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Reason for Decision (RFD)</span>
              <div class="mt-1 p-3 bg-slate-50 rounded border border-slate-200 text-sm text-slate-700 whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {{ selectedBallot()?.rfd || 'No written feedback provided.' }}
              </div>
           </div>
        </div>
      </div>

      <main class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <div class="col-span-12 flex gap-4 mb-4 border-b border-slate-200">
            <button (click)="activeTab.set('Dashboard')" [class.border-slate-800]="activeTab()==='Dashboard'" class="pb-2 border-b-2 border-transparent font-bold text-sm">Rounds</button>
            <button (click)="activeTab.set('Bracket')" [class.border-slate-800]="activeTab()==='Bracket'" class="pb-2 border-b-2 border-transparent font-bold text-sm">Bracket</button>
        </div>

        <!-- DASHBOARD TAB -->
        <div *ngIf="activeTab() === 'Dashboard'" class="contents">
             <div class="lg:col-span-4 space-y-6">
                 <div *ngIf="!tournament.isTournamentClosed()" class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 class="font-bold text-slate-800 mb-4">Create Round</h2>
                    <div class="space-y-4">
                      <input [(ngModel)]="newTopic" placeholder="Resolved: (Topic)" class="w-full p-2 border rounded text-sm bg-slate-50">
                      <div class="grid grid-cols-2 gap-2">
                        <select [(ngModel)]="roundType" class="w-full p-2 border rounded text-sm bg-white">
                            <option value="Prelim">Preliminary</option>
                            <option value="Elimination">Elimination</option>
                        </select>
                        <div *ngIf="roundType === 'Prelim'" class="flex items-center gap-2 bg-slate-50 border rounded px-2">
                          <span class="text-[10px] font-bold text-slate-500 uppercase">Round</span>
                          <input type="number" [(ngModel)]="roundNumber" min="1" class="w-full p-1.5 bg-transparent text-sm outline-none">
                        </div>
                        <select *ngIf="roundType === 'Elimination'" [(ngModel)]="roundStage" class="w-full p-2 border rounded text-sm bg-white">
                            <option value="Octofinals">Octofinals</option>
                            <option value="Quarterfinals">Quarterfinals</option>
                            <option value="Semifinals">Semifinals</option>
                            <option value="Finals">Finals</option>
                        </select>
                      </div>
                      <div class="space-y-2">
                        <label class="block text-xs font-bold text-blue-600 uppercase mb-1">Affirmative</label>
                        <select [(ngModel)]="selectedAffId" class="w-full p-2 border rounded text-sm bg-white"><option value="" disabled selected>Select Debater...</option><option *ngFor="let d of sortedDebaters()" [value]="d.id" [disabled]="d.status === 'Eliminated'" [class.text-red-400]="d.status === 'Eliminated'">{{ d.name }} {{ d.status === 'Eliminated' ? '(Eliminated)' : '' }}</option></select>
                      </div>
                      <div class="space-y-2">
                        <label class="block text-xs font-bold text-red-600 uppercase mb-1">Negative</label>
                        <select [(ngModel)]="selectedNegId" class="w-full p-2 border rounded text-sm bg-white"><option value="" disabled selected>Select Debater...</option><option *ngFor="let d of sortedDebaters()" [value]="d.id" [disabled]="d.status === 'Eliminated'" [class.text-red-400]="d.status === 'Eliminated'">{{ d.name }} {{ d.status === 'Eliminated' ? '(Eliminated)' : '' }}</option></select>
                      </div>
                      <button (click)="create()" class="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800" title="Create Matchup">Create Matchup</button>
                    </div>
                 </div>
                 
                 <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 class="font-bold text-slate-800 mb-4">Participants</h2>
                    <div class="max-h-64 overflow-y-auto space-y-2">
                         <div *ngFor="let d of sortedDebaters()" class="flex justify-between text-sm p-2 bg-slate-50 rounded">
                             <span [class.line-through]="d.status === 'Eliminated'" [class.text-slate-400]="d.status === 'Eliminated'">{{ d.name }} <span class="text-xs font-bold ml-1" [class.text-green-600]="d.status!=='Eliminated'">({{d.wins}}W - {{d.losses}}L)</span></span>
                             <div class="flex gap-2">
                                 <button *ngIf="!tournament.isTournamentClosed()" (click)="toggleStatus(d)" title="Toggle Status">{{ d.status === 'Eliminated' ? '❤️' : '💀' }}</button>
                                 <button *ngIf="!tournament.isTournamentClosed()" (click)="tournament.kickUser(d.id, 'Debater')" class="text-red-500" title="Kick User">&times;</button>
                             </div>
                         </div>
                         <div *ngFor="let j of tournament.judges()" class="flex justify-between text-sm p-2 bg-slate-50 rounded">
                             <span>{{ j.name }} (J)</span>
                             <button *ngIf="!tournament.isTournamentClosed()" (click)="tournament.kickUser(j.id, 'Judge')" class="text-red-500" title="Kick User">&times;</button>
                         </div>
                    </div>
                 </div>
             </div>
             
             <div class="lg:col-span-8 space-y-6">
                <div *ngFor="let debate of sortedDebates()" class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 mb-4">
                     <div class="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                        <div>
                            <div class="flex items-center gap-3">
                                <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded" [ngClass]="debate.type === 'Elimination' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'">{{ debate.stage }}</span>
                                <h3 class="font-bold text-lg text-slate-800">{{ debate.topic }}</h3>
                                <span *ngIf="debate.status === 'Closed' && getWinner(debate.id) !== 'Pending'" class="bg-yellow-100 text-yellow-800 text-[10px] px-2 py-0.5 rounded font-bold border border-yellow-200">🏆 WINNER: {{ getWinnerName(debate) }}</span>
                            </div>
                            <div class="text-sm text-slate-500 mt-1">{{ debate.affName }} vs {{ debate.negName }}</div>
                        </div>
                        <div class="flex gap-2 items-center" *ngIf="!tournament.isTournamentClosed()">
                            <div class="relative" *ngIf="debate.status === 'Open'">
                                <select #assignSelect (change)="assign(debate.id, assignSelect.value); assignSelect.value=''" class="bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold py-2 px-3 rounded focus:outline-none hover:bg-slate-200 cursor-pointer">
                                    <option value="" disabled selected>+ Add Judge</option>
                                    <option *ngFor="let judge of getUnassignedJudges(debate)" [value]="judge.id">{{ judge.name }}</option>
                                </select>
                            </div>
                            <button *ngIf="debate.status === 'Open'" (click)="tournament.finalizeRound(debate.id)" class="bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded hover:bg-slate-900" title="Finalize Round">Finalize</button>
                            <button (click)="tournament.deleteDebate(debate.id)" class="text-slate-300 hover:text-red-500 p-2" title="Delete Debate"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg></button>
                        </div>
                     </div>
                     <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div *ngFor="let judgeId of debate.judgeIds" class="bg-slate-50 rounded-lg p-3 border border-slate-200 relative group">
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-xs font-bold text-slate-700 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-green-500"></span> {{ getJudgeName(judgeId) }}</span>
                                <button *ngIf="debate.status === 'Open' && !tournament.isTournamentClosed()" (click)="remove(debate.id, judgeId)" class="text-slate-300 hover:text-red-500 font-bold text-xs" title="Unassign Judge">Remove</button>
                            </div>
                            <div *ngIf="getResult(debate.id, judgeId) as res; else pending" 
                                 (click)="selectedBallot.set(res)"
                                 class="animate-in fade-in bg-white p-2 rounded border border-slate-100 mt-2 cursor-pointer hover:border-blue-300 transition-colors hover:shadow-sm group/ballot"
                                 title="Click to view full ballot">
                                <div class="flex justify-between text-xs font-bold mb-1">
                                    <span [class.text-blue-600]="res.decision === 'Aff'" [class.text-red-600]="res.decision === 'Neg'">Voted: {{ res.decision }}</span>
                                </div>
                                <div class="grid grid-cols-2 gap-2 text-center my-1">
                                     <div class="bg-blue-50 rounded px-1"><span class="text-[10px] font-bold text-blue-600">AFF</span><span class="text-sm font-bold text-slate-700 block leading-none">{{ res.affScore }}</span></div>
                                     <div class="bg-red-50 rounded px-1"><span class="text-[10px] font-bold text-red-600">NEG</span><span class="text-sm font-bold text-slate-700 block leading-none">{{ res.negScore }}</span></div>
                                </div>
                                <div class="text-[10px] text-slate-400 mt-1 text-center group-hover/ballot:text-blue-500">Click to view details</div>
                            </div>
                            <ng-template #pending>
                                <div class="flex items-center justify-between w-full mt-2 pl-2">
                                    <span class="text-[10px] text-slate-400">Pending...</span>
                                    <button *ngIf="!tournament.isTournamentClosed()" (click)="tournament.sendNudge(judgeId)" class="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200 font-bold flex items-center gap-1" title="Send reminder notification">🔔 Nudge</button>
                                </div>
                            </ng-template>
                        </div>
                         <div *ngIf="debate.judgeIds.length === 0" class="col-span-2 text-center py-4 border-2 border-dashed border-slate-100 rounded-lg text-slate-300 text-xs italic">Waiting for judges.</div>
                    </div>
                </div>
             </div>
        </div>

        <!-- BRACKET TAB -->
        <div *ngIf="activeTab() === 'Bracket'" class="col-span-12 lg:col-span-12 w-full overflow-x-auto pb-8">
           <div class="flex gap-8 min-w-max">
              <div *ngFor="let stage of bracketStages" class="w-64 flex-none space-y-4">
                  <h3 class="font-bold text-center text-slate-500 uppercase tracking-widest text-xs mb-4 sticky top-0 bg-slate-100 py-2">{{ stage }}</h3>
                  <div *ngFor="let d of getDebatesForStage(stage)" class="bg-white border border-slate-200 rounded-lg shadow-sm p-3 relative">
                      <div class="text-[10px] text-slate-400 mb-2 truncate font-mono">{{ d.topic }}</div>
                      <div class="space-y-1">
                         <div class="flex justify-between p-1 rounded text-xs font-bold" [class.bg-green-100]="d.status === 'Closed' && getWinner(d.id) === 'Aff'"><span>{{ d.affName }}</span><span *ngIf="d.status === 'Closed' && getWinner(d.id) === 'Aff'">✓</span></div>
                         <div class="flex justify-between p-1 rounded text-xs font-bold" [class.bg-green-100]="d.status === 'Closed' && getWinner(d.id) === 'Neg'"><span>{{ d.negName }}</span><span *ngIf="d.status === 'Closed' && getWinner(d.id) === 'Neg'">✓</span></div>
                      </div>
                  </div>
              </div>
           </div>
        </div>
      </main>
    </div>
  \`
})
export class AdminComponent {
  tournament = inject(TournamentService);
  newTopic = ''; selectedAffId = ''; selectedNegId = '';
  roundType: RoundType = 'Prelim';
  roundNumber = 1; 
  roundStage = 'Quarterfinals'; 
  
  selectedBallot = signal<RoundResult | null>(null);
  
  activeTab = signal<'Dashboard' | 'Bracket'>('Dashboard');
  bracketStages = ['Octofinals', 'Quarterfinals', 'Semifinals', 'Finals'];

  sortedDebates = computed(() => 
     this.tournament.debates().slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  );

  sortedDebaters = computed(() => {
     const stats = this.tournament.standings();
     return this.tournament.debaters().map(d => {
         const s = stats.find(stat => stat.id === d.id);
         return { ...d, wins: s?.wins || 0, losses: s?.losses || 0 };
     }).sort((a, b) => {
         if (b.wins !== a.wins) return b.wins - a.wins;
         return a.losses - b.losses;
     });
  });

  create() { 
    const aff = this.tournament.debaters().find(d => d.id === this.selectedAffId);
    const neg = this.tournament.debaters().find(d => d.id === this.selectedNegId);
    let stageName = this.roundType === 'Prelim' ? \`Round \${this.roundNumber}\` : this.roundStage;
    if (aff && neg) {
      this.tournament.createDebate(this.newTopic, aff.id, aff.name, neg.id, neg.name, this.roundType, stageName);
    }
  }
  
  backToList() {
      this.tournament.tournamentId.set(null); // Clears ID to trigger list view
  }
  
  closeTournament() { if(confirm('Close this tournament?')) this.tournament.closeTournament(this.tournament.tournamentId()!); }
  assign(debateId: string, judgeId: string) { this.tournament.assignJudge(debateId, judgeId); }
  remove(debateId: string, judgeId: string) { this.tournament.removeJudge(debateId, judgeId); }
  toggleStatus(debater: any) { this.tournament.toggleDebaterStatus(debater.id, debater.status); }
  getDebatesForStage(stage: string) { return this.tournament.debates().filter(d => d.type === 'Elimination' && d.stage === stage); }
  getWinner(debateId: string) { return this.tournament.getWinner(debateId); }
  getWinnerName(debate: Debate) {
     const w = this.tournament.getWinner(debate.id);
     return w === 'Aff' ? debate.affName : (w === 'Neg' ? debate.negName : 'None');
  }
  getJudgeName(id: string) { return this.tournament.judges().find(j => j.id === id)?.name || 'Unknown'; }
  getUnassignedJudges(debate: Debate) { return this.tournament.judges().filter(j => !debate.judgeIds.includes(j.id)); }
  getResult(debateId: string, judgeId: string) { return this.tournament.results().find(r => r.debateId === debateId && r.judgeId === judgeId); }
  getDebate(id: string | undefined) { return this.tournament.debates().find(d => d.id === id); }
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
      <!-- Condensed ballot logic for brevity -->
      <div *ngIf="!isDebater()">
          <div class="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
            <h2 class="font-bold text-slate-800 text-xl">Ballot</h2>
            <span *ngIf="isLocked()" class="text-red-600 font-bold uppercase text-xs">Locked</span>
          </div>
          <div class="flex justify-end mb-2">
              <button (click)="toggleHints()" class="text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all" title="Show/Hide guidelines">
                  {{ showHints() ? 'Hide Guidelines' : 'Show Guidelines' }}
              </button>
          </div>
          
          <div *ngIf="showHints()" class="mb-6 grid grid-cols-1 md:grid-cols-2 gap-2 transition-all">
             <div class="bg-indigo-50 border border-indigo-100 p-2 rounded text-[10px] text-indigo-900"><strong>Framework:</strong> Value & Criterion</div>
             <div class="bg-amber-50 border border-amber-100 p-2 rounded text-[10px] text-amber-900"><strong>Tabula Rasa:</strong> No bias</div>
          </div>

          <div class="grid grid-cols-2 gap-6 mb-6">
             <div>
                <label class="block text-xs font-bold text-slate-500 uppercase mb-1 text-center">Aff ({{ currentDebate()?.affName }})</label>
                <input type="number" [(ngModel)]="affPoints" [disabled]="isLocked()" class="w-full border p-2 rounded text-center font-bold text-xl">
             </div>
             <div>
                <label class="block text-xs font-bold text-slate-500 uppercase mb-1 text-center">Neg ({{ currentDebate()?.negName }})</label>
                <input type="number" [(ngModel)]="negPoints" [disabled]="isLocked()" class="w-full border p-2 rounded text-center font-bold text-xl">
             </div>
          </div>
          <div class="flex gap-4 mb-6">
             <button (click)="!isLocked() && decision.set('Aff')" [class]="decision() === 'Aff' ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'" class="flex-1 py-4 rounded-xl font-bold transition-all flex flex-col items-center justify-center">
                <span class="text-xs uppercase opacity-70">Affirmative</span>
                <span class="text-lg">{{ currentDebate()?.affName }}</span>
             </button>
             <button (click)="!isLocked() && decision.set('Neg')" [class]="decision() === 'Neg' ? 'bg-red-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'" class="flex-1 py-4 rounded-xl font-bold transition-all flex flex-col items-center justify-center">
                <span class="text-xs uppercase opacity-70">Negative</span>
                <span class="text-lg">{{ currentDebate()?.negName }}</span>
             </button>
          </div>
          <textarea [(ngModel)]="rfdText" [disabled]="isLocked()" class="w-full h-32 border rounded p-2 text-sm" placeholder="Reason for Decision"></textarea>
          <button *ngIf="!isLocked()" (click)="submitRound()" class="w-full mt-4 bg-slate-900 text-white font-bold py-3 rounded hover:bg-slate-800" title="Submit Ballot">Submit Ballot</button>
      </div>
      <div *ngIf="isDebater()" class="text-center text-slate-400 italic py-8">
          Submitting ballots is restricted to Judges. Use the dashboard to view feedback.
      </div>
    </div>
  \`
})
export class BallotComponent {
  pdfService = inject(PdfService);
  tournament = inject(TournamentService);
  affPoints = signal(28);
  negPoints = signal(28);
  decision = signal<'Aff' | 'Neg' | null>(null);
  rfdText = ''; 
  isUpdate = false;
  
  // Re-added missing signal
  showHints = signal(true);

  // ADDED: Computed signal for current debate info
  currentDebate = computed(() => this.tournament.debates().find(d => d.id === this.tournament.activeDebateId()));

  constructor() {
    effect(() => {
      const debateId = this.tournament.activeDebateId();
      const userId = this.tournament.userProfile()?.id;
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

  resetBallot() {
    this.isUpdate = false;
    this.affPoints.set(28);
    this.negPoints.set(28);
    this.decision.set(null);
    this.rfdText = '';
  }

  toggleHints() { this.showHints.update(v => !v); }

  submitRound() {
    if (this.isLocked()) return;
    if (!this.decision()) return;
    const debateId = this.tournament.activeDebateId();
    if (!debateId) return;

    this.tournament.submitBallot(this.tournament.activeDebateId()!, {
      affScore: this.affPoints(), negScore: this.negPoints(), decision: this.decision()!, rfd: this.rfdText, timestamp: Date.now()
    }).then(() => {
      alert(this.isUpdate ? "Ballot Updated!" : "Ballot Submitted!");
      this.isUpdate = true;
    }).catch(e => alert(e.message));
  }
  
  // Helper methods for template actions
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
    content: `import { Component, signal, effect, inject, Input } from '@angular/core';
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
    <div id="debate-flow" class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col relative">
      <!-- Read-Only Overlay -->
      <div *ngIf="readOnly()" class="absolute top-2 right-4 bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded border border-amber-200 z-10">Read Only View</div>
      
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h2 class="font-bold text-slate-700">Interactive Flow Sheet</h2>
          <p class="text-xs text-slate-500">Star <span class="text-purple-600 font-bold">★ Voting Issues</span> to track winning arguments.</p>
        </div>
        <button *ngIf="!readOnly()" (click)="resetFlow()" class="text-xs text-red-400 hover:text-red-600 underline" aria-label="Clear All Notes">Clear All</button>
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
                  <input type="text" [(ngModel)]="frameworks()[col.id].value" (ngModelChange)="saveData()" [disabled]="readOnly()" placeholder="e.g. Justice" class="flex-1 text-sm font-bold text-indigo-900 bg-white border border-indigo-100 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500" aria-label="Value Premise">
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-indigo-700 w-16 text-right"><app-term lookup="Value Criterion">Criterion</app-term>:</span>
                  <input type="text" [(ngModel)]="frameworks()[col.id].criterion" (ngModelChange)="saveData()" [disabled]="readOnly()" placeholder="e.g. Social Welfare" class="flex-1 text-sm font-medium text-indigo-800 bg-white border border-indigo-100 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500" aria-label="Value Criterion">
                </div>
              </div>
              <div *ngFor="let arg of getArgsForCol(i)" class="relative p-3 rounded-lg border shadow-sm transition-all group/card" [ngClass]="{'bg-purple-50 border-purple-300 ring-1 ring-purple-200 shadow-md': arg.isVoter, 'bg-green-50 border-green-200 opacity-70': !arg.isVoter && arg.status === 'addressed', 'bg-red-50 border-red-200': !arg.isVoter && arg.status === 'dropped', 'bg-white border-slate-200': !arg.isVoter && arg.status === 'open'}">
                <div *ngIf="isLinkedToPrevious(arg)" class="absolute -left-3 top-4 w-3 h-[2px] bg-slate-300"></div>
                <div *ngIf="editingId() !== arg.id" (click)="!readOnly() && editArg(arg.id, $event)" class="text-sm text-slate-800 whitespace-pre-wrap cursor-text min-h-[1.5rem]">{{ arg.text }}</div>
                <textarea *ngIf="editingId() === arg.id && !readOnly()" [(ngModel)]="arg.text" (blur)="stopEditing()" (click)="$event.stopPropagation()" (keydown.enter)="$event.preventDefault(); stopEditing()" class="w-full text-sm p-1 border rounded focus:ring-2 focus:ring-blue-500 bg-white" autoFocus></textarea>
                
                <!-- Controls (Only visible if NOT read-only) -->
                <div *ngIf="!readOnly()" class="mt-2 flex justify-between items-center opacity-0 group-hover/card:opacity-100 transition-opacity">
                  <div class="flex gap-1 items-center">
                    <button (click)="setDrop(arg); $event.stopPropagation()" title="Drop" class="p-1 hover:text-red-600 text-slate-400"><span class="font-bold text-xs">✕</span></button>
                    <button (click)="setAddressed(arg); $event.stopPropagation()" title="Address" class="p-1 hover:text-green-600 text-slate-400"><span class="font-bold text-xs">✓</span></button>
                    <div class="w-px h-3 bg-slate-200 mx-1"></div>
                    <button (click)="toggleVoter(arg); $event.stopPropagation()" class="p-1 transition-colors" [class]="arg.isVoter ? 'text-purple-600' : 'text-slate-300 hover:text-purple-500'" title="Mark as Voting Issue"><svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clip-rule="evenodd" /></svg></button>
                    <div class="w-px h-3 bg-slate-200 mx-1"></div>
                    <button (click)="deleteArg(arg); $event.stopPropagation()" title="Delete" class="p-1 hover:text-slate-600 text-slate-300"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                  </div>
                  <div class="relative">
                    <button *ngIf="i < columns.length - 1" (click)="toggleLinkMenu(arg.id, $event)" class="text-xs px-2 py-1 rounded border font-medium flex items-center gap-1 transition-colors" [ngClass]="col.isCx ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'" title="Link argument to previous point">Link ⤵</button>
                     <div *ngIf="activeLinkId() === arg.id" (click)="$event.stopPropagation()" class="absolute right-0 top-full mt-1 w-36 bg-white rounded shadow-lg border border-slate-200 z-50 flex flex-col py-1">
                      <button *ngFor="let target of getFutureColumns(i)" (click)="createLink(arg, target.idx)" class="text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 w-full">{{ target.name }}</button>
                    </div>
                  </div>
                </div>
                
                <!-- Status Indicators -->
                <div *ngIf="arg.status === 'dropped' && !arg.isVoter" class="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm z-10">DROP</div>
                <div *ngIf="arg.isVoter" class="absolute -top-2 -right-2 bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm z-10 flex items-center gap-1"><span>★</span> VOTER</div>
                <div class="mt-1 pt-1 border-t border-slate-100/50">
                   <input [(ngModel)]="arg.comments" (ngModelChange)="persistArgs()" [disabled]="readOnly()" placeholder="Add note..." class="w-full text-[10px] p-0.5 bg-transparent border-none focus:ring-0 placeholder:text-slate-300 text-slate-500 italic">
                </div>
              </div>
              <div *ngIf="!readOnly()" class="mt-2"><input type="text" [placeholder]="col.isCx ? '+ Note Admission...' : '+ New Point...'" (keydown.enter)="addArg($event, i)" class="w-full text-xs p-2 bg-transparent border border-dashed border-slate-300 rounded hover:bg-white focus:ring-2 focus:ring-blue-500 transition-all" aria-label="Add new argument"></div>
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
  readOnly = signal(false);

  // Input to set flow data for read-only mode
  @Input() set viewOnlyFlow(data: { args: DebateArgument[], frameworks: Record<string, FrameworkData> } | undefined) {
      if (data) {
          this.arguments.set(data.args || []);
          this.frameworks.set(data.frameworks || { '1AC': { value: '', criterion: '' }, '1NC': { value: '', criterion: '' } });
          this.readOnly.set(true);
      } else {
          this.readOnly.set(false);
      }
  }

  constructor() {
    this.loadData();
    
    // Save to local storage only if editing
    effect(() => {
      if (!this.readOnly()) {
          localStorage.setItem('ld-flow-args', JSON.stringify(this.arguments()));
          localStorage.setItem('ld-flow-frameworks', JSON.stringify(this.frameworks()));
          
          // Sync to service for submission
          this.tournament.currentFlow.set(this.arguments());
          this.tournament.currentFrameworks.set(this.frameworks());
      }
    });
    
    effect(() => {
      const activeId = this.tournament.activeDebateId();
      const lastDebateId = localStorage.getItem('ld-current-debate-id');
      if (activeId !== lastDebateId && !this.readOnly()) {
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

  saveData() { 
      if(!this.readOnly()) {
          localStorage.setItem('ld-flow-frameworks', JSON.stringify(this.frameworks())); 
          this.tournament.currentFrameworks.set(this.frameworks());
      }
  }
  persistArgs() { if(!this.readOnly()) this.arguments.update(a => [...a]); }
  
  toggleVoter(arg: DebateArgument) { if(!this.readOnly()) this.arguments.update(args => args.map(a => a.id === arg.id ? { ...a, isVoter: !a.isVoter } : a)); }
  
  createLink(originalArg: DebateArgument, targetIdx: number) { 
    if(this.readOnly()) return;
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
    if(this.readOnly()) return;
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
  deleteArg(arg: DebateArgument) { if (!this.readOnly() && confirm('Delete note?')) this.arguments.update(args => args.filter(a => a.id !== arg.id)); }
  setDrop(arg: DebateArgument) { if(!this.readOnly()) this.updateArgStatus(arg.id, 'dropped'); }
  setAddressed(arg: DebateArgument) { if(!this.readOnly()) this.updateArgStatus(arg.id, 'addressed'); }
  updateArgStatus(id: string, status: any) { this.arguments.update(args => args.map(a => a.id === id ? { ...a, status } : a)); }
  editArg(id: string, e: Event) { if(!this.readOnly()) { e.stopPropagation(); this.editingId.set(id); } }
  stopEditing() { this.editingId.set(null); }
  resetFlow() { if(!this.readOnly() && confirm('Clear all notes?')) this.internalReset(); }
}`
  },
  {
    path: 'src/app/profile.component.ts',
    content: `import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TournamentService, UserProfile, RoundResult } from './tournament.service';
import { FlowComponent } from './flow.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowComponent],
  template: \`
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
  \`
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