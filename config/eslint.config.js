export default [
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
    },
  },
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/.next/**"],
  },
];
