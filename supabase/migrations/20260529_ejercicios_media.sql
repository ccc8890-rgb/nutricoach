-- Sprint 4: añadir foto_url, video_url, video_tipo a la tabla ejercicios
ALTER TABLE ejercicios
  ADD COLUMN IF NOT EXISTS foto_url   TEXT,
  ADD COLUMN IF NOT EXISTS video_url  TEXT,
  ADD COLUMN IF NOT EXISTS video_tipo TEXT; -- 'youtube' | 'instagram' | 'url' | null
