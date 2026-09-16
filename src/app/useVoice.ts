"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Speaking and listening, using what the browser and the machine already have.
 *
 * No API and no key: macOS ships four Thai voices and Chrome does Thai recognition, so voice
 * costs exactly what typing costs — the one model call that answers the question. Whisper and
 * the paid voices are better at a hard accent and are worth reaching for only once this is
 * demonstrably not enough.
 *
 * Both halves degrade to nothing. A browser without recognition simply has no microphone
 * button, rather than one that does nothing when pressed.
 */

/** The bits of the recognition API this uses. It is not in lib.dom, and only these matter. */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => SpeechRecognitionLike;

function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export interface Listening {
  /** false in a browser that cannot do this, so the button is never drawn */
  supported: boolean;
  listening: boolean;
  /** what the microphone is hearing right now, before it has settled */
  interim: string;
  /** null until something goes wrong, and then a sentence a person can act on */
  error: string | null;
  start(): void;
  stop(): void;
}

/**
 * Listen, and hand back what was heard.
 *
 * `onFinal` receives the settled text; the caller puts it in the box rather than sending it,
 * which is the whole safety story. Speech mishears digits — thirty-five becomes 3 5, a
 * million becomes one — and on this site a misheard digit is a wrong premium. Seeing the
 * words before pressing send is a confirmation that costs nothing and catches everything.
 */
export function useListening(onFinal: (text: string) => void): Listening {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    setSupported(Boolean(recognitionCtor()));
    return () => ref.current?.abort();
  }, []);

  const stop = useCallback(() => {
    ref.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    setError(null);
    setInterim("");
    const r = new Ctor();
    ref.current = r;
    r.lang = "th-TH";
    r.continuous = false;
    // the running guess is shown as it changes, so a person can see it is hearing them
    r.interimResults = true;

    r.onresult = (e) => {
      let settled = "";
      let running = "";
      for (let i = 0; i < e.results.length; i++) {
        const alt = e.results[i][0];
        if (e.results[i].isFinal) settled += alt.transcript;
        else running += alt.transcript;
      }
      setInterim(running);
      if (settled.trim()) {
        onFinalRef.current(settled.trim());
        setInterim("");
      }
    };
    r.onerror = (e) => {
      setError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "เบราว์เซอร์ยังไม่อนุญาตให้ใช้ไมโครโฟน — กดอนุญาตที่แถบที่อยู่ด้านบนแล้วลองใหม่"
          : e.error === "no-speech"
            ? "ไม่ได้ยินเสียงพูดครับ ลองใหม่อีกครั้ง"
            : `ไมโครโฟนมีปัญหา (${e.error})`,
      );
      setListening(false);
    };
    r.onend = () => setListening(false);

    try {
      r.start();
      setListening(true);
    } catch {
      setError("เริ่มฟังไม่ได้ ลองใหม่อีกครั้งครับ");
      setListening(false);
    }
  }, []);

  return { supported, listening, interim, error, start, stop };
}

export interface Speaking {
  supported: boolean;
  speaking: boolean;
  /** the Thai voice being used, for the label that names it */
  voiceName: string | null;
  speak(text: string): void;
  cancel(): void;
}

/**
 * Read an answer out loud in Thai.
 *
 * The best Thai voice installed wins, and macOS marks its good ones "คุณภาพสูง" in the name.
 * Markdown is stripped first: a voice given "**HIC**" says the asterisks.
 */
export function useSpeaking(): Speaking {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setSupported(true);
    const pick = () => {
      const thai = speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith("th"));
      if (thai.length) setVoice(thai.find((v) => v.name.includes("คุณภาพสูง")) ?? thai[0]);
    };
    pick();
    speechSynthesis.onvoiceschanged = pick;
    return () => { speechSynthesis.onvoiceschanged = null; speechSynthesis.cancel(); };
  }, []);

  const cancel = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const plain = text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")   // a link is read as its words
      .replace(/[*_#`>]/g, "")                    // and the marks around them are not read
      .replace(/^\s*[-•]\s*/gm, "")
      .trim();
    if (!plain) return;
    const u = new SpeechSynthesisUtterance(plain);
    if (voice) u.voice = voice;
    u.lang = "th-TH";
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    speechSynthesis.speak(u);
    setSpeaking(true);
  }, [voice]);

  return { supported, speaking, voiceName: voice?.name ?? null, speak, cancel };
}
