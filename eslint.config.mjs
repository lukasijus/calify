import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // `react-hooks/set-state-in-effect` ships as an error in the react-hooks 7
      // "recommended" preset that eslint-config-next pulls in. It also flags the
      // legitimate patterns this app depends on: hydrating persisted weigh-ins
      // from localStorage on mount, and measuring the chart container / tooltip
      // in a layout effect before positioning. Disable it until we move that
      // wiring to a useSyncExternalStore-style store.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
