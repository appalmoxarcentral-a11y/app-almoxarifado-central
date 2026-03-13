
-- Fix typo in plan features
UPDATE public.plans 
SET features = features::jsonb || '["api access"]'::jsonb - 'api acess'
WHERE features::jsonb ? 'api acess';
