begin;

create schema if not exists private;

create or replace function private.current_profile_role()
returns text language sql stable security definer set search_path=public
as $$ select role from public.profiles where id=auth.uid() $$;

create or replace function private.current_profile_status()
returns text language sql stable security definer set search_path=public
as $$ select status from public.profiles where id=auth.uid() $$;

create or replace function private.set_ticket_code()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if new.ticket_code is null or btrim(new.ticket_code)='' then
    new.ticket_code:='ISP-'||to_char(coalesce(new.created_at,now()),'YYYY')||'-'||lpad(new.ticket_number::text,6,'0');
  end if;
  return new;
end; $$;

grant usage on schema private to authenticated;
grant execute on function private.current_profile_role() to authenticated;
grant execute on function private.current_profile_status() to authenticated;
revoke all on function private.set_ticket_code() from public,anon,authenticated;
grant execute on function private.set_ticket_code() to service_role;

drop policy if exists audit_staff_read on public.audit_logs;
create policy audit_staff_read on public.audit_logs for select to authenticated
using(private.current_profile_role()=any(array['Administrador','Supervisor']::text[]));

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles for all to authenticated
using(private.current_profile_role()='Administrador')
with check(private.current_profile_role()='Administrador');

drop policy if exists profiles_self_or_staff on public.profiles;
create policy profiles_self_or_staff on public.profiles for select to authenticated
using(id=auth.uid() or private.current_profile_role()=any(array['Administrador','Supervisor','Agente']::text[]));

drop trigger if exists trg_tickets_ticket_code on public.tickets;
create trigger trg_tickets_ticket_code before insert on public.tickets for each row execute function private.set_ticket_code();

revoke all on function public.current_profile_role() from public,anon,authenticated,service_role;
revoke all on function public.current_profile_status() from public,anon,authenticated,service_role;
revoke all on function public.set_ticket_code() from public,anon,authenticated,service_role;

commit;
