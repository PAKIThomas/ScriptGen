// Écriture de valeurs Lua littérales, au format des scripts « Mizan Script Creator » :
// listes `{ 1, 2 }`, liste vide `{}`, chaînes entre guillemets doubles.
import { isRaw, type LuaValue } from '../model/types';

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const LUA_KEYWORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function', 'goto', 'if', 'in',
  'local', 'nil', 'not', 'or', 'repeat', 'return', 'then', 'true', 'until', 'while',
]);

export function luaString(s: string): string {
  const escaped = s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
  return `"${escaped}"`;
}

export function luaKey(key: string): string {
  return IDENTIFIER.test(key) && !LUA_KEYWORDS.has(key) ? key : `[${luaString(key)}]`;
}

export function luaValue(v: LuaValue): string {
  if (isRaw(v)) return v.raw;
  if (typeof v === 'string') return luaString(v);
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '0';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) {
    if (v.length === 0) return '{}';
    return `{ ${v.map(luaValue).join(', ')} }`;
  }
  const entries = Object.entries(v);
  if (entries.length === 0) return '{}';
  return `{ ${entries.map(([k, val]) => `${luaKey(k)} = ${luaValue(val)}`).join(', ')} }`;
}
