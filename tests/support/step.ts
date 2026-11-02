import { test } from "@playwright/test";

// Reports a method as one step, such as "LoginPage.logIn", in the report and the trace. The name
// leaves out the arguments, which may be passwords. Not boxed: a boxed step's failure shows no code.
export function step<This extends object, Args extends unknown[], Return>(
  method: (this: This, ...args: Args) => Promise<Return>,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Promise<Return>>,
) {
  return function (this: This, ...args: Args): Promise<Return> {
    const name = `${this.constructor.name}.${String(context.name)}`;
    return test.step(name, () => method.call(this, ...args));
  };
}
