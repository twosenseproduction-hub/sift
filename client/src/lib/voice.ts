// Web Speech API wrapper. Returns a recognizer handle with start/stop.
// Falls back gracefully — component checks `isSupported`.

export type RecognitionHandle = {
  start: () => void;
  stop: () => void;
};

export function isVoiceSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  );
}

export function createRecognizer(opts: {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (msg: string) => void;
  onEnd?: () => void;
}): RecognitionHandle | null {
  const SR: any =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!SR) return null;

  const rec = new SR();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = navigator.language || "en-US";

  let finalBuffer = "";

  rec.onresult = (e: any) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) {
        finalBuffer += res[0].transcript + " ";
      } else {
        interim += res[0].transcript;
      }
    }
    const combined = (finalBuffer + interim).trim();
    opts.onResult(combined, false);
  };

  rec.onerror = (e: any) => {
    opts.onError?.(e.error || "speech error");
  };

  rec.onend = () => {
    // Send one final clean version and signal end
    opts.onResult(finalBuffer.trim(), true);
    opts.onEnd?.();
  };

  return {
    start: () => {
      finalBuffer = "";
      try {
        rec.start();
      } catch (e) {
        // noop — already started
      }
    },
    stop: () => {
      try {
        rec.stop();
      } catch (e) {}
    },
  };
}
