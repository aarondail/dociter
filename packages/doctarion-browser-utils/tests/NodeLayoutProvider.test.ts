describe("NodeLayoutProvider", () => {
  // afterEach(() => {
  //   const kids = [];
  //   for (let i = 0; i < document.body.children.length; i++) {
  //     const c = document.body.children[i];
  //     kids.push(c);
  //   }
  //   kids.forEach((c) => document.body.removeChild(c));
  // });

  it("it works", () => {
    // console.log(electron);
    // console.log(electron.remote);
    // electron.remote.getCurrentWindow().show();

    const el = document.createElement("p");
    el.style.cssText = "width: 200px; background-color: #999; font-size: 20px; font-family: Arial;";
    el.textContent = "I am a little pony.";
    document.body.appendChild(el);

    for (let i = 0; i < el.getClientRects().length; i++) {
      console.log(JSON.stringify(el.getClientRects()[i]));
    }
    expect(1).toEqual(1);
  });
});
