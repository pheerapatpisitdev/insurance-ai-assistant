import type { MetadataRoute } from "next";

/**
 * What the app is called once it is saved to a phone's home screen.
 *
 * Agents work from a phone, and a page saved without this gets the URL as its name and a
 * screenshot as its icon. `short_name` is what actually appears under the icon — anything
 * past about twelve characters is cut with an ellipsis, so it is the shortest name that is
 * still the right one rather than a truncation of the long one.
 *
 * `start_url` is "/" and not the chat's own path because the chat is what "/" serves; a
 * saved app that opened on a deeper page would be one the agency could not later move.
 *
 * The icon is the same file the browser tab uses. `purpose: "any"` and not "maskable":
 * Android crops a maskable icon to whatever shape the launcher uses, and this mark is tall —
 * a circle mask would take the top and bottom off the N.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "คำนวณเบี้ยประกัน · advisortool",
    short_name: "advisortool",
    description: "ถามเงื่อนไขแบบประกันและคิดเบี้ยจากตารางจริงของบริษัท",
    start_url: "/",
    display: "standalone",
    lang: "th",
    background_color: "#26272A",
    theme_color: "#26272A",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
