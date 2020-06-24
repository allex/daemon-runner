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

type TaskRunnerOnInit = (o: TaskRunner) => void

type TaskRunnerOption = {
  onInit?: TaskRunnerOnInit;
  startOnAdd?: boolean;
}

export enum RunnerState {
  READY, IDLE, STOP, STOPED, RUNNING
}

export type RunnerCallbackOptions = Partial<Omit<TaskEntity, 'fn'>>

export class TaskRunner {
  constructor (opts: TaskRunnerOption | TaskRunnerOnInit) {
    if (opts) {
      let onInit: TaskRunnerOnInit | undefined
      if (typeof opts === 'object') {
        onInit = opts.onInit
      } else if (typeof opts === 'function') {
        onInit = opts
      } else {
        Object.assign(this._opts, opts)
      }
      onInit && onInit(this)
    }
  }

  private _opts: TaskRunnerOption = {
    startOnAdd: false
  };

  private _tasks: TaskEntity[] = [];
  private _tm: any = null;
  private _state: RunnerState = RunnerState.READY;

  /**
   * Enqueue task to the runner queue, bootstrap runner if construct option `startOnAdd` is true
   *
   * @param task {Function} Add task function
   * @param options {Number|RunnerCallbackOptions} task options, as interval if a number
   *
   * @return Returns a teardown function for dispose the added task manually
   */
  add (fn: (...args: any[]) => any, options: number | RunnerCallbackOptions): () => void {
    let conf: RunnerCallbackOptions
    if (typeof options === 'number') {
      conf = {
        interval: options
      }
    } else {
      conf = options
    }

    let task
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

  pause (): TaskRunner {
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
    this.pause()

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
          task.defer = r
            .then(r => {
              if (isStoped()) {
                throw new Error('runner is stoped')
              }
              return r
            })
            .finally(() => setTimeout(() => {
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
        this._state = RunnerState.IDLE
      }
    }

    next()

    return this
  }

  stop (): TaskRunner {
    this.pause()
    this._state = RunnerState.STOPED
    return this
  }

  destroy (): void {
    this.stop()
    this._tasks.length = 0
  }
}
