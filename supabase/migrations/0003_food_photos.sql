-- Private storage for food photos. Files live at food-photos/<client_id>/<file>.jpg
insert into storage.buckets (id, name, public) values ('food-photos', 'food-photos', false)
on conflict (id) do nothing;

create policy "own food photos read" on storage.objects for select
  using (bucket_id = 'food-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coach()));
create policy "own food photos write" on storage.objects for insert
  with check (bucket_id = 'food-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own food photos delete" on storage.objects for delete
  using (bucket_id = 'food-photos' and (storage.foldername(name))[1] = auth.uid()::text);
