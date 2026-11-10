-- =====================================================================
-- Convites sem validade: o convite continua válido até ser aceito ou
-- revogado (ou até o casal ser desfeito). expires_at passa a ser opcional:
-- null = não expira. Convites antigos com data continuam respeitando-a.
-- =====================================================================

alter table public.couple_invitations alter column expires_at drop not null;

create or replace function public.create_invitation(p_couple uuid)
returns table (id uuid, code text, expires_at timestamptz)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.couple_members m
    where m.couple_id = p_couple and m.user_id = v_uid and m.role = 'admin'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if (select count(*) from public.couple_members m where m.couple_id = p_couple) >= 2 then
    raise exception 'couple_full' using errcode = 'P0001';
  end if;

  update public.couple_invitations i
     set status = 'revoked'
   where i.couple_id = p_couple and i.status = 'pending';

  v_code := '';
  for n in 1..10 loop
    v_code := v_code || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
      1 + (get_byte(decode(substr(replace(gen_random_uuid()::text, '-', ''), 1, 2), 'hex'), 0) % 32), 1);
  end loop;

  insert into public.couple_invitations (couple_id, invited_by, code, expires_at)
  values (p_couple, v_uid, v_code, null)
  returning couple_invitations.id into v_id;

  return query select v_id, v_code, null::timestamptz;
end;
$$;

create or replace function public.accept_invitation(p_code text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.couple_invitations;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.couple_members where user_id = v_uid) then
    raise exception 'already_in_couple' using errcode = 'P0001';
  end if;

  select * into v_inv
    from public.couple_invitations i
   where i.code = upper(trim(p_code))
   for update;

  if v_inv.id is null
     or v_inv.status <> 'pending'
     or (v_inv.expires_at is not null and v_inv.expires_at <= now()) then
    raise exception 'invalid_invitation' using errcode = 'P0001';
  end if;
  if v_inv.invited_by = v_uid then
    raise exception 'own_invitation' using errcode = 'P0001';
  end if;
  if (select count(*) from public.couple_members m where m.couple_id = v_inv.couple_id) >= 2 then
    raise exception 'couple_full' using errcode = 'P0001';
  end if;

  insert into public.couple_members (couple_id, user_id, role)
  values (v_inv.couple_id, v_uid, 'partner');

  update public.couple_invitations
     set status = 'accepted', accepted_by = v_uid, accepted_at = now()
   where id = v_inv.id;

  return v_inv.couple_id;
end;
$$;

revoke all on function public.create_invitation(uuid) from public;
revoke all on function public.accept_invitation(text) from public;
grant execute on function public.create_invitation(uuid) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
