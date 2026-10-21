// Compatibilidad con iPhone/Safari antiguos (iOS 14-15): funciones modernas que usan algunas librerías.
/* eslint-disable no-extend-native */
const def = (obj: any, name: string, fn: any) => { if (!(name in obj)) Object.defineProperty(obj, name, { value: fn, writable: true, configurable: true }); };
function at(this: any, i: number) { const n = Math.trunc(i) || 0; const k = n < 0 ? this.length + n : n; return k >= 0 && k < this.length ? this[k] : undefined; }
def(Array.prototype, 'at', at);
def(String.prototype, 'at', at);
def(Array.prototype, 'findLast', function (this: any[], cb: any, t?: any) { for (let i = this.length - 1; i >= 0; i--) if (cb.call(t, this[i], i, this)) return this[i]; return undefined; });
def(Array.prototype, 'findLastIndex', function (this: any[], cb: any, t?: any) { for (let i = this.length - 1; i >= 0; i--) if (cb.call(t, this[i], i, this)) return i; return -1; });
def(Object, 'hasOwn', (o: any, k: PropertyKey) => Object.prototype.hasOwnProperty.call(o, k));
if (typeof (globalThis as any).structuredClone !== 'function') {
  (globalThis as any).structuredClone = (v: any) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
}
export {};
