module.exports = function (config) {
  config.set({
    frameworks: ["jasmine", "karma-typescript"],
    files: [
      "tests/**/*.ts", // *.tsx for React Jsx
    ],
    preprocessors: {
      "**/*.ts": "karma-typescript", // *.tsx for React Jsx
    },
    reporters: ["progress", "karma-typescript"],
    browsers: ["Chrome"],
    karmaTypescriptConfig: {
      bundlerOptions: {
        transforms: [require("karma-typescript-es6-transform")()],
      },
    },
  });
};
