import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AVST — เครื่องมือที่ปรึกษาประกัน",
    short_name: "AVST",
    description: "โปรแกรมคำนวณเบี้ยประกันสำหรับตัวแทน",
    start_url: "/",
    display: "standalone",
    background_color: "#26272a",
    theme_color: "#26272a",
    icons: [
      { src: "/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/app-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
