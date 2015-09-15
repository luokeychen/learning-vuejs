var Vue = require('vue');

// http://zukan.kids.yahoo.co.jp/animal/kind/mammals/0102.html
new Vue({
  el: '#vue-app',

  data: {
    name: 'ザトウクジラ',
    binomen: 'megaptera novaeangliae',
    location: '世界中の海域',
    description: '尾びれの裏側の多様な模様で個体を識別できる。胸びれは長い。季節にともなって回遊し、アラスカのものは冬は出産と育児のため、ハワイなどの暖かい海へ移動する。オスは繁殖期に「歌」をくりかえし歌う。潮吹きを3～4回した後に潜水する。絶滅が危惧（きぐ）されている。',
    classification: 'クジラ目ナガスクジラ科',
    image: 'http://i.yimg.jp/i/kids/zukan/photo/animal/mammals/0102/400_400.jpg',
    friends: [
      'シロナガスクジラ',
      'ジンベエザメ',
      'マッコウクジラ'
    ]
  },

  methods: {
    makeSounds(e) {
      alert(`${this.name}ァァァァッッーーーー！！！！`);
      e.preventDefault();
    }
  }
});
