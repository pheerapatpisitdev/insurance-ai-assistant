"use client";
import { useState, useTransition } from "react";
import { pairAd, type AdRow } from "./actions";
import { Empty } from "../ui";

/**
 * One row per advertisement, and a box saying what it sells.
 *
 * The box is left on "อ่านจากชื่อโฆษณา" until somebody changes it, and that is not a default
 * standing in for a decision — it is what actually happens: the bot reads the advertisement's
 * own name, and this row says what that reading came to. Choosing a plan here overrides it for
 * that advertisement and nothing else, which is the whole point of the page. Advertisements
 * whose names already read correctly need nobody to touch them.
 */

const PRODUCTS = [
  { value: "", label: "อ่านจากชื่อโฆษณา" },
  { value: "lifeprotect", label: "Life Protect (ประกันชีวิต)" },
  { value: "ihealthy", label: "iHealthy Ultra (ประกันสุขภาพ)" },
] as const;

const NAME = { lifeprotect: "Life Protect", ihealthy: "iHealthy Ultra" } as const;

export function AdTable({ rows }: { rows: AdRow[] }) {
  /**
   * The rows come from the server on every render, and the boxes hold only what has been
   * chosen since. Keeping the whole list in state instead meant the list was whatever it had
   * been when the page opened: a row added by the form below saved correctly and then did not
   * appear, because the copy on screen was made before it existed.
   */
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const ads = rows;

  function set(adId: string, product: string, label?: string) {
    setError(undefined);
    setChosen((c) => ({ ...c, [adId]: product }));
    start(async () => {
      try {
        await pairAd(adId, product as "" | "lifeprotect" | "ihealthy", label);
      } catch (e) {
        setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
      }
    });
  }

  if (!ads.length) {
    return (
      <Empty>
        ยังไม่เคยเห็นโฆษณาไหนเลย — รายชื่อจะขึ้นเองเมื่อมีลูกค้าทักเข้ามาจากโฆษณา
        หรือเมื่อสถิติโฆษณาถูกดึงเข้าระบบ ระหว่างนี้เพิ่มรหัสโฆษณาเองได้ด้านล่าง
      </Empty>
    );
  }

  return (
    <div className="overflow-x-auto">
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-slate-500">
            <th className="py-2 pr-3">โฆษณา</th>
            <th className="py-2 pr-3 text-right">ทักเข้ามา</th>
            <th className="py-2 pr-3 text-right">ใช้ไป</th>
            <th className="py-2">ขายแบบไหน</th>
          </tr>
        </thead>
        <tbody>
          {ads.map((ad) => (
            <tr key={ad.adId} className="border-b align-top">
              <td className="py-2 pr-3">
                <div className="font-medium text-slate-800">{ad.name ?? "(ไม่มีชื่อ)"}</div>
                <div className="text-xs text-slate-400">
                  {ad.adId}{ad.campaign ? ` · ${ad.campaign}` : ""}
                </div>
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">{ad.conversations || "—"}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {ad.spend ? `${Math.round(ad.spend).toLocaleString("en-US")} บาท` : "—"}
              </td>
              <td className="py-2">
                <select
                  value={chosen[ad.adId] ?? ad.paired ?? ""} disabled={pending}
                  onChange={(e) => set(ad.adId, e.target.value, ad.name)}
                  className="w-full max-w-[16rem] rounded border px-2 py-1.5 text-sm"
                >
                  {PRODUCTS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                {/* what happens if nobody chooses, said plainly rather than left to be discovered */}
                {!(chosen[ad.adId] ?? ad.paired) && (
                  <p className="mt-1 text-xs text-slate-500">
                    {ad.read
                      ? `ตอนนี้อ่านได้ว่า ${NAME[ad.read]}`
                      : "ชื่อนี้อ่านไม่ออกว่าแบบไหน — บอทจะถามลูกค้าว่าสนใจแบบไหน"}
                  </p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Adding an advertisement before it has sent anybody.
 *
 * A new campaign is paired the day it goes live, which is the day before its figures sync and
 * before its first customer arrives — so the list it would otherwise have to be picked from
 * does not exist yet. The id is on the advertisement in Ads Manager.
 */
export function AddAd() {
  const [adId, setAdId] = useState("");
  const [product, setProduct] = useState("lifeprotect");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs text-slate-500">
        รหัสโฆษณา (ad id)
        <input
          value={adId} onChange={(e) => setAdId(e.target.value)}
          placeholder="120210000000000000"
          className="mt-1 block w-56 rounded border px-2 py-1.5 text-sm text-slate-800"
        />
      </label>
      <label className="text-xs text-slate-500">
        ชื่อเรียก (ใส่ไว้ให้จำได้)
        <input
          value={label} onChange={(e) => setLabel(e.target.value)}
          placeholder="ไลฟ์ โพรเทค x2 — มีนาคม"
          className="mt-1 block w-64 rounded border px-2 py-1.5 text-sm text-slate-800"
        />
      </label>
      <label className="text-xs text-slate-500">
        ขายแบบไหน
        <select
          value={product} onChange={(e) => setProduct(e.target.value)}
          className="mt-1 block rounded border px-2 py-1.5 text-sm text-slate-800"
        >
          {PRODUCTS.filter((p) => p.value).map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </label>
      <button
        type="button" disabled={pending || !adId.trim()}
        onClick={() => start(async () => {
          setError(undefined);
          try {
            await pairAd(adId, product as "lifeprotect" | "ihealthy", label);
            setAdId(""); setLabel("");
          } catch (e) {
            setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
          }
        })}
        className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40"
      >
        {pending ? "กำลังบันทึก…" : "จับคู่"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
