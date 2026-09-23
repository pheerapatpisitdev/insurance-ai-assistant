"use client";
import { useCallback, useRef, useState } from "react";

/**
 * Save a poster the way each device expects: on a phone the share sheet, whose "บันทึกภาพ"
 * puts it in Photos where the Facebook app looks; on a computer a PNG in Downloads.
 *
 * iPhone Safari lets a page open the share sheet only straight from the tap, not after
 * waiting on the network, so the picture is fetched ahead — when the preview has loaded, from
 * the browser's cache — and handed over at once.
 */

const isPhone = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

function download(blob: Blob, name: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

async function fetchFile(url: string, name: string): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`poster ${res.status}`);
  return new File([await res.blob()], name, { type: "image/png" });
}

export type SaveState = "idle" | "saving" | "saved" | "failed";

/** `ready` goes on the preview <img onLoad>; `save` on the button. */
export function usePictureSaver(url: string, name: string) {
  const file = useRef<{ url: string; file: Promise<File> } | null>(null);
  const [state, setState] = useState<SaveState>("idle");

  const load = useCallback(() => {
    if (file.current?.url !== url) {
      const p = fetchFile(url, name);
      p.catch(() => { if (file.current?.url === url) file.current = null; });
      file.current = { url, file: p };
    }
    return file.current.file;
  }, [url, name]);

  const save = useCallback(async () => {
    setState("saving");
    try {
      const f = await load();
      if (isPhone() && navigator.canShare?.({ files: [f] })) {
        try {
          await navigator.share({ files: [f] });
        } catch (e) {
          if ((e as Error).name === "AbortError") { setState("idle"); return; }
          download(f, name); // the sheet refused (no tap left to spend): fall back to a file
        }
      } else {
        download(f, name);
      }
      setState("saved");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("failed");
      setTimeout(() => setState("idle"), 3000);
    }
  }, [load, name]);

  return { ready: () => void load(), save, state };
}

export const SAVE_LABEL: Record<SaveState, string> = {
  idle: "บันทึกรูป", saving: "กำลังเตรียม…", saved: "บันทึกแล้ว ✓", failed: "ไม่สำเร็จ ลองใหม่",
};
