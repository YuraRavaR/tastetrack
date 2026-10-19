// Wraps a D1 binding so every query run through it is counted. Used only when
// test hooks are on, so API tests can assert how many queries a request made.

const queryMethods = new Set<PropertyKey>(["first", "run", "all", "raw"]);

// Reads a property off the real object, binding methods to it rather than to the proxy.
function passThrough(target: object, prop: PropertyKey): unknown {
  const value = Reflect.get(target, prop, target);
  return typeof value === "function" ? value.bind(target) : value;
}

export interface CountedD1 {
  db: D1Database;
  count(): number;
}

export function countQueries(d1: D1Database): CountedD1 {
  let count = 0;
  const unwrapped = new WeakMap<object, D1PreparedStatement>();

  function wrapStatement(statement: D1PreparedStatement): D1PreparedStatement {
    const proxy = new Proxy(statement, {
      get(target, prop) {
        if (prop === "bind") {
          return (...values: unknown[]) => wrapStatement(target.bind(...values));
        }
        const value = passThrough(target, prop);
        if (queryMethods.has(prop) && typeof value === "function") {
          return (...args: unknown[]) => {
            count += 1;
            return value(...args);
          };
        }
        return value;
      },
    });
    unwrapped.set(proxy, statement);
    return proxy;
  }

  const db = new Proxy(d1, {
    get(target, prop) {
      if (prop === "prepare") {
        return (query: string) => wrapStatement(target.prepare(query));
      }
      if (prop === "batch") {
        return (statements: D1PreparedStatement[]) => {
          count += statements.length;
          return target.batch(statements.map((s) => unwrapped.get(s) ?? s));
        };
      }
      if (prop === "exec") {
        return async (query: string) => {
          const result = await target.exec(query);
          count += result.count;
          return result;
        };
      }
      return passThrough(target, prop);
    },
  });

  return { db, count: () => count };
}
