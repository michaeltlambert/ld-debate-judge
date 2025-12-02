import { Injectable, signal, inject } from '@angular/core';
import { getAuth, signInWithCustomToken, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { AppConfig } from '../config';
import { initializeApp } from 'firebase/app';
import { Router } from '@angular/router';
import { UserProfile } from './models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);
  
  user = signal<User | null>(null);
  userProfile = signal<UserProfile | null>(null);
  
  public app: any;
  public auth: any;
  public db: any;
  public appId: string;

  constructor() {
    this.appId = (window as any).__app_id || 'default-app';
    this.initFirebase();
  }

  private initFirebase() {
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
      
      const initialToken = (window as any).__initial_auth_token;
      if (initialToken && !this.auth.currentUser) signInWithCustomToken(this.auth, initialToken);

      onAuthStateChanged(this.auth, (u) => {
        this.user.set(u);
        if (u) {
          if (!this.restoreSession()) {
             this.recoverProfile(u.uid);
          }
        }
      });
    } catch(e) {
      console.warn("Offline/Demo Mode active:", e);
    }
  }

  private restoreSession(): boolean {
    const savedName = localStorage.getItem('debate-user-name');
    const savedRole = localStorage.getItem('debate-user-role') as any;
    const savedTid = localStorage.getItem('debate-tournament-id');

    if (savedName && savedRole && this.user()) {
       const uid = this.user()!.uid;
       const profile: UserProfile = { 
         id: uid, name: savedName, role: savedRole, tournamentId: savedTid, isOnline: true 
       };
       this.userProfile.set(profile);
       this.redirectAfterLogin(profile);
       return true;
    }
    return false;
  }

  async login(email: string, pass: string) {
    if (!this.auth) throw new Error("Auth not configured");
    await signInWithEmailAndPassword(this.auth, email, pass);
  }

  async register(email: string, pass: string, name: string, role: any, tid: string | null) {
    if (!this.auth) {
        await this.setProfile(name, role, tid);
        return;
    }
    const cred = await createUserWithEmailAndPassword(this.auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    await this.setProfile(name, role, tid, cred.user.uid);
  }

  async logout() {
    if (this.auth) await signOut(this.auth);
    localStorage.clear();
    this.user.set(null);
    this.userProfile.set(null);
    this.router.navigate(['/login']);
  }

  async setProfile(name: string, role: 'Admin' | 'Judge' | 'Debater', tid: string | null, uid?: string) {
    const userId = uid || this.user()?.uid || 'demo-' + Math.random().toString(36).substring(7);
    const profile: UserProfile = { id: userId, tournamentId: tid || null, name, role, isOnline: true, status: 'Active' };
    
    localStorage.setItem('debate-user-name', name);
    localStorage.setItem('debate-user-role', role);
    if (tid) localStorage.setItem('debate-tournament-id', tid); 
    else localStorage.removeItem('debate-tournament-id');

    this.userProfile.set(profile);
    await this.updateCloudProfile(profile);
    this.redirectAfterLogin(profile);
  }

  private async recoverProfile(uid: string) {
    if (!this.db) return;
    const collections = ['judges', 'debaters', 'admins'];
    for (const col of collections) {
        const snap = await getDoc(doc(this.db, 'artifacts', this.appId, 'public', 'data', col, uid));
        if (snap.exists()) {
            const p = snap.data() as UserProfile;
            this.userProfile.set(p);
            this.redirectAfterLogin(p);
            return;
        }
    }
  }

  private redirectAfterLogin(profile: UserProfile) {
    if (profile.role === 'Admin') {
       if (profile.tournamentId) this.router.navigate(['/admin', profile.tournamentId]);
       else this.router.navigate(['/tournaments']);
    } else {
       if (profile.tournamentId) this.router.navigate(['/dashboard']);
       else this.router.navigate(['/profile']);
    }
  }

  async updateCloudProfile(profile: UserProfile) {
    if (!this.db) return;
    const collectionName = profile.role === 'Debater' ? 'debaters' : (profile.role === 'Judge' ? 'judges' : 'admins');
    const ref = doc(this.db, 'artifacts', this.appId, 'public', 'data', collectionName, profile.id);
    await setDoc(ref, { ...profile, isOnline: true }, { merge: true });
  }
}