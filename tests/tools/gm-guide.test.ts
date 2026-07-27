import { describe, it } from "node:test";
import assert from "node:assert";
import { registerGMGuideTool } from "../../tools/gm-guide.ts";

// ============================================================
// Helpers
// ============================================================

function mockPi() {
  const tools: Record<string, any> = {};
  return {
    tools,
    registerTool: (tool: any) => {
      tools[tool.name] = tool;
    },
  };
}

async function getGuideText(topic?: string): Promise<string> {
  const pi = mockPi();
  registerGMGuideTool(pi);

  const tool = pi.tools["gm_guide"];
  assert.ok(tool, "gm_guide tool should be registered");

  const result = await tool.execute("call-1", topic ? { topic } : {});
  assert.ok(Array.isArray(result.content) && result.content.length > 0, "expected text content");
  return result.content[0].text;
}

// ============================================================
// Tests
// ============================================================

describe("gm_guide full guide", () => {
  it("should describe timer readiness using the accurate disappearance wording", async () => {
    const text = await getGuideText();

    assert.ok(
      text.includes("计时器从注入中消失即表示就绪/到达"),
      `full guide should state that a timer disappearing from injection means ready/arrival, got: ${text}`,
    );
  });

  it("should not mention an inaccurate separate travel prompt", async () => {
    const text = await getGuideText();

    assert.ok(
      !text.includes("旅行提示"),
      `full guide should not refer to a separate travel prompt, got: ${text}`,
    );
  });
});
