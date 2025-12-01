import { Injectable, signal, computed } from '@angular/core';
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
  
  // Current active flow state
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
         if (taken) throw new Error(`Name "${name}" is already taken.`);
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
        if (taken && !currentUser) throw new Error(`Name "${name}" is already taken.`);
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
    this.stopListeners(); // Clean up old tournament listeners
    
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
    
    // Notify Judge
    await addDoc(this.getCollection('notifications'), { 
        tournamentId: this.tournamentId()!, 
        recipientId: judgeId, 
        message: `You have been assigned to judge: ${debate.topic}`, 
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
        const ballotId = `${debateId}_${uid}`;
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
      if (taken) throw new Error(`Name "${profile.name}" is already used in this tournament.`);

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
}