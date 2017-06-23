/**
 * Created by alex on 2017/6/21.
 */
const qiniu = require('./qiniu')
const inquirer = require('inquirer')

class QiniuWebpackPlugin {
  constructor (options) {
    if (!options || !options.ACCESS_KEY || !options.SECRET_KEY) {
      throw new Error('ACCESS_KEY,SECRET_KEY,bucket and domain isn\'t allow empty')
    }
    if (options.domain.slice(-1) !== '/') options.domain += '/'
    this.options = Object.assign({
      afterDays: 30,
      refreshUrls: ['index.html'],
      excludes: ['.gz', '.map']
    }, options)
    qiniu.conf.ACCESS_KEY = this.options.ACCESS_KEY
    qiniu.conf.SECRET_KEY = this.options.SECRET_KEY
  }

  apply (compiler) {
    compiler.plugin('after-emit', (compilation, callback) => {
      const {assets} = compilation
      const {bucket, refreshUrls, afterDays, excludes, domain} = this.options
      const promises = []

      const files = Object.keys(assets)
        .filter((filename) => {
          return assets[filename].emitted && excludes.every((exclude) => { return filename.slice(-exclude.length) !== exclude })
        })
        .map((filename) => {
          const putPolicy = new qiniu.rs.PutPolicy(`${bucket}:${filename}`)
          const token = putPolicy.token()
          const extra = new qiniu.io.PutExtra()

          const promise = new Promise((resolve, reject) => {
            qiniu.io.putFile(token, filename, assets[filename].existsAt, extra, function (err, ret) {
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
          const questions = [
            {
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
          inquirer.prompt(questions).then(function (answers) {
            if (answers.refreshUrl) {
              qiniu.cdn.refreshUrls(
                refreshUrls.map((url) => {
                  return domain + url
                }).concat(domain)
              )
              console.log(refreshUrls.reduce((sum, url) => { return sum + `${url} ` }) + '刷新成功')
            }
            if (answers.prefetchUrl) {
              qiniu.cdn.prefetchUrls(
                files.map((filename) => {
                  return domain + filename
                })
              )
              console.log('预取 js css image 成功')
            }
            if (answers.delExpired) {
              qiniu.rsf.listPrefix(bucket, false, false, false, false, (err, result, res) => {
                if (err) {
                  console.log(err)
                  return
                }
                const client = new qiniu.rs.Client()
                for (var i = 0; i < result.items.length; i++) {
                  const obj = result.items[i]
                  if (refreshUrls.some((url) => { return obj.key === url })) continue
                  client.deleteAfterDays(bucket, obj.key, afterDays, (err, result) => {
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
