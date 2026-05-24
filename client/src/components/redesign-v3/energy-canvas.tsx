import { useEffect, useMemo, useRef, useState } from "react";
import {
  ENERGY_STATES,
  scoreEnergyState,
  type EnergyStateName,
} from "@/lib/energy-canvas";
import { cn } from "@/lib/utils";

export function EnergyCanvas({ text }: { text: string }) {
  const [stateName, setStateName] = useState<EnergyStateName>("blank");
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setStateName("blank");
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      setStateName(scoreEnergyState(text));
    }, 400);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [text]);

  const state = ENERGY_STATES[stateName];

  return (
    <div className="sift-energy-canvas" aria-hidden style={{ background: state.bg }}>
      {state.blobs.map((blob, index) => (
        <div
          key={index}
          className={cn("sift-energy-blob", `sift-energy-blob-${index}`)}
          style={{
            width: `${blob.w}%`,
            height: `${blob.h}%`,
            left: `${blob.l}%`,
            top: `${blob.t}%`,
            background: blob.grad,
            opacity: blob.op,
            animationDuration: blob.spd,
          }}
        />
      ))}
      <div className="sift-energy-noise" />
    </div>
  );
}

export function EnergyIndicator({ text }: { text: string }) {
  const [stateName, setStateName] = useState<EnergyStateName>("blank");
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setStateName("blank");
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      setStateName(scoreEnergyState(text));
    }, 400);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [text]);

  const state = useMemo(() => ENERGY_STATES[stateName], [stateName]);
  const visible = Boolean(state.label);

  return (
    <div
      className={cn("sift-energy-indicator", visible && "visible")}
      aria-live="polite"
      aria-atomic="true"
    >
      {visible ? (
        <>
          <div className="sift-energy-dot" style={{ background: state.dotColor }} />
          <span className="sift-energy-word" style={{ color: state.dotColor }}>
            {state.label}
          </span>
        </>
      ) : null}
    </div>
  );
}

export function useEnergyState(text: string): EnergyStateName {
  const [stateName, setStateName] = useState<EnergyStateName>("blank");
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setStateName("blank");
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      setStateName(scoreEnergyState(text));
    }, 400);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [text]);

  return stateName;
}
