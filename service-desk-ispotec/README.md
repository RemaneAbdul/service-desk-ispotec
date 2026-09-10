# Service Desk ISPOTEC

Sistema web de Service Desk para registo e gestão de incidentes, solicitações, reclamações/sugestões e outros pedidos.

## Requisitos
- Node.js 20+
- npm

## Instalação

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed
npm start
```

Abrir: http://localhost:3000

## Contas de demonstração

- Administrador: `admin@ispotec.local` / `Admin@123`
- Técnico: `tecnico@ispotec.local` / `Tecnico@123`
- Colaborador: `colaborador@ispotec.local` / `Colaborador@123`

Altere as palavras-passe antes de qualquer utilização real.

## Funcionalidades
- Autenticação e RBAC.
- Criação, consulta, atualização e encerramento de tickets.
- Histórico de alterações.
- Comentários públicos e notas internas.
- Categorias, utilizadores e SLA.
- Regra de impressão configurável.
- Upload com validação de extensão/tamanho.
- Dashboard e exportação CSV/XLSX.
- API REST.

## Produção
Defina `DATABASE_URL` para PostgreSQL e um `JWT_SECRET` forte. Execute as migrações de produção e sirva a aplicação atrás de HTTPS.
