import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextConfigRequire = createRequire(require.resolve("eslint-config-next/package.json"));

const nextPlugin = nextConfigRequire("@next/eslint-plugin-next");
const reactPlugin = nextConfigRequire("eslint-plugin-react");
const reactHooksPlugin = nextConfigRequire("eslint-plugin-react-hooks");
const jsxA11yPlugin = nextConfigRequire("eslint-plugin-jsx-a11y");
const importPlugin = nextConfigRequire("eslint-plugin-import");
const typescriptEslintPlugin = nextConfigRequire("@typescript-eslint/eslint-plugin");
const nextParser = nextConfigRequire("eslint-config-next/parser.js");

const commonFiles = ["**/*.{js,mjs,cjs,jsx,ts,tsx}"];

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "out/**", "build/**", ".sisyphus/**", ".omc/**", ".opencode/**", ".golutra/**"],
  },
  {
    files: commonFiles,
    languageOptions: {
      parser: nextParser,
      parserOptions: {
        requireConfigFile: false,
        sourceType: "module",
        allowImportExportEverywhere: true,
        babelOptions: {
          presets: ["next/babel"],
          caller: {
            supportsTopLevelAwait: true,
          },
        },
      },
    },
    plugins: {
      import: importPlugin,
      "react-hooks": reactHooksPlugin,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  nextPlugin.flatConfig.coreWebVitals,
  reactPlugin.configs.flat.recommended,
  jsxA11yPlugin.flatConfigs.recommended,
  {
    files: commonFiles,
    plugins: {
      "react-hooks": reactHooksPlugin,
    },
    rules: reactHooksPlugin.configs.recommended.rules,
  },
  ...typescriptEslintPlugin.configs["flat/recommended"],
  {
    files: commonFiles,
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "import/no-anonymous-default-export": "warn",
      "react/no-unknown-property": "off",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "jsx-a11y/alt-text": [
        "warn",
        {
          elements: ["img"],
          img: ["Image"],
        },
      ],
      "jsx-a11y/aria-props": "warn",
      "jsx-a11y/aria-proptypes": "warn",
      "jsx-a11y/aria-unsupported-elements": "warn",
      "jsx-a11y/role-has-required-aria-props": "warn",
      "jsx-a11y/role-supports-aria-props": "warn",
      "react/jsx-no-target-blank": "off",
    },
  },
  {
    files: ["next-env.d.ts"],
    rules: {
      "@typescript-eslint/triple-slash-reference": "off",
    },
  },
];

export default eslintConfig;
