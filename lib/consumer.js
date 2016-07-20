const tools = require('./tools.js');
var ProtoBuf = require("protobufjs");
var Promise = require('es6-promise').Promise;
var async = require('async');

var builder = ProtoBuf.loadJson(require('../registrant.proto.json'));
var schema = builder.build("Registrant");

function Consumer (provider, registryAddress, registrarAddress) {
  this.registry = provider.getRegistry(registryAddress);
  this.registrar = provider.getRegistrar(registrarAddress);
  this.registrarAddress = registrarAddress;
  this.registryAddress = registryAddress;
  this.web3 = provider.getWeb3();
  this.address = provider.getAddress();
}

Consumer.prototype.getCA = function () {
  var self = this;
  return new Promise(function (fulfill, reject) {
    self.registrar.certificationAuthority.call({from: self.address}, function(err, data) {
      if (err) {
        console.error(err);
        reject(err);
        return;
      }
      fulfill(data);
    });
  });
}

Consumer.prototype.decodeRegistrant = function (registrantData) {
  return schema.Registrant.decodeHex(registrantData);
}

Consumer.prototype.getRegistrarAddressOnRegistry = function () {
  var self = this;
  return new Promise(function (fulfill, reject) {
    self.registry.registrarAddress.call({}, {from: self.address}, function(err, data) {
      if (err) {
        console.error(err);
        reject(err);
        return;
      }
      fulfill(data);
    });
  });
}

Consumer.prototype.getThing = function (identity) {
  var self = this;
  return new Promise(function (fulfill, reject) {
    self.registry.getThing.call(identity, {from: self.address}, function(err, data) {
      if (err) {
        console.error(err);
        reject(err);
        return;
      }
      var schema = data[0];
      var dataSlices = data[1];
      var isValid = data[2];
      if (!isValid) {
        reject('Error: record marked as invalid.');
      }
      var builder = ProtoBuf.loadJson(ProtoBuf.DotProto.Parser.parse(schema.split(';#;')[2]));
      var Thing = builder.build("Thing");
      var merged = tools.merge(dataSlices);
      var decoded = "";
      try{
          decoded = Thing.decodeHex(merged.replace('0x',''));
      } catch (e){
          decoded = Thing.decodeHex(merged.replace('0x','').slice(0, -2));
      }
      fulfill(decoded);
    });
  });
}

Consumer.prototype.getRegistrant = function (address) {
  var self = this;
  return new Promise(function (fulfill, reject) {
    self.registrar.registrantIndex.call(address, {from: self.address}, function(err, index) {
      if (err) {
        console.error(err);
        reject(err);
        return;
      }
      self.registrar.registrants.call(index, {from: self.address}, function(err, data) {
        if (err) {
          console.error(err);
          reject(err);
          return;
        }
        var decoded = "";
        decoded = schema.Registrant.decodeHex(data[1]);
        fulfill(decoded);
      });
    });
  });
}

Consumer.prototype.getErrors = function (finalCallback) {
    var self = this;
    async.parallel([
        function(callback){
            self.registry.Error({}, { fromBlock: 0 }).get(function (err, errors) {
    			if (err)
                    callback(err)
    			else
    			    callback(null, errors);
    		});
        },
        function(callback){
            self.registrar.Error({}, { fromBlock: 0 }).get(function (err, errors) {
    			if (err)
                    callback(err)
    			else
    			    callback(null, errors);
    		});
        }
    ], function(err, results){
        if (err)
            console.error(err);
        else
            finalCallback(results);
    })
};


Consumer.prototype.getSchema = function (index) {
  var self = this;
  return new Promise(function (fulfill, reject) {
      self.registry.schemas.call(index,{from: self.address}, function(error, proto) {
        if (error) {
          console.error(error);
          reject(error);
          return;
      }
      fulfill(proto);
    });
  });
}

Consumer.prototype.getSchemas = function () {
  var self = this;
  return new Promise(function (fulfill, reject) {
      self.registry.getSchemasLenght.call({from: self.address}, function(error, data) {
        if (error) {
          console.error(error)
          reject(error);
          return;
      }
      fulfill(data);
    });
  });
}

Consumer.prototype.getThings = function (onlyActives, fromBlock, finalCallback) {
    var self = this;
    if (!fromBlock)
        fromBlock = 1;
    async.parallel([
        function(callback){
            self.registry.Creation({}, { fromBlock: fromBlock }).get(function (err, creations) {
    			if (err)
                    callback(err)
    			else
    			    callback(null, creations);
    		});
        },
        function(callback){
            self.registry.Update({}, { fromBlock: fromBlock }).get(function (err, alternations) {
    			if (err)
                    callback(err)
    			else
    			    callback(null, alternations);
    		});
        }
    ], function(err, results){
        if (err)
            console.error(err);
        else{
            if (onlyActives){
                let actives = [];
                for (var i = 0; i < results[0].length; i++)
                    actives[results[0][i].args.registrant] = results[0][i];
                for (var i = 0; i < results[1].length; i++) {
                    if (!results[1][i].args.isActive && actives[results[1][i].args.registrant]){
                        delete actives[results[1][i].args.registrant];
                    } else if (results[1][i].args.isActive && !actives[results[1][i].args.registrant]){
                        actives[results[1][i].args.registrant] = results[1][i];
                    }
                }
                for (var i = 0; i < results[0].length; i++) {
                    if (!actives[results[0][i].args.registrant]){
                        results[0].splice(i,1);
                        i --;
                    }
                }
            }
            finalCallback(results[0]);
        }
    })
};

Consumer.prototype.getRegistrantbyIndex = function (index) {
  var self = this;
  return new Promise(function (fulfill, reject) {
      self.registrar.registrants.call(index, function(error, data) {
        if (error) {
          console.error(err);
          reject(error);
          return;
      }
      fulfill(data);
    });
  });
}

Consumer.prototype.getRegistrants = function (onlyActives, fromBlock, finalCallback) {
    var self = this;
    if (!fromBlock)
        fromBlock = 1;
    async.parallel([
        function(callback){
            self.registrar.Creation({}, { fromBlock: fromBlock }).get(function (err, creations) {
    			if (err)
                    callback(err)
    			else
    			    callback(null, creations);
    		});
        },
        function(callback){
            self.registrar.Update({}, { fromBlock: fromBlock }).get(function (err, alternations) {
    			if (err)
                    callback(err)
    			else
    			    callback(null, alternations);
    		});
        }
    ], function(err, results){
        if (err)
            console.error(err);
        else{
            if (onlyActives){
                let actives = [];
                for (var i = 0; i < results[0].length; i++)
                    actives[results[0][i].args.registrant] = results[0][i];
                for (var i = 0; i < results[1].length; i++) {
                    if (!results[1][i].args.isActive && actives[results[1][i].args.registrant]){
                        delete actives[results[1][i].args.registrant];
                    } else if (results[1][i].args.isActive && !actives[results[1][i].args.registrant]){
                        actives[results[1][i].args.registrant] = results[1][i];
                    }
                }
                for (var i = 0; i < results[0].length; i++) {
                    if (!actives[results[0][i].args.registrant]){
                        results[0].splice(i,1);
                        i --;
                    }
                }
            }
            finalCallback(results[0]);
        }
    })
};

Consumer.prototype.verifyIdentity = function (message, signature, reference) {
  this.getThing(reference).then(function(decoded){
    console.dir(decoded);
  });
}

module.exports = Consumer;