"use client";

import { useRef, useState } from "react";
import { signModuleCompletion } from "@/lib/actions";

export function SignaturePad({ moduleId }: { moduleId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasStroke = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const getCtx = () => canvasRef.current?.getContext("2d") ?? null;

  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = getCtx();
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = pointFromEvent(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#1c2c4d";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    hasStroke.current = true;
    if (isEmpty) setIsEmpty(false);
  };

  const end = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStroke.current = false;
    setIsEmpty(true);
  };

  const submit = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke.current) return;
    setSubmitting(true);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const fd = new FormData();
      fd.set("moduleId", moduleId);
      fd.set("signatureData", dataUrl);
      await signModuleCompletion(fd);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border border-rule rounded-md bg-surface p-5">
      <h2 className="font-[var(--font-display)] font-semibold mb-1">Sign to confirm completion</h2>
      <p className="text-ink-2 text-[13.5px] mb-3">
        You&apos;ve passed every knowledge check. Sign below to confirm you completed and understood this training — your
        manager will certify you after the practical evaluation.
      </p>
      <div className="border border-rule-2 rounded-lg bg-paper relative">
        <canvas
          ref={canvasRef}
          width={500}
          height={140}
          className="w-full h-[140px] touch-none cursor-crosshair"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        {isEmpty && <span className="absolute inset-0 flex items-center justify-center text-ink-3 text-sm pointer-events-none">Sign here</span>}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button type="button" onClick={clear} className="btn-secondary text-xs">
          Clear
        </button>
        <button type="button" onClick={submit} disabled={isEmpty || submitting} className="btn-primary text-xs disabled:opacity-40 disabled:cursor-not-allowed">
          {submitting ? "Signing…" : "Accept & Sign"}
        </button>
      </div>
    </div>
  );
}
