import type { Locator } from "@playwright/test";

// Where an element sits once its opening animation has finished.
export async function settledBoxOf(element: Locator) {
  await element.evaluate((node) =>
    Promise.all(node.getAnimations().map(({ finished }) => finished)),
  );
  const box = await element.boundingBox();
  if (!box) throw new Error("The element isn't rendered");
  return box;
}
