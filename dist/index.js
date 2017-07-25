'use strict';

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var qiniu = require('qiniu');
var inquirer = require('inquirer');

var QiniuWebpackPlugin = function () {
    function QiniuWebpackPlugin(options) {
        (0, _classCallCheck3.default)(this, QiniuWebpackPlugin);

        if (!options || !options.ACCESS_KEY || !options.SECRET_KEY) {
            throw new Error("ACCESS_KEY,SECRET_KEY,bucket and domain isn't allow empty");
        }
        if (options.domain.slice(-1) !== '/') options.domain += '/';
        this.options = (0, _assign2.default)({
            afterDays: 30,
            refreshUrls: ['index.html'],
            excludes: ['.gz', '.map']
        }, options);
    }

    (0, _createClass3.default)(QiniuWebpackPlugin, [{
        key: 'apply',
        value: function apply(compiler) {
            var _this = this;

            compiler.plugin('after-emit', function (compilation, callback) {
                var assets = compilation.assets;
                var _options = _this.options,
                    bucket = _options.bucket,
                    refreshUrls = _options.refreshUrls,
                    afterDays = _options.afterDays,
                    excludes = _options.excludes,
                    domain = _options.domain,
                    ACCESS_KEY = _options.ACCESS_KEY,
                    SECRET_KEY = _options.SECRET_KEY;

                var promises = [];
                var mac = new qiniu.auth.digest.Mac(ACCESS_KEY, SECRET_KEY);
                var config = new qiniu.conf.Config();
                config.zone = qiniu.zone.Zone_z0;
                var bucketManager = new qiniu.rs.BucketManager(mac, config);
                var cdnManager = new qiniu.cdn.CdnManager(mac);
                var files = (0, _keys2.default)(assets).filter(function (filename) {
                    return assets[filename].emitted && excludes.every(function (exclude) {
                        return filename.slice(-exclude.length) !== exclude;
                    });
                }).map(function (filename) {
                    var options = {
                        scope: bucket
                    };
                    var putPolicy = new qiniu.rs.PutPolicy(options);
                    var uploadToken = putPolicy.uploadToken(mac);
                    var formUploader = new qiniu.form_up.FormUploader(config);
                    var putExtra = new qiniu.form_up.PutExtra();
                    var promise = new _promise2.default(function (resolve, reject) {
                        formUploader.putFile(uploadToken, filename, assets[filename].existsAt, putExtra, function (err, ret) {
                            if (!err) {
                                resolve(ret);
                            } else {
                                console.log(err);
                                reject(err);
                            }
                        });
                    });
                    promises.push(promise);
                    return filename;
                });
                _promise2.default.all(promises).then(function (res) {
                    callback();
                    var questions = [{
                        type: 'confirm',
                        name: 'refreshUrl',
                        message: '是否刷新缓存?',
                        default: true
                    }, {
                        type: 'confirm',
                        name: 'prefetchUrl',
                        message: '是否预取 js css image ?',
                        default: false
                    }, {
                        type: 'confirm',
                        name: 'delExpired',
                        message: '是否删除过期文件?',
                        default: false
                    }];
                    inquirer.prompt(questions).then(function (answers) {
                        if (answers.refreshUrl) {
                            cdnManager.refreshUrls(refreshUrls.map(function (url) {
                                return domain + url;
                            }).concat(domain));
                            console.log(refreshUrls.reduce(function (sum, url) {
                                return sum + (url + ' ');
                            }) + '刷新成功');
                        }
                        if (answers.prefetchUrl) {
                            cdnManager.prefetchUrls(files.map(function (filename) {
                                return domain + filename;
                            }));
                            console.log('预取 js css image 成功');
                        }
                        if (answers.delExpired) {
                            bucketManager.listPrefix(bucket, false, false, false, false, function (err, result, res) {
                                if (err) {
                                    console.log(err);
                                    return;
                                }

                                var _loop = function _loop() {
                                    var obj = result.items[i];
                                    if (refreshUrls.some(function (url) {
                                        return obj.key === url;
                                    })) return 'continue';
                                    bucketManager.deleteAfterDays(bucket, obj.key, afterDays, function (err, result) {
                                        if (err) {
                                            console.log(err);
                                        }
                                    });
                                };

                                for (var i = 0; i < result.items.length; i++) {
                                    var _ret = _loop();

                                    if (_ret === 'continue') continue;
                                }
                            });
                            console.log('过期文件删除成功');
                        }
                    });
                }).catch(function (e) {
                    callback(e);
                });
            });
        }
    }]);
    return QiniuWebpackPlugin;
}();

module.exports = QiniuWebpackPlugin;