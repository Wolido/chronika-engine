export interface ActiveStatus {
  effect_name: string;
  effect_type: string;
  magnitude: number;
  remaining_turns: number;
  max_duration: number;
}

export interface ApplyStatusInput {
  effect: {
    name: string;
    effect_type: string;
    magnitude: number;
    duration: number;
  };
  current_effects: ActiveStatus[];
}

export interface ApplyStatusResult {
  applied: boolean;
  updated_effects: ActiveStatus[];
  note?: string;
}

export interface TickStatusInput {
  active_effects: ActiveStatus[];
  target_hp: number;
  target_hp_max: number;
}

export interface TickRecord {
  effect_name: string;
  hp_change: number;
  remaining: number;
  expired: boolean;
}

export interface TickStatusResult {
  ticks: TickRecord[];
  hp_change_total: number;
  hp_after: number;
  remaining_effects: ActiveStatus[];
}

export function applyStatus(input: ApplyStatusInput): ApplyStatusResult {
  if (!input.effect.name || input.effect.name.trim() === "") {
    return { applied: false, updated_effects: input.current_effects, note: "Effect name is required" };
  }

  const existing = input.current_effects.find(e => e.effect_name === input.effect.name);

  if (existing) {
    existing.remaining_turns = input.effect.duration;
    existing.max_duration = input.effect.duration;
    return {
      applied: true,
      updated_effects: [...input.current_effects],
      note: `Refreshed ${input.effect.name} (${input.effect.duration} turns)`,
    };
  }

  const newEffect: ActiveStatus = {
    effect_name: input.effect.name,
    effect_type: input.effect.effect_type,
    magnitude: input.effect.magnitude,
    remaining_turns: input.effect.duration,
    max_duration: input.effect.duration,
  };

  return {
    applied: true,
    updated_effects: [...input.current_effects, newEffect],
    note: `Applied ${input.effect.name} (${input.effect.duration} turns)`,
  };
}

export function tickStatus(input: TickStatusInput): TickStatusResult {
  let hp = input.target_hp;
  const ticks: TickRecord[] = [];
  const remaining: ActiveStatus[] = [];

  for (const effect of input.active_effects) {
    let hpChange = 0;

    if (effect.effect_type === "dot") {
      hpChange = -Math.abs(effect.magnitude);
    } else if (effect.effect_type === "hot") {
      hpChange = Math.abs(effect.magnitude);
    }

    const newHp = Math.max(0, Math.min(input.target_hp_max, hp + hpChange));
    const actualChange = newHp - hp;
    hp = newHp;

    const newRemaining = effect.remaining_turns - 1;
    const expired = newRemaining <= 0;

    ticks.push({
      effect_name: effect.effect_name,
      hp_change: actualChange,
      remaining: Math.max(0, newRemaining),
      expired,
    });

    if (!expired) {
      remaining.push({ ...effect, remaining_turns: newRemaining });
    }
  }

  return {
    ticks,
    hp_change_total: hp - input.target_hp,
    hp_after: hp,
    remaining_effects: remaining,
  };
}
