import { defineConfig, globalIgnores } from "eslint/config"
import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypeScript from "eslint-config-next/typescript"

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["src/globe/**/*.ts", "src/scene.ts"],
    rules: {
      // These legacy Three.js modules are being migrated incrementally.
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
  globalIgnores([
    // Prebuilt third-party Draco artifacts are not project source files.
    "public/draco/**",
  ]),
])
