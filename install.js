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
DebateMate is a real-time Lincoln-Douglas adjudication system.

### **New Features: Tournament Management**
* **Admin Portal:** Central hub to create, view, and manage all tournaments.
* **Auto-Codes:** Tournaments get a unique 6-digit code upon creation.
* **Multi-Admin:** Any admin can administer any open tournament.
* **Archive Mode:** Closed tournaments become read-only for historical review.

## 🔧 Configuration (Required)
To fix "auth/operation-not-allowed" or "auth/unauthorized-domain":

1.  Go to **Firebase Console > Authentication > Sign-in method**.
    * Click **Add new provider** -> **Google** -> Toggle **Enable** -> **Save**.
    * Click **Add new provider** -> **Facebook** -> Toggle **Enable** -> **Save**.
2.  Go to **Authentication > Settings > Authorized domains**.
    * Add \`localhost\` to the list.
3.  Update \`src/app/config.ts\` with your API Keys.

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
    path: 'src/app/tournament.service.ts',
    content: `import { Injectable, signal, computed } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, updateDoc, 
  onSnapshot, setDoc, deleteDoc, query, where, getDocs, getDoc
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, 
  User, signInWithCustomToken, signOut, GoogleAuthProvider, FacebookAuthProvider, 
  signInWithPopup, signInWithRedirect, getRedirectResult,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile
} from 'firebase/auth';
import { AppConfig } from './config';

// --- DATA MODELS ---

export type RoundType = 'Prelim' | 'Elimination';
export type RoundStage = string;

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
}

export interface UserProfile {
  id: string; 
  // FIX: Allow null/undefined for users not yet in a tournament
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
  
  // Tournament Management
  // FIX: Renamed from allTournaments to myTournaments to match component usage
  myTournaments = signal<TournamentMeta[]>([]);
  
  currentTournamentStatus = computed(() => {
      const tid = this.tournamentId();
      return this.myTournaments().find(t => t.id === tid)?.status || 'Active';
  });
  
  isTournamentClosed = computed(() => this.currentTournamentStatus() === 'Closed');
  
  activeDebateId = signal<string | null>(null);

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
    try {
      const redirectResult = await getRedirectResult(this.auth);
      if (redirectResult?.user) {
        this.user.set(redirectResult.user);
        if (!this.restoreSession(redirectResult.user.uid)) {
           this.recoverProfile(redirectResult.user.uid);
        }
        return;
      }
    } catch(e) { console.warn("Redirect Result check failed:", e); }

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

  async loginWithGoogle() {
    if (!this.auth) return;
    const provider = new GoogleAuthProvider();
    try { await signInWithPopup(this.auth, provider); } 
    catch(e) { await signInWithRedirect(this.auth, provider); }
  }

