export type RoundType = 'Prelim' | 'Elimination';
export type RoundStage = string;

export interface DebateArgument {
  id: string;
  text: string;
  colIdx: number;
  status: 'open' | 'addressed' | 'dropped';
  parentId: string | null;
  isVoter?: boolean;
  comments?: string;
}

export interface FrameworkData {
  value: string;
  criterion: string;
}

export interface TournamentMeta {
  id: string;
  name: string;
  topic: string;
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
  createdAt: number;
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

export interface AppNotification {
  id: string;
  tournamentId: string;
  recipientId: string;
  message: string;
  debateId?: string;
  timestamp: number;
}