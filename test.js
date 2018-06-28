var ddrive = require('@ddrive/core')
var toilet = require('toiletdb')
var memdb = require('memdb')
var test = require('tape')
var fs = require('fs')

function flushToilet () {
  try {
    fs.unlinkSync('state.json')
  } catch (e) {}
}

flushToilet()

var noop = function () {}
var noopCb = function () {
  setImmediate(arguments[arguments.length - 1])
}
var multiDDrive = require('./')

test('dDrive = multiDDrive', function (t) {
  t.test('should assert input types', function (t) {
    t.plan(3)
    t.throws(multiDDrive.bind(null), /object/)
    t.throws(multiDDrive.bind(null, {}), /function/)
    t.throws(multiDDrive.bind(null, {}, noop), /function/)
  })
  t.end()
})

test('dDrive.create', function (t) {
  t.test('should create an vault', function (t) {
    t.plan(6)

    var store = toilet('state.json')
    multiDDrive(store, createVault, noopCb, function (err, dDrive) {
      t.ifError(err, 'no err')
      t.equal(typeof dDrive, 'object', 'dDrive was returned')
      dDrive.create(null, function (err, vault) {
        t.ifError(err, 'no err')
        t.equal(typeof vault, 'object', 'vault was created')
        t.ok(Buffer.isBuffer(vault.metadata.key), 'vault has a key')
        dDrive.disconnect(function (err) {
          t.error(err)
        })
      })
    })

    function createVault (data, done) {
      var db = memdb()
      var dDrive = ddrive(db)
      var vault = dDrive.createVault()
      done(null, vault)
    }
  })

  t.test('should recreate vaults', function (t) {
    t.plan(6)
    flushToilet()
    var store = toilet('state.json')
    multiDDrive(store, createVault, noopCb, function (err, dDrive) {
      t.ifError(err, 'no err')

      dDrive.create({ hello: 'world' }, function (err, vault) {
        t.ifError(err, 'no err')

        dDrive.disconnect(function (err) {
          t.error(err)
          var newStore = toilet('state.json')
          multiDDrive(newStore, createVault, noopCb, function (err, dDrive) {
            t.ifError(err, 'no err')
            var dDrives = dDrive.list()
            t.equal(dDrives.length, 1, 'one dDrive on init')
            dDrive.disconnect(function (err) {
              t.error(err)
            })
          })
        })
      })
    })

    function createVault (data, done) {
      var db = memdb()
      var dDrive = ddrive(db)
      var vault = dDrive.createVault()
      done(null, vault)
    }
  })

  t.test('should noop on duplicates', function (t) {
    t.plan(6)
    flushToilet()
    var store = toilet('state.json')
    var db = memdb()
    var dDrive = ddrive(db)
    multiDDrive(store, createVault, noopCb, function (err, dDrive) {
      t.ifError(err, 'no err')

      dDrive.create({ hello: 'world' }, function (err, vault) {
        t.ifError(err, 'no err')

        dDrive.create({ key: vault.key }, function (err, _vault, duplicate) {
          t.ifError(err, 'no err')
          t.equal(_vault, vault)
          t.equal(duplicate, true)
        })
        dDrive.disconnect(function (err) {
          t.error(err)
        })
      })
    })

    function createVault (data, done) {
      var vault = dDrive.createVault({ key: data.key })
      done(null, vault)
    }
  })

  t.test('should properly compare different key types', function (t) {
    t.plan(6)
    flushToilet()
    var store = toilet('state.json')
    var db = memdb()
    var dDrive = ddrive(db)
    multiDDrive(store, createVault, noopCb, function (err, dDrive) {
      t.ifError(err, 'no err')

      dDrive.create({ hello: 'world' }, function (err, vault) {
        t.ifError(err, 'no err')

        dDrive.create({ key: vault.key }, function (err, _vault, duplicate) {
          t.ifError(err, 'no err')
          t.equal(_vault, vault)
          t.equal(duplicate, true)
          dDrive.disconnect(function (err) {
            t.error(err)
          })
        })
      })
    })

    function createVault (data, done) {
      var vault = dDrive.createVault({ key: data.key })
      if (data.key) vault.key = Buffer(vault.key)
      done(null, vault)
    }
  })
  t.end()
})

test('dDrive.list', function (t) {
  t.test('should list vaults', function (t) {
    t.plan(4)
    flushToilet()

    var store = toilet('state.json')
    multiDDrive(store, createVault, noopCb, function (err, dDrive) {
      t.ifError(err, 'no err')
      dDrive.create(null, function (err, vault) {
        t.ifError(err, 'no err')
        var dDrives = dDrive.list()
        t.equal(dDrives.length, 1, 'one dDrive')
        dDrive.disconnect(function (err) {
          t.error(err)
        })
      })
    })

    function createVault (data, done) {
      var db = memdb()
      var dDrive = ddrive(db)
      var vault = dDrive.createVault()
      done(null, vault)
    }
  })

  t.test('should not fail on initial vault creation errors', function (t) {
    t.plan(9)
    flushToilet()

    var store = toilet('state.json')
    var createVault = function (data, done) {
      var db = memdb()
      var dDrive = ddrive(db)
      var vault = dDrive.createVault()
      done(null, vault)
    }
    multiDDrive(store, createVault, noopCb, function (err, dDrive) {
      t.ifError(err, 'no err')
      dDrive.create({ some: 'data' }, function (err, vault) {
        t.ifError(err, 'no err')
        var createVault = function (data, done) {
          done(Error('not today'))
        }
        dDrive.disconnect(function (err) {
          t.error(err)
          multiDDrive(store, createVault, noopCb, function (err, dDrive) {
            t.ifError(err, 'no err')
            var dDrives = dDrive.list()
            t.equal(dDrives.length, 1, 'one dDrive')
            t.ok(dDrives[0] instanceof Error)
            t.equal(dDrives[0].data.some, 'data')
            t.equal(dDrives[0].data.key, vault.key.toString('hex'))
            dDrive.disconnect(function (err) {
              t.error(err)
            })
          })
        })
      })
    })
  })
  t.end()
})

test('dDrive.close', function (t) {
  t.test('close an vault', function (t) {
    t.plan(5)
    flushToilet()

    var store = toilet('state.json')
    multiDDrive(store, createVault, closeVault, function (err, dDrive) {
      t.ifError(err, 'no err')
      dDrive.create(null, function (err, vault) {
        t.ifError(err, 'no err')
        dDrive.close(vault.key, function (err) {
          t.ifError(err, 'no err')
          var dDrives = dDrive.list()
          t.equal(dDrives.length, 0, 'no dDrives left')
          dDrive.disconnect(function (err) {
            t.error(err)
          })
        })
      })
    })

    function createVault (data, done) {
      var db = memdb()
      var dDrive = ddrive(db)
      var vault = dDrive.createVault()
      done(null, vault)
    }

    function closeVault (vault, done) {
      vault.close()
      done()
    }
  })

  t.test('close an vault instanceof Error', function (t) {
    t.plan(7)
    flushToilet()

    var store = toilet('state.json')
    multiDDrive(store, createVault, closeVault, function (err, dDrive) {
      t.ifError(err, 'no err')
      dDrive.create({}, function (err, vault) {
        t.ifError(err, 'no err')
        var createVault = function (data, done) {
          done(Error('not today'))
        }
        dDrive.disconnect(function (err) {
          t.error(err)
          multiDDrive(store, createVault, noopCb, function (err, dDrive) {
            t.ifError(err, 'no err')
            var errDPack = dDrive.list()[0]
            dDrive.close(errDPack.data.key, function (err) {
              t.ifError(err, 'no err')
              var dDrives = dDrive.list()
              t.equal(dDrives.length, 0, 'no dDrives left')
              dDrive.disconnect(function (err) {
                t.error(err)
              })
            })
          })
        })
      })
    })

    function createVault (data, done) {
      var db = memdb()
      var dDrive = ddrive(db)
      var vault = dDrive.createVault()
      done(null, vault)
    }

    function closeVault (vault, done) {
      vault.close()
      done()
    }
  })
  t.end()
})

test('dDrive.disconnect', function (t) {
  t.test('create and disconnect without vaults created', function (t) {
    t.plan(2)
    flushToilet()
    var store = toilet('state.json')
    multiDDrive(store, noop, noop, function (err, dDrive) {
      t.error(err)
      dDrive.disconnect(function (err) {
        t.error(err)
      })
    })
  })
  t.test('errors after disconnection', function (t) {
    t.plan(6)
    flushToilet()
    var store = toilet('state.json')
    multiDDrive(store, noop, noop, function (err, dDrive) {
      t.error(err)
      dDrive.disconnect(function (err) {
        t.error(err)
        t.equals(dDrive.list().length, 0)
        dDrive.create(null, function (err) {
          t.equals(err.message, 'disconnected')
          dDrive.close(null, function (err) {
            t.equals(err.message, 'disconnected')
            dDrive.disconnect(function (err) {
              t.equals(err.message, 'disconnected')
            })
          })
        })
      })
    })
  })
  t.test('disconnecting closes vaults', function (t) {
    t.plan(4)
    flushToilet()
    var store = toilet('state.json')
    multiDDrive(store, createVault, closeVault, function (err, dDrive) {
      t.error(err)
      dDrive.create(null, function (err, vault) {
        t.error(err)
        dDrive.disconnect(function (err) {
          t.error(err)
          t.ok(vault._closed)
        })
      })
    })

    function createVault (data, done) {
      var db = memdb()
      var dDrive = ddrive(db)
      var vault = dDrive.createVault()
      done(null, vault)
    }

    function closeVault (vault, done) {
      vault.close()
      done()
    }
  })
  t.test('disconnecting closes vaults and passes through errors', function (t) {
    t.plan(3)
    flushToilet()
    var store = toilet('state.json')
    multiDDrive(store, createVault, closeVault, function (err, dDrive) {
      t.error(err)
      dDrive.create({key: 'x'}, function (err, vault) {
        t.error(err)
        dDrive.disconnect(function (err) {
          t.equals(err.message, 'test-error')
        })
      })
    })

    function createVault (data, done) {
      done(null, data)
    }

    function closeVault (vault, done) {
      done(new Error('test-error'))
    }
  })
  t.end()
})

test('cleanup toilet', function (t) {
  flushToilet()
  t.ok(true, 'flushed toilet')
  process.nextTick(t.end)
})
