/**
 * Created by alex on 2017/6/21.
 */
const qiniu = require('qiniu')
const inquirer = require('inquirer')

class QiniuWebpackPlugin {
    constructor(options) {
        if (!options || !options.ACCESS_KEY || !options.SECRET_KEY) {
            throw new Error("ACCESS_KEY,SECRET_KEY,bucket and domain isn't allow empty")
        }
        if (options.domain.slice(-1) !== '/') options.domain += '/'
        this.options = Object.assign({
            afterDays: 30,
            refreshUrls: ['index.html'],
            excludes: ['.gz', '.map']
        }, options)
    }

    apply(compiler) {
        compiler.plugin('after-emit', (compilation, callback) => {
            const { assets } = compilation
            const { bucket, refreshUrls, afterDays, excludes, domain, ACCESS_KEY, SECRET_KEY } = this.options
            const promises = []
            const mac = new qiniu.auth.digest.Mac(ACCESS_KEY, SECRET_KEY)
            const config = new qiniu.conf.Config()
            config.zone = qiniu.zone.Zone_z0
            const bucketManager = new qiniu.rs.BucketManager(mac, config)
            const cdnManager = new qiniu.cdn.CdnManager(mac)
            const files = Object.keys(assets)
                .filter((filename) => {
                    return assets[filename].emitted && excludes.every((exclude) => {
                        return filename.slice(-exclude.length) !== exclude
                    })
                })
                .map((filename) => {
                    const options = {
                        scope: bucket
                    }
                    const putPolicy = new qiniu.rs.PutPolicy(options)
                    const uploadToken = putPolicy.uploadToken(mac)
                    const formUploader = new qiniu.form_up.FormUploader(config)
                    const putExtra = new qiniu.form_up.PutExtra()
                    const promise = new Promise((resolve, reject) => {
                        formUploader.putFile(uploadToken, filename, assets[filename].existsAt, putExtra, function(err, ret) {
                            if (!err) {
                                // 上传成功，处理返回值
                                resolve(ret)
                            } else {
                                // 上传失败，处理返回代码
                                console.log(err)
                                reject(err)
                            }
                        })
                    })
                    promises.push(promise)
                    return filename
                })
            Promise
                .all(promises)
                .then((res) => {
                    callback()
                    const questions = [{
                            type: 'confirm',
                            name: 'refreshUrl',
                            message: '是否刷新缓存?',
                            default: true
                        },
                        {
                            type: 'confirm',
                            name: 'prefetchUrl',
                            message: '是否预取 js css image ?',
                            default: false
                        },
                        {
                            type: 'confirm',
                            name: 'delExpired',
                            message: '是否删除过期文件?',
                            default: false
                        }
                    ]
                    inquirer.prompt(questions).then(function(answers) {
                        if (answers.refreshUrl) {
                            cdnManager.refreshUrls(
                                refreshUrls.map((url) => {
                                    return domain + url
                                }).concat(domain)
                            )
                            console.log(refreshUrls.reduce((sum, url) => {
                                return sum + `${url} `
                            }) + '刷新成功')
                        }
                        if (answers.prefetchUrl) {
                            cdnManager.prefetchUrls(
                                files.map((filename) => {
                                    return domain + filename
                                })
                            )
                            console.log('预取 js css image 成功')
                        }
                        if (answers.delExpired) {
                            bucketManager.listPrefix(bucket, false, false, false, false, (err, result, res) => {
                                if (err) {
                                    console.log(err)
                                    return
                                }
                                for (var i = 0; i < result.items.length; i++) {
                                    const obj = result.items[i]
                                    if (refreshUrls.some((url) => {
                                            return obj.key === url
                                        })) continue
                                    bucketManager.deleteAfterDays(bucket, obj.key, afterDays, (err, result) => {
                                        if (err) {
                                            console.log(err)
                                        }
                                    })
                                }
                            })
                            console.log('过期文件删除成功')
                        }
                    })
                })
                .catch((e) => {
                    callback(e)
                })
        })
    }
}

module.exports = QiniuWebpackPlugin