import base from "./playwright.config";

export default { ...base, testMatch: ["showcase/**/*.spec.ts"] };
