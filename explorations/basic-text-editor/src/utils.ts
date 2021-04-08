export function isElementInViewport(element: HTMLElement, horizontalSlop = 0, verticalSlop = 0) {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= horizontalSlop &&
    rect.left >= verticalSlop &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) - horizontalSlop &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth) - verticalSlop
  );
}
