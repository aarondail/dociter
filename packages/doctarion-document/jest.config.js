module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  moduleNameMapper: {
    "doctarion-utils": "<rootDir>../doctarion-utils/src",
  },
};
