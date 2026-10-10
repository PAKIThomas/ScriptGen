declare module 'luaparse' {
  interface ParseOptions {
    comments?: boolean;
    locations?: boolean;
    ranges?: boolean;
    luaVersion?: '5.1' | '5.2' | '5.3' | 'LuaJIT';
    encodingMode?: 'none' | 'pseudo-latin1' | 'x-user-defined';
  }
  const luaparse: { parse(code: string, options?: ParseOptions): unknown };
  export default luaparse;
}
