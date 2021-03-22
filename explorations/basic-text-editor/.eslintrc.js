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
    "plugin:import/warnings",
    "plugin:import/errors",
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
    "@typescript-eslint/member-ordering": [
      "error",
      {
        default: {
          memberTypes: [
            "public-static-field",
            "protected-static-field",
            "private-static-field",
            "public-instance-field",
            "protected-instance-field",
            "private-instance-field",
            "constructor",
            "public-instance-method",
            "protected-instance-method",
            "private-instance-method",
            "public-static-method",
            "protected-static-method",
            "private-static-method",
          ],
          order: "alphabetically",
        },
      },
    ],
  },
};
