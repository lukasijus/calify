import board from '@/public/calibration/board.json';
import { type Profile, validProfile } from '@/lib/local-data';
import { useLocalState } from './local-state';
const validate = (v: unknown): v is Profile | null => v === null || validProfile(v, board);
export const useProfile = () => useLocalState<Profile | null>('profile', null, validate);
