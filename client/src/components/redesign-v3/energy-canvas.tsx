import { useEffect, useRef, useState } from "react";
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
