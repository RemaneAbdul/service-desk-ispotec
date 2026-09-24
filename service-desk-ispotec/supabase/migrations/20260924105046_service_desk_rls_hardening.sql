begin;

create or replace function public.current_profile_status()
returns text language sql stable security definer set search_path=public
as $$ select status from public.profiles where id=auth.uid() $$;

drop policy if exists tickets_requester_insert on public.tickets;
create policy tickets_requester_insert on public.tickets for insert to authenticated
with check(requester_id=auth.uid() and current_profile_status()='Activo' and current_profile_role()='Solicitante');

drop policy if exists tickets_requester_or_staff on public.tickets;
create policy tickets_requester_or_staff on public.tickets for select to authenticated
using(current_profile_status()='Activo' and (requester_id=auth.uid() or current_profile_role()=any(array['Administrador','Supervisor','Agente']::text[])));

drop policy if exists tickets_staff_update on public.tickets;
create policy tickets_staff_update on public.tickets for update to authenticated
using(current_profile_status()='Activo' and current_profile_role()=any(array['Administrador','Supervisor','Agente']::text[]))
with check(current_profile_status()='Activo' and current_profile_role()=any(array['Administrador','Supervisor','Agente']::text[]));

drop policy if exists ticket_messages_visible on public.ticket_messages;
create policy ticket_messages_visible on public.ticket_messages for select to authenticated
using(exists(select 1 from public.tickets t where t.id=ticket_messages.ticket_id and
  (t.requester_id=auth.uid() or current_profile_role()=any(array['Administrador','Supervisor','Agente']::text[]))));

drop policy if exists ticket_messages_create on public.ticket_messages;
create policy ticket_messages_create on public.ticket_messages for insert to authenticated
with check(author_id=auth.uid() and exists(select 1 from public.tickets t where t.id=ticket_messages.ticket_id and
  ((t.requester_id=auth.uid() and visibility='Pública') or current_profile_role()=any(array['Administrador','Supervisor','Agente']::text[]))));

drop policy if exists ticket_attachments_own_or_staff on public.ticket_attachments;
create policy ticket_attachments_own_or_staff on public.ticket_attachments for select to authenticated
using(exists(select 1 from public.tickets t where t.id=ticket_attachments.ticket_id and
  (t.requester_id=auth.uid() or current_profile_role()=any(array['Administrador','Supervisor','Agente']::text[]))));

drop policy if exists ticket_attachments_create on public.ticket_attachments;
create policy ticket_attachments_create on public.ticket_attachments for insert to authenticated
with check(uploaded_by=auth.uid() and exists(select 1 from public.tickets t where t.id=ticket_attachments.ticket_id and
  (t.requester_id=auth.uid() or current_profile_role()=any(array['Administrador','Supervisor','Agente']::text[]))));

commit;