  async loginWithFacebook() {
    if (!this.auth) return;
    const provider = new FacebookAuthProvider();
    try { await signInWithPopup(this.auth, provider); } 
    catch(e) { await signInWithRedirect(this.auth, provider); }
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
      // FIX: Ensure tournamentId handles undefined/null correctly
      this.userProfile.set({ id: uid, tournamentId: tid || null, name: name, role: role, isOnline: true });
      
      this.updateCloudProfile(uid, name, role, tid);
      
      if (tid) {
        this.watchMyProfile(uid, role);
        this.watchNotifications(uid);
        this.startListeners(tid);
      }
      
      if (role === 'Admin') this.fetchAllTournaments();
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
    
    // FIX: tournamentId is optional/nullable
    const profile: UserProfile = { id: uid, tournamentId: tid || null, name, role, isOnline: true, status: 'Active' };
    localStorage.setItem('debate-user-name', name);
    localStorage.setItem('debate-user-role', role);
    if (tid) localStorage.setItem('debate-tournament-id', tid); else localStorage.removeItem('debate-tournament-id');
    if (tName) localStorage.setItem('debate-tournament-name', tName);
    
    this.userProfile.set(profile);
    await this.updateCloudProfile(uid, name, role, tid);
    
    if (role === 'Admin') {
        await this.createTournamentRecord(tid || 'demo', uid); // Handle null tid for admins creating first one
        this.fetchAllTournaments();
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
          // FIX: Explicit type annotation for update
          this.myTournaments.update((t: TournamentMeta[]) => [...t, { id: this.tournamentId() || 'demo', name: 'Demo', ownerId: 'me', status: 'Active', createdAt: Date.now() }]);
          return;
      }
      const q = query(this.getCollection('tournaments')); // List all
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
          // FIX: Typed parameter for map
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
  
  private startListeners(tid: string) {
    if (!this.db) return;
    const qJudges = query(this.getCollection('judges'), where('tournamentId', '==', tid));
    onSnapshot(qJudges, (s) => this.judges.set(s.docs.map(d => ({id:d.id, ...d.data()} as UserProfile))));
    const qDebaters = query(this.getCollection('debaters'), where('tournamentId', '==', tid));
    onSnapshot(qDebaters, (s) => this.debaters.set(s.docs.map(d => ({id:d.id, ...d.data()} as UserProfile))));
    const qDebates = query(this.getCollection('debates'), where('tournamentId', '==', tid));
    onSnapshot(qDebates, (s) => this.debates.set(s.docs.map(d => ({id:d.id, ...d.data()} as Debate))));
    const qResults = query(this.getCollection('results'), where('tournamentId', '==', tid));
    onSnapshot(qResults, (s) => this.results.set(s.docs.map(d => ({id:d.id, ...d.data()} as RoundResult))));
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
    await addDoc(this.getCollection('notifications'), { tournamentId: tid, recipientId: judgeId, message: "Please submit your ballot!", timestamp: Date.now() });
  }

  async dismissNotification(id: string) {
    if (!this.db) { this.notifications.update(n => n.filter(x => x.id !== id)); return; }
    await deleteDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', 'notifications', id));
  }

  async logout() {
    if (this.profileUnsubscribe) this.profileUnsubscribe();
    if (this.notificationUnsubscribe) this.notificationUnsubscribe();
    if (this.tournamentUnsubscribe) this.tournamentUnsubscribe();
    
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
    const debate = { tournamentId: tid, topic, affId, affName, negId, negName, judgeIds: [], status: 'Open' as const, type, stage };
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

    const finalResult = { ...result, tournamentId: tid, debateId, judgeId: uid, judgeName: name, timestamp: Date.now() };
    if (this.db) {
        const ballotId = \`\${debateId}_\${uid}\`;
        await setDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', 'results', ballotId), finalResult, { merge: true });
    }
  }
  
  // Join an existing tournament
  async joinTournament(code: string) {
      const profile = this.userProfile();
      if (!profile) return;
      if (!this.db) return; // Offline can't join
      
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
              <button (click)="showProfile.set(true)" class="flex items-center gap-2 text-right hover:bg-slate-50 px-2 py-1 rounded transition-colors">
                <div class="hidden sm:block">
                   <div class="text-xs font-bold text-slate-700">{{ tournament.userProfile()?.name }}</div>
                   <div class="text-[10px] text-slate-400">View Profile</div>
                </div>
                <img [src]="tournament.userProfile()?.photoURL || 'https://ui-avatars.com/api/?name=' + tournament.userProfile()?.name" class="w-8 h-8 rounded-full border border-slate-200">
              </button>
              <button (click)="tournament.logout()" class="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-2 rounded transition-colors" aria-label="Log Out">
                Log Out
              </button>
            </div>
          </header>

          <div *ngFor="let n of tournament.notifications()" class="bg-yellow-500 text-white px-4 py-2 text-center text-sm font-bold flex justify-between items-center sticky top-[60px] z-50 shadow-md animate-in slide-in-from-top">
             <div class="flex items-center gap-2 mx-auto"><span>🔔</span><span>{{ n.message }}</span></div>
             <button (click)="tournament.dismissNotification(n.id)" class="hover:bg-yellow-600 p-1 rounded">&times;</button>
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
                     <button (click)="tournament.activeDebateId.set(null)" class="text-red-500 hover:underline">Exit Round</button>
                  </div>
                  <main class="flex-1 p-4 overflow-hidden relative"><app-flow class="h-full block" /></main>
                  <footer class="bg-white border-t border-slate-200 p-2 flex-none z-40">
                    <div class="max-w-7xl mx-auto flex justify-between items-center">
                      <div class="text-xs text-slate-400"><strong>DebateMate</strong> 2025</div>
                      <button (click)="showBallot.set(!showBallot())" class="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-all">{{ isDebater() ? 'View Feedback' : 'Score Round' }}</button>
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
import { TournamentService, Debate, RoundType, RoundStage, UserProfile } from './tournament.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: \`
    <div class="p-6 max-w-7xl mx-auto">
      <header class="max-w-7xl mx-auto mb-8 flex justify-between items-center">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">{{ tournament.tournamentName() }}</h1>
          <p class="text-slate-500">Code: <span class="font-mono font-bold text-blue-600">{{ tournament.tournamentId() }}</span></p>
        </div>
        <div class="flex items-center gap-4">
           <button (click)="backToList()" class="text-sm font-bold text-slate-500 hover:text-slate-800 underline">Switch Tournament</button>
           
           <!-- Close Tournament -->
           <button *ngIf="!tournament.isTournamentClosed()" (click)="closeTournament()" class="text-xs font-bold bg-red-50 text-red-600 px-3 py-2 rounded hover:bg-red-100 transition-colors border border-red-100">End Tournament</button>
           <div *ngIf="tournament.isTournamentClosed()" class="text-xs font-bold bg-gray-100 text-gray-500 px-3 py-2 rounded border border-gray-200">ARCHIVED</div>
           
           <button (click)="tournament.logout()" class="text-sm font-bold text-red-500 hover:text-red-700 underline ml-4">Log Out</button>
        </div>
      </header>

      <div *ngIf="tournament.isTournamentClosed()" class="max-w-7xl mx-auto bg-amber-50 border border-amber-200 p-4 rounded-lg mb-6 text-center text-amber-800 font-bold">
          This tournament is closed. All data is Read-Only.
      </div>

      <main class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
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
                        <select [(ngModel)]="selectedAffId" class="w-full p-2 border rounded text-sm bg-white"><option *ngFor="let d of tournament.debaters()" [value]="d.id">{{ d.name }}</option></select>
                      </div>
                      <div class="space-y-2">
                        <select [(ngModel)]="selectedNegId" class="w-full p-2 border rounded text-sm bg-white"><option *ngFor="let d of tournament.debaters()" [value]="d.id">{{ d.name }}</option></select>
                      </div>
                      <button (click)="create()" class="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800">Create Matchup</button>
                    </div>
                 </div>
                 
                 <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 class="font-bold text-slate-800 mb-4">Participants</h2>
                    <div class="max-h-64 overflow-y-auto space-y-2">
                         <div *ngFor="let d of tournament.debaters()" class="flex justify-between text-sm p-2 bg-slate-50 rounded">
                             <span>{{ d.name }}</span>
                             <div class="flex gap-2">
                                 <button *ngIf="!tournament.isTournamentClosed()" (click)="toggleStatus(d)">{{ d.status === 'Eliminated' ? '❤️' : '💀' }}</button>
                                 <button *ngIf="!tournament.isTournamentClosed()" (click)="tournament.kickUser(d.id, 'Debater')" class="text-red-500">&times;</button>
                             </div>
                         </div>
                         <div *ngFor="let j of tournament.judges()" class="flex justify-between text-sm p-2 bg-slate-50 rounded">
                             <span>{{ j.name }} (J)</span>
                             <button *ngIf="!tournament.isTournamentClosed()" (click)="tournament.kickUser(j.id, 'Judge')" class="text-red-500">&times;</button>
                         </div>
                    </div>
                 </div>
             </div>
             
             <div class="lg:col-span-8 space-y-6">
                <div class="flex gap-4 mb-4 border-b border-slate-200">
                    <button (click)="activeTab.set('Dashboard')" [class.border-slate-800]="activeTab()==='Dashboard'" class="pb-2 border-b-2 border-transparent font-bold text-sm">Rounds</button>
                    <button (click)="activeTab.set('Bracket')" [class.border-slate-800]="activeTab()==='Bracket'" class="pb-2 border-b-2 border-transparent font-bold text-sm">Bracket</button>
                </div>

                <div *ngFor="let debate of tournament.debates()" class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 mb-4">
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
                            <button *ngIf="debate.status === 'Open'" (click)="tournament.finalizeRound(debate.id)" class="bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded hover:bg-slate-900">Finalize</button>
                            <button (click)="tournament.deleteDebate(debate.id)" class="text-slate-300 hover:text-red-500 p-2" title="Delete Debate"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg></button>
                        </div>
                     </div>
                     <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div *ngFor="let judgeId of debate.judgeIds" class="bg-slate-50 rounded-lg p-3 border border-slate-200 relative group">
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-xs font-bold text-slate-700 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-green-500"></span> {{ getJudgeName(judgeId) }}</span>
                                <button *ngIf="debate.status === 'Open' && !tournament.isTournamentClosed()" (click)="remove(debate.id, judgeId)" class="text-slate-300 hover:text-red-500 font-bold text-xs">Remove</button>
                            </div>
                            <div *ngIf="getResult(debate.id, judgeId) as res; else pending" class="animate-in fade-in bg-white p-2 rounded border border-slate-100 mt-2">
                                <div class="flex justify-between text-xs font-bold mb-1">
                                    <span [class.text-blue-600]="res.decision === 'Aff'" [class.text-red-600]="res.decision === 'Neg'">Voted: {{ res.decision }}</span>
                                </div>
                                <div class="grid grid-cols-2 gap-2 text-center my-1">
                                     <div class="bg-blue-50 rounded px-1"><span class="text-[10px] font-bold text-blue-600">AFF</span><span class="text-sm font-bold text-slate-700 block leading-none">{{ res.affScore }}</span></div>
                                     <div class="bg-red-50 rounded px-1"><span class="text-[10px] font-bold text-red-600">NEG</span><span class="text-sm font-bold text-slate-700 block leading-none">{{ res.negScore }}</span></div>
                                </div>
                            </div>
                            <ng-template #pending>
                                <div class="flex items-center justify-between w-full mt-2 pl-2">
                                    <span class="text-[10px] text-slate-400">Pending...</span>
                                    <button *ngIf="!tournament.isTournamentClosed()" (click)="tournament.sendNudge(judgeId)" class="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200 font-bold flex items-center gap-1">🔔 Nudge</button>
                                </div>
                            </ng-template>
                        </div>
                         <div *ngIf="debate.judgeIds.length === 0" class="col-span-2 text-center py-4 border-2 border-dashed border-slate-100 rounded-lg text-slate-300 text-xs italic">Waiting for judges.</div>
                    </div>
                </div>
             </div>
        </div>

        <!-- BRACKET TAB -->
        <div *ngIf="activeTab() === 'Bracket'" class="lg:col-span-12">
           <div class="flex gap-4 mb-4 border-b border-slate-200">
               <button (click)="activeTab.set('Dashboard')" class="pb-2 border-b-2 border-transparent font-bold text-sm">Rounds</button>
               <button (click)="activeTab.set('Bracket')" class="pb-2 border-b-2 border-slate-800 font-bold text-sm">Bracket</button>
           </div>
           <div class="w-full overflow-x-auto pb-8">
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
  
  activeTab = signal<'Dashboard' | 'Bracket'>('Dashboard');
  bracketStages = ['Octofinals', 'Quarterfinals', 'Semifinals', 'Finals'];

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
  toggleStatus(debater: UserProfile) { this.tournament.toggleDebaterStatus(debater.id, debater.status); }
  getDebatesForStage(stage: string) { return this.tournament.debates().filter(d => d.type === 'Elimination' && d.stage === stage); }
  getWinner(debateId: string) { return this.tournament.getWinner(debateId); }
  getWinnerName(debate: Debate) {
     const w = this.tournament.getWinner(debate.id);
     return w === 'Aff' ? debate.affName : (w === 'Neg' ? debate.negName : 'None');
  }
  getJudgeName(id: string) { return this.tournament.judges().find(j => j.id === id)?.name || 'Unknown'; }
  getUnassignedJudges(debate: Debate) { return this.tournament.judges().filter(j => !debate.judgeIds.includes(j.id)); }
  getResult(debateId: string, judgeId: string) { return this.tournament.results().find(r => r.debateId === debateId && r.judgeId === judgeId); }
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
          <div class="grid grid-cols-2 gap-6 mb-6">
             <input type="number" [(ngModel)]="affPoints" [disabled]="isLocked()" class="border p-2 rounded text-center font-bold text-xl">
             <input type="number" [(ngModel)]="negPoints" [disabled]="isLocked()" class="border p-2 rounded text-center font-bold text-xl">
          </div>
          <div class="flex gap-4 mb-6">
             <button (click)="!isLocked() && decision.set('Aff')" [class]="decision() === 'Aff' ? 'bg-blue-600 text-white' : 'bg-slate-100'" class="flex-1 py-3 rounded font-bold">Affirmative</button>
             <button (click)="!isLocked() && decision.set('Neg')" [class]="decision() === 'Neg' ? 'bg-red-600 text-white' : 'bg-slate-100'" class="flex-1 py-3 rounded font-bold">Negative</button>
          </div>
          <textarea [(ngModel)]="rfdText" [disabled]="isLocked()" class="w-full h-32 border rounded p-2 text-sm" placeholder="Reason for Decision"></textarea>
          <button *ngIf="!isLocked()" (click)="submitRound()" class="w-full mt-4 bg-slate-900 text-white font-bold py-3 rounded hover:bg-slate-800">Submit Ballot</button>
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

  constructor() {
    effect(() => {
      const debateId = this.tournament.activeDebateId();
      const userId = this.tournament.userProfile()?.id;
      if (debateId && userId) {
          const existing = this.tournament.results().find(r => r.debateId === debateId && r.judgeId === userId);
          if (existing) {
              this.affPoints.set(existing.affScore);
              this.negPoints.set(existing.negScore);
              this.decision.set(existing.decision);
              this.rfdText = existing.rfd;
          }
      }
    }, { allowSignalWrites: true });
  }

  isDebater() { return this.tournament.userRole() === 'Debater'; }
  isLocked() { 
      const d = this.tournament.debates().find(x => x.id === this.tournament.activeDebateId());
      return d?.status === 'Closed';
  }

  submitRound() {
    if (this.isLocked() || !this.decision()) return;
    this.tournament.submitBallot(this.tournament.activeDebateId()!, {
      affScore: this.affPoints(), negScore: this.negPoints(), decision: this.decision()!, rfd: this.rfdText, timestamp: Date.now()
    }).then(() => alert("Submitted!"));
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