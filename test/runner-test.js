import assert from 'assert'
import { TaskRunner, RunnerState } from '../'

describe('daemon-runner', function () {

  it('should invoke task func with custom scope', (done) => {
    const runner = new TaskRunner()
    const interval = 64
    var callCount = 0

    const ctx = {}

    runner.add(function () {
      callCount++
      assert.strictEqual(this, ctx)
    }, { interval, ctx })

    setTimeout(function () {
      assert.strictEqual(callCount, 2)
      runner.destroy()
      done()
    }, interval * 2)
  })

  it('should invoke tasks with the specific interval delay', (done) => {
    const runner = new TaskRunner()
    const interval = 64
    var callCount = 0

    runner.add(() => {
      callCount++
    }, interval)

    setTimeout(function () {
      assert.strictEqual(callCount, 2)
      runner.stop()
      done()
    }, interval * 2)
  })

  it('should invoke the tasks only once if none interval provided', (done) => {
    const runner = new TaskRunner()
    var callCounts = {
        a: 0,
        b: 0
      },
      object = {}

    runner.add(() => {
      callCounts['a']++
    })
    runner.add(() => {
      callCounts['b']++
    })

    setTimeout(function () {
      assert.strictEqual(callCounts['a'], 1)
      assert.strictEqual(callCounts['b'], 1)
      assert.strictEqual(runner._state, RunnerState.STOP)
      assert.deepStrictEqual(runner.size(), 0)
      done()
    }, 64)
  })

  it('should stoped and cleaned if destroy invoked', (done) => {
    const runner = new TaskRunner()
    const interval = 64
    const N = 5
    let callCount = 0

    setTimeout(function () {
      assert.strictEqual(callCount, N)
      runner.destroy()
      assert.strictEqual(runner._state, RunnerState.STOPED)
      assert.strictEqual(runner.size(), 0)
      done()
    }, interval * N)

    runner.add(() => {
      callCount++
    }, { interval })
  })

  it('should await for last cycle when task is a promise returned', (done) => {
    const runner = new TaskRunner()
    const interval = 64
    const N = 3
    let callCount = 0
    let resolveCount = 0

    setTimeout(function () {
      runner.destroy()
      done()
    }, interval * 2 * N)

    runner.add(() => {
      return new Promise((resolve, reject) => {
        callCount++
        // resolve delay
        setTimeout(() => {
          resolveCount++
          assert.strictEqual(callCount, resolveCount)
          resolve(callCount)
        }, interval)
      })
    }, { interval })
  })

})
