import { Injectable, signal, computed } from '@angular/core';
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
    this.results().forEach(r => {
      const debate = this.debates().find(d => d.id === r.debateId);
      if (debate) {
        if (!stats[debate.affId]) stats[debate.affId] = { id: debate.affId, name: debate.affName, wins: 0, losses: 0 };
        if (!stats[debate.negId]) stats[debate.negId] = { id: debate.negId, name: debate.negName, wins: 0, losses: 0 };

        if (r.decision === 'Aff') { stats[debate.affId].wins++; stats[debate.negId].losses++; }
        else { stats[debate.negId].wins++; stats[debate.affId].losses++; }
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
	apiKey: "AIzaSyCtRIJNfTDdYJ4yQ4t2NK3IP2fZAs5O238",
	authDomain: "ld-debate-judge.firebaseapp.com",
	projectId: "ld-debate-judge",
	storageBucket: "ld-debate-judge.firebasestorage.app",
	messagingSenderId: "1031465191804",
	appId: "1:1031465191804:web:d80147a650f0cad4c77cf9",
	measurementId: "G-LY6JZCHPVZ"
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
      // Re-establish presence in DB on refresh
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
    // Clean up presence from DB so Admin knows user is gone
    const profile = this.userProfile();
    if (profile && this.db) {
        const collectionName = profile.role === 'Debater' ? 'debaters' : (profile.role === 'Judge' ? 'judges' : null);
        if (collectionName) {
             try {
                await deleteDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', collectionName, profile.id));
             } catch(e) { console.warn('Logout cleanup failed', e); }
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

  getMyAssignments() {
    const uid = this.userProfile()?.id;
    if (!uid) return [];
    if (!this.db) return this.debates(); 
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