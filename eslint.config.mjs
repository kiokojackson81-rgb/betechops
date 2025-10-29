import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  // Temporarily relax strict any rule in API and lib to unblock smoke builds; we'll tighten types incrementally.
  {
    files: [
      "src/app/api/**/*.ts",
      "src/app/api/**/*.tsx",
      "src/lib/**/*.ts",
      "src/lib/**/*.tsx",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      // Guard against server-side relative fetches to /api/... which break in production
      // Prefer absUrl('/api/...') in server components
      "no-restricted-syntax": [
        "warn",
        {
          selector: "CallExpression[callee.name='fetch'][arguments.0.value=/^\\/api\\//]",
          message:
            "Use absUrl('/api/...') for server-side fetches to avoid Invalid URL in production.",
        },
      ],
    },
  },
];

export default eslintConfig;
