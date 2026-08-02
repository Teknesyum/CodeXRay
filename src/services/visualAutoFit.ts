export const calculateVisualAutoFitScale = (
  viewportWidth: number,
  viewportHeight: number,
  contentWidth: number,
  contentHeight: number,
): number => {
  if (
    viewportWidth <= 0
    || viewportHeight <= 0
    || contentWidth <= 0
    || contentHeight <= 0
  ) return 1;

  return Math.min(
    1,
    viewportWidth / contentWidth,
    viewportHeight / contentHeight,
  );
};
