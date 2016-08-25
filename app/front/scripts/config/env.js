'use strict';

var services = require('../../../services');

var config = {
  defaultErrorHandler: function(error) {
    if (console.trace) {
      return console.trace(error);
    } else
    if (console.log) {
      return console.log(error);
    }
  },
  defaultPackageFileName: 'datapackage.json',
  events: {
    CONCEPTS_CHANGED: 'package.conceptsChanged'
  },
  storage: {
    collection: 'appstate',
    key: 'default'
  },
  steps: services.data.steps,
  isWizard: window.isWizard
};

angular.module('Application')
  .constant('Configuration', config);
