-- Facebook ads join posts and scripts on the content workbench.
--
-- An ad is one cell of a round's matrix — a selling angle in a tone — stored as a piece like any
-- other so it gets the same checks, poster, pictures and ใช้จริง/ลบ. Its three Ads Manager fields
-- map onto the piece's own: headline → hooks[0], primary text → body, description → closing,
-- with the angle and tone kept in output.ad. See src/lib/content/ads.ts.
alter table public.ins_content drop constraint if exists ins_content_format_check;
alter table public.ins_content add constraint ins_content_format_check check (format in ('post', 'script', 'ad'));
