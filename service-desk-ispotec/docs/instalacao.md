# Instalação

1. Instale Node.js 20 ou superior.
2. Execute `npm install`.
3. Copie `.env.example` para `.env`.
4. Execute `npm run db:generate`.
5. Execute `npm run db:migrate`.
6. Execute `npm run db:seed`.
7. Execute `npm start`.
8. Aceda a `http://localhost:3000`.

Para produção, utilize PostgreSQL e altere a configuração Prisma para o provider correspondente.
