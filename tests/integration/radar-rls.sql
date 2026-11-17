-- Rollback-only SQL verification. No emails are sent and no test records persist.
begin;
insert into public.allowed_emails(email) values ('radar-rls-a@example.test'),('radar-rls-b@example.test');
insert into auth.users(id,email) values ('00000000-0000-4000-8000-00000000a001','radar-rls-a@example.test'),('00000000-0000-4000-8000-00000000b001','radar-rls-b@example.test');
insert into public.radar_access(user_id) values ('00000000-0000-4000-8000-00000000a001');
set local role authenticated;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated"}';
insert into public.radar_watchlist(id,user_id,exchange,security_id,symbol,name,asset_type)
values ('00000000-0000-4000-8000-00000000c001','00000000-0000-4000-8000-00000000a001','NSE','123','SYNTHETIC','Synthetic research','equity');
insert into public.radar_snapshots(user_id,watch_id,source,engine_version,input_hash,candles,analysis)
values ('00000000-0000-4000-8000-00000000a001','00000000-0000-4000-8000-00000000c001','INDstocks','test',repeat('0',64),'[]','{}');
do $$ begin
  if (select count(*) from public.radar_latest_snapshots()) <> 1 then raise exception 'Owner cannot read latest snapshot'; end if;
  begin
    update public.radar_watchlist set user_id='00000000-0000-4000-8000-00000000b001';
    raise exception 'Ownership reassignment was allowed';
  exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-00000000b001","role":"authenticated"}';
do $$ begin
  if exists(select 1 from public.radar_access) or exists(select 1 from public.radar_watchlist) or exists(select 1 from public.radar_snapshots) or exists(select 1 from public.radar_latest_snapshots()) then raise exception 'Private Radar rows were exposed'; end if;
  begin
    insert into public.radar_access(user_id) values ('00000000-0000-4000-8000-00000000b001');
    raise exception 'Self entitlement was allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.radar_watchlist(user_id,exchange,security_id,symbol,name,asset_type) values ('00000000-0000-4000-8000-00000000b001','NSE','456','SYNTHETIC','Synthetic','equity');
    raise exception 'Unentitled insert was allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.radar_access(user_id) values ('00000000-0000-4000-8000-00000000b001');
set local role authenticated;
do $$ begin
  begin
    insert into public.radar_snapshots(user_id,watch_id,source,engine_version,input_hash,candles,analysis) values ('00000000-0000-4000-8000-00000000b001','00000000-0000-4000-8000-00000000c001','INDstocks','test',repeat('0',64),'[]','{}');
    raise exception 'Cross-owner parent was allowed';
  exception when foreign_key_violation then null; end;
end $$;
select 'Owner access, isolation, self-entitlement denial, ownership reassignment denial and cross-owner parent denial passed' as verification;
rollback;
