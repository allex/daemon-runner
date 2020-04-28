import { now } from './now'

const isPromise = (o: any): boolean => !!o && typeof o.then === 'function'

interface TaskEntity {
  fn: (...args: any[]) => any;
  args: any[];
  ctx: any | null;
  interval?: number; // 0, identify as once-run task
  ts?: number;
  next?: (() => void) | null;
  defer?: Promise<any> | null;
}

export enum RunnerState {
  STOP, STOPED, RUNNING
}

export type RunnerCallbackOptions = Partial<Omit<TaskEntity, 'fn'>>

export class TaskRunner {
  constructor (onInit?: (o: TaskRunner) => void) {
    if (typeof onInit === 'function') {
      onInit(this)
    }
  }

  private _tasks: TaskEntity[] = [];
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

    const tasks = this._tasks

    // add duplicate check
    if (!tasks.some(o => o.fn === fn && o.interval === conf.interval)) {
      tasks.push({
        fn,
        args: [],
        ctx: null,
        ...conf
      })
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
    return this._tasks.length
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

    const isStoped = (): boolean => this._state === RunnerState.STOPED

    const evaluate = (task: TaskEntity): void => {
      const {
        fn,
        ctx,
        args,
        interval = 0,
        ts = 0
      } = task
      const deltaTs = now() - (ts || 0)

      if (deltaTs >= interval) {
        const tasks = this._tasks
        const index = tasks.indexOf(task)
        if (index === -1) {
          return
        }
        if (task.defer) {
          task.next = (): void => {
            if (!isStoped()) evaluate(task)
          }
          return
        } else {
          task.next = null
        }

        // is a single-eval if interval 0
        if (interval === 0) {
          tasks.splice(index, 1)
        }

        const r = fn.apply(ctx, args || [])
        if (isPromise(r)) {
          task.defer = r.finally(() => setTimeout(() => {
            task.defer = null
            if (task.next) task.next()
          }, ~~(interval / 2)))
        }
        task.ts = now()
      }
    }

    const process = (): void => {
      this._state = RunnerState.RUNNING
      const arr = this._tasks.slice(0)
      let task: TaskEntity | null
      let index = -1
      while (task = arr[++index]) evaluate(task)
    }

    const next = (): void => {
      process()
      if (isStoped()) {
        return
      }
      if (this._tasks.length) {
        this._tm = setTimeout(next, 1)
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
    this._tasks.length = 0
  }
}
