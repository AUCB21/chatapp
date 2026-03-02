// Allows TypeScript to resolve global CSS imports (e.g. import './globals.css')
declare module "*.css";

// Voice call signaling types
type VoiceSignalType = 
  | { type: 'call-offer'; from: string; fromName: string; offer: RTCSessionDescriptionInit }
  | { type: 'call-answer'; from: string; answer: RTCSessionDescriptionInit }
  | { type: 'ice-candidate'; from: string; candidate: RTCIceCandidateInit }
  | { type: 'call-end'; from: string }
  | { type: 'call-reject'; from: string };

// Voice call status
type VoiceCallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

// Caller information
interface CallerInfo {
  id: string;
  name: string;
}
