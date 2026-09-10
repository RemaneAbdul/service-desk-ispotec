# Service Desk ISPOTEC

Sistema web de Service Desk para registo e gestão de incidentes, solicitações, reclamações/sugestões e outros pedidos.

## Stack

- Node.js 20+
- Express 5
- Prisma ORM
- PostgreSQL
- Frontend HTML/CSS/JavaScript
- JWT + RBAC
- Vercel Serverless Functions

## Execução local

```bash
npm install
cp .env.example .env
npm run db:generate
npx prisma db push --schema server/prisma/schema.prisma
npm run db:seed
npm start
```

Abrir: http://localhost:3000

## Contas de demonstração

- Administrador: `admin@ispotec.local` / `Admin@123`
- Técnico: `tecnico@ispotec.local` / `Tecnico@123`
- Colaborador: `colaborador@ispotec.local` / `Colaborador@123`

Altere as palavras-passe antes de qualquer utilização real.

## Deploy no Vercel + PostgreSQL

O projeto já contém `api/index.js` e `vercel.json` para execução como função Node.js no Vercel. O build executa:

```bash
prisma generate --schema server/prisma/schema.prisma
prisma db push --schema server/prisma/schema.prisma
```

No Vercel, configure pelo menos:

- `DATABASE_URL`: URL de conexão PostgreSQL com SSL quando exigido pelo provedor.
- `JWT_SECRET`: segredo forte e aleatório.

A aplicação deve ser importada com a pasta `service-desk-ispotec` como **Root Directory** do projeto Vercel, caso o repositório seja conectado diretamente. Se o conteúdo for extraído de um ZIP, use o conteúdo dessa pasta como raiz do projeto.

## Funcionalidades

- Autenticação e RBAC.
- Criação, consulta, atualização e encerramento de tickets.
- Histórico de alterações.
- Comentários públicos e notas internas.
- Categorias, utilizadores e SLA.
- Regra de impressão configurável.
- Dashboard e exportação CSV.
- API REST.
