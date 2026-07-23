export interface DiceResult {
  total: number;
  terms: {
    rolls: number[];
    sides: number;
    count: number;
    subtotal: number;
  }[];
  modifiers: number[];
  expression: string;
}

function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

const DICE_PATTERN = /^(\d+)?d(\d+)$/i;

export function rollDice(expression: string): DiceResult {
  const trimmed = expression.trim();
  if (!trimmed) {
    return { total: 0, terms: [], modifiers: [], expression };
  }

  // Split by + or -, keep the delimiters
  const tokens: string[] = [];
  let current = "";
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if ((ch === "+" || ch === "-") && i > 0) {
      tokens.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);

  const terms: DiceResult["terms"] = [];
  const modifiers: number[] = [];

  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed) continue;

    // 剥离前导符号以正确匹配骰子正则
    let sign = 1;
    let core = trimmed;
    if (trimmed.startsWith("+")) {
      core = trimmed.slice(1);
    } else if (trimmed.startsWith("-")) {
      sign = -1;
      core = trimmed.slice(1);
    }

    const match = core.match(DICE_PATTERN);
    if (match) {
      const count = match[1] ? parseInt(match[1], 10) : 1;
      const sides = parseInt(match[2], 10);
      const rolls: number[] = [];
      for (let i = 0; i < count; i++) {
        rolls.push(rollDie(sides));
      }
      const subtotal = rolls.reduce((a, b) => a + b, 0) * sign;
      terms.push({ rolls, sides, count, subtotal });
    } else {
      // 尝试解析为数字（含符号）
      const num = parseInt(trimmed, 10);
      if (!isNaN(num)) {
        modifiers.push(num);
      }
    }
  }

  const rawTotal = terms.reduce((s, t) => s + t.subtotal, 0) + 
                   modifiers.reduce((s, m) => s + m, 0);

  return {
    total: rawTotal,
    terms,
    modifiers,
    expression,
  };
}
