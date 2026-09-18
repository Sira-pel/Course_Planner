import { applyDomTheme, persistTheme } from './theme';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

class FakeClassList {
  tokens = new Set<string>();
  toggle(name: string, force?: boolean): boolean {
    if (force === true) this.tokens.add(name);
    else if (force === false) this.tokens.delete(name);
    else if (this.tokens.has(name)) this.tokens.delete(name);
    else this.tokens.add(name);
    return this.tokens.has(name);
  }
  contains(name: string): boolean {
    return this.tokens.has(name);
  }
}

const root = {
  classList: new FakeClassList(),
  style: { colorScheme: '' },
};
Object.defineProperty(globalThis, 'document', {
  value: { documentElement: root },
  configurable: true,
});

applyDomTheme('dark');
assert(root.classList.contains('dark'), 'dark class is set with color-scheme');
assert(root.style.colorScheme === 'dark', 'color-scheme is dark in the same call');

applyDomTheme('light');
assert(!root.classList.contains('dark'), 'light clears the dark class');
assert(root.style.colorScheme === 'light', 'color-scheme is light in the same call');

let setCalls = 0;
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    setItem() {
      setCalls += 1;
      throw new Error('quota');
    },
  },
});

let continued = false;
persistTheme('dark');
continued = true;
assert(setCalls === 1, 'persistTheme still writes even when storage throws');
assert(continued, 'persistTheme does not throw into the caller');

console.log('theme tests passed');
