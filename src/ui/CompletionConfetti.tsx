import { useEffect, useRef } from "react";
import type { TimerSnapshot } from "../timer";

// Original local canvas effect; visual reference is recorded in docs/assets.md.
function launchConfetti(node: HTMLCanvasElement, settle: boolean) {
  const ctx = node.getContext("2d");
  if (!ctx) return;
  let width = innerWidth;
  let height = innerHeight;
  const colors = ["#EF4A40", "#F2A541", "#59B8E8", "#F5F5F5", "#91D5AD"];
  const pieces = Array.from({ length: 120 }, () => ({
    x: Math.random() * width,
    y: -20 - Math.random() * height * 0.6,
    speed: Math.max(height, 600) * (0.35 + Math.random() * 0.3),
    drift: Math.random() * 60 - 30,
    angle: Math.random() * Math.PI * 2,
    spin: Math.random() * 5 - 2.5,
    size: 6 + Math.random() * 6,
    landingOffset: 4 + Math.random() * 14,
    color: colors[Math.floor(Math.random() * colors.length)],
    settled: false,
  }));
  const paint = () => {
    ctx.clearRect(0, 0, width, height);
    for (const piece of pieces) {
      ctx.save();
      ctx.translate(piece.x, piece.y);
      ctx.rotate(piece.angle);
      // Keep settled paper visible even if its last airborne rotation was thin.
      ctx.scale(piece.settled ? 1 : Math.cos(piece.angle), 1);
      ctx.fillStyle = piece.color;
      ctx.fillRect(-piece.size / 2, -piece.size, piece.size, piece.size * 2);
      ctx.restore();
    }
  };
  const resize = () => {
    const previousWidth = width;
    const previousHeight = height;
    width = innerWidth;
    height = innerHeight;
    for (const piece of pieces) {
      piece.x *= width / Math.max(previousWidth, 1);
      piece.y = piece.settled
        ? height - piece.landingOffset
        : piece.y * (height / Math.max(previousHeight, 1));
    }
    const scale = Math.min(devicePixelRatio || 1, 2);
    node.width = Math.round(width * scale);
    node.height = Math.round(height * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    paint();
  };
  resize();
  window.addEventListener("resize", resize);
  const start = performance.now();
  let previous = start;
  let frame = 0;
  let previewFinished = false;
  const draw = (now: number) => {
    const elapsed = now - start;
    const dt = Math.min((now - previous) / 1000, 0.05);
    previous = now;
    if (!settle && elapsed >= 5000) {
      previewFinished = true;
      ctx.clearRect(0, 0, width, height);
      window.removeEventListener("resize", resize);
      return;
    }
    ctx.globalAlpha = settle ? 1 : Math.min(1, (5000 - elapsed) / 900);
    for (const piece of pieces) {
      if (piece.settled) continue;
      piece.y += piece.speed * dt;
      piece.x = Math.max(0, Math.min(width, piece.x + piece.drift * dt));
      piece.angle += piece.spin * dt;
      if (piece.y >= height - piece.landingOffset) {
        piece.y = height - piece.landingOffset;
        piece.settled = true;
      }
    }
    paint();
    // Keep the final canvas, but stop spending frames once all paper has landed.
    if (!settle || pieces.some((piece) => !piece.settled))
      frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", resize);
    if (!previewFinished) ctx.clearRect(0, 0, width, height);
  };
}

function ConfettiPreview() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvas.current) return launchConfetti(canvas.current, false);
  }, []);
  return (
    <canvas
      ref={canvas}
      className="completion-confetti confetti-preview effect-preview"
      aria-hidden="true"
    />
  );
}

export function CompletionConfetti({
  snapshot,
  enabled,
  previewId = 0,
}: {
  snapshot: TimerSnapshot;
  enabled: boolean;
  previewId?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const celebratedRun = useRef<number | null>(null);
  const { status, completionReason, runId } = snapshot;
  useEffect(() => {
    if (status !== "completed" || completionReason !== "limit") return;
    if (celebratedRun.current === runId) return;
    celebratedRun.current = runId;
    if (!enabled || !canvas.current) return;
    return launchConfetti(canvas.current, true);
  }, [status, completionReason, runId, enabled]);
  return (
    <>
      {status === "completed" && enabled && (
        <canvas
          ref={canvas}
          className="completion-confetti"
          aria-hidden="true"
        />
      )}
      {enabled && previewId > 0 && <ConfettiPreview key={previewId} />}
    </>
  );
}
