var mapLimit = require('map-limit')
var assert = require('assert')
var debug = require('debug')('@ddrive/multi')

module.exports = multiDDrive

function multiDDrive (store, createVault, closeVault, cb) {
  assert.equal(typeof store, 'object', 'multiDDrive: store should be type object')
  assert.equal(typeof createVault, 'function', 'multiDDrive: createVault should be type function')
  assert.equal(typeof closeVault, 'function', 'multiDDrive: closeVault should be type function')
  assert.equal(typeof cb, 'function', 'multiDDrive: cb should be type function')

  var vaults = []
  var _disconnected = false
  var dDrive = {
    list: list,
    create: create,
    close: close,
    disconnect: disconnect
  }

  debug('initialize')
  store.read(sink)

  function sink (err, data) {
    if (err) return cb(err)
    var values = Object.keys(data).map(function (key) {
      var value = JSON.parse(data[key])
      value.key = key
      return value
    })
    debug('found %s dwebs', values.length)

    function createWithoutError (data, cb) {
      try {
        createVault(data, function (err, dweb) {
          if (err) {
            err.data = data
            dweb = err
            err = null
          }
          cb(err, dweb)
        })
      } catch (err) {
        err.data = data
        cb(null, err)
      }
    }

    mapLimit(values, 1, createWithoutError, function (err, _vaults) {
      if (err) return cb(err)
      vaults = _vaults
      debug('initialized')
      cb(null, dDrive)
    })
  }

  function list () {
    return vaults
  }

  function create (data, cb) {
    if (_disconnected) return setImmediate(cb.bind(null, new Error('disconnected')))
    debug('create vault data=%j', data)
    createVault(data, function (err, vault) {
      if (err) return cb(err)
      var key = vault.key
      var hexKey = key.toString('hex')
      debug('vault created key=%s', hexKey)

      var duplicates = vaults.filter(function (_vault) {
        if (_vault instanceof Error) return false
        var a = Buffer(_vault.key)
        var b = Buffer(key)
        return a.equals(b)
      })
      var duplicate = duplicates[0]
      if (duplicate) {
        debug('vault duplicate key=%s', hexKey)
        return cb(null, duplicate, Boolean(duplicate))
      }

      var _data
      if (data) _data = JSON.stringify(data)
      store.write(key, _data, function (err) {
        if (err) return cb(err)
        debug('vault stored key=%s', hexKey)
        vaults.push(vault)
        cb(null, vault)
      })
    })
  }

  function disconnect (cb) {
    if (_disconnected) return setImmediate(cb.bind(null, new Error('disconnected')))
    _disconnected = true
    store = null
    if (vaults.length === 0) return setImmediate(cb)
    var _vaults = vaults
    var count = _vaults.length
    var _err
    _vaults.forEach(function (vault) {
      closeVault(vault, next)
    })
    vaults = []

    function next (err) {
      count--
      if (err && !_err) {
        _err = err
      }
      if (count === 0) {
        cb(_err)
      }
    }
  }

  function close (key, cb) {
    if (_disconnected) return setImmediate(cb.bind(null, new Error('disconnected')))
    if (Buffer.isBuffer(key)) key = key.toString('hex')
    debug('close vault key=%s', key)
    var i = 0
    var vault = vaults.find(function (vault, j) {
      var _key = (vault.key || vault.data.key).toString('hex')
      if (_key !== key) return
      i = j
      return true
    })
    if (!vault) return setImmediate(cb.bind(null, new Error('could not find vault ' + key)))
    if (vault instanceof Error) next()
    else closeVault(vault, next)

    function next (err) {
      if (err) return cb(err)
      debug('vault closed key=%s', key)
      store.delete(key, function (err) {
        if (err) return cb(err)
        debug('vault deleted key=%s', key)
        vaults.splice(i, 1)
        cb(null, vault)
      })
    }
  }
}
