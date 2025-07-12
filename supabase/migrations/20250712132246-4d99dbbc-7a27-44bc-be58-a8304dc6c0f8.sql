-- Remover o trigger que causa erro de permissões
DROP TRIGGER IF EXISTS trigger_sincronizar_enum_unidade_medida ON unidades_medida;

-- Remover a função que não pode ser executada pelo usuário authenticator
DROP FUNCTION IF EXISTS sincronizar_enum_unidade_medida();