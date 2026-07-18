-- Trivia Rush Phase 5 category platform
-- Adds display metadata for the complete manifest. The generated question seed
-- activates categories transactionally only after their banks are present.

begin;

do $$
begin
  if to_regclass('public.question_categories') is null then
    raise exception 'Run the Phase 4A question platform before Phase 5.';
  end if;

  if to_regclass('public.trivia_questions') is null then
    raise exception 'The Phase 4A trivia_questions table is required.';
  end if;
end;
$$;

alter table public.question_categories
  add column if not exists icon_key text,
  add column if not exists color text;

insert into public.question_categories (
  id,
  label,
  sort_order,
  icon_key,
  color,
  is_active
)
values
  ('science', 'Science', 10, 'flask', '#41E28C', true),
  ('history', 'History', 20, 'landmark', '#FFD54A', true),
  ('geography', 'Geography', 30, 'globe', '#3EE7DB', true),
  ('entertainment', 'Entertainment', 40, 'film', '#FF4F9B', true),
  ('sport', 'Sport', 50, 'trophy', '#FF8A4C', true),
  ('technology', 'Technology', 60, 'cpu', '#7C83FF', true),
  ('gaming', 'Gaming', 70, 'gamepad', '#B66CFF', true),
  ('food_drink', 'Food & Drink', 80, 'utensils', '#FFB347', false),
  ('nature_animals', 'Nature & Animals', 90, 'paw', '#62D26F', false),
  ('art_literature', 'Art & Literature', 100, 'palette_book', '#F47CD4', false),
  ('game_of_thrones', 'Game of Thrones', 110, 'dragon', '#9B1C1C', true),
  ('mythology', 'Mythology', 120, 'thunderbolt', '#C9A227', true),
  ('harry_potter', 'Harry Potter', 130, 'wand', '#4B2E83', true),
  ('marvel_cinematic_universe', 'Marvel Cinematic Universe', 140, 'shield', '#ED1D24', true)
on conflict (id) do update
set
  label = excluded.label,
  sort_order = excluded.sort_order,
  icon_key = excluded.icon_key,
  color = excluded.color,
  is_active = public.question_categories.is_active;

alter table public.question_categories
  alter column icon_key set not null,
  alter column color set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.question_categories'::regclass
      and conname = 'question_categories_icon_key_valid'
  ) then
    alter table public.question_categories
      add constraint question_categories_icon_key_valid check (
        icon_key = lower(btrim(icon_key))
        and icon_key ~ '^[a-z][a-z0-9_]{1,39}$'
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.question_categories'::regclass
      and conname = 'question_categories_color_valid'
  ) then
    alter table public.question_categories
      add constraint question_categories_color_valid check (
        color ~ '^#[0-9A-F]{6}$'
      );
  end if;
end;
$$;

drop function public.get_question_categories();

create function public.get_question_categories()
returns table (
  category_id text,
  label text,
  question_count bigint,
  icon_key text,
  color text,
  sort_order integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    qc.id,
    qc.label,
    count(q.id)::bigint,
    qc.icon_key,
    qc.color,
    qc.sort_order
  from public.question_categories qc
  left join public.trivia_questions q
    on q.category_id = qc.id
   and q.is_active
  where qc.is_active
  group by qc.id, qc.label, qc.icon_key, qc.color, qc.sort_order
  order by qc.sort_order;
$$;

revoke all
on function public.get_question_categories()
from public;

grant execute
on function public.get_question_categories()
to anon, authenticated;

commit;

notify pgrst, 'reload schema';
