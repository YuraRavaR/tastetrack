import type { Locator } from "@playwright/test";

export type Box = Awaited<ReturnType<typeof settledBoxOf>>;

// Where an element sits once its opening animation has finished.
export async function settledBoxOf(element: Locator) {
  await element.evaluate((node) =>
    Promise.all(node.getAnimations().map(({ finished }) => finished)),
  );
  const box = await element.boundingBox();
  if (!box) throw new Error("The element isn't rendered");
  return box;
}
