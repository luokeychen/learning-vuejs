# learning-vuejs

[Vue.js](http://jp.vuejs.org/guide/index.html)

## 特徴

- プレーンなJavaScript Objectを用いた、極力シンプルにしたAPI設計
- リアクティブなデータバインディング
- コンポーネント化が容易
- 他ライブラリへの依存がなく柔軟かつ軽量（約52KB）
- 学習コストの低さ

## 補足

MVVMフレームワークなので、Routerはありません。
SPAなどでRouterが必要な場合は、[vue-router](https://github.com/vuejs/vue-router)を使用することが推奨されています。

## 概要

- ViewModel (View / Model)
- ディレクティブ
- Mustache バインディング
- フィルタ
- コンポーネント

## ViewModel

```Javascript:ViewModel
var vm = new Vue({ /* options */ });
```

```Javascript
vm.$el
```

```Javascript:Model
vm.$data // The Model

var vm = new Vue({
  data: {
    a: 1
  }
});

vm.$data.a // 1
vm.a // 1
vm.$data.a === vm.a // true
```

### 基礎チュートリアル（ディレクティブ / Mustache バインディング / フィルタ）
`$ git clone https://github.com/30kidz/learning-vuejs.git`

### カーセンサーAPIを使用したチュートリアル（コンポーネント）

`$ git checkout -b carsensor origin/carsensor`
