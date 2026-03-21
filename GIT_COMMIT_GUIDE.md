# Guia de Comandos Git

Siga estes passos para realizar o commit e push das suas alterações manualmente no terminal.

### 1. Verificar alterações
Antes de tudo, veja o que foi modificado no seu projeto:
```bash
git status
```

### 2. Adicionar arquivos ao Commit
Você pode adicionar arquivos específicos ou todos de uma vez.

**Para adicionar todos os arquivos modificados:**
```bash
git add .
```

**Para adicionar arquivos ou pastas específicas (Recomendado):**
```bash
git add caminho/do/arquivo.tsx
git add pasta/especifica/
```

### 3. Criar o Commit
Gere a versão local com uma descrição clara do que foi feito:
```bash
git commit -m "sua descrição aqui"
```

### 4. Enviar para o GitHub
Envie suas alterações locais para o repositório remoto (branch main):
```bash
git push origin main
```

---

### Dicas de Segurança (Boas Práticas)
- **Nunca** use `git add .` se houver arquivos sensíveis como `.env` que não estejam no `.gitignore`.
- Sempre verifique o `git status` antes de fazer o push para garantir que não está enviando arquivos indesejados (como scripts de teste temporários).
