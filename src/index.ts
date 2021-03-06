import 'setimmediate'
import { now } from './now'

const isPromise = (o: any): boolean => !!o && typeof o.then === 'function'
const noop = (): void => void(0)

type Timeout = NodeJS.Timeout | number
type Immediate = NodeJS.Immediate | number

export interface TaskConfig {
  /**
   * The function to execute each time the task is invoked. The function will
   * be called at each interval and passed the `args` argument if specified,
   * and the current invocation count if not.
   */
  fn: (...args: any[]) => any;

  /**
   * An array of arguments to be spread passed to the function specified by `fn`.
   */
  args: any[];

  /**
   * The scope (`this` reference) in which to execute the `fn` function.
   * Defaults to the task config object.
   */
  ctx: any | null;

  /**
   * The frequency in milliseconds with which the task should be invoked.
   * (0, identify as a one-time task)
   */
  interval?: number;
}

interface ITask extends TaskConfig {
  /* task internal properties */
  ts?: number;
  next?: (() => void) | null;
  defer?: Promise<any> | null;
}

type TaskRunnerOnInit = (o: TaskRunner) => void

export type TaskRunnerOptions = {
  onInit: TaskRunnerOnInit;
  startOnAdd: boolean;
}

export type TaskDisposeFunc = () => void

export enum RunnerState {
  READY,
  IDLE,
  STOPED,
  RUNNING
}

export class TaskRunner {
  constructor (opts: Partial<TaskRunnerOptions> | TaskRunnerOnInit) {
    if (opts) {
      if (typeof opts === 'object') {
        Object.assign(this._opts, opts)
      } else if (typeof opts === 'function') {
        this._opts.onInit = opts
      }
      this._opts.onInit(this)
    }
  }

  private _opts: TaskRunnerOptions = {
    onInit: noop,
    startOnAdd: false
  };

  private _tasks: ITask[] = [];
  private _tm: Timeout = 0;
  private _pid: Immediate = 0;
  private _state: RunnerState = RunnerState.READY;

  /**
   * Enqueue task to the runner queue, bootstrap runner if construct option `startOnAdd` is true
   *
   * @param task {Function} The function to execute each time the task is invoked
   * @param options {Number|TaskConfig} task options, as interval if a number
   *
   * @return Returns a teardown function for dispose the added task manually
   */
  add (fn: (...args: any[]) => any, options: number | Partial<TaskConfig>): TaskDisposeFunc {
    let conf: Partial<TaskConfig>
    if (typeof options === 'number') {
      conf = {
        interval: options
      }
    } else {
      conf = options
    }

    let task: ITask
    const tasks = this._tasks

    // add duplicate check
    if (!tasks.some(o => o.fn === fn && o.interval === conf.interval)) {
      task = {
        fn,
        args: [],
        ctx: null,
        ...conf
      }
      tasks.push(task)
    }

    if (this._state === RunnerState.IDLE || this._opts.startOnAdd && this._state === RunnerState.READY) {
      this.start()
    }

    return (): void => {
      const i = tasks.indexOf(task)
      if (i > -1) { tasks.splice(i, 1) }
    }
  }

  /**
   * Returns the runner queue task size
   */
  size (): number {
    return this._tasks.length
  }

  start (): TaskRunner {
    if (this._state === RunnerState.RUNNING) {
      return this
    }

    const isStoped = (): boolean => this._state === RunnerState.STOPED

    const evaluate = (task: ITask): void => {
      const {
        fn,
        ctx,
        args,
        interval = 0,
        ts = 0
      } = task

      const clock = now()
      const deltaTs = clock - (ts || 0)

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

        const r = fn.apply(ctx || task, args || [])
        if (isPromise(r)) {
          task.defer = r
            .then(r => {
              if (isStoped()) {
                throw new Error('runner is halt')
              }
              return r
            })
            .finally(() => setTimeout(() => {
              task.defer = null
              if (task.next) task.next()
            }, ~~(interval / 2)))
        }
        task.ts = clock
      }
    }

    const process = (): void => {
      if (this._pid) {
        return
      }
      // add process locker
      this._pid = setImmediate(() => {
        const arr = this._tasks.slice(0)
        let task: ITask | null
        let index = -1
        while (task = arr[++index]) evaluate(task)
        this._pid = 0
      })
    }

    const clear = (): void => {
      if (this._tm) {
        clearInterval(this._tm as any)
        this._tm = 0
      }
    }

    const next = (): void => {
      if (isStoped()) {
        clear()
        return
      }

      process()

      if (!this._tasks.length) {
        this._state = RunnerState.IDLE
        clear()
      }
    }

    this._state = RunnerState.RUNNING

    clear()
    this._tm = setInterval(next, 0)

    return this
  }

  stop (): TaskRunner {
    this._state = RunnerState.STOPED
    return this
  }

  destroy (): void {
    this.stop()
    this._tasks.length = 0
    // reset state to initial
    this._state = RunnerState.READY
  }
}
