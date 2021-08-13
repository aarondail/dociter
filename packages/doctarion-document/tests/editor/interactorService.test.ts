import { Draft } from "immer";

import { Path } from "../../src/basic-traversal";
import { Cursor, CursorOrientation } from "../../src/cursor";
import { Editor, EditorOperationServices, EditorState, OPS, createOperation } from "../../src/editor";
import { HeaderLevel } from "../../src/models";
import { InteractorOrderingEntryCursorType } from "../../src/working-document";
import { doc, header, inlineText, inlineUrlLink, paragraph } from "../utils";

const testDoc1 = doc(
  header(HeaderLevel.One, inlineText("H1")),
  paragraph(inlineText("MM"), inlineText(""), inlineText("NN")),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", "GOOGLE"))
);

describe("interactorCursorsAtOrAfter", () => {
  const TEST_OPERATION_NAME = "TEST";
  let changeableTestFunction: (state: Draft<EditorState>, services: EditorOperationServices) => void;
  const testOperation = createOperation(TEST_OPERATION_NAME, (state, services) => {
    changeableTestFunction(state, services);
  });

  const debugInteractorCursorsAtOrAfter = (
    services: EditorOperationServices,
    at: string,
    orientation: CursorOrientation
  ) => {
    return services.interactors
      .interactorCursorsAtOrAfter(new Cursor(Path.parse(at), orientation))
      .map(
        ({ interactor, cursorType }) =>
          `${
            cursorType === InteractorOrderingEntryCursorType.Main
              ? interactor.mainCursor.toString()
              : interactor.selectionAnchorCursor?.toString() || ""
          }${cursorType === InteractorOrderingEntryCursorType.SelectionAnchor ? " (Sa)" : ""}`
      );
  };

  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      document: testDoc1,
      additionalOperations: [testOperation],
      omitDefaultInteractor: true,
    });
  });

  it("correctly works with one interactor", () => {
    changeableTestFunction = (state, services) => {
      // The test is here
      expect(debugInteractorCursorsAtOrAfter(services, "0/0/0", CursorOrientation.Before)).toMatchInlineSnapshot(`
        Array [
          "BEFORE 0/0/0",
        ]
      `);
      expect(
        services.interactors.interactorCursorsAtOrAfter(new Cursor(Path.parse("0/1"), CursorOrientation.Before))
      ).toEqual([]);
      expect(debugInteractorCursorsAtOrAfter(services, "0/0", CursorOrientation.Before)).toMatchInlineSnapshot(`
        Array [
          "BEFORE 0/0/0",
        ]
      `);
      expect(
        services.interactors.interactorCursorsAtOrAfter(new Cursor(Path.parse("0/0"), CursorOrientation.After))
      ).toEqual([]);
      expect(debugInteractorCursorsAtOrAfter(services, "", CursorOrientation.Before)).toMatchInlineSnapshot(`
        Array [
          "BEFORE 0/0/0",
        ]
      `);
      expect(
        services.interactors.interactorCursorsAtOrAfter(new Cursor(Path.parse(""), CursorOrientation.After))
      ).toEqual([]);
      expect(
        services.interactors.interactorCursorsAtOrAfter(new Cursor(Path.parse("0/0/0"), CursorOrientation.On))
      ).toEqual([]);
      expect(
        services.interactors.interactorCursorsAtOrAfter(new Cursor(Path.parse("0/0/0"), CursorOrientation.After))
      ).toEqual([]);
    };
    // More test setup
    editor.execute(OPS.addInteractor({ at: { path: "0/0/0", orientation: CursorOrientation.Before } }));
    // Run changeableTestFunction
    editor.execute({ name: TEST_OPERATION_NAME, payload: {} });
    // JIC
    expect.hasAssertions();
  });

  it("correctly works with multiple interactors", () => {
    changeableTestFunction = (state, services) => {
      // The test is here
      expect(debugInteractorCursorsAtOrAfter(services, "", CursorOrientation.Before)).toMatchInlineSnapshot(`
        Array [
          "AFTER 1/0/1",
          "ON 2",
          "BEFORE 3/1/0",
        ]
      `);
      expect(
        services.interactors.interactorCursorsAtOrAfter(new Cursor(Path.parse(""), CursorOrientation.After))
      ).toEqual([]);

      expect(debugInteractorCursorsAtOrAfter(services, "1/2", CursorOrientation.Before)).toMatchInlineSnapshot(`
              Array [
                "ON 2",
                "BEFORE 3/1/0",
              ]
            `);
      expect(debugInteractorCursorsAtOrAfter(services, "2", CursorOrientation.Before)).toMatchInlineSnapshot(`
              Array [
                "ON 2",
                "BEFORE 3/1/0",
              ]
            `);
      expect(debugInteractorCursorsAtOrAfter(services, "2", CursorOrientation.On)).toMatchInlineSnapshot(`
        Array [
          "ON 2",
          "BEFORE 3/1/0",
        ]
      `);
      expect(debugInteractorCursorsAtOrAfter(services, "2", CursorOrientation.After)).toMatchInlineSnapshot(`
              Array [
                "BEFORE 3/1/0",
              ]
            `);
      expect(debugInteractorCursorsAtOrAfter(services, "2/1/2/3/4", CursorOrientation.Before)).toMatchInlineSnapshot(`
        Array [
          "BEFORE 3/1/0",
        ]
      `);
    };
    // More test setup
    editor.execute(OPS.addInteractor({ at: { path: "1/0/1", orientation: CursorOrientation.After } }));
    editor.execute(OPS.addInteractor({ at: { path: "2", orientation: CursorOrientation.On } }));
    editor.execute(OPS.addInteractor({ at: { path: "3/1/0", orientation: CursorOrientation.Before } }));
    // Run changeableTestFunction
    editor.execute({ name: TEST_OPERATION_NAME, payload: {} });
    // JIC
    expect.hasAssertions();
  });

  it("correctly works with selection anchors interactors", () => {
    changeableTestFunction = (state, services) => {
      // The test is here
      expect(debugInteractorCursorsAtOrAfter(services, "", CursorOrientation.Before)).toMatchInlineSnapshot(`
        Array [
          "AFTER 1/0/0",
          "BEFORE 3/1/0 (Sa)",
        ]
      `);
      expect(
        services.interactors.interactorCursorsAtOrAfter(new Cursor(Path.parse(""), CursorOrientation.After))
      ).toEqual([]);

      expect(debugInteractorCursorsAtOrAfter(services, "1/2", CursorOrientation.Before)).toMatchInlineSnapshot(`
              Array [
                "BEFORE 3/1/0 (Sa)",
              ]
            `);

      // More test setup
      editor.execute(
        OPS.addInteractor({
          at: { path: "1/0/0", orientation: CursorOrientation.After },
          selectionAnchor: { path: "3/1/0", orientation: CursorOrientation.Before },
        })
      );
      // Run changeableTestFunction
      editor.execute({ name: TEST_OPERATION_NAME, payload: {} });
      // JIC
      expect.hasAssertions();
    };
  });
});

