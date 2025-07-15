-- Adicionar foreign key entre rascunhos_compras.usuario_id e usuarios.id
ALTER TABLE public.rascunhos_compras 
ADD CONSTRAINT fk_rascunhos_compras_usuario_id 
FOREIGN KEY (usuario_id) 
REFERENCES public.usuarios(id);