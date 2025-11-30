import { Injectable, signal, computed } from '@angular/core';
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
}