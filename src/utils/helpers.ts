import { Session } from '../types';
import { START_TIME, END_TIME, INTERVAL } from './constants';

export const getNowHHMM = () => {
  const now = new Date();
  return now.toTimeString().slice(0, 5);
};

export const generateSessions = (): Session[] => {
  const sessions: Session[] = [];
  let currentTime = new Date(`2000-01-01T${START_TIME}:00`);
  const endTime = new Date(`2000-01-01T${END_TIME}:00`);
  
  while (currentTime <= endTime) {
    const timeStr = currentTime.toTimeString().slice(0, 5);
    sessions.push({
      id: `session-${timeStr.replace(':', '')}`,
      time: timeStr,
      movieId: "", // initialize with an empty string
      peopleCount: 0,
      bookings: [],
      isFinished: false,
      status: 'open'
    });
    currentTime.setMinutes(currentTime.getMinutes() + INTERVAL);
  }
  return sessions;
};

export const normalizePhoneNumber = (phone: string): string | null => {
  if (!phone) return null;
  // Remove all non-numeric characters
  let normalized = phone.replace(/\D/g, '');
  
  if (normalized.startsWith('905') && normalized.length === 12) {
    return normalized;
  }
  if (normalized.startsWith('05') && normalized.length === 11) {
    return '9' + normalized;
  }
  if (normalized.startsWith('5') && normalized.length === 10) {
    return '90' + normalized;
  }
  
  return null;
};

export const generateLaserTagSessions = () => {
  const sessions = [];
  const start = "10:00";
  const end = "21:40";
  const interval = 20; // 20 mins interval
  let currentTime = new Date(`2000-01-01T${start}:00`);
  const endTime = new Date(`2000-01-01T${end}:00`);
  
  while (currentTime <= endTime) {
    const timeStr = currentTime.toTimeString().slice(0, 5);
    sessions.push({
      id: `lasertag-${timeStr.replace(':', '')}`,
      time: timeStr,
      gameMode: 'Solo FFA',
      status: 'open',
      bookings: [],
      friendlyFire: false,
      gameDuration: 10,
      rulesetPreset: 'Standard'
    });
    currentTime.setMinutes(currentTime.getMinutes() + interval);
  }
  return sessions;
};
