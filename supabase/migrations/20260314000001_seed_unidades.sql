-- Insert sample health units
INSERT INTO public.unidades_saude (nome, codigo, cidade, endereco, bairro, ativo)
VALUES 
    ('UBS Central', 'UBS-001', 'Campo Grande', 'Rua Principal, 100', 'Centro', true),
    ('UBS Jardim das Flores', 'UBS-002', 'Campo Grande', 'Av. das Flores, 500', 'Jardim das Flores', true),
    ('UBS Vila Esperança', 'UBS-003', 'Campo Grande', 'Rua da Paz, 300', 'Vila Esperança', true),
    ('UBS Santa Maria', 'UBS-004', 'Campo Grande', 'Rua Santa Maria, 10', 'Santa Maria', true)
ON CONFLICT (codigo) DO NOTHING;
