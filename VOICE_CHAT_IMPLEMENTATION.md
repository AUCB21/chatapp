# Voice Chat Implementation Guide

## Overview

Add real-time voice calling functionality to the chat application using WebRTC for peer-to-peer audio streaming and Supabase Realtime for signaling.

## Features

- ✅ One-on-one voice calls within chat rooms
- ✅ Call/hang up controls
- ✅ Mute/unmute microphone
- ✅ Volume controls
- ✅ Call status indicators (idle, calling, ringing, connected)
- ✅ Browser audio permission handling
- ✅ Automatic cleanup on disconnect

## Technical Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Audio Streaming | WebRTC | Peer-to-peer audio transmission |
| Signaling | Supabase Realtime | Exchange connection info (SDP, ICE candidates) |
| State Management | React Hooks | Call state and controls |
| UI | React Components | Voice call interface |

## Architecture

```
User A                    Supabase Realtime               User B
  |                              |                           |
  |---(1) Start Call----------->|                           |
  |                              |---(2) Call Signal-------->|
  |                              |                           |
  |<--(3) Answer---------------- |<--(4) Answer Signal------|
  |                              |                           |
  |---(5) WebRTC Direct Connection (peer-to-peer audio)---->|
  |<--(6) Audio Stream----------------------------------------|
```

## New Requirements

### Dependencies

