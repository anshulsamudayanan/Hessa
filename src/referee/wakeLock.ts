import { useEffect } from 'react';

/** Keep the screen awake while a phone is propped up refereeing. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let released = false;
    const request = () =>
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          if (released) l.release();
          else lock = l;
        })
        .catch(() => {});
    const onVisible = () => document.visibilityState === 'visible' && request();
    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
