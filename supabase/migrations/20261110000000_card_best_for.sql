-- Spend categories a card suits, used to suggest which card to use.
alter table public.credit_cards
  add column best_for text[] not null default '{}'
    check (best_for <@ array['travel', 'dining', 'groceries', 'fuel', 'online', 'bills', 'upi', 'international']::text[]);
