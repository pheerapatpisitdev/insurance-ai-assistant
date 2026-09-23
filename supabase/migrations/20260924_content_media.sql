-- The pictures the content posters draw behind their words.
--
-- Private: nothing reads this bucket but the server, with the service role — /api/content-poster
-- downloads a piece's picture and draws the poster over it, and the page only ever sees the
-- finished poster. Files are "<piece id>/<file id>.<ext>", the only shape src/lib/content/poster.ts
-- accepts as a background, so a poster URL cannot be pointed at anything else.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content-media', 'content-media', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
