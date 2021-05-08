export function DebugBar(): JSX.Element {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        color: "white",
        backgroundColor: "purple",
        height: 40,
        opacity: "80%",
        backdropFilter: "blur(1px)",
      }}
    >
      Debug Bar
    </div>
  );
}