describe("interactorCursorsDescendantsOf", () => {
  const TEST_OPERATION_NAME = "TEST";
  let changeableTestFunction: (state: Draft<EditorState>, services: EditorOperationServices) => void;
  const testOperation = createOperation(TEST_OPERATION_NAME, (state, services) => {
    changeableTestFunction(state, services);
  });

  const debugInteractorCursorsDescendantsOf = (services: EditorOperationServices, at: string) => {
    return services.interactors
      .interactorCursorsDescendantsOf(Path.parse(at))
      .map(
        ({ interactor, cursorType }) =>
          `${
            cursorType === InteractorOrderingEntryCursorType.Main
              ? interactor.mainCursor.toString()
              : interactor.selectionAnchorCursor?.toString() || ""
          }${cursorType === InteractorOrderingEntryCursorType.SelectionAnchor ? " (Sa)" : ""}`
      );
  };

  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      document: testDoc1,
      additionalOperations: [testOperation],
      omitDefaultInteractor: true,
    });
  });

  it("correctly works with one interactor", () => {
    changeableTestFunction = (state, services) => {
      // The test is here
      expect(debugInteractorCursorsDescendantsOf(services, "0/0/1")).toEqual([]);
      expect(services.interactors.interactorCursorsDescendantsOf(Path.parse("0/0/0"))).toEqual([]);
      expect(services.interactors.interactorCursorsDescendantsOf(Path.parse("0/0/2"))).toEqual([]);

      expect(debugInteractorCursorsDescendantsOf(services, "0/0")).toMatchInlineSnapshot(`
        Array [
          "AFTER 0/0/1",
        ]
      `);
      expect(services.interactors.interactorCursorsDescendantsOf(Path.parse("0/1"))).toEqual([]);

      expect(debugInteractorCursorsDescendantsOf(services, "0")).toMatchInlineSnapshot(`
        Array [
          "AFTER 0/0/1",
        ]
      `);
      expect(services.interactors.interactorCursorsDescendantsOf(Path.parse("1"))).toEqual([]);

      expect(debugInteractorCursorsDescendantsOf(services, "")).toMatchInlineSnapshot(`
        Array [
          "AFTER 0/0/1",
        ]
      `);
    };
    // More test setup
    editor.execute(OPS.addInteractor({ at: { path: "0/0/1", orientation: CursorOrientation.After } }));
    // Run changeableTestFunction
    editor.execute({ name: TEST_OPERATION_NAME, payload: {} });
    // JIC
    expect.hasAssertions();
  });

  it("correctly works with multiple interactors", () => {
    changeableTestFunction = (state, services) => {
      // The test is here
      expect(debugInteractorCursorsDescendantsOf(services, "")).toMatchInlineSnapshot(`
        Array [
          "BEFORE 0/0/0",
          "AFTER 0/0/0",
          "AFTER 1/0/1",
          "ON 2",
          "BEFORE 3/1/0",
        ]
      `);
      expect(debugInteractorCursorsDescendantsOf(services, "0")).toMatchInlineSnapshot(`
        Array [
          "BEFORE 0/0/0",
          "AFTER 0/0/0",
        ]
      `);
      expect(debugInteractorCursorsDescendantsOf(services, "1/0")).toMatchInlineSnapshot(`
        Array [
          "AFTER 1/0/1",
        ]
      `);

      expect(debugInteractorCursorsDescendantsOf(services, "2")).toEqual([]);
    };
    // More test setup
    editor.execute(OPS.addInteractor({ at: { path: "0/0/0", orientation: CursorOrientation.Before } }));
    editor.execute(OPS.addInteractor({ at: { path: "0/0/0", orientation: CursorOrientation.After } }));
    editor.execute(OPS.addInteractor({ at: { path: "1/0/1", orientation: CursorOrientation.After } }));
    editor.execute(OPS.addInteractor({ at: { path: "2", orientation: CursorOrientation.On } }));
    editor.execute(OPS.addInteractor({ at: { path: "3/1/0", orientation: CursorOrientation.Before } }));
    // Run changeableTestFunction
    editor.execute({ name: TEST_OPERATION_NAME, payload: {} });
    // JIC
    expect.hasAssertions();
  });

  it("correctly works with selection anchors interactors", () => {
    changeableTestFunction = (state, services) => {
      // The test is here
      expect(debugInteractorCursorsDescendantsOf(services, "")).toMatchInlineSnapshot(`
        Array [
          "AFTER 1/0/0",
          "BEFORE 3/1/0 (Sa)",
        ]
      `);
      expect(debugInteractorCursorsDescendantsOf(services, "1")).toMatchInlineSnapshot(`
        Array [
          "AFTER 1/0/0",
        ]
      `);
      expect(debugInteractorCursorsDescendantsOf(services, "3")).toMatchInlineSnapshot(`
        Array [
          "BEFORE 3/1/0 (Sa)",
        ]
      `);
    };

    // More test setup
    editor.execute(
      OPS.addInteractor({
        at: { path: "1/0/0", orientation: CursorOrientation.After },
        selectionAnchor: { path: "3/1/0", orientation: CursorOrientation.Before },
      })
    );
    // Run changeableTestFunction
    editor.execute({ name: TEST_OPERATION_NAME, payload: {} });
    // JIC
    expect.hasAssertions();
  });
});