Add WebRTC simple-peer library (optional - we'll use native WebRTC):

```bash
# Optional: If you want simpler WebRTC handling
npm install simple-peer
npm install -D @types/simple-peer
```

**OR** use native WebRTC APIs (no additional dependencies required) ✅

### Browser Permissions

- Microphone access required
- HTTPS required in production (WebRTC security requirement)
- Supported browsers: Chrome, Firefox, Safari, Edge (latest versions)

### Supabase Configuration

No additional Supabase configuration needed - uses existing Realtime channels.

## Implementation Steps

### Step 1: Create Voice Call Hook

**File**: `src/hooks/useVoiceCall.ts`

**Functionality**:
- Manage WebRTC peer connections
- Handle offer/answer exchange
- Process ICE candidates
- Manage audio streams
- Provide call controls (call, hangup, mute)

**Key Functions**:
```typescript
- startCall(targetUserId: string): Promise<void>
- answerCall(): Promise<void>
- hangUp(): void
- toggleMute(): void
```

**State**:
```typescript
- callStatus: 'idle' | 'calling' | 'ringing' | 'connected'
- isMuted: boolean
- isIncomingCall: boolean
- caller: { id: string, name: string } | null
- remoteStream: MediaStream | null
```

### Step 2: Create Voice Chat UI Component

**File**: `src/components/VoiceCallControls.tsx`

**Features**:
- Call button (start call)
- Hang up button
- Mute/unmute toggle
- Volume indicator
- Call status display
- Incoming call notification with accept/decline

**UI States**:
- Idle: Show "Start Voice Call" button
- Calling: Show "Calling..." with hang up option
- Ringing: Show "Incoming call from X" with accept/decline
- Connected: Show hang up, mute controls, duration timer

### Step 3: Integrate into Chat Page

**File**: `src/app/page.tsx`

**Changes**:
- Import `useVoiceCall` hook
- Import `VoiceCallControls` component
- Pass active chat ID to voice call hook
- Add voice controls to chat header
- Handle voice call events

**Placement**: Add voice controls next to chat name in the header.

### Step 4: Add Signaling Types

**File**: `src/types.d.ts`

**Add**:
```typescript
type VoiceSignal = 
  | { type: 'call-offer', from: string, offer: RTCSessionDescriptionInit }
  | { type: 'call-answer', from: string, answer: RTCSessionDescriptionInit }
  | { type: 'ice-candidate', from: string, candidate: RTCIceCandidateInit }
  | { type: 'call-end', from: string };
```

### Step 5: Update Supabase Realtime Usage

**File**: `src/hooks/useChat.ts`

**Note**: Voice signaling will use a separate Realtime channel per chat:
- Channel name: `voice-${chatId}`
- Events: Custom WebRTC signaling events
- No database changes required

### Step 6: Add Voice Call Permissions UI

**File**: `src/components/MicrophonePermission.tsx`

**Features**:
- Request microphone permission
- Show permission status
- Handle denied permissions
- Provide instructions for enabling

## Database Changes

**None required** - Voice calls use Realtime channels only (no persistence).

Optional: Add call history tracking later if desired.

## Security Considerations

### 1. WebRTC Security
- ✅ Peer-to-peer encryption (built into WebRTC)
- ✅ HTTPS required in production
- ✅ STUN/TURN servers for NAT traversal

### 2. Access Control
- ✅ Only chat members can initiate calls
- ✅ Validate membership via RLS policies
- ✅ Realtime channels require authentication

### 3. Privacy
- ⚠️ Audio is peer-to-peer (not recorded)
- ⚠️ No call history stored (unless implemented)
- ⚠️ Users must explicitly accept calls

## STUN/TURN Server Configuration

WebRTC needs STUN servers for NAT traversal:

### Free STUN Servers (Default)
```javascript
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];
```

### Optional: TURN Server (for restrictive networks)

For production, consider:
- **Twilio STUN/TURN**: https://www.twilio.com/stun-turn
- **Xirsys**: https://xirsys.com/
- **Self-hosted Coturn**: Open source TURN server

**Add to environment variables**:
```env
NEXT_PUBLIC_TURN_SERVER_URL=turn:your-turn-server.com:3478
NEXT_PUBLIC_TURN_USERNAME=username
NEXT_PUBLIC_TURN_CREDENTIAL=password
```

## Testing Plan

### Unit Tests
- [ ] Test WebRTC connection establishment
- [ ] Test signaling message exchange
- [ ] Test mute/unmute functionality
- [ ] Test call termination

### Integration Tests
- [ ] Test full call flow between two users
- [ ] Test call rejection
- [ ] Test call timeout
- [ ] Test reconnection after network interruption

### Manual Testing Checklist
- [ ] Can start a call from chat A
- [ ] User B receives call notification
- [ ] User B can accept/decline call
- [ ] Audio streams both directions
- [ ] Mute works correctly
- [ ] Hang up ends call for both users
- [ ] Multiple chats don't interfere
- [ ] Works on mobile browsers
- [ ] Works in incognito/private mode
- [ ] Handles microphone permission denial

## Browser Compatibility

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 74+ | ✅ Full |
| Firefox | 66+ | ✅ Full |
| Safari | 12.1+ | ✅ Full |
| Edge | 79+ | ✅ Full |
| Mobile Safari | 13+ | ✅ Full |
| Mobile Chrome | 74+ | ✅ Full |

## Performance Considerations

### Audio Quality Settings
```javascript
const constraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
    channelCount: 1 // Mono for efficiency
  }
};
```

### Bandwidth Usage
- Audio only: ~50-100 Kbps per peer
- Low bandwidth compared to video
- Scales well for one-on-one calls

### Connection Monitoring
- Monitor ICE connection state
- Detect disconnections
- Auto-cleanup on errors
- Reconnection attempts

## Implementation Timeline

### Phase 1: Core Voice (2-3 hours)
1. Create `useVoiceCall` hook
2. Implement WebRTC setup
3. Add Realtime signaling
4. Basic call/hangup

### Phase 2: UI Components (1-2 hours)
1. Create `VoiceCallControls` component
2. Add call status indicators
3. Integrate into chat page
4. Style voice controls

### Phase 3: Polish (1-2 hours)
1. Add mute/unmute
2. Add volume controls
3. Connection quality indicators
4. Error handling & permissions UI

### Phase 4: Testing (1-2 hours)
1. Cross-browser testing
2. Network condition testing
3. Edge case handling
4. Mobile testing

**Total Estimated Time**: 5-9 hours

## Code Structure

```
src/
├── hooks/
│   ├── useChat.ts (existing)
│   └── useVoiceCall.ts (new)
├── components/
│   ├── VoiceCallControls.tsx (new)
│   └── MicrophonePermission.tsx (new)
├── lib/
│   └── webrtc.ts (new - WebRTC utilities)
└── app/
    └── page.tsx (update)
```

## Deployment Checklist

### Before Deploying

- [ ] Test on localhost with two browsers
- [ ] Test on local network (different devices)
- [ ] Verify HTTPS in production (required for WebRTC)
- [ ] Configure STUN servers
- [ ] Add error logging
- [ ] Test microphone permissions flow

### After Deploying

- [ ] Test on production URL
- [ ] Verify across different browsers
- [ ] Test on mobile devices
- [ ] Monitor for connection issues
- [ ] Check Vercel function logs for errors

## Future Enhancements

### Phase 2 Features (Optional)
- [ ] Group voice calls (3+ participants)
- [ ] Screen sharing
- [ ] Call recording (with consent)
- [ ] Call history/logs
- [ ] Push notifications for calls
- [ ] Video calling
- [ ] Call quality metrics
- [ ] Background noise suppression (advanced)

### Monitoring & Analytics
- [ ] Track call success rate
- [ ] Monitor connection quality
- [ ] Log common errors
- [ ] Usage statistics

## Troubleshooting Guide

### Common Issues

**Issue**: "Permission denied" error
- **Solution**: User must allow microphone access in browser settings

**Issue**: "ICE connection failed"
- **Solution**: Check STUN/TURN server configuration, might need TURN server

**Issue**: No audio heard
- **Solution**: Check browser audio settings, verify microphone/speaker

**Issue**: Echo or feedback
- **Solution**: Enable echo cancellation, use headphones

**Issue**: Call doesn't connect
- **Solution**: Check firewall, verify Realtime channel subscription

## Resources

- [WebRTC Documentation](https://webrtc.org/)
- [MDN WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [WebRTC Samples](https://webrtc.github.io/samples/)

## Questions & Decisions

Before implementing, decide:

1. **One-on-one only or group calls?** → Start with one-on-one
2. **Call history/logs?** → No (Phase 2)
3. **Video calling?** → No (Phase 2)
4. **Mobile app support?** → Web only initially
5. **TURN server?** → Optional, use free STUN for now

## Next Steps

1. Review this document
2. Confirm feature requirements
3. Set up development environment
4. Begin Phase 1 implementation
5. Test incrementally

---

**Ready to implement?** Let me know and I'll start with Phase 1! 🚀
