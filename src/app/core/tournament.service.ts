import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { collection, doc, addDoc, updateDoc, onSnapshot, setDoc, deleteDoc, query, where, getDocs, getDoc } from 'firebase/firestore';
import { AuthService } from './auth.service';
import { 
  Debate, RoundType, RoundStage, UserProfile, RoundResult, 
  TournamentMeta, DebaterStats, AppNotification, DebateArgument, FrameworkData 
} from './models';

export * from './models';

@Injectable({ providedIn: 'root' })
export class TournamentService {
  private auth = inject(AuthService);
  private db = this.auth.db;
  private appId = this.auth.appId;

  tournamentId = signal<string | null>(null);
  tournamentName = signal<string>('');
  
  judges = signal<UserProfile[]>([]);
  debaters = signal<UserProfile[]>([]);
  debates = signal<Debate[]>([]);
  results = signal<RoundResult[]>([]);
  notifications = signal<AppNotification[]>([]);
  myTournaments = signal<TournamentMeta[]>([]);
  
  activeDebateId = signal<string | null>(null);
  currentFlow = signal<DebateArgument[]>([]);
  currentFrameworks = signal<Record<string, FrameworkData>>({});

  userProfile = this.auth.userProfile;
  userRole = computed(() => this.userProfile()?.role);

  currentTournament = computed(() => {
      const tid = this.tournamentId();
      return this.myTournaments().find(t => t.id === tid);
  });

  currentTournamentStatus = computed(() => this.currentTournament()?.status || 'Active');
  isTournamentClosed = computed(() => this.currentTournamentStatus() === 'Closed');

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

  private tournamentUnsubscribe: (() => void) | null = null;
  private notificationUnsubscribe: (() => void) | null = null;
  private collectionUnsubscribes: (() => void)[] = [];

  constructor() {
    const savedTid = localStorage.getItem('debate-tournament-id');
    const savedTName = localStorage.getItem('debate-tournament-name');
    if (savedTid) {
        this.tournamentId.set(savedTid);
        if (savedTName) this.tournamentName.set(savedTName);
    }

    effect(() => {
      const tid = this.tournamentId();
      if (tid) this.startListeners(tid);
    });
    
    effect(() => {
       const user = this.userProfile();
       if (user?.role === 'Admin') this.fetchMyTournaments(user.id);
    });
  }

  async loginWithEmail(e: string, p: string) { return this.auth.login(e, p); }
  async registerWithEmail(e: string, p: string, n: string, r: any, t: string | null) { return this.auth.register(e, p, n, r, t); }
  async logout() { return this.auth.logout(); }

  async selectTournament(tid: string, name: string) {
      this.tournamentId.set(tid);
      this.tournamentName.set(name);
      localStorage.setItem('debate-tournament-id', tid);
      localStorage.setItem('debate-tournament-name', name);
      this.activeDebateId.set(null);
      const p = this.userProfile();
      if (p) await this.auth.updateCloudProfile({ ...p, tournamentId: tid });
  }

  async createNewTournament(name: string, topic: string) {
      const tid = Math.random().toString(36).substring(2, 8).toUpperCase();
      const meta: TournamentMeta = {
          id: tid, name, topic, ownerId: this.userProfile()!.id, status: 'Active', createdAt: Date.now() 
      };

      if (!this.db) {
          this.myTournaments.update(t => [...t, meta]);
          return tid;
      }
      const ref = doc(this.db, 'artifacts', this.appId, 'public', 'data', 'tournaments', tid);
      await setDoc(ref, meta);
      return tid;
  }

  async closeTournament(tid: string) {
      if (!this.db) {
          this.myTournaments.update(t => t.map(x => x.id === tid ? { ...x, status: 'Closed' } : x));
          return;
      }
      await updateDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', 'tournaments', tid), { status: 'Closed' });
  }

  private fetchMyTournaments(uid: string) {
      if (!this.db) {
          this.myTournaments.set([{ id: this.tournamentId() || 'demo', name: 'Demo Tournament', topic: 'Resolved: Demo', ownerId: uid, status: 'Active', createdAt: Date.now() }]);
          return;
      }
      const q = query(this.getCollection('tournaments'), where('ownerId', '==', uid));
      if (this.tournamentUnsubscribe) this.tournamentUnsubscribe();
      this.tournamentUnsubscribe = onSnapshot(q, (s) => {
          this.myTournaments.set(s.docs.map(d => d.data() as TournamentMeta));
      });
  }

  async createDebate(topic: string, affId: string, affName: string, negId: string, negName: string, type: RoundType, stage: RoundStage) {
    if (this.isTournamentClosed()) return;
    const tid = this.tournamentId();
    if (!tid) throw new Error("No tournament context found.");
    
    const debateData: any = { 
        tournamentId: tid, topic, affId, affName, negId, negName, judgeIds: [], status: 'Open', type, stage, createdAt: Date.now() 
    };

    let newDebateId: string;
    if (!this.db) {
        newDebateId = 'loc-' + Date.now();
        this.debates.update(d => [...d, { id: newDebateId, ...debateData } as Debate]);
    } else {
        const docRef = await addDoc(this.getCollection('debates'), debateData);
        newDebateId = docRef.id;
    }
    await this.sendNotification(affId, `You are assigned Affirmative: ${topic}`, newDebateId);
    await this.sendNotification(negId, `You are assigned Negative: ${topic}`, newDebateId);
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
    await this.sendNotification(judgeId, `You have been assigned to judge: ${debate.topic}`, debateId);
  }

