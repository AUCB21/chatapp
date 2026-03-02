# Voice Chat - Quick Start Guide

Voice chat is now live in your chat app! 🎙️

## Features Added

✅ One-on-one voice calls within chat rooms  
✅ Call, answer, decline, and hang up controls  
✅ Mute/unmute microphone  
✅ Real-time call status display  
✅ Call duration timer  
✅ Incoming call notifications  
✅ WebRTC peer-to-peer audio (encrypted)  
✅ Works in all modern browsers  

## How to Use

### Starting a Call

1. Open a chat room (must have write or admin permission)
2. Click the green **phone icon** in the chat header
3. Wait for the other person to answer

### Receiving a Call

When someone calls you:
1. You'll see "📞 [Name] is calling..."
2. Click **Answer** to accept or **Decline** to reject
3. After accepting, you'll be connected

### During a Call

- **Timer**: Shows call duration (MM:SS)
- **Mute button**: Click the microphone icon to mute/unmute
- **Hang up button**: Red phone icon to end the call

### Call States

| Status | What You See |
|--------|--------------|
| Idle | Green phone icon - ready to call |
| Calling | Blue status with "Calling..." |
| Ringing | Incoming call with Answer/Decline buttons |
| Connected | Green status with timer and controls |
| Ended | Brief "Call ended" message |

## Browser Requirements

Voice chat requires:
- ✅ **HTTPS** (automatic on Vercel)
- ✅ **Microphone permission** (browser will ask on first call)
- ✅ Modern browser: Chrome 74+, Firefox 66+, Safari 12.1+, Edge 79+

## Testing Locally

### Test with Two Browsers

1. Start dev server: `npm run dev`
2. Open in two different browsers (or incognito mode)
3. Login with different accounts
4. Create/join same chat
5. Try calling between them

### Test on Mobile

1. Deploy to Vercel (HTTPS required)
2. Open on your phone
3. Allow microphone access when prompted
4. Test calls work end-to-end

## Troubleshooting

### "Microphone access denied"
**Fix**: Click the camera/microphone icon in browser address bar → Allow microphone

### "Voice calls not supported"
**Fix**: Update your browser or use Chrome/Firefox/Safari

### Can't hear audio
**Fix**: 
- Check your speakers/headphones
- Make sure volume is up
- Try unmuting if the mute button is red

### Call doesn't connect
**Fix**:
- Check your internet connection
- Make sure both users are in the same chat
- Try refreshing the page

### Echo or feedback
**Fix**: 
- Use headphones
- Lower speaker volume
- Move away from microphone

## Security

- ✅ Audio is peer-to-peer encrypted (WebRTC built-in)
- ✅ Only chat members can call each other
- ✅ No call recording (fully private)
- ✅ Requires HTTPS in production

## Technical Details

### Architecture
```
Browser A ←→ WebRTC (P2P Audio) ←→ Browser B
     ↓              ↓                   ↓
     └──── Supabase Realtime (Signaling) ───┘
```

### Files Added
- `src/lib/webrtc.ts` - WebRTC utilities
- `src/hooks/useVoiceCall.ts` - Voice call logic
- `src/components/VoiceCallControls.tsx` - UI controls
- `src/types.d.ts` - Type definitions (updated)

### Files Modified
- `src/app/page.tsx` - Added voice controls to chat header

## Bandwidth Usage

- ~50-100 Kbps per call (audio only)
- Low impact - works well on mobile data
- Uses free Google STUN servers

## Future Enhancements

Want more features? Consider adding:
- [ ] Group voice calls (3+ participants)
- [ ] Video calling
- [ ] Screen sharing
- [ ] Call history/logs
- [ ] Push notifications for missed calls
- [ ] Call quality indicators

## Deployment

Voice chat works automatically when deployed to Vercel because:
1. ✅ HTTPS is enabled by default
2. ✅ No additional configuration needed
3. ✅ No extra environment variables required
4. ✅ Uses existing Supabase Realtime

Just `git push` and it's live! 🚀

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify microphone permission is granted
3. Ensure HTTPS is enabled
4. Test with different browsers
5. Check Vercel function logs

---

**Enjoy your new voice chat feature!** 🎉
