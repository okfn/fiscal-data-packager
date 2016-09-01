'use strict';

var _ = require('lodash');
var Promise = require('bluebird');
var datapackageValidate = require('datapackage-validate').validate;
var registry = require('datapackage-registry');
var OSTypes = require('os-types');
var utils = require('./utils');
var url = require('url');
require('isomorphic-fetch');

module.exports.createResourceFromSource = function(urlOrFile) {
  return utils.getCsvSchema(urlOrFile).then(function(data) {
    var resourceName = null;
    var source = {};
    if (_.isObject(urlOrFile)) {
      source.fileName = urlOrFile.name;
      source.mimeType = urlOrFile.type;
      source.size = urlOrFile.size;
      resourceName = utils.createNameFromPath(urlOrFile.name);
    } else {
      source.url = utils.undecorateProxyUrl(urlOrFile);
      resourceName = utils.createNameFromUrl(urlOrFile);
    }

    var dataColumns = _.unzip(data.rows || []);

    var resource = {
      name: resourceName,
      title: resourceName,
      source: source,
      encoding: urlOrFile.encoding,
      data: {
        headers: data.headers,
        rows: data.rows,
        raw: data.raw
      },
      dialect: {
        csvddfVersion: 1.0,
        delimiter: data.dialect.delimiter,
        lineTerminator: data.dialect.linebreak
      },
      fields: _.map(data.schema.fields, function(field, index) {
        var _field = {};
        _field.type = '';
        _field.name = field.name;
        _field.title = field.name;
        _field.data = _.slice(dataColumns[index], 0, 3)
        return _field;
      })
    };
    return resource;
  });
};

module.exports.getFiscalDataPackageSchema = function(useProxy) {
  return 'fiscal';
};

module.exports.validateDataPackage = function(dataPackage, schema) {
  return new Promise(function(resolve, reject) {
    resolve(datapackageValidate(dataPackage, schema));
  });
};

module.exports.createFiscalDataPackage = function(attributes, resources) {
  // Use OSTypes to generate FDP
  var fields = resources[0].fields; //TODO: Add support for more than one resource once OSTypes supports it
  _.forEach(fields, function(field) {
    delete field.errors;
    delete field.additionalOptions;
    delete field.slug;
  });
  var fdp = new OSTypes().fieldsToModel(fields);

  // Package metadata
  _.extend(fdp, utils.removeEmptyAttributes(attributes));

  // Resources
  fdp.resources = _.map(resources, function(resource) {
    var result = {};
    result.name = resource.name;
    result.format = 'csv';
    if (resource.source.url) {
      result.url = resource.source.url;
    } else {
      result.path = resource.source.fileName || resource.name + '.csv';
    }
    if (resource.source.mimeType) {
      result.mediatype = resource.source.mimeType;
    }
    if (resource.source.size) {
      result.bytes = resource.source.size;
    }
    if (resource.dialect) {
      result.dialect = _.clone(resource.dialect);
    }
    if (resource.encoding) {
      result.encoding = resource.encoding;
    }
    result.schema = fdp.schema;
    result.schema.fields = _.map(
      _.values(result.schema.fields),
      function(field) {
        return _.omit(field, 'options');
      }
    );
    delete fdp.schema;
    return result;
  });

  // JSON-LD
  fdp['@context'] = 'http://schemas.frictionlessdata.io/fiscal-data-package.jsonld';

  return fdp;
};

function convertResource(resource, dataPackage, dataPackageUrl) {
  var resourceUrl = resource.url || url.resolve(dataPackageUrl, resource.path);
  return module.exports.createResourceFromSource(resourceUrl)
    .then(function(result) {
      // Copy some properties from original resource
      // to keep them when re-assembling datapackage.json
      result.name = resource.name;
      result.dialect = resource.dialect;
      result.encoding = resource.encoding;
      result.source.url = resource.url;
      result.source.fileName = resource.path;
      result.source.mimeType = resource.mediatype;
      result.source.size = resource.bytes;
      _.each(result.fields, function(field, index) {
        var originalField = resource.schema.fields[index];
        field.name = originalField.name;
        field.title = originalField.title;
        field.slug = originalField.slug;
        field.type = originalField.osType;
        var measure = _.find(dataPackage.model.measures, function(item) {
          return item.source == field.name;
        });
        if (measure) {
          var excludeFields = ['resource', 'source', 'title'];
          field.options = _.chain(measure)
            .map(function(value, key) {
              if (excludeFields.indexOf(key) == -1) {
                return [key, value];
              }
            })
            .filter()
            .fromPairs()
            .value();
        }
      });
      return result;
    });
}

module.exports.loadFiscalDataPackage = function(dataPackageUrl) {
  var result = {
    attributes: {},
    resources: []
  };
  return fetch(dataPackageUrl)
    .then(function(response) {
      if (response.status != 200) {
        throw 'Failed to load data from ' + response.url;
      }
      return response.json();
    })
    .then(function(dataPackage) {
      console.log(dataPackage);
      // TODO: Check `dataPackage.owner` - user can edit only own files
      var exceptFields = ['resources', 'model', '@context'];
      _.each(dataPackage, function(value, key) {
        if (exceptFields.indexOf(key) == -1) {
          result.attributes[key] = value;
        }
      });
      var promises = _.map(dataPackage.resources, function(resource) {
        return convertResource(resource, dataPackage, dataPackageUrl);
      });
      return Promise.all(promises);
    })
    .then(function(resources) {
      result.resources = resources;
    })
    .then(function() {
      return result;
    })
};
