// Requirement IDs: HEE-EVAL-01, HEE-EVAL-02, HEE-EVAL-03
// DP-W08 §3.2 generic screen-action tools (the control arm) and §4 prompts.
import type { ToolDecl } from "../llm/index.js";
import type { EvalArm, ToolOutcome } from "./types.js";

export interface LocatorLike {
  first(): LocatorLike;
  count(): Promise<number>;
  click(o?: { timeout?: number }): Promise<void>;
  fill(v: string, o?: { timeout?: number }): Promise<void>;
}

export interface PageLike {
  locator(sel: string): { ariaSnapshot(): Promise<string> };
  getByRole(role: string, o: { name: string; exact?: boolean }): LocatorLike;
  getByLabel(text: string, o?: { exact?: boolean }): LocatorLike;
  getByText(text: string, o?: { exact?: boolean }): LocatorLike;
  keyboard: { press(key: string): Promise<void> };
  waitForTimeout(ms: number): Promise<void>;
}

export const CONTROL_TOOLS: ToolDecl[] = [
  {
    name: "ui_snapshot",
    description: "Read what is on the screen as an outline of roles and names. Call this first and after every change.",
    parameters: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    name: "ui_click",
    description: `Click the element whose visible name is \`text\`. Example: ui_click({"text":"Save","role":"button"}).`,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["text"],
      properties: {
        text: { type: "string", description: "The visible name of the element to click." },
        role: {
          type: "string",
          description: "The role of the element to click.",
          enum: ["button", "link", "tab", "menuitem", "checkbox", "option"],
        },
      },
    },
  },
  {
    name: "ui_type",
    description: "Type `value` into the field labelled `label`, replacing what is there.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["label", "value"],
      properties: {
        label: { type: "string", description: "The label of the field to type into." },
        value: { type: "string", description: "The text to type." },
      },
    },
  },
  {
    name: "ui_press",
    description: "Press one keyboard key such as Enter or Escape.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["key"],
      properties: {
        key: { type: "string", description: "The key to press." },
      },
    },
  },
];

const CLICK_ROLES = ["button", "link", "tab", "menuitem", "checkbox", "option"];

function firstLine(message: string): string {
  return message.split("\n")[0] as string;
}

function stringProp(args: Record<string, unknown>, name: string): boolean {
  return typeof args[name] === "string";
}

function invalidArgs(names: string[]): ToolOutcome {
  return { ok: false, summary: "", error: `Invalid arguments: ${names.join(", ")}`, invalid_args: true };
}

export function createUiControlTools(page: PageLike): {
  tools: ToolDecl[];
  call(name: string, args: Record<string, unknown>): Promise<ToolOutcome>;
} {
  async function call(name: string, args: Record<string, unknown>): Promise<ToolOutcome> {
    const input = args ?? {};
    try {
      if (name === "ui_snapshot") {
        const outline = await page.locator("body").ariaSnapshot();
        return { ok: true, summary: outline.slice(0, 6000) };
      }
      if (name === "ui_click") {
        const bad: string[] = [];
        if (!stringProp(input, "text")) bad.push("text");
        if (input["role"] !== undefined && (typeof input["role"] !== "string" || !CLICK_ROLES.includes(input["role"]))) {
          bad.push("role");
        }
        if (bad.length > 0) return invalidArgs(bad);
        const text = input["text"] as string;
        const target =
          input["role"] !== undefined
            ? page.getByRole(input["role"] as string, { name: text }).first()
            : page.getByText(text, { exact: false }).first();
        if ((await target.count()) === 0) {
          return {
            ok: false,
            summary: "",
            error: `No element named "${text}" is on the screen. Call ui_snapshot to see what is there.`,
          };
        }
        await target.click({ timeout: 4000 });
        await page.waitForTimeout(250);
        return { ok: true, summary: `Clicked "${text}".` };
      }
      if (name === "ui_type") {
        const bad: string[] = [];
        if (!stringProp(input, "label")) bad.push("label");
        if (!stringProp(input, "value")) bad.push("value");
        if (bad.length > 0) return invalidArgs(bad);
        const label = input["label"] as string;
        const target = page.getByLabel(label, { exact: false }).first();
        if ((await target.count()) === 0) {
          return {
            ok: false,
            summary: "",
            error: `No element named "${label}" is on the screen. Call ui_snapshot to see what is there.`,
          };
        }
        await target.fill(input["value"] as string);
        return { ok: true, summary: `Typed into "${label}".` };
      }
      if (name === "ui_press") {
        if (!stringProp(input, "key")) return invalidArgs(["key"]);
        await page.keyboard.press(input["key"] as string);
        return { ok: true, summary: `Pressed ${input["key"] as string}.` };
      }
      return { ok: false, summary: "", error: `Unknown tool "${name}".` };
    } catch (e) {
      return { ok: false, summary: "", error: firstLine((e as Error).message ?? String(e)) };
    }
  }
  return { tools: CONTROL_TOOLS, call };
}

const TREATMENT_SYSTEM = "You operate {{product}} on behalf of the person who gives you a task. Use the tools you are given to carry the task out. Work in small steps and read each tool result before the next step. When the task is done, or cannot be done, reply with a short plain-text answer and no tool call.";

const CONTROL_SYSTEM = "You operate {{product}} on behalf of the person who gives you a task. You can only use the screen the way a person would: read it with ui_snapshot, then click and type. Work in small steps and read the screen again after each change. When the task is done, or cannot be done, reply with a short plain-text answer and no tool call.";

export function renderSystemPrompt(arm: EvalArm, product: string): string {
  const template = arm === "treatment" ? TREATMENT_SYSTEM : CONTROL_SYSTEM;
  return template.replace("{{product}}", product);
}
