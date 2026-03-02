/**
 * WebRTC utilities for voice chat
 * Handles peer connection setup, ICE configuration, and media streams
 */

// Free Google STUN servers for NAT traversal
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

// Audio constraints for high-quality voice
const AUDIO_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: false,
};

/**
 * Request microphone access from the browser
 */
export async function requestMicrophoneAccess(): Promise<MediaStream> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
    return stream;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Microphone access denied. Please allow microphone access in your browser settings.');
      }
      if (error.name === 'NotFoundError') {
        throw new Error('No microphone found. Please connect a microphone and try again.');
      }
    }
    throw new Error('Failed to access microphone. Please check your browser settings.');
  }
}

/**
 * Create a new RTCPeerConnection with proper configuration
 */
export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection(ICE_SERVERS);
}

/**
 * Add local audio stream to peer connection
 */
export function addStreamToPeer(peer: RTCPeerConnection, stream: MediaStream): void {
  stream.getTracks().forEach((track) => {
    peer.addTrack(track, stream);
  });
}

/**
 * Stop all tracks in a media stream
 */
export function stopMediaStream(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

/**
 * Toggle mute state of an audio stream
 * @param stream - The media stream to mute/unmute
 * @param shouldMute - true to mute, false to unmute
 */
export function toggleStreamMute(stream: MediaStream | null, shouldMute: boolean): void {
  if (!stream) return;
  stream.getAudioTracks().forEach((track) => {
    track.enabled = !shouldMute; // enabled=false means muted
  });
}

/**
 * Check if browser supports WebRTC
 */
export function isWebRTCSupported(): boolean {
  return !!(
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof window !== 'undefined' &&
    window.RTCPeerConnection
  );
}

/**
 * Get user-friendly browser name for error messages
 */
export function getBrowserName(): string {
  const userAgent = navigator.userAgent;
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  return 'your browser';
}

// ============= SCREEN SHARING =============

export type ScreenShareResolution = '720p' | '1080p' | '4k';

export interface ScreenShareOptions {
  resolution: ScreenShareResolution;
  includeAudio: boolean;
}

/**
 * Map resolution names to actual dimensions
 */
function getResolutionConstraints(resolution: ScreenShareResolution): { width: number; height: number; frameRate: number } {
  switch (resolution) {
    case '720p':
      return { width: 1280, height: 720, frameRate: 30 };
    case '1080p':
      return { width: 1920, height: 1080, frameRate: 30 };
    case '4k':
      return { width: 3840, height: 2160, frameRate: 30 };
  }
}

/**
 * Request screen sharing with specified options
 * Browser will show native picker for screen/window selection
 */
export async function requestScreenShare(options: ScreenShareOptions): Promise<MediaStream> {
  if (!isScreenShareSupported()) {
    throw new Error('Screen sharing is not supported in your browser.');
  }

  try {
    const constraints = getResolutionConstraints(options.resolution);
    
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: constraints.width, max: constraints.width },
        height: { ideal: constraints.height, max: constraints.height },
        frameRate: { ideal: constraints.frameRate, max: constraints.frameRate },
      },
      audio: options.includeAudio ? {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      } : false,
    });

    return stream;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Screen sharing denied. Please allow screen sharing to continue.');
      }
      if (error.name === 'NotFoundError') {
        throw new Error('No screen source found. Please try again.');
      }
    }
    throw new Error('Failed to start screen sharing. Please check your browser settings.');
  }
}

/**
 * Check if browser supports screen sharing
 */
export function isScreenShareSupported(): boolean {
  return !!(
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === 'function'
  );
}

/**
 * Stop screen sharing tracks
 */
export function stopScreenShare(stream: MediaStream | null): void {
  stopMediaStream(stream);
}

/**
 * Get track type ('video' for screen, 'audio' for system audio)
 */
export function getTrackType(track: MediaStreamTrack): 'video' | 'audio' {
  return track.kind as 'video' | 'audio';
}