describe("interactorCursorsAtOrDescendantsOf", () => {
  const TEST_OPERATION_NAME = "TEST";
  let changeableTestFunction: (state: Draft<EditorState>, services: EditorOperationServices) => void;
  const testOperation = createOperation(TEST_OPERATION_NAME, (state, services) => {
    changeableTestFunction(state, services);
  });

  const debugInteractorCursorsDescendantsOf = (services: EditorOperationServices, at: string) => {
    return services.interactors
      .interactorCursorsAtOrDescendantsOf(Path.parse(at))
      .map(
        ({ interactor, cursorType }) =>
          `${
            cursorType === InteractorOrderingEntryCursorType.Main
              ? interactor.mainCursor.toString()
              : interactor.selectionAnchorCursor?.toString() || ""
          }${cursorType === InteractorOrderingEntryCursorType.SelectionAnchor ? " (Sa)" : ""}`
      );
  };

  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      document: testDoc1,
      additionalOperations: [testOperation],
      omitDefaultInteractor: true,
    });
  });

  it("correctly works with multiple interactors", () => {
    changeableTestFunction = (state, services) => {
      // The test is here
      expect(debugInteractorCursorsDescendantsOf(services, "")).toMatchInlineSnapshot(`
        Array [
          "BEFORE 0/0/0",
          "AFTER 0/0/0",
          "AFTER 1/0/1",
          "ON 2",
          "BEFORE 3/1/0",
        ]
      `);

      expect(debugInteractorCursorsDescendantsOf(services, "2")).toMatchInlineSnapshot(`
      Array [
        "ON 2",
      ]
    `);
    };
    // More test setup
    editor.execute(OPS.addInteractor({ at: { path: "0/0/0", orientation: CursorOrientation.Before } }));
    editor.execute(OPS.addInteractor({ at: { path: "0/0/0", orientation: CursorOrientation.After } }));
    editor.execute(OPS.addInteractor({ at: { path: "1/0/1", orientation: CursorOrientation.After } }));
    editor.execute(OPS.addInteractor({ at: { path: "2", orientation: CursorOrientation.On } }));
    editor.execute(OPS.addInteractor({ at: { path: "3/1/0", orientation: CursorOrientation.Before } }));
    // Run changeableTestFunction
    editor.execute({ name: TEST_OPERATION_NAME, payload: {} });
    // JIC
    expect.hasAssertions();
  });
});
