import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Camera manager: permissions, live stream and lifecycle. Owns the MediaStream so
 * every exit path (unmount, stop button, tab hidden for good) releases the camera.
 */

export type CameraErrorKind = 'insecure' | 'unsupported' | 'denied' | 'not-found' | 'in-use' | 'unknown';

export interface CameraError {
  kind: CameraErrorKind;
  message: string;
}

export type CameraStatus = 'idle' | 'starting' | 'live' | 'error';
export type Facing = 'user' | 'environment';

export function describeCameraError(err: unknown): CameraError {
  const name = (err as DOMException)?.name;
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        kind: 'denied',
        message:
          'Camera access was blocked. Allow the camera for this site in your browser settings (the lock or “aA” icon next to the address), then try again.',
      };
    case 'NotFoundError':
    case 'OverconstrainedError':
      return { kind: 'not-found', message: 'No camera was found on this device.' };
    case 'NotReadableError':
    case 'AbortError':
      return { kind: 'in-use', message: 'The camera is busy. Close other apps or tabs using it and try again.' };
    default:
      return { kind: 'unknown', message: `The camera could not start${name ? ` (${name})` : ''}.` };
  }
}

export function checkCameraSupport(): CameraError | null {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return {
      kind: 'insecure',
      message: 'Camera access needs a secure connection. Open Hessa over https:// (or on localhost).',
    };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { kind: 'unsupported', message: 'This browser can’t use the camera. Try a recent Chrome, Safari, Edge or Firefox.' };
  }
  return null;
}

export type Camera = ReturnType<typeof useCamera>;

export interface CameraDevice {
  deviceId: string;
  label: string;
}

const SAVED_CAMERA = 'hessa.cameraId';
const readSaved = () => {
  try {
    return localStorage.getItem(SAVED_CAMERA);
  } catch {
    return null;
  }
};

export function useCamera(defaultFacing: Facing = 'environment') {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<CameraError | null>(null);
  const [facing, setFacing] = useState<Facing | null>(defaultFacing);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(readSaved);
  /** null = automatic (mirror front/laptop cameras); true/false = the user's choice. */
  const [mirrorOverride, setMirrorOverride] = useState<boolean | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('idle');
  }, []);

  /**
   * Start (or switch) the camera. A specific `deviceId` (e.g. a USB webcam picked
   * from the list) wins over `facing`; the choice is remembered for next time.
   */
  const start = useCallback(
    async (opts: { facing?: Facing; deviceId?: string | null } = {}) => {
      const unsupported = checkCameraSupport();
      if (unsupported) {
        setError(unsupported);
        setStatus('error');
        return;
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setStatus('starting');
      setError(null);
      const wantDevice = opts.deviceId !== undefined ? opts.deviceId : opts.facing ? null : deviceId;
      const base = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
      const open = (id: string | null) =>
        navigator.mediaDevices.getUserMedia({
          audio: false,
          video: id ? { ...base, deviceId: { exact: id } } : { ...base, facingMode: { ideal: opts.facing ?? facing ?? defaultFacing } },
        });
      try {
        let stream: MediaStream;
        try {
          stream = await open(wantDevice);
        } catch (err) {
          // A remembered camera that's been unplugged: fall back to any camera.
          if (!wantDevice) throw err;
          stream = await open(null);
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.muted = true;
          video.playsInline = true;
          await video.play().catch(() => {});
        }
        const settings = stream.getVideoTracks()[0]?.getSettings();
        setFacing((settings?.facingMode as Facing) ?? null);
        const id = settings?.deviceId ?? null;
        setDeviceId(id);
        try {
          if (id) localStorage.setItem(SAVED_CAMERA, id);
        } catch {}
        // Labels are only available once permission is granted, i.e. now.
        const all = await navigator.mediaDevices.enumerateDevices().catch(() => [] as MediaDeviceInfo[]);
        setDevices(
          all
            .filter((d) => d.kind === 'videoinput')
            .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` })),
        );
        setStatus('live');
      } catch (err) {
        setError(describeCameraError(err));
        setStatus('error');
      }
    },
    [deviceId, facing, defaultFacing],
  );

  const selectDevice = useCallback((id: string) => start({ deviceId: id }), [start]);

  const flip = useCallback(() => start({ facing: facing === 'user' ? 'environment' : 'user', deviceId: null }), [facing, start]);

  // Phones report which way the camera faces; laptop webcams usually don't, and face the user.
  const autoMirror = facing === 'user' || (facing === null && !/Android|iPhone|iPad/i.test(navigator.userAgent));
  const mirrored = mirrorOverride ?? autoMirror;

  /** Callback ref: lets the live stream follow the <video> across setup → match screens. */
  const bindVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current;
      el.muted = true;
      el.playsInline = true;
      el.play().catch(() => {});
    }
  }, []);

  // Always release the camera when the component using it goes away.
  useEffect(() => stop, [stop]);

  return {
    videoRef,
    bindVideo,
    status,
    error,
    facing,
    devices,
    deviceId,
    hasMultiple: devices.length > 1,
    start,
    stop,
    flip,
    selectDevice,
    mirrored,
    setMirrored: setMirrorOverride,
  };
}
