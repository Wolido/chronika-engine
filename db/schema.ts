export const SCHEMA_VERSION = 3;

export const DDL_STATEMENTS = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS world_meta (
  id          INTEGER PRIMARY KEY,
  world_name  TEXT NOT NULL,
  world_desc  TEXT,
  tone        TEXT,
  created_at  TEXT DEFAULT (datetime('now')),
  version     INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS characters (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  is_player     INTEGER DEFAULT 0,
  level         INTEGER DEFAULT 1,
  xp            INTEGER DEFAULT 0,
  hp            INTEGER NOT NULL,
  hp_max        INTEGER NOT NULL,
  strength      INTEGER DEFAULT 5,
  agility       INTEGER DEFAULT 5,
  endurance     INTEGER DEFAULT 5,
  perception    INTEGER DEFAULT 5,
  intelligence  INTEGER DEFAULT 5,
  willpower     INTEGER DEFAULT 5,
  charisma      INTEGER DEFAULT 5,
  persuasion    INTEGER DEFAULT 5,
  survival      INTEGER DEFAULT 5,
  medicine      INTEGER DEFAULT 5,
  mechanics     INTEGER DEFAULT 5,
  credits       INTEGER DEFAULT 0,
  current_location TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS weapons (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  category      TEXT NOT NULL,
  damage_type   TEXT NOT NULL,
  damage_min    INTEGER NOT NULL,
  damage_max    INTEGER NOT NULL,
  accuracy      REAL NOT NULL,
  durability    INTEGER,
  rarity        TEXT NOT NULL,
  tier          INTEGER DEFAULT 1,
  weight        REAL,
  value         INTEGER DEFAULT 0,
  range_min     INTEGER,
  range_max     INTEGER,
  ammo_type     TEXT,
  special_effect TEXT,
  description   TEXT,
  flavor_text   TEXT
);

CREATE TABLE IF NOT EXISTS items (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  item_type     TEXT NOT NULL,
  rarity        TEXT NOT NULL,
  value         INTEGER DEFAULT 0,
  weight        REAL,
  stackable     INTEGER DEFAULT 1,
  stack_max     INTEGER DEFAULT 99,
  effect_type   TEXT,
  effect_value  INTEGER,
  description   TEXT
);

CREATE TABLE IF NOT EXISTS monsters (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  category        TEXT NOT NULL,
  hp              INTEGER NOT NULL,
  strength        INTEGER DEFAULT 5,
  agility         INTEGER DEFAULT 5,
  endurance       INTEGER DEFAULT 5,
  perception      INTEGER DEFAULT 5,
  intelligence    INTEGER DEFAULT 1,
  willpower       INTEGER DEFAULT 3,
  damage_min      INTEGER NOT NULL,
  damage_max      INTEGER NOT NULL,
  accuracy        REAL NOT NULL,
  evasion         REAL DEFAULT 0,
  armor           INTEGER DEFAULT 0,
  tier            INTEGER DEFAULT 1,
  xp_reward       INTEGER DEFAULT 0,
  description     TEXT,
  behavior_text   TEXT
);

CREATE TABLE IF NOT EXISTS inventory (
  id            INTEGER PRIMARY KEY,
  character_id  INTEGER NOT NULL,
  item_id       INTEGER,
  weapon_id     INTEGER,
  quantity      INTEGER DEFAULT 1,
  is_equipped   INTEGER DEFAULT 0,
  FOREIGN KEY (character_id) REFERENCES characters(id)
);

CREATE TABLE IF NOT EXISTS event_log (
  id          INTEGER PRIMARY KEY,
  turn        INTEGER DEFAULT 0,
  event_type  TEXT NOT NULL,
  summary     TEXT,
  detail      TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS game_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plugin_registry (
  id          INTEGER PRIMARY KEY,
  plugin_name TEXT NOT NULL UNIQUE,
  category    TEXT NOT NULL,
  description TEXT,
  enabled     INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS status_effects (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  effect_type     TEXT NOT NULL,
  target_attribute TEXT NOT NULL,
  magnitude       INTEGER NOT NULL,
  duration        INTEGER NOT NULL,
  stackable       INTEGER DEFAULT 0,
  max_stacks      INTEGER,
  description     TEXT
);

CREATE TABLE IF NOT EXISTS actions (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  action_type     TEXT NOT NULL,
  primary_attr    TEXT NOT NULL,
  difficulty      INTEGER NOT NULL,
  cooldown        INTEGER DEFAULT 0,
  success_result  TEXT NOT NULL,
  failure_result  TEXT NOT NULL,
  description     TEXT
);

CREATE TABLE IF NOT EXISTS brands (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  tagline         TEXT,
  stat_bias       TEXT,
  unique_rule     TEXT,
  description     TEXT
);

CREATE TABLE IF NOT EXISTS weapon_parts (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL,
  part_slot       TEXT NOT NULL,
  rarity          TEXT NOT NULL,
  stat_mods       TEXT NOT NULL,
  description     TEXT
);

CREATE TABLE IF NOT EXISTS legendary_effects (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL,
  trigger         TEXT NOT NULL,
  effect_type     TEXT NOT NULL,
  magnitude       REAL NOT NULL,
  description     TEXT,
  created_by      TEXT DEFAULT 'legendary_gen'
);

CREATE TABLE IF NOT EXISTS generated_weapons (
  id              INTEGER PRIMARY KEY,
  name            TEXT,
  base_weapon_id  INTEGER,
  brand_id        INTEGER,
  part_ids        TEXT,
  element_id      INTEGER,
  legendary_id    INTEGER,
  current_durability INTEGER,
  current_ammo    INTEGER,
  owner_id        INTEGER,
  created_at      TEXT DEFAULT (datetime('now'))
);
`;
