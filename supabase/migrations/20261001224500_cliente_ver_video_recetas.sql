-- El coach decide por cliente si el portal muestra el vídeo original (Instagram/TikTok/YouTube) de las recetas.
alter table public.clientes
  add column if not exists ver_video_recetas boolean not null default false;
