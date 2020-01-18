type INow = () => number;

let fn: INow

if ((typeof performance !== 'undefined' && performance !== null) && performance.now) {
  fn = (): number => performance.now()
} else if ((typeof process !== 'undefined' && process !== null) && process.hrtime) {
  const hrtime = process.hrtime
  const getNanoSeconds = (): number => {
    const hr = hrtime()
    return hr[0] * 1e9 + hr[1]
  }
  const moduleLoadTime = getNanoSeconds()
  const upTime = process.uptime() * 1e9
  const nodeLoadTime = moduleLoadTime - upTime
  fn = (): number => (getNanoSeconds() - nodeLoadTime) / 1e6
} else if (Date.now) {
  const loadTime = Date.now()
  fn = (): number => Date.now() - loadTime
} else {
  const loadTime = new Date().getTime()
  fn = (): number => new Date().getTime() - loadTime
}

export const now = (): number => fn()
