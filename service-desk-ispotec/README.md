# Service Desk ISPOTEC

Service Desk web do ISPOTEC integrado com **Supabase Auth, PostgreSQL, Storage e RLS**.

## Funcionalidades

- Cadastro público de Estudantes e Colaboradores.
- Aprovação administrativa antes do acesso.
- Estados Pendente, Activo, Inactivo, Bloqueado e Recusado.
- Dashboard separado para solicitantes e Service Desk.
- Tickets com categorias, serviços, prioridade e SLA.
- Mensagens públicas e notas internas.
- Anexos privados no Supabase Storage.
- Atribuição a agente/departamento.
- Notificações.
- Auditoria.
- Reabertura e avaliação do atendimento.
- Gestão de utilizadores, departamentos, categorias e serviços.

## Supabase

Projecto utilizado: \`ifoptec-service-desk\`.

Configure no ambiente de execução:

- \`SUPABASE_URL\`
- \`SUPABASE_PUBLISHABLE_KEY\`
- \`SUPABASE_SECRET_KEY\`

A chave secreta do Supabase é obrigatória apenas no servidor e **nunca deve ser colocada no frontend, GitHub ou URL**.

## Execução

Requer Node.js 22+.

\`\`\`bash
npm install
cp .env.example .env
npm start
\`\`\`

Abrir \`http://localhost:3000\`.

## Cadastro

Na página de login existe:

**Ainda não tem conta? Criar acesso**

O utilizador escolhe Estudante ou Colaborador. O cadastro fica pendente até aprovação do administrador.

## Segurança

- Passwords são geridas pelo Supabase Auth.
- O backend valida o JWT do Supabase.
- O backend valida role e estado da conta.
- O frontend não é considerado mecanismo de autorização.
- Dados privados continuam protegidos por RLS.
- Anexos são armazenados em bucket privado.
- Acções administrativas e alterações de tickets são auditadas.
- Não existem credenciais de demonstração hardcoded na interface.

## Desenvolvimento

O Prisma legado foi mantido no repositório para preservar histórico, mas o runtime actual utiliza Supabase. Não executar migrações Prisma sobre a base Supabase deste projecto.

As alterações de base de dados foram aplicadas através de migrações Supabase não destrutivas.
