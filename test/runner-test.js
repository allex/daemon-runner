import assert from 'assert'
import { TaskRunner, RunnerState } from '../'

describe('daemon-runner', function () {

  it('runner constructor parameter can be a initial function or mixed options obj', (done) => {
    const startOnAdd = true
    const onInit = () => 1
    const runner = new TaskRunner({
      onInit,
      startOnAdd
    })
    assert.strictEqual(runner._opts.onInit, onInit)
    assert.strictEqual(runner._opts.startOnAdd, startOnAdd)

    const runner2 = new TaskRunner(onInit)
    assert.strictEqual(runner2._opts.onInit, onInit)
    assert.strictEqual(runner2._opts.startOnAdd, false)

    done()
  })

  it('should invoke task func with custom scope', (done) => {
    const runner = new TaskRunner({ startOnAdd: true })
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
    const runner = new TaskRunner({ startOnAdd: true })
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
    const runner = new TaskRunner({ startOnAdd: true })
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
      assert.strictEqual(runner._state, RunnerState.IDLE, 'runner is idle')
      assert.deepStrictEqual(runner.size(), 0)
      done()
    }, 64)
  })

  it('should reset to initial state (READY) when instance destroyed', (done) => {
    const runner = new TaskRunner({ startOnAdd: true })
    const interval = 64
    const N = 5
    let callCount = 0

    setTimeout(function () {
      assert.strictEqual(callCount, N)
      runner.destroy()
      assert.strictEqual(runner._state, RunnerState.READY)
      assert.strictEqual(runner.size(), 0)
      done()
    }, interval * N)

    runner.add(() => {
      callCount++
    }, { interval })
  })

  it('should await for last cycle when task is a promise returned', (done) => {
    const runner = new TaskRunner({ startOnAdd: true })
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

  it('should been wake up when idle runner was enqueue', (done) => {
    const runner = new TaskRunner({ startOnAdd: true })
    var callCounts = {
        a: 0,
        b: 0
      },
      object = {}

    const task = () => {
      callCounts['a']++
    }

    runner.add(task)

    setTimeout(() => {
      assert.strictEqual(callCounts['a'], 1)
      assert.strictEqual(runner._state, RunnerState.IDLE, 'runner is idle')
      assert.deepStrictEqual(runner.size(), 0)

      // enqueue a interval task when runner idle
      runner.add(task, 64)

      // stop runner when task exec 4 times
      const n = 4
      setTimeout(() => {
        runner.destroy()
        assert.strictEqual(callCounts['a'], 1 + n)
        done()
      }, 64 * n)
    }, 64)
  })

})
