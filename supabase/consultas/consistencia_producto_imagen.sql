-- Consistencia entre producto.imagen_path (columna derivada) y la galería
-- (producto_imagen), tras 20261014120000_producto_imagen. SOLO LECTURA.
--
--   supabase db query --linked -f supabase/consultas/consistencia_producto_imagen.sql
--
-- Esperado: 0 y 0. Si sale otra cosa, se arregla con las RPC de la galería
-- (agregar_imagen_producto / quitar_imagen_producto / reordenar_imagenes_producto,
-- con actor), nunca con un UPDATE directo: un UPDATE no deja responsable en la
-- bitácora y se saltaría el tope de 8 y el orden sin huecos.

select
  -- 1. imagen_path no coincide con la foto de orden 0 (incluye: hay galería y
  --    imagen_path es NULL, o imagen_path apunta a otra foto).
  (select count(*)
     from public.producto p
     join public.producto_imagen i on i.producto_id = p.id and i.orden = 0
    where p.imagen_path is distinct from i.storage_path)              as principal_desincronizada,

  -- 2. imagen_path con valor pero el producto no tiene ninguna fila en la galería.
  (select count(*)
     from public.producto p
    where p.imagen_path is not null
      and not exists (select 1 from public.producto_imagen i where i.producto_id = p.id)) as imagen_sin_galeria;
