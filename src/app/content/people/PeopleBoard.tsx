"use client";
import { useState } from "react";
import { MAX_PHOTOS } from "@/lib/content/people";
import type { Person } from "@/lib/content/people-store";
import { ask } from "../ask";

/** the long side a reference photo is sent at: plenty for a face, and four fit one request */
const LONG_SIDE = 1024;

/** A photo shrunk in the browser to LONG_SIDE and re-encoded as JPEG, so an upload stays small. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LONG_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("resize failed"))), "image/jpeg", 0.88));
}

const photoUrl = (path: string) => `/api/content-people/photo?path=${encodeURIComponent(path)}`;

export function PeopleBoard({ initial }: { initial: Person[] }) {
  const [people, setPeople] = useState(initial);
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  async function save() {
    setError(null);
    if (!name.trim()) return setError("ตั้งชื่อก่อนนะครับ");
    if (files.length === 0) return setError("เลือกรูปอย่างน้อย 1 รูปนะครับ");
    if (files.length > MAX_PHOTOS) return setError(`เลือกได้ไม่เกิน ${MAX_PHOTOS} รูปนะครับ`);
    if (!consent) return setError("ต้องติ๊กยืนยันว่าได้รับความยินยอมจากเจ้าของรูปก่อนนะครับ");
    setBusy(true);
    try {
      const form = new FormData();
      form.set("name", name.trim());
      form.set("consent", "on");
      for (const [i, f] of files.entries()) form.append("photos", await shrink(f), `photo-${i}.jpg`);
      const res = await fetch("/api/content-people", { method: "POST", body: form }).then((r) => r.json());
      if (!res.ok) return setError(res.error);
      setPeople((list) => [...list, res.person as Person]);
      setName(""); setFiles([]); setConsent(false); setFormKey((k) => k + 1);
    } catch {
      setError("อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้งนะครับ (รูปบางแบบ เช่น HEIC จากไอโฟน ให้แปลงเป็น JPG ก่อน)");
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: Person) {
    if (!(await ask(`ลบ "${p.name}" และรูปทั้งหมดออกจากระบบ? ลบแล้วกู้คืนไม่ได้`, "ลบ"))) return;
    const res = await fetch(`/api/content-people?id=${p.id}`, { method: "DELETE" }).then((r) => r.json()).catch(() => ({ ok: false }));
    if (!res.ok) return setError("ลบไม่สำเร็จ ลองใหม่อีกครั้งนะครับ");
    setPeople((list) => list.filter((x) => x.id !== p.id));
  }

  const field = "w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm";

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-lg border border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)] p-3 text-sm text-[var(--ct-alert)]">{error}</p>}

      <section className="space-y-3">
        {people.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--ct-line)] p-6 text-center text-sm text-[var(--ct-mute)]">ยังไม่มีใครในคลัง — เพิ่มคนแรกด้านล่าง</p>
        ) : people.map((p) => (
          <article key={p.id} className="flex flex-wrap items-center gap-4 rounded-lg border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-3">
            <div className="flex gap-2">
              {p.photos.map((path) => (
                // eslint-disable-next-line @next/next/no-img-element -- a private photo through our own route
                <img key={path} src={photoUrl(path)} alt="" className="size-16 rounded-md object-cover" />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{p.name}</p>
              <p className="text-xs text-[var(--ct-mute)]">{p.photos.length} รูป · ยืนยันความยินยอม {new Date(p.consentedAt).toLocaleDateString("th-TH")}</p>
            </div>
            <button type="button" onClick={() => remove(p)} className="rounded-lg border border-[var(--ct-line)] px-3 py-1.5 text-sm text-[var(--ct-alert)]">ลบ</button>
          </article>
        ))}
      </section>

      <section key={formKey} className="space-y-3 rounded-lg border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4">
        <h2 className="font-semibold">เพิ่มบุคคล</h2>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">ชื่อ</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="ตัวผม" className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">รูปต้นแบบ (1–{MAX_PHOTOS} รูป)</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, MAX_PHOTOS))} className="block text-sm" />
          {files.length > 0 && <span className="mt-1 block text-xs text-[var(--ct-mute)]">เลือกแล้ว {files.length} รูป</span>}
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
          <span>ได้รับความยินยอมจากเจ้าของรูป ให้ใช้ในโฆษณาและให้ AI ดัดแปลงได้</span>
        </label>
        <button type="button" onClick={save} disabled={busy} className="rounded-lg bg-[var(--ct-solid)] px-4 py-2 text-sm font-medium text-[var(--ct-solid-ink)] disabled:opacity-50">
          {busy ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </section>
    </div>
  );
}
