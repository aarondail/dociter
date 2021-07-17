// describe("deleteSelection", () => {
//   it("basically works", () => {
//     const editor = new Editor({ document : testDoc1 });
//     // Delete the OOG from GOOGLE
//     editor.update(OPS.select("3/1/1", "3/1/3"));
//     editor.update(OPS.deleteSelection);
//     expect(debugState(editor)).toEqual(`
// SELECTION: <| 3/1/0 -- 3/1/0
// ELEMENTS:
// 3/1/0`);
//     expect(debugCurrentBlock(editor)).toEqual(`
// PARAGRAPH > TEXT {} > "CC"
// PARAGRAPH > URL_LINK g.com > "GLE"
// PARAGRAPH > TEXT {} > "DD"`);
//   });
// });

test("ASD", () => {
  expect(true).toBe(true);
});
