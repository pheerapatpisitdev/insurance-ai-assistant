"use client";

/**
 * LINE's own share link: it opens the app with the text ready and lets the agent pick which
 * chat it goes to. Long summaries are fine — this rides in the URL, and a quote runs to a few
 * hundred characters, well inside what browsers and LINE accept.
 */
function shareUrl(text: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(text)}`;
}

export function ShareToLineButton({ text }: { text: string }) {
  return (
    <a
      href={shareUrl(text)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="currentColor">
        <path d="M12 2C6.5 2 2 5.6 2 10c0 3.9 3.5 7.2 8.2 7.9.3.07.75.22.86.5.1.26.07.66.03.92l-.14.83c-.04.25-.2.96.85.53 1.05-.44 5.65-3.33 7.7-5.7C20.9 13.4 22 11.8 22 10c0-4.4-4.5-8-10-8Z" />
      </svg>
      แชร์เข้า LINE
    </a>
  );
}
