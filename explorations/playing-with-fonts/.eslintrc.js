module.exports = {
  plugins: ["react", "@typescript-eslint"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2020,
    project: ["./tsconfig.json"],
    tsconfigRootDir: __dirname,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "react-app",
    "prettier",
    "plugin:prettier/recommended",
    "plugin:import/typescript",
  ],
  env: {
    browser: true,
    es6: true,
  },
  rules: {
    "no-debugger": ["warn"],
    "import/order": ["error", { alphabetize: { order: "asc" }, "newlines-between": "always" }],
    "sort-imports": ["warn", { ignoreDeclarationSort: true }],
    "@typescript-eslint/no-empty-function": ["warn"],
    "@typescript-eslint/no-unsafe-assignment": ["warn"],
  },
};