  async removeJudge(debateId: string, judgeId: string) {
    if (this.isTournamentClosed()) return;
    if (!this.db) return;
    const debate = this.debates().find(d => d.id === debateId);
    if (!debate) return;
    await updateDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', 'debates', debateId), { judgeIds: debate.judgeIds.filter(id => id !== judgeId) });
  }

  async toggleDebaterStatus(debaterId: string, currentStatus: string | undefined) {
    if (this.isTournamentClosed()) return;
    const newStatus = currentStatus === 'Eliminated' ? 'Active' : 'Eliminated';
    if (this.db) {
        const ref = doc(this.db, 'artifacts', this.appId, 'public', 'data', 'debaters', debaterId);
        await updateDoc(ref, { status: newStatus });
    }
  }

  async kickUser(userId: string, role: 'Judge' | 'Debater') {
      if (!this.db) return;
      if (this.isTournamentClosed()) return;
      const collectionName = role === 'Debater' ? 'debaters' : 'judges';
      await deleteDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', collectionName, userId));
  }

  async submitBallot(debateId: string, result: Omit<RoundResult, 'id' | 'judgeId' | 'judgeName' | 'debateId' | 'tournamentId' | 'flow' | 'frameworks'>) {
    const debate = this.debates().find(d => d.id === debateId);
    if (debate?.status === 'Closed' || this.isTournamentClosed()) throw new Error("Round is closed.");
    const uid = this.userProfile()?.id || 'anon';
    const name = this.userProfile()?.name || 'Anonymous';
    const tid = this.tournamentId();
    if (!tid) throw new Error("No tournament context.");

    const finalResult = { 
        ...result, 
        tournamentId: tid, 
        debateId, 
        judgeId: uid, 
        judgeName: name, 
        flow: this.currentFlow(), 
        frameworks: this.currentFrameworks() 
    };
    if (this.db) {
        const ballotId = `${debateId}_${uid}`;
        await setDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', 'results', ballotId), finalResult, { merge: true });
    }
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

  getMyDebaterRecord(): DebaterStats {
    const uid = this.userProfile()?.id;
    if (!uid) return { id: 'unknown', name: 'Guest', wins: 0, losses: 0, status: 'Active' };
    const stats = this.standings().find(s => s.id === uid);
    return stats || { id: uid, name: this.userProfile()?.name || 'Guest', wins: 0, losses: 0, status: 'Active' };
  }

  getMyAssignments() {
    const uid = this.userProfile()?.id;
    if (!uid) return [];
    return this.debates().filter(d => {
      const isJudge = d.judgeIds.includes(uid);
      const isDebater = d.affId === uid || d.negId === uid;
      if (this.userRole() === 'Debater') return isJudge || isDebater;
      return (isJudge || isDebater) && d.status === 'Open';
    });
  }

  async joinTournament(code: string) {
      const profile = this.userProfile();
      if (!profile) return;
      if (!this.db) return; 
      const snap = await getDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', 'tournaments', code));
      if (!snap.exists()) throw new Error("Tournament code not found.");

      const taken = await this.isNameTaken(profile.name, code);
      if (taken) throw new Error(`Name "${profile.name}" is already used in this tournament.`);

      await this.auth.setProfile(profile.name, profile.role, code, profile.id);
  }

  async updatePersonalInfo(data: Partial<UserProfile>) {
      const current = this.userProfile();
      if (!current) return;
      await this.auth.updateCloudProfile({ ...current, ...data });
  }

  async sendNudge(judgeId: string, debateId: string) {
    await this.sendNotification(judgeId, "Please submit your ballot!", debateId);
  }

  async dismissNotification(id: string) {
    if (!this.db) { this.notifications.update(n => n.filter(x => x.id !== id)); return; }
    await deleteDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', 'notifications', id));
  }

  private async sendNotification(recipientId: string, message: string, debateId?: string) {
    const tid = this.tournamentId();
    if (!tid) return;
    
    const notification: any = { tournamentId: tid, recipientId, message, timestamp: Date.now() };
    if (debateId) notification.debateId = debateId;

    if (!this.db) {
        this.notifications.update(n => [...n, { id: 'loc-notif-'+Date.now(), ...notification } as AppNotification]);
        return;
    }
    await addDoc(this.getCollection('notifications'), notification);
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
    const uid = this.userProfile()?.id;
    if(uid) {
       const qNotes = query(this.getCollection('notifications'), where('recipientId', '==', uid));
       this.notificationUnsubscribe = onSnapshot(qNotes, (s) => this.notifications.set(s.docs.map(d => ({id:d.id, ...d.data()} as AppNotification))));
    }
  }

  private stopListeners() {
      this.collectionUnsubscribes.forEach(u => u());
      this.collectionUnsubscribes = [];
      if (this.notificationUnsubscribe) this.notificationUnsubscribe();
  }

  private async isNameTaken(name: string, tid: string): Promise<boolean> {
    if (!this.db) return false;
    const qJ = query(this.getCollection('judges'), where('tournamentId', '==', tid), where('name', '==', name));
    if (!(await getDocs(qJ)).empty) return true;
    const qD = query(this.getCollection('debaters'), where('tournamentId', '==', tid), where('name', '==', name));
    return !(await getDocs(qD)).empty;
  }

  private getCollection(name: string) { return collection(this.db, 'artifacts', this.appId, 'public', 'data', name); }
}