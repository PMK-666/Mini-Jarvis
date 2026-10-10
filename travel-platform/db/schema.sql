-- Itinera — target PostgreSQL schema (Phase 2+). Not used by the Phase 1 prototype,
-- which keeps the same shapes in code (src/lib/domain/types.ts) and memory (src/lib/store.ts).
--
-- Key rule: a published TRIP TEMPLATE is never mutated by a customer. Customers create
-- PLANS → QUOTES → BOOKINGS that reference a specific template VERSION.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- Users & creators ------------------------------------------------------------
create table users (
  id            uuid primary key default gen_random_uuid(),
  email         citext unique not null,
  display_name  text not null,
  created_at    timestamptz not null default now()
);

create table creators (
  user_id         uuid primary key references users(id),
  bio             text,
  payout_account  text,              -- reference at payment provider (e.g. Stripe Connect), never bank details
  created_at      timestamptz not null default now()
);

-- Trip templates ----------------------------------------------------------------
create table trip_templates (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  creator_id    uuid references creators(user_id),
  destination   text not null,           -- primary title, e.g. 'Philippines'
  category      text not null,           -- secondary title, e.g. 'Honeymoon'
  travel_style  text not null,
  creator_status text not null check (creator_status in ('completed','planned')),
  status        text not null default 'draft' check (status in ('draft','published','archived')),
  created_at    timestamptz not null default now()
);

create table trip_categories (
  template_id uuid references trip_templates(id) on delete cascade,
  category    text not null,
  primary key (template_id, category)    -- a trip can belong to many categories
);

-- Immutable versions: quotes and bookings point at the exact version they used.
create table trip_template_versions (
  id               uuid primary key default gen_random_uuid(),
  template_id      uuid not null references trip_templates(id),
  version          int  not null,
  summary          text,
  original_start   date not null,
  original_end     date not null,
  home_airport     char(3) not null,
  published_at     timestamptz,
  unique (template_id, version)
);

create table template_components (
  id               text not null,           -- stable id within the version, e.g. 'stay-cauayan'
  version_id       uuid not null references trip_template_versions(id) on delete cascade,
  kind             text not null check (kind in ('flight','stay','transfer','activity','choice')),
  title            text not null,
  start_day        int  not null,           -- offset from departure day, never an absolute date
  provenance       text not null check (provenance in ('booked','incomplete','assumed','suggested')),
  note             text,
  required         boolean not null,
  included_by_default boolean,
  parent_choice_id text,                     -- set for components inside a choice option
  parent_option_id text,
  details          jsonb not null,           -- kind-specific: legs, nights, property/room, product ids, timing anchor
  primary key (version_id, id)
);

create table template_dependencies (
  version_id  uuid not null,
  component_id text not null,
  depends_on   text not null,
  primary key (version_id, component_id, depends_on),
  foreign key (version_id, component_id) references template_components(version_id, id) on delete cascade
);

create table template_media (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references trip_templates(id) on delete cascade,
  url          text not null,
  credit       text,
  licence      text not null,
  sort         int not null default 0
);

create table saved_trips (
  user_id     uuid references users(id) on delete cascade,
  template_id uuid references trip_templates(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, template_id)
);

-- Reviews: only from completed bookings, so they are verifiable by construction.
create table reviews (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid unique not null,         -- references bookings(id), added below
  template_id uuid not null references trip_templates(id),
  rating      int not null check (rating between 1 and 5),
  body        text,
  created_at  timestamptz not null default now()
);

-- Product catalogue mapping (our ids ↔ supplier ids) ---------------------------
create table supplier_products (
  id            text primary key,           -- e.g. 'cauayan'
  kind          text not null,
  supplier      text not null,              -- 'expedia-rapid', 'duffel', 'local-dmc-palawan', ...
  supplier_ref  text not null,
  content       jsonb not null,             -- names, descriptions, check-in times, operating windows
  unique (supplier, supplier_ref)
);

-- Plans, quotes -----------------------------------------------------------------
create table quotes (
  id                 uuid primary key default gen_random_uuid(),
  template_version_id uuid not null references trip_template_versions(id),
  user_id            uuid references users(id),
  plan               jsonb not null,         -- TripPlan
  itinerary          jsonb not null,         -- resolved components with absolute dates
  results            jsonb not null,         -- offers per component
  issues             jsonb not null,
  total_nok          int not null,
  bookable           boolean not null,
  created_at         timestamptz not null default now(),
  expires_at         timestamptz not null
);

-- Bookings ----------------------------------------------------------------------
create table bookings (
  id               uuid primary key default gen_random_uuid(),
  reference        text unique not null,
  quote_id         uuid not null references quotes(id),
  user_id          uuid references users(id),
  status           text not null check (status in ('revalidating','payment_authorizing','booking_components','confirmed','action_required','cancelling','cancelled','failed')),
  total_nok        int not null,
  contact          jsonb not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table reviews add constraint reviews_booking_fk foreign key (booking_id) references bookings(id);

create table booking_travelers (
  booking_id   uuid references bookings(id) on delete cascade,
  idx          int not null,
  first_name   text not null,
  last_name    text not null,
  date_of_birth date not null,
  primary key (booking_id, idx)
);

create table reservations (
  booking_id       uuid not null references bookings(id) on delete cascade,
  component_id     text not null,
  kind             text not null,
  supplier         text not null,
  offer            jsonb not null,
  status           text not null check (status in ('pending','requested','retrying','confirmed','failed','cancelling','cancelled')),
  attempts         int not null default 0,
  idempotency_key  text unique not null,     -- passed to the supplier on every attempt
  supplier_ref     text,
  last_error       text,
  refund_nok       int,
  updated_at       timestamptz not null default now(),
  primary key (booking_id, component_id)
);

create table booking_events (
  id          bigserial primary key,
  booking_id  uuid not null references bookings(id) on delete cascade,
  level       text not null,
  message     text not null,
  at          timestamptz not null default now()
);

create table idempotency_keys (
  key         text primary key,
  booking_id  uuid not null references bookings(id),
  created_at  timestamptz not null default now()
);

-- Payments: provider references only. Never card numbers.
create table payments (
  booking_id     uuid primary key references bookings(id),
  provider       text not null,
  intent_id      text not null,
  status         text not null check (status in ('authorized','captured','voided','declined','refunded','partially_refunded')),
  amount_nok     int not null,
  refunded_nok   int not null default 0,
  updated_at     timestamptz not null default now()
);

-- Creator earnings (Phase 4) -------------------------------------------------------
create table creator_commissions (
  booking_id   uuid primary key references bookings(id),
  creator_id   uuid not null references creators(user_id),
  amount_nok   int not null,
  status       text not null check (status in ('pending','payable','paid','reversed'))
);
