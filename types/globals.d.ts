// Ensure this is treated as a module.
export {}

declare global {
  type IFunc = (...args: any[]) => any
  type IArgs = IArguments | any[]
  type Newable<T> = new (...args: any[]) => T

  interface Kv<T = any> extends object {
    [index: string]: T
  }
  interface Error {
    [key: string]: any
  }
  interface Promise<T> {
    [key: string]: any
  }
}
