import { HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision';
import type { Overlay } from '@/components/CameraStage';
import { toView, type Point } from '@/referee/viewport';
import { readFingers } from './fingers';
import type { FrameObs, Side } from './revealDetector';

export interface SeenHand {
  side: Side;
  count: number | null;
  points: Point[]; // view space
}

/**
 * Converts raw landmarker output into per-player observations. Players are told
 * apart by which half of the frame their hand is in (left player / right player).
 */
export function observeHands(res: HandLandmarkerResult, mirrored: boolean, t: number): { obs: FrameObs; hands: SeenHand[] } {
  const hands: SeenHand[] = res.landmarks.map((lm, i) => {
    const points = lm.map((p) => toView(p, mirrored));
    const cx = (points[0].x + points[9].x) / 2;
    return { side: cx < 0.5 ? 'left' : 'right', count: readFingers(res.worldLandmarks[i] ?? []).count, points };
  });
  const left = hands.filter((h) => h.side === 'left');
  const right = hands.filter((h) => h.side === 'right');
  const conflict = left.length > 1 || right.length > 1;
  return {
    obs: {
      t,
      conflict,
      left: !conflict && left[0] ? { count: left[0].count } : null,
      right: !conflict && right[0] ? { count: right[0].count } : null,
    },
    hands,
  };
}

const SIDE_COLOR: Record<Side, string> = { left: '#C9ADA1', right: '#A0A083' };

export function drawHands(o: Overlay, hands: SeenHand[]) {
  const { ctx, rect, px } = o;
  // Midline that separates the two players.
  ctx.save();
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = 'rgba(234,224,204,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(rect.x + rect.w / 2, rect.y);
  ctx.lineTo(rect.x + rect.w / 2, rect.y + rect.h);
  ctx.stroke();
  ctx.restore();

  for (const h of hands) {
    const pts = h.points.map(px);
    ctx.strokeStyle = SIDE_COLOR[h.side];
    ctx.lineWidth = 3;
    for (const { start, end } of HandLandmarker.HAND_CONNECTIONS) {
      ctx.beginPath();
      ctx.moveTo(pts[start].x, pts[start].y);
      ctx.lineTo(pts[end].x, pts[end].y);
      ctx.stroke();
    }
    ctx.fillStyle = '#EAE0CC';
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Reading badge above the hand.
    const top = pts.reduce((a, b) => (b.y < a.y ? b : a));
    const label = h.count === null ? '?' : h.count === 0 ? '✊' : String(h.count);
    ctx.fillStyle = h.count === null ? 'rgba(164,71,58,0.92)' : 'rgba(31,49,51,0.9)';
    ctx.beginPath();
    ctx.arc(top.x, top.y - 28, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#EAE0CC';
    ctx.font = '700 20px "Plus Jakarta Sans", system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, top.x, top.y - 27);
  }
}
