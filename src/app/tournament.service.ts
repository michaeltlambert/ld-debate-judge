import { Injectable, signal, computed } from '@angular/core';
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
    if (taken) throw new Error(`Name "${name}" is already taken in this tournament.`);

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
        const ballotId = `${debateId}_${uid}`;
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
}