qiniu-webpack-plugin
====

[![npm version](https://img.shields.io/npm/v/qiniuu-webpack-plugin.svg)](https://www.npmjs.org/package/iniuu-webpack-plugin)

## Documentation
npm
```
npm install qiniuu-webpack-plugin --save-dev
```
yarn
```
yarn add qiniuu-webpack-plugin
```

append to webpack.conf.js
```
if (config.build.deployToQiniu) {
  var QiniuWebpackPlugin = require('qiniuu-webpack-plugin')
  var qiniuPlugin = new QiniuWebpackPlugin({
    ACCESS_KEY: '-FpCM8XR5JvLeXULWp',
    SECRET_KEY: '-5ZHX',
    bucket: 'ber-',
    zone:'Zone_z2',
    domain: 'http://www.google.com/'
  })

  webpackConfig.plugins.push(qiniuPlugin)
}
```
其中关于`Zone`对象和机房的关系如下：

|机房|Zone对象|
|---|-----|
|华东|`Zone_z0`|
|华北|`Zone_z1`|
|华南|`Zone_z2`|
|北美|`Zone_na0`|

[具体见这里](https://github.com/qiniu/nodejs-sdk/blob/7aadf972579bee5d6041b459515673987956cfb7/docs/nodejs-sdk-v7.md)

append to config.js
```
deployToQiniu: process.argv && process.argv[2] === 'deploy'
```
append to package.json scripts

```
"deploy": "node build/build.js deploy",
```

```
npm run deploy
or
yarn run deploy
```

## Contribution

If you find a bug or want to contribute to the code or documentation, you can help by submitting an issue or a pull request.

## License

The MIT License(http://opensource.org/licenses/MIT)

Copyright (c) 2017-present, alex <xalexec@gmail.com>
