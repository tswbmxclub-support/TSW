import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      // Las carpetas de salida de los chequeos: tipos generados, no código nuestro.
      ".next-verificar/**",
      ".next-verificar-dev/**",
      "node_modules/**",
      "supabase/.temp/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
