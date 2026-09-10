# API REST

Base: `/api`

## Auth
- POST `/auth/login` — `{email,password}`
- POST `/auth/register` — criação de colaborador
- GET `/auth/me` — utilizador autenticado

## Tickets
- GET `/tickets`
- POST `/tickets`
- GET `/tickets/:id`
- PATCH `/tickets/:id` — técnico/admin
- POST `/tickets/:id/comments`

## Admin
- GET `/admin/dashboard`
- GET/POST `/admin/users`
- PATCH/DELETE `/admin/users/:id`
- GET/POST `/admin/categories`
- PATCH/DELETE `/admin/categories/:id`
- GET `/admin/settings`
- PUT `/admin/settings`
- GET `/admin/export/csv`

Todas as rotas protegidas exigem `Authorization: Bearer <token>`.
