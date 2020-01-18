import { now } from './now'

export interface RunnerItem {
  fn: (...args: any[]) => any;
  ctx?: any;
  interval?: number;
  args?: any[];
  ts?: number;
}

export enum RunnerState {
  STOP, STOPED, RUNNING
}

export type RunnerCallbackOptions = Omit<RunnerItem, 'fn'>

export class TaskRunner {
  constructor (onInit?: (o: TaskRunner) => void) {
    if (typeof onInit === 'function') {
      onInit(this)
    }
  }

  private _items: RunnerItem[] = [];
  private _tm: any = null;
  private _state: RunnerState = RunnerState.STOP;

  /**
   * Enqueue task to the runner queue, bootstrap runner if not stoped manually
   *
   * @param task {Function} Add task function
   * @param options {Number|RunnerCallbackOptions} task options, as interval if a number
   */
  add (fn: (...args: any[]) => any, options: number | RunnerCallbackOptions): TaskRunner {
    let conf: RunnerCallbackOptions
    if (typeof options === 'number') {
      conf = {
        interval: options
      }
    } else {
      conf = options
    }
    const items = this._items
    // add duplicate check
    if (!items.some(o => o.fn === fn && o.interval === conf.interval)) {
      items.push({ fn, args: [], ...conf })
    }
    if (this._state === RunnerState.STOP) {
      this.start()
    }
    return this
  }

  /**
   * Returns the runner queue task size
   */
  size (): number {
    return this._items.length
  }

  clear (): TaskRunner {
    if (this._tm) {
      clearTimeout(this._tm)
    }
    this._state = RunnerState.STOP

    return this
  }

  start (): TaskRunner {
    if (this._state === RunnerState.RUNNING) {
      return this
    }
    this.clear()

    const process = (): void => {
      this._state = RunnerState.RUNNING
      const clock = now()
      const arr = this._items.slice(0)
      let conf: RunnerItem | null
      let index = -1
      while (conf = arr[++index]) {
        const { fn, ctx, args, interval = 0, ts = 0 } = conf
        const deltaTs = clock - (ts || 0)
        if (deltaTs >= interval) {
          // run a single time if interval 0
          if (interval === 0) {
            this._items.splice(index, 1)
          }
          fn.apply(ctx, args || [])
          conf.ts = now()
        }
      }
    }

    const next = (): void => {
      process()
      if (this._state === RunnerState.STOPED) {
        return
      }
      if (this._items.length) {
        this._tm = setTimeout(next, 0)
      } else {
        this._state = RunnerState.STOP
      }
    }

    next()
    return this
  }

  stop (): TaskRunner {
    this.clear()
    this._state = RunnerState.STOPED
    return this
  }

  destroy (): void {
    this.stop()
    this._items.length = 0
  }
}
