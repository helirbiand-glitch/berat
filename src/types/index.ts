export type Movie = {
  id: string;
  name: string;
};

export type Group = {
  id: string;
  name: string;
  peopleCount: number;
  sessionsBlocked: string[]; // List of session IDs
};

export type Booking = {
  id: string;
  customerName: string;
  phone: string;
  count: number;
  movieId?: string;
};

export type Session = {
  id: string;
  time: string; // HH:mm
  movieId: string;
  peopleCount: number;
  bookings: Booking[];
  groupId?: string;
  isFinished: boolean;
  status: 'open' | 'active' | 'maintenance';
  activeSince?: number; // timestamp when started
};

export type HistoryItem = {
  id: string;
  timestamp: string;
  action: string;
  details: string;
};

export type ViewMode = 'kasiyer' | 'musteri' | 'admin';

export interface LaserTagPlayer {
  id: string;
  codename: string;
  vestId: string;
  team: 'red' | 'blue' | 'none';
  role: 'Commander' | 'Scout' | 'Heavy' | 'Medic' | 'Soldier';
  score: number;
  hitsGiven: number;
  hitsReceived: number;
  shotsFired: number;
  accuracy: number;
  isAlive: boolean;
  battery: number; // Device battery %
  signal: number; // Device wireless signal %
}

export interface LaserTagSessionBooking {
  id: string;
  customerName: string;
  phone: string;
  count: number;
  players: LaserTagPlayer[];
}

export interface LaserTagSession {
  id: string;
  time: string; // HH:mm
  gameMode: 'Solo FFA' | 'Team TDM' | 'Capture Flag' | 'Domination';
  status: 'open' | 'active' | 'finished' | 'maintenance';
  bookings: LaserTagSessionBooking[];
  friendlyFire: boolean;
  gameDuration: number; // in minutes (e.g. 10)
  rulesetPreset: 'Standard' | 'Hardcore' | 'Tactical';
  activeSince?: number; // timestamp started
  isFinished?: boolean;
  liveLogs?: any[];
  gameTimeElapsed?: number;
}

