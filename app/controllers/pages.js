'use strict';

var services = require('../services');
var _ = require('lodash');

function getBasePath(config) {
  var result = config.get('basePath');
  if (_.isUndefined(result) || _.isNull(result) || (result == '')) {
    return '';
  }
  result = '' + result;
  if (result[0] != '/') {
    result = '/' + result;
  }
  if (result.substr(-1, 1) == '/') {
    result = result.substr(0, result.length - 1);
  }
  return result;
}

module.exports.main = function(req, res) {
  var config = req.app.get('config');
  var basePath = getBasePath(config);

  res.render('pages/main.html', {
    frontendOptions: config.get('frontend'),
    basePath: basePath,
    title: 'Create a Fiscal Data Package'
  });
};

module.exports.redirectToMain = function(req, res) {
  var config = req.app.get('config');
  var basePath = getBasePath(config);

  var steps = require('../services').data.steps;
  var firstStep = _.first(steps);

  var url = basePath + firstStep.route;
  var query = _.chain(req.query)
    .map(function(value, key) {
      return key + '=' + encodeURIComponent(value);
    })
    .join('&')
    .value();
  if (query) {
    url = url + '?' + query;
  }

  res.redirect(302, url);
};

module.exports.landing = function(req, res) {
  var config = req.app.get('config');
  var basePath = getBasePath(config);
  var firstStep = _.first(services.data.steps);

  res.render('pages/landing.html', {
    frontendOptions: config.get('frontend'),
    basePath: basePath,
    title: 'OS Packager',
    getStartedUrl: basePath + firstStep.route
  });
};

module.exports.loggedIn = function(req, res) {
  var config = req.app.get('config');
  var basePath = getBasePath(config);

  res.render('pages/logged-in.html', {
    frontendOptions: config.get('frontend'),
    basePath: basePath,
    title: 'OS Packager'
  });
};

module.exports.templates = function(req, res) {
  var path = req.params[0];
  res.render('partials/' + path);
};
