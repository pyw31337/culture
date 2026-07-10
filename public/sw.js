/**
 * Welcome to your Workbox-powered service worker!
 *
 * You'll need to register this file in your web app and you should
 * disable HTTP caching for this file too.
 * See https://goo.gl/nhQhGp
 *
 * The rest of the code is auto-generated. Please don't update this file
 * directly; instead, make changes to your Workbox build configuration
 * and re-run your build process.
 * See https://goo.gl/2aRDsh
 */

importScripts("https://storage.googleapis.com/workbox-cdn/releases/4.3.1/workbox-sw.js");

importScripts(
  "/culture/_next/precache.S6YrWF1pjGu9x-K8efk-h.97990b70ac9e3fcd95eb2dd83d5ffd74.js"
);

workbox.core.skipWaiting();

workbox.core.clientsClaim();

/**
 * The workboxSW.precacheAndRoute() method efficiently caches and responds to
 * requests for URLs in the manifest.
 * See https://goo.gl/S9QRab
 */
self.__precacheManifest = [
  {
    "url": "/favicon.png",
    "revision": "797993bf1580d6daea2f3d6f69e5d114"
  },
  {
    "url": "/file.svg",
    "revision": "d09f95206c3fa0bb9bd9fefabfd0ea71"
  },
  {
    "url": "/globe.svg",
    "revision": "2aaafa6a49b6563925fe440891e32717"
  },
  {
    "url": "/icon.png",
    "revision": "3120902a640e19cf56d56c49aa1a0047"
  },
  {
    "url": "/images/fallbacks/activity.jpg",
    "revision": "6c1d9e2cd563eb973b8c1291d33d58dd"
  },
  {
    "url": "/images/fallbacks/baseball.jpg",
    "revision": "9db3f04c5e4e132347a3ff0bee87593f"
  },
  {
    "url": "/images/fallbacks/basketball.jpg",
    "revision": "6c1d9e2cd563eb973b8c1291d33d58dd"
  },
  {
    "url": "/images/fallbacks/classic.jpg",
    "revision": "a41ee8fb805b48ad89e6e8a051169cad"
  },
  {
    "url": "/images/fallbacks/exhibition.jpg",
    "revision": "6c1d9e2cd563eb973b8c1291d33d58dd"
  },
  {
    "url": "/images/fallbacks/handball.jpg",
    "revision": "db6129c55493b3861a5a3a48a308383e"
  },
  {
    "url": "/images/fallbacks/movie.svg",
    "revision": "f4ffaca66c5ce06e6ec6d362f1fc317b"
  },
  {
    "url": "/images/fallbacks/museum.jpg",
    "revision": "ca428a72d88e140e6a4acf80cfc60654"
  },
  {
    "url": "/images/fallbacks/soccer_poster.png",
    "revision": "6c1d9e2cd563eb973b8c1291d33d58dd"
  },
  {
    "url": "/images/fallbacks/soccer.jpg",
    "revision": "5914ba5168f597d8543f1c11eb23b480"
  },
  {
    "url": "/images/fallbacks/volleyball.jpg",
    "revision": "6c1d9e2cd563eb973b8c1291d33d58dd"
  },
  {
    "url": "/images/handball_poster.png",
    "revision": "db6129c55493b3861a5a3a48a308383e"
  },
  {
    "url": "/images/hockey_poster.png",
    "revision": "132758c253aeb3295f486042f2025ac7"
  },
  {
    "url": "/images/kbl_poster.png",
    "revision": "9e62613e8545c9b36b0e10dbef4dc4ad"
  },
  {
    "url": "/images/kbo-thumbnail.png",
    "revision": "48845ef4ffb8ed6df577199ee66391e9"
  },
  {
    "url": "/images/logos/handball/busan_official.png",
    "revision": "e1b23f3c83602e8a3dc34a881c456fe6"
  },
  {
    "url": "/images/logos/handball/busan.png",
    "revision": "e1b23f3c83602e8a3dc34a881c456fe6"
  },
  {
    "url": "/images/logos/handball/chungnam_official.png",
    "revision": "047bb524d29ea988c3e756b434446d7c"
  },
  {
    "url": "/images/logos/handball/chungnam.png",
    "revision": "047bb524d29ea988c3e756b434446d7c"
  },
  {
    "url": "/images/logos/handball/chungnam.svg",
    "revision": "69c25f2bca2802a619dfd773140a56b3"
  },
  {
    "url": "/images/logos/handball/daegu_official.png",
    "revision": "2cc29c9e3067082a2edf2a29b8697e41"
  },
  {
    "url": "/images/logos/handball/daegu.png",
    "revision": "2cc29c9e3067082a2edf2a29b8697e41"
  },
  {
    "url": "/images/logos/handball/doosan_official.png",
    "revision": "6905d2c07e330982aa57f8331d7b1946"
  },
  {
    "url": "/images/logos/handball/doosan.png",
    "revision": "6905d2c07e330982aa57f8331d7b1946"
  },
  {
    "url": "/images/logos/handball/doosan.svg",
    "revision": "87f14ddf6478a131f88a27fbe899ad8f"
  },
  {
    "url": "/images/logos/handball/gwangju_official.png",
    "revision": "bd8b9ab5e001e318dca2b94d7de8e3b0"
  },
  {
    "url": "/images/logos/handball/gwangju.png",
    "revision": "bd8b9ab5e001e318dca2b94d7de8e3b0"
  },
  {
    "url": "/images/logos/handball/gyeongnam_official.png",
    "revision": "465f107db00f787636d2f46873853978"
  },
  {
    "url": "/images/logos/handball/gyeongnam.png",
    "revision": "465f107db00f787636d2f46873853978"
  },
  {
    "url": "/images/logos/handball/hanam_official.png",
    "revision": "6d8a620bfbc8ecb10cb78829e797cbac"
  },
  {
    "url": "/images/logos/handball/hanam.png",
    "revision": "6d8a620bfbc8ecb10cb78829e797cbac"
  },
  {
    "url": "/images/logos/handball/hanam.svg",
    "revision": "d5505392fab13563c5cab383191884ab"
  },
  {
    "url": "/images/logos/handball/incheon_city_official.png",
    "revision": "741d49e91d85924041e58c78b5650912"
  },
  {
    "url": "/images/logos/handball/incheon_city.png",
    "revision": "741d49e91d85924041e58c78b5650912"
  },
  {
    "url": "/images/logos/handball/incheon_official.png",
    "revision": "47788a9cd48c4193922b9f023beb8363"
  },
  {
    "url": "/images/logos/handball/incheon.png",
    "revision": "47788a9cd48c4193922b9f023beb8363"
  },
  {
    "url": "/images/logos/handball/samcheok_official.png",
    "revision": "5d71bcc075e757154825efcb221d3637"
  },
  {
    "url": "/images/logos/handball/samcheok.png",
    "revision": "5d71bcc075e757154825efcb221d3637"
  },
  {
    "url": "/images/logos/handball/sangmu_official.png",
    "revision": "ebcd01542e207c0e2e917f084d33e4fc"
  },
  {
    "url": "/images/logos/handball/sangmu.png",
    "revision": "ebcd01542e207c0e2e917f084d33e4fc"
  },
  {
    "url": "/images/logos/handball/sangmu.svg",
    "revision": "848c49d958b45462d4d03b6a5b7e24f9"
  },
  {
    "url": "/images/logos/handball/seoul_official.png",
    "revision": "db9ed4f99b278e7cbe22af60ace765d9"
  },
  {
    "url": "/images/logos/handball/seoul.png",
    "revision": "db9ed4f99b278e7cbe22af60ace765d9"
  },
  {
    "url": "/images/logos/handball/sk_hawks_official.png",
    "revision": "d1dbd88ceeaeae4c51b92b470fcf86df"
  },
  {
    "url": "/images/logos/handball/sk_hawks.png",
    "revision": "d1dbd88ceeaeae4c51b92b470fcf86df"
  },
  {
    "url": "/images/logos/handball/sk_hawks.svg",
    "revision": "842761b0f6ffbb382b82ce44213e049a"
  },
  {
    "url": "/images/logos/handball/sk_sugar_official.png",
    "revision": "a149cfd120b06356d8cd7b80a02fe34e"
  },
  {
    "url": "/images/logos/handball/sk_sugar.png",
    "revision": "a149cfd120b06356d8cd7b80a02fe34e"
  },
  {
    "url": "/images/logos/handball/SK슈가글라이더즈.png",
    "revision": "a149cfd120b06356d8cd7b80a02fe34e"
  },
  {
    "url": "/images/logos/handball/경남개발공사.png",
    "revision": "465f107db00f787636d2f46873853978"
  },
  {
    "url": "/images/logos/handball/광주도시공사.png",
    "revision": "bd8b9ab5e001e318dca2b94d7de8e3b0"
  },
  {
    "url": "/images/logos/handball/대구광역시청.png",
    "revision": "2cc29c9e3067082a2edf2a29b8697e41"
  },
  {
    "url": "/images/logos/handball/부산시설공단.png",
    "revision": "e1b23f3c83602e8a3dc34a881c456fe6"
  },
  {
    "url": "/images/logos/handball/삼척시청.png",
    "revision": "5d71bcc075e757154825efcb221d3637"
  },
  {
    "url": "/images/logos/handball/서울시청.png",
    "revision": "db9ed4f99b278e7cbe22af60ace765d9"
  },
  {
    "url": "/images/logos/handball/인천광역시청.png",
    "revision": "741d49e91d85924041e58c78b5650912"
  },
  {
    "url": "/images/logos/kbl/asia.svg",
    "revision": "2a1c725373ffe0955e8ca7a1e76d7157"
  },
  {
    "url": "/images/logos/kbl/at.svg",
    "revision": "2a1c725373ffe0955e8ca7a1e76d7157"
  },
  {
    "url": "/images/logos/kbl/chiba.svg",
    "revision": "2a1c725373ffe0955e8ca7a1e76d7157"
  },
  {
    "url": "/images/logos/kbl/db_official.svg",
    "revision": "23a031c80b6451d23fd3806a4b5bb5ba"
  },
  {
    "url": "/images/logos/kbl/db.svg",
    "revision": "23a031c80b6451d23fd3806a4b5bb5ba"
  },
  {
    "url": "/images/logos/kbl/gong.svg",
    "revision": "2a1c725373ffe0955e8ca7a1e76d7157"
  },
  {
    "url": "/images/logos/kbl/kcc_official.svg",
    "revision": "37f8113e2ef8d31f737066d795a856e9"
  },
  {
    "url": "/images/logos/kbl/kcc.svg",
    "revision": "37f8113e2ef8d31f737066d795a856e9"
  },
  {
    "url": "/images/logos/kbl/kgc_official.svg",
    "revision": "8a0bebc1621624c38dc196d8d9f54376"
  },
  {
    "url": "/images/logos/kbl/kgc.svg",
    "revision": "8a0bebc1621624c38dc196d8d9f54376"
  },
  {
    "url": "/images/logos/kbl/kogas_official.svg",
    "revision": "feff88cee38718b09df61ecdeea4bc59"
  },
  {
    "url": "/images/logos/kbl/kogas.svg",
    "revision": "feff88cee38718b09df61ecdeea4bc59"
  },
  {
    "url": "/images/logos/kbl/kt_official.svg",
    "revision": "16160f3989f9ee952d7d3a53c09c2fd9"
  },
  {
    "url": "/images/logos/kbl/kt.svg",
    "revision": "16160f3989f9ee952d7d3a53c09c2fd9"
  },
  {
    "url": "/images/logos/kbl/lg_official.svg",
    "revision": "96af3490fbf2010d0bedbb0bab3c6b0b"
  },
  {
    "url": "/images/logos/kbl/lg.svg",
    "revision": "96af3490fbf2010d0bedbb0bab3c6b0b"
  },
  {
    "url": "/images/logos/kbl/mer.svg",
    "revision": "2a1c725373ffe0955e8ca7a1e76d7157"
  },
  {
    "url": "/images/logos/kbl/mobis_official.svg",
    "revision": "ebee68b3f6149f9a64faebd1a0926655"
  },
  {
    "url": "/images/logos/kbl/mobis.svg",
    "revision": "ebee68b3f6149f9a64faebd1a0926655"
  },
  {
    "url": "/images/logos/kbl/mong.svg",
    "revision": "2a1c725373ffe0955e8ca7a1e76d7157"
  },
  {
    "url": "/images/logos/kbl/new.svg",
    "revision": "2a1c725373ffe0955e8ca7a1e76d7157"
  },
  {
    "url": "/images/logos/kbl/rookie.svg",
    "revision": "2a1c725373ffe0955e8ca7a1e76d7157"
  },
  {
    "url": "/images/logos/kbl/ryu.svg",
    "revision": "2a1c725373ffe0955e8ca7a1e76d7157"
  },
  {
    "url": "/images/logos/kbl/samsung_official.svg",
    "revision": "22d137285653d6cb29ddb8de5e221299"
  },
  {
    "url": "/images/logos/kbl/samsung.svg",
    "revision": "22d137285653d6cb29ddb8de5e221299"
  },
  {
    "url": "/images/logos/kbl/sangmu.svg",
    "revision": "766cc378f7f343271b4896fcdd7a96ad"
  },
  {
    "url": "/images/logos/kbl/sk_official.svg",
    "revision": "842761b0f6ffbb382b82ce44213e049a"
  },
  {
    "url": "/images/logos/kbl/sk.svg",
    "revision": "842761b0f6ffbb382b82ce44213e049a"
  },
  {
    "url": "/images/logos/kbl/sono_official.svg",
    "revision": "bfd48485c372e3219ef70081c4d31e67"
  },
  {
    "url": "/images/logos/kbl/sono.svg",
    "revision": "bfd48485c372e3219ef70081c4d31e67"
  },
  {
    "url": "/images/logos/kbl/tfb.svg",
    "revision": "2a1c725373ffe0955e8ca7a1e76d7157"
  },
  {
    "url": "/images/logos/kbl/tps.svg",
    "revision": "2a1c725373ffe0955e8ca7a1e76d7157"
  },
  {
    "url": "/images/logos/kbo/chuncheon_f.png",
    "revision": "e8c8f397f1d58ca19d5c931efdf8615f"
  },
  {
    "url": "/images/logos/kbo/doosan_f.png",
    "revision": "f0b40cfe970dcbcd1bec44c09c1ca7b0"
  },
  {
    "url": "/images/logos/kbo/doosan.svg",
    "revision": "87f14ddf6478a131f88a27fbe899ad8f"
  },
  {
    "url": "/images/logos/kbo/goyang_f.png",
    "revision": "e8c8f397f1d58ca19d5c931efdf8615f"
  },
  {
    "url": "/images/logos/kbo/hanwha_f.png",
    "revision": "861842dd47bb7f4ea44a7f4295f2afb2"
  },
  {
    "url": "/images/logos/kbo/hanwha.svg",
    "revision": "2e6f536956f5be001237833fe4dcafe3"
  },
  {
    "url": "/images/logos/kbo/kia_f.png",
    "revision": "bba2a7342914841ea165d186abd2dde6"
  },
  {
    "url": "/images/logos/kbo/kia.svg",
    "revision": "1808698d7b42ed68c69cbe38cf066ee2"
  },
  {
    "url": "/images/logos/kbo/kiwoom.svg",
    "revision": "581b1a152ee2d5b867c6ddddb8574013"
  },
  {
    "url": "/images/logos/kbo/kt_f.png",
    "revision": "135cae66154eeb6a95fa38b96691d087"
  },
  {
    "url": "/images/logos/kbo/kt.svg",
    "revision": "0c3ab28cd4ae73b4932c7c4ca5390398"
  },
  {
    "url": "/images/logos/kbo/lg_f.png",
    "revision": "b578171a90223532ac6bbf158413f45a"
  },
  {
    "url": "/images/logos/kbo/lg.svg",
    "revision": "62a3a55c250925ba019367549d698572"
  },
  {
    "url": "/images/logos/kbo/lotte_f.png",
    "revision": "facc846a128043736b3d636861913a27"
  },
  {
    "url": "/images/logos/kbo/lotte.svg",
    "revision": "851b81d4185e03c293e3ce04e8479d42"
  },
  {
    "url": "/images/logos/kbo/nc_f.png",
    "revision": "dbb6b32f1afb7773cb2ee76ba6b65ec6"
  },
  {
    "url": "/images/logos/kbo/nc.svg",
    "revision": "b762e5cf444a6ff677341d9eba4bbf37"
  },
  {
    "url": "/images/logos/kbo/samsung_f.png",
    "revision": "dc90855a9b7c2c9a4c0b1364452fc4e2"
  },
  {
    "url": "/images/logos/kbo/samsung.svg",
    "revision": "df7e1eaf1bca87aa30b5e36a5e29af06"
  },
  {
    "url": "/images/logos/kbo/sangmu_f.png",
    "revision": "15e6234b497f73dddee1e96679518615"
  },
  {
    "url": "/images/logos/kbo/ssg_f.png",
    "revision": "33527e267894dff96984cee54691f60b"
  },
  {
    "url": "/images/logos/kbo/ssg.svg",
    "revision": "37ad5cf2e8934df2512caec3b974b12c"
  },
  {
    "url": "/images/logos/kleague/gimhae.webp",
    "revision": "5cf7ccd5b1c2b1185bbe7e39b0fcb5fe"
  },
  {
    "url": "/images/logos/kleague/paju.webp",
    "revision": "8185752f214f977099785f5967bb4f2e"
  },
  {
    "url": "/images/logos/kleague/강원.png",
    "revision": "b9569248cad8f5a7d5474f6a9f687fcb"
  },
  {
    "url": "/images/logos/kleague/경남.png",
    "revision": "6841300e74997c9f0a4c62e2c702ffdc"
  },
  {
    "url": "/images/logos/kleague/광주.png",
    "revision": "2c5f153441b1df052751f5a533b32580"
  },
  {
    "url": "/images/logos/kleague/김천.png",
    "revision": "93f35839b9a93e5b6d8905e3a7bb3f23"
  },
  {
    "url": "/images/logos/kleague/김포.png",
    "revision": "ce18b01cbb88e3e92a6c32a9656c0f13"
  },
  {
    "url": "/images/logos/kleague/김포.svg",
    "revision": "e1db4493afb3c6ae521181b06ddcad08"
  },
  {
    "url": "/images/logos/kleague/김해.png",
    "revision": "0bd79e4ba37630f19b9005b9637a1f46"
  },
  {
    "url": "/images/logos/kleague/김해.svg",
    "revision": "9e1c9c60109e601dee48b33330f8a097"
  },
  {
    "url": "/images/logos/kleague/김해.webp",
    "revision": "5cf7ccd5b1c2b1185bbe7e39b0fcb5fe"
  },
  {
    "url": "/images/logos/kleague/대구.png",
    "revision": "14bc3d1be7fe773ad99871dccbb7693d"
  },
  {
    "url": "/images/logos/kleague/대전.png",
    "revision": "3792fdd5d55da47a7c5a8ae9ec124d5d"
  },
  {
    "url": "/images/logos/kleague/부산.png",
    "revision": "defef1097e21427d8adadbfc6e627611"
  },
  {
    "url": "/images/logos/kleague/부산.svg",
    "revision": "3f57dbb5a7fc13ddc56f48a1b8638b90"
  },
  {
    "url": "/images/logos/kleague/부천.png",
    "revision": "c01eb41e72360a3e125f2e69da588f59"
  },
  {
    "url": "/images/logos/kleague/서울.png",
    "revision": "5e3a5433c2bfb4eb4eca7f7eee5c83a4"
  },
  {
    "url": "/images/logos/kleague/서울E.png",
    "revision": "579165e20ace0ec289336143e5134e9b"
  },
  {
    "url": "/images/logos/kleague/성남.png",
    "revision": "1140d4bd47d12483ba43b21b1aa19a17"
  },
  {
    "url": "/images/logos/kleague/수원.png",
    "revision": "c88840d83da094522cb40dd77f43c64a"
  },
  {
    "url": "/images/logos/kleague/수원FC.png",
    "revision": "2895f340a580d4e08647d4cc981dd8ff"
  },
  {
    "url": "/images/logos/kleague/안산.png",
    "revision": "69ebd1dd5cdb26f0cd4bdfdde19ae29e"
  },
  {
    "url": "/images/logos/kleague/안산.svg",
    "revision": "12875aa5e1079fe809e30d7e4a154d67"
  },
  {
    "url": "/images/logos/kleague/안양.png",
    "revision": "1a679643d0eb5a28cc1e39ba218148e5"
  },
  {
    "url": "/images/logos/kleague/용인.png",
    "revision": "9478328dd2f1ecd62ddd9d2eec7f0f34"
  },
  {
    "url": "/images/logos/kleague/용인.webp",
    "revision": "241778f4b771cb98993ab48622c2a72b"
  },
  {
    "url": "/images/logos/kleague/울산.png",
    "revision": "89821685b8aa5b42cdada1c1e7aaa321"
  },
  {
    "url": "/images/logos/kleague/울산.svg",
    "revision": "235730d3fc4aef9bdf32ee7ed1c8361f"
  },
  {
    "url": "/images/logos/kleague/인천.png",
    "revision": "e1ce95572a08ffa67b435d9cdfba1e1a"
  },
  {
    "url": "/images/logos/kleague/전남.png",
    "revision": "b1ab8cfe64cce8965366c67e4f794330"
  },
  {
    "url": "/images/logos/kleague/전북.png",
    "revision": "e27c42c4cf81d4be5b40ad182612fc6c"
  },
  {
    "url": "/images/logos/kleague/전북.svg",
    "revision": "43839221cbdd791dab4edec67c38a478"
  },
  {
    "url": "/images/logos/kleague/제주.png",
    "revision": "f2c17b4bff671728f749ac1003919e34"
  },
  {
    "url": "/images/logos/kleague/제주.svg",
    "revision": "c5b7642c98d570658f14158837ce3afd"
  },
  {
    "url": "/images/logos/kleague/천안.png",
    "revision": "40cf77d140512ac34b5d2ee160b7ff82"
  },
  {
    "url": "/images/logos/kleague/충남아산.png",
    "revision": "e75a151b97ca8805ebd0e8a0b3e13bcf"
  },
  {
    "url": "/images/logos/kleague/충북청주.png",
    "revision": "e210223d956a2e19a7ff242d7e82a05a"
  },
  {
    "url": "/images/logos/kleague/파주.png",
    "revision": "3a6e0d12d8f1d2284c228f73d0803a06"
  },
  {
    "url": "/images/logos/kleague/파주.webp",
    "revision": "8185752f214f977099785f5967bb4f2e"
  },
  {
    "url": "/images/logos/kleague/포항.png",
    "revision": "41fb9067ad988a5428df42f235a8be34"
  },
  {
    "url": "/images/logos/kleague/화성.png",
    "revision": "a15a53b309fdebebb0222f5fae364b8c"
  },
  {
    "url": "/images/logos/kleague/화성.svg",
    "revision": "7498614f90fda2407dc039eddf85fe45"
  },
  {
    "url": "/images/logos/kovo/aipeppers.svg",
    "revision": "31058a3cdf8503ed77a1eac82431d61a"
  },
  {
    "url": "/images/logos/kovo/altos.svg",
    "revision": "7b4ec58cd96cbb9ab62b845401f47d70"
  },
  {
    "url": "/images/logos/kovo/bluefangs.svg",
    "revision": "df37c3443083b6b646dd45f1e08e6519"
  },
  {
    "url": "/images/logos/kovo/hillstate.svg",
    "revision": "9432c69aef47fa7c71d54e414f48b672"
  },
  {
    "url": "/images/logos/kovo/hipass.svg",
    "revision": "555a19495de418b77c1c46e3a6c4b4d5"
  },
  {
    "url": "/images/logos/kovo/jumbos.svg",
    "revision": "92c7d3bcf8d005a234a2f3472613974f"
  },
  {
    "url": "/images/logos/kovo/kixx.svg",
    "revision": "1554a4aeb8ea8b48cdc2186a0bf07079"
  },
  {
    "url": "/images/logos/kovo/okman.svg",
    "revision": "778f85b269ef74c1ad1421edf4c927a9"
  },
  {
    "url": "/images/logos/kovo/pinkspiders.svg",
    "revision": "76cd878261a9a231e8848f7d743defb7"
  },
  {
    "url": "/images/logos/kovo/redsparks.svg",
    "revision": "6e656eb19f69746abe8462507588a49b"
  },
  {
    "url": "/images/logos/kovo/skywalkers.svg",
    "revision": "f10d5dbcfb28a8fab9712c5c5a5b72ca"
  },
  {
    "url": "/images/logos/kovo/stars.svg",
    "revision": "460d0314ded983571e41e381ed7c3d30"
  },
  {
    "url": "/images/logos/kovo/vixtorm.svg",
    "revision": "2cafaff4be35ffbb306beefdf86dff4f"
  },
  {
    "url": "/images/logos/kovo/wooriwon.svg",
    "revision": "7cd02aaa1b88317196e65ffb4a484a88"
  },
  {
    "url": "/images/og_image.jpg",
    "revision": "3f68ec663ed2824c98fe859455a38628"
  },
  {
    "url": "/images/og-image.jpg",
    "revision": "9ad9b167a0e383b30a2bd1697f9462d3"
  },
  {
    "url": "/images/soccer_goal_poster_20260528.jpg",
    "revision": "6c1d9e2cd563eb973b8c1291d33d58dd"
  },
  {
    "url": "/images/soccer_poster.png",
    "revision": "6c1d9e2cd563eb973b8c1291d33d58dd"
  },
  {
    "url": "/images/thumbs/w320/posters/bexco/bexco_15661.webp",
    "revision": "a44770d4824ee2c1add835a7a3652e31"
  },
  {
    "url": "/images/thumbs/w320/posters/bexco/bexco_15810.webp",
    "revision": "acd1b27227a9620bef7ee7bff582473a"
  },
  {
    "url": "/images/thumbs/w320/posters/bexco/bexco_15811.webp",
    "revision": "01a9e093f09b2caec60b14e8f368277d"
  },
  {
    "url": "/images/thumbs/w320/posters/bexco/bexco_15812.webp",
    "revision": "027425291d340da7fb9b9cadf634dca2"
  },
  {
    "url": "/images/thumbs/w320/posters/bexco/bexco_15982.webp",
    "revision": "7cbbac917d8cb91d0eda8a5a1f0f8093"
  },
  {
    "url": "/images/thumbs/w320/posters/bexco/bexco_16065.webp",
    "revision": "29ca3f43b21c1b9dfb75bf0734194ab8"
  },
  {
    "url": "/images/thumbs/w320/posters/bexco/bexco_16149.webp",
    "revision": "7fa949ede8c4dbe111968603ac95c49e"
  },
  {
    "url": "/images/thumbs/w320/posters/bexco/bexco_16232.webp",
    "revision": "76200d66fd29e99e5120c85920f6ae19"
  },
  {
    "url": "/images/thumbs/w320/posters/bexco/bexco_16233.webp",
    "revision": "5ec684f4c22772029359751fe9f05985"
  },
  {
    "url": "/images/thumbs/w320/posters/bexco/bexco_16238.webp",
    "revision": "5c8fbacf4d280670f538b24641fc14d2"
  },
  {
    "url": "/images/thumbs/w320/posters/bexco/bexco_16240.webp",
    "revision": "3b527597b20d38cd608105506ebca777"
  },
  {
    "url": "/images/thumbs/w320/posters/bexco/bexco_16298.webp",
    "revision": "adb89b1b1cdfb245c13d06b2c362675c"
  },
  {
    "url": "/images/thumbs/w320/posters/bexco/bexco_16410.webp",
    "revision": "d0e71457057afb128194e8b32aa792f2"
  },
  {
    "url": "/images/thumbs/w320/posters/bexco/bexco_16445.webp",
    "revision": "24736946ba875f5bd7eb580fe22f7e97"
  },
  {
    "url": "/images/thumbs/w320/posters/bexco/bexco_16448.webp",
    "revision": "24736946ba875f5bd7eb580fe22f7e97"
  },
  {
    "url": "/images/thumbs/w320/posters/bexco/bexco_16450.webp",
    "revision": "24736946ba875f5bd7eb580fe22f7e97"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_광주_GAC_기획공연_11시_음악산책_단편선_시리즈_귀여운_여인.webp",
    "revision": "9d7ecc362b7c9544db8b6a7005dfb4ec"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_광주시립교향악단_GSO_체임버_시리즈_Brahms_Schumann.webp",
    "revision": "6ac7f8d2ab13b0a9712363dc0e138b20"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_광주시립교향악단_제407회_정기연주회_청춘.webp",
    "revision": "5f377726f92863969fd66cbbadf59107"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_광주시립국악관현악단_제148회_정기연주회_젊은_마에스트로의_초대.webp",
    "revision": "f9c0afd95396d43e4f14ed811ebb4ada"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_광주시립창극단_특별기획공연_희경루방회도.webp",
    "revision": "8b11c8a0f9913836717bdb070c6ccfd3"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_광주시립합창단_204회_정기연주회_German_Requiem.webp",
    "revision": "68279faf4e6b89860a95c862d89f6249"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_김해_2026_자유_패키지_P_art.webp",
    "revision": "f3c072bd4954ca665eee0c23cbaf23dc"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_김해_2026_저녁의음악회_패키지.webp",
    "revision": "4f902cf2b674264d3051c9dc036df6b9"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_김해_6월_저녁의음악회_테너_김세일_시인의_사랑.webp",
    "revision": "5f796be5dfac9f4537f0c869b669d121"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_김해_국립창극단_절창.webp",
    "revision": "37e5b449f2d2720e4c61b633ec0bae0d"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_김해_대니_구_데뷔_10주년_리사이틀.webp",
    "revision": "01289866a7fc6b8683fa0aa348b85e2b"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_김해_유니버설발레단_백조의_호수.webp",
    "revision": "83decd44f5a31247c21534d560652b79"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_부산_11시_브런치_콘서트_최후의_트레몰로.webp",
    "revision": "62356c5a77980f142b31de9c7c539faf"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_부산_2026_NAC_렉처콘서트_BSO_솔로이스츠_실내악_목관5중주_금관5중주.webp",
    "revision": "46a095e607d0890d1cb3f94520deba84"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_부산_2026_NAC_문화예술교육_공연_및_체험_악기체험_클클클_친구들이_놀러왔어.webp",
    "revision": "25645592655c57b9c969fceb16f7665c"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_부산_2026_NAC_시그니처_Symphony_No_5_Choral_Series_쇼스타코비치_No_5_엘가_첼로_협주곡.webp",
    "revision": "18684b69f7970eb72bf51f01e5314a62"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_부산_2026_지역민간교향악축제_KNN_방송교향악단.webp",
    "revision": "c90892057434ac2df0f02786118b4751"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_부산_2026_지역민간교향악축제_낙동아트센터_페스티벌_오케스트라_NAFO.webp",
    "revision": "4814c675fc95bcc0e0d66ce0bded7c58"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_부산_2026_지역민간교향악축제_피아노_손열음.webp",
    "revision": "d3d090644c81c6569ed11deabc913f46"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_부산_NAC_2026_해외초청기획_트리오_코발트_공연.webp",
    "revision": "3d17d0856af30411df2b2ef245d9b337"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_부산_NAC_NAFO시리즈_교향곡_속의_합창.webp",
    "revision": "0c41c6b07bf87e7693d475fc66722963"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_부산_Young_Soloists_손소정_플루트_리사이틀.webp",
    "revision": "411cb78d25254aaff40d225fd0ca6e6b"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_부산_마티네_콘서트_성악_앙상블_시리즈_오네스토_앙상블의_힐링_뮤직브런치.webp",
    "revision": "5ad9972e4be2c511c9e10b33a36544e1"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_부산_미로슬라브_꿀띠쉐프_피아노_독주회.webp",
    "revision": "ef54693e12e296873ae40d3f8e3e87fe"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_창원_국립국악원_연희_판.webp",
    "revision": "0c6122198a5e1b97cc5ff1326d855e6a"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_창원_국립합창단_시네마_클래식.webp",
    "revision": "73c356a762b47dd158e80da26ba0cc7f"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_창원_미디어아트_콘서트_이중섭_그림과_편지.webp",
    "revision": "9b079fd2506a3474acc99060a5d8847d"
  },
  {
    "url": "/images/thumbs/w320/posters/classic/yes24_창원_미디어아트_콘서트_클로드_모네_빛을_따라가는_여정.webp",
    "revision": "246a8933431bf0a3ae391c08e2ad546a"
  },
  {
    "url": "/images/thumbs/w320/posters/coex/coex_1b551c853a7cf8f6.webp",
    "revision": "00dc4f798e0c1397eb8e03098ab1314d"
  },
  {
    "url": "/images/thumbs/w320/posters/coex/coex_2d83e99a06fc295b.webp",
    "revision": "6cc2b6894a207db8320e8382be2b73b9"
  },
  {
    "url": "/images/thumbs/w320/posters/coex/coex_3dfc7aa3bcaa459f.webp",
    "revision": "62aa1691736425cd694d0860f26272a5"
  },
  {
    "url": "/images/thumbs/w320/posters/coex/coex_6861858464ebc463.webp",
    "revision": "0f8932fdfd78711968cdebc67e57ede0"
  },
  {
    "url": "/images/thumbs/w320/posters/coex/coex_ac0f00c8931375d8.webp",
    "revision": "882f851538ed1e8f7791324de622a5af"
  },
  {
    "url": "/images/thumbs/w320/posters/coex/coex_bb1e8350670aea41.webp",
    "revision": "fa279c669bb864c2e5b8ba4e1bfde236"
  },
  {
    "url": "/images/thumbs/w320/posters/coex/coex_c4cb7bd855cb8e02.webp",
    "revision": "39354ef29a3a55abceaa890e6991c330"
  },
  {
    "url": "/images/thumbs/w320/posters/coex/coex_fe6c43359186cd5d.webp",
    "revision": "13afcdcb94958b542635a2a5cdc7b95d"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_2026_DXMON_FANMEETING_HYPER_LINK_ON.webp",
    "revision": "7f557b8b8f250ded52e0e10a2abc34fe"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_2026_JAY_B_tape_roots_seoul.webp",
    "revision": "ca616a47009029a2f2bdb3c9e8771fcc"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_2026_딥다이브_뮤직페스티벌_2026_DEEP_DIVE_MUSIC_FESTIVAL.webp",
    "revision": "54937fd07d1decf7e893c55e0b171233"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_2026_손영택_Universe_1st_FAN_CON_From_Birth_to_Death.webp",
    "revision": "77c85047dc917bc0ee5a8872e2298f20"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_2026_전주얼티밋뮤직페스티벌_블라인드.webp",
    "revision": "5b29a793067ddf080c208b3bdee30e5a"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_American_Football_Live_in_Seoul.webp",
    "revision": "577c67e8056f747f997713f846491365"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_Azusa_Tadokoro_Fan_Meeting_in_Seoul.webp",
    "revision": "9fda9c3ebc24ac44745bcc444cda6a05"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_back_number_Grateful_Yesterdays_Tour_2026_in_Seoul.webp",
    "revision": "ca78d685749adb7745b37d6e69960bb2"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_Bandai_Namco_Music_Live_Festival_in_SEOUL_2026.webp",
    "revision": "94386ccb62ff7080f9da7ef359b5eb55"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_BOSS_CKM_HOTTER_THAN_SUMMER_LIVE_PARTY_IN_KOREA.webp",
    "revision": "f0bd16c2bdd507cadf439c73a68708ad"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_Cardinals_Live_in_Seoul.webp",
    "revision": "57b298ed5c1eaaa910946ce1df3d990b"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_Chilli_Beans_Asia_Tour_2026_in_Seoul.webp",
    "revision": "8af881a3c18a8c6ea8710095046c7f16"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_HY_LIVE_SERIES_MUKAI_TAICHI_After_the_End_Roll_Mukai_Taichi_In_Seoul.webp",
    "revision": "d1b70e3f3006c2e8f146403519de4948"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_IDOL1ST_KENTY_ASIA_TOUR_2026_in_SEOUL.webp",
    "revision": "db4f7935d6b704d95fe9d387b7afb8a8"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_KBS부산_제_98기_수요일_노래교실_오전반_1층_지정석.webp",
    "revision": "5fb0abf70df386e7255431a6fb073ba9"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_KBS부산_제_98기_수요일_노래교실_오전반_2층_자유석.webp",
    "revision": "5fb0abf70df386e7255431a6fb073ba9"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_KBS부산_제_98기_화요일_노래교실_2층_자유석.webp",
    "revision": "5fb0abf70df386e7255431a6fb073ba9"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_KBS부산_제_99기_수요일_노래교실_오전반_1층_지정석.webp",
    "revision": "5fb0abf70df386e7255431a6fb073ba9"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_KBS부산_제_99기_수요일_노래교실_오전반_2층_자유석.webp",
    "revision": "5fb0abf70df386e7255431a6fb073ba9"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_KBS부산_제_99기_수요일_노래교실_오후반_1층_지정석.webp",
    "revision": "5fb0abf70df386e7255431a6fb073ba9"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_KBS부산_제_99기_수요일_노래교실_오후반_2층_자유석.webp",
    "revision": "5fb0abf70df386e7255431a6fb073ba9"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_KBS부산_제_99기_화요일_노래교실_1층_지정석.webp",
    "revision": "5fb0abf70df386e7255431a6fb073ba9"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_KBS부산_제_99기_화요일_노래교실_2층_자유석.webp",
    "revision": "5fb0abf70df386e7255431a6fb073ba9"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_Luv_sic_Hexalogy_Asia_Tour_2026_Seoul.webp",
    "revision": "c6371938618814bd835e7295d5819253"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_Omoinotake_One_Man_Tour_2026_in_Seoul.webp",
    "revision": "fdfa60be00a68a6ebfe6f4ac71bd3369"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_Reol_Oneman_Live_2026_Bijigaku_in_SEOUL.webp",
    "revision": "8e10f76cdca4ed62fbc325c58fee6a3e"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_Ruslan_Belyy_New_concert_IMMIGRACIAS.webp",
    "revision": "b9f031fd14861ac5d030e6ce7141817e"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_SIRUP_내한공연_SIRUP_ASIA_TOUR_2026_TURN_THE_PAGE_IN_ASIA_in_SEOUL.webp",
    "revision": "cd24246eb742907f2cc0cf43d67f0c12"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_Sofia_Isella_Live_in_Seoul_소피아_이셀라_첫_내한공연.webp",
    "revision": "3be4288715aa20f24cb3ed690d3849d9"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_Sou_LIVE_TOUR_2026_Finder_in_Seoul.webp",
    "revision": "9a7d84fb4230145c685437536aa08e5e"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_SPYAIR_JUST_LIKE_THIS_2026_in_KOREA.webp",
    "revision": "d9971aafaf2b301826bf495c2ba86a76"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_SUKIMASWITCH_POPMAN_S_WORLD_2026_in_Seoul.webp",
    "revision": "0f4f65b1503d449e0654904495f82947"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_Sustainable_Wave_Festival_서스테이너블_웨이브_페스티벌.webp",
    "revision": "b1aa36eb8ec02e5a7694669adfe0d58f"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_TK_from_Ling_tosite_sigure_ASIA_TOUR_2026_in_Seoul.webp",
    "revision": "1686a0050482166985dbab7896f40355"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_WANDERLOCH_with_브로콜리너마저_X_nib.webp",
    "revision": "52f5195c43c0cc4fa7b9b6832152853f"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_WE_DREAM_THE_SAME_DREAM_TUESDAY_BEACH_CLUB.webp",
    "revision": "8ba63573be320df490d256255ba06dfd"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_ZEE_YOU_AGAIN_IN_KOREA.webp",
    "revision": "feee3fb8b9322f622f8d5b9a3608bc31"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_군산_패션_워십_컨퍼런스_2026.webp",
    "revision": "e2bc3de72f89c805c769c30b094868e8"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_김경일_교수와_함께하는_뇌_발달로_이해하는_0_7세_아이의_마음과_대화법.webp",
    "revision": "ea0a061e6f9a6f9b601a6001005d3e53"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_대구_1등들_전국투어_콘서트.webp",
    "revision": "78b5d2c8fbfee19385c6976d593f47b9"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_대구_2026_LUCY_9TH_CONCERT_ISLAND.webp",
    "revision": "8ebd5efd8e6a4f1afac1f267abcec33b"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_대구_더_보컬.webp",
    "revision": "51d08e9d1035aa1391244ea585f29dc8"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_매튜_아이필드_Matthew_Ifield_내한_공연_CLOSE_TO_YOUR_HEART_TOUR.webp",
    "revision": "54ab13f9c123b0de4adc415035b8d0c0"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_무쿠_내한공연_muque_LIVE_TOUR_2026_GLHF_in_Seoul.webp",
    "revision": "66ad2f7824ff6be818526d8b1e9d3bd9"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_부산_1등들_전국투어_콘서트.webp",
    "revision": "4ef205b308f3f16b8f3d9beff79af25e"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_부산_2026_박지현_콘서트_쇼맨쉽_시즌2_SHOWMANSHIP_SEASON_2.webp",
    "revision": "11650c8384dccc76df642b2b16e42b4d"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_부산_Midnight_rAge_Party.webp",
    "revision": "d5886bdabb51a3c1a4c34ba4faa8ed4c"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_부산_Playlist_Yeongdo_시리즈_양파_전진희_노래가_된_우리.webp",
    "revision": "ce4071f631039621bdedcf88929970b3"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_부산_The_Voyager_Maiden_Vessel.webp",
    "revision": "b8bd54a05dfad360e8a933c0a42c0e5d"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_부천_2026_이승철_40주년_콘서트_THE_VOICE_LEE_SEUNG_CHUL.webp",
    "revision": "7d2aa92d96c4b2c21fed915e1373ce0d"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_서울_Midnight_rAge_Party.webp",
    "revision": "d5886bdabb51a3c1a4c34ba4faa8ed4c"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_수원_패션_워십_컨퍼런스_2026.webp",
    "revision": "afbe8540af9d9eefd3a17769737349c4"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_승리의_여신_니케_밴드라이브_콘서트_Full_Burst_Live.webp",
    "revision": "ea2fec86c7e9a8e34026e4331cd36d1e"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_알레시아_카라_첫_단독_내한공연_ALESSIA_CARA_LIVE_IN_SEOUL.webp",
    "revision": "fb2cdfa5f541e11e311ff823a0c766a0"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_에즈라_콜렉티브_첫_단독_내한공연_Ezra_Collective_Live_in_Seoul.webp",
    "revision": "61f5a653966c46a3aff4315bc86e8ba9"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_인천_2026_강문경_콘서트_The_Holic_더_홀릭.webp",
    "revision": "dce7ccbdf7a15448f4528e632b9b06a0"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_제19회_부산항축제_부산항투어_이그린호.webp",
    "revision": "527a71f8807f3de09df542bf896c330b"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_제19회_부산항축제_부산항투어_자갈치크루즈.webp",
    "revision": "527a71f8807f3de09df542bf896c330b"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_제19회_부산항축제_포트런.webp",
    "revision": "527a71f8807f3de09df542bf896c330b"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_제19회_부산항축제_해양미션투어.webp",
    "revision": "527a71f8807f3de09df542bf896c330b"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_창원_SUPER_수요콘서트_Enjoy_by_BUMHAN_MECATEC_6월_오월오일.webp",
    "revision": "689be45b764eba12a819af12929c17a4"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_청주_2026_심규선x안예은_콘서트_어느봄날.webp",
    "revision": "04b77385804aa43ccc854804c1bb1370"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_청주_2026_이승철_40주년_콘서트_THE_VOICE_LEE_SEUNG_CHUL.webp",
    "revision": "e2beea26ad8cdcbed1afa2fc1d5701a1"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_춘천_2026_이승철_40주년_콘서트_THE_VOICE_LEE_SEUNG_CHUL.webp",
    "revision": "f8c2ef90cdd418d83bd4d3419c78419f"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_포레스텔라_정규_4집_투어_콘서트_THE_LEGACY_SYMPHONY_In_Busan.webp",
    "revision": "ef4a133f63a058a1669932982b9d27af"
  },
  {
    "url": "/images/thumbs/w320/posters/concert/yes24_화성_2026_이승철_40주년_콘서트_THE_VOICE_LEE_SEUNG_CHUL.webp",
    "revision": "6d5c9c9d6593c2cb10471b90b0d3f63d"
  },
  {
    "url": "/images/thumbs/w320/posters/exhibition/yes24_부산_판타와_지노의_공룡탐험_IN_BUSAN.webp",
    "revision": "0099aa60fd6c7baceed48af71d2c9b2f"
  },
  {
    "url": "/images/thumbs/w320/posters/exhibition/yes24_얼리버드_부산_판타와_지노의_공룡탐험_IN_BUSAN.webp",
    "revision": "81f195747a77e8a323562cfb6b736899"
  },
  {
    "url": "/images/thumbs/w320/posters/exhibition/yes24_열혈농구단_시즌2_일곱번째_경기_직관경기.webp",
    "revision": "6d834436defba72f8b63d5485806dcd9"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/02a1c2ab_bce7_404a_9c8f_4eb4ac69acb3.webp",
    "revision": "6c5d404ac9108fe9e8593f826d86f098"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/03f52860_d5ec_4e72_b808_62db3d874881.webp",
    "revision": "54bdc36269f2fd0f5f49b1f8caa5b48f"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/0790d425_2b40_44ef_92ea_32c895e7b28e.webp",
    "revision": "5056fa5cb8e00a096ac04e6fe2b99077"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/0b35fb80_db10_4428_81f1_82a6278da0b5.webp",
    "revision": "20138230f48915bb3059a146ac14f25a"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/0b996b95_7aa9_4e4e_938b_3bd7cc503f78.webp",
    "revision": "d9d53d31c23d3f5eae57e052215cc3f4"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/0e803334_1e3d_4c57_9005_e4ec9c87657f.webp",
    "revision": "c60654dc5bca27e850e747204ce1e4f3"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/0f8ab017_197a_40c2_b9cc_622bdef0ad4b.webp",
    "revision": "96bcc4457ed2caf7fb9d1eedb18a997f"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/0fe22b88_0997_4c23_9f07_789667874b06.webp",
    "revision": "42ddcf49bb4e8bd7fe4d6bc909b06d62"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/187271d0_9f7f_450f_a502_fe0b46f4e48c.webp",
    "revision": "43ad8db8b5378dad40b35cc8b813214d"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/1a7b7f32_e5a4_47b1_9e35_4a87499eccd8.webp",
    "revision": "686188bd05f1bca510f24f75af2526ce"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/1b22f1fa_d3e1_42c1_837a_c8c4e359eef4.webp",
    "revision": "c25ef2360240a78a1038d0a4b915fe16"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/1ebb18cf_529a_4674_8a85_5e9ca495dffb.webp",
    "revision": "d4e03fb41e2e6e5952231b9d6d5a1a39"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/1f4196b6_5e15_4e22_accf_6e57a484612c.webp",
    "revision": "4d18b71a7b61d0240651f481f1fbfe4a"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/1f47bee8_d195_40a2_81eb_a5aeca10fb81.webp",
    "revision": "6ae7cfa7aaa071a397eeb079951de3f3"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/1fc75427_81f0_42bf_946b_d81e9a32aca5.webp",
    "revision": "022658e6a9ddaee741b113e683cb8231"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/22f905a0_4209_4eb9_af81_89f96593f543.webp",
    "revision": "7112bfa1bbd9a6eaaef04451f4dbbd66"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/2387725a_dc4a_4b19_8d5d_2a4d954d00d7.webp",
    "revision": "023f1dc36cac6c7404c424cb67b896b4"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/24e592fb_3856_4d3a_b155_b6d16d1b51bf.webp",
    "revision": "923fef1b292a4e35f5a6c6a0d04617cf"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/28db2736_cde3_4e56_a331_aaf8ba9f0015.webp",
    "revision": "6ae972d46e6f001682b2d2ec30a0183b"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/2c18520d_8813_4c1f_867a_3608ede7b446.webp",
    "revision": "88ff44c135cc9a455590eb96cce8617d"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/2d36bbb3_494b_4ba6_be8b_76c611860558.webp",
    "revision": "d9d53d31c23d3f5eae57e052215cc3f4"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/36c1abb5_d987_415d_ae63_1c7ca340e173.webp",
    "revision": "6bcdae4d43e8a3e57ed5f407eaddb03b"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/38c52c0b_98b9_4cfb_b285_72ca7ec0b988.webp",
    "revision": "746359c0309505bb4e3eaf0da924098c"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/3d2b41c5_9052_43b8_8a8b_9e741ccca343.webp",
    "revision": "f9643cd2c91c8b35be9be4fea831a74f"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/3d928829_fbcd_4bc6_8b4b_3aeb81476162.webp",
    "revision": "3b54c7ced074a169c87560c10450a206"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/3e214a82_45b4_4ccb_87af_15908caaa0d9.webp",
    "revision": "f39ef2b69e64694c3afc6a00c798d81e"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/3ebf99b8_e25d_4074_821a_27a6c0e488ef.webp",
    "revision": "4b8cb5d1ec1bebf3f18b88dce15d8461"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/47010e81_432c_42b0_a5f7_aaac7a07dbc2.webp",
    "revision": "d7f820e1878400433d47fe8d25bf39ef"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/4b3a9d90_353d_4b1b_a34f_8807e713774b.webp",
    "revision": "5ea6d83372b8f55042a83f43d025defe"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/50f59373_bf29_455b_8c92_50c4e76f58f5.webp",
    "revision": "3d93f81346486a33debc5a34af8a7f3b"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/518c24d3_309a_40a1_90a0_01dc354772c7.webp",
    "revision": "392469edd05aaea8dea1b78602beb1ad"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/5293a09e_2727_40f0_b086_39f8e74bacfc.webp",
    "revision": "52d32d43c5e93c8d63eec242894d6934"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/52c26e05_2f86_4332_8181_ca3f68edb064.webp",
    "revision": "c0a3bde4883bc6cda116b9f5bc8f50ce"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/53b9497a_02cf_48ed_9d46_ee58efc16545.webp",
    "revision": "83a81b74e74760353810a0fd8de761c8"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/53d646d1_9565_4c14_8888_81359ac8867a.webp",
    "revision": "9502370f1af1b13c4a605259f813b85e"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/54ffde37_3298_4de1_8f42_fccc2e79cb15.webp",
    "revision": "e6bc46b9e88948c8710f992c1bc5f8f1"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/5b4f8c9d_c069_4f7c_b9ee_413b1e7122b5.webp",
    "revision": "d89f1ccb1f929638099baa3022538fae"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/5c6f720a_dd3e_4e54_bd2e_0ed7a72147ee.webp",
    "revision": "dfbd5c47b61651d243d267ad568eb705"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/644495a7_65e3_42ef_8993_e18e2e71a8bd.webp",
    "revision": "cfb9a4b08918f22fe9e64dc00527ec59"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/67a2b058_c7c0_42bd_a018_8aedc8418bde.webp",
    "revision": "8ea73d0670731632247e746964f29297"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/6d5c971e_b99c_4da8_a003_f673b4beba76.webp",
    "revision": "776490c320039e69ad42bd4e8ccdb35c"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/7231bfc8_9e7b_470e_8cc2_b237fe582fa3.webp",
    "revision": "03ca5a425d2c59a0f0c7370034f01032"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/73b47051_6c45_4676_b83f_52781f6ead9c.webp",
    "revision": "cce81267ac8934eb45e206cb792cf77d"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/75ebfb38_9953_47aa_bbfe_188dc8a3767c.webp",
    "revision": "115098041ada5f000633215a35ad05db"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/76b2d6e5_8f1d_46cb_a0f9_aada5ef1b409.webp",
    "revision": "0c4613646e8e60bb28f0752df5452940"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/78db2649_69d9_4710_a0d3_3c8f91c26720.webp",
    "revision": "fa4417d13e2fc1ab12f66e3789b6862c"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/7d2cf1b1_9e46_470d_bfa9_4e2b8272802b.webp",
    "revision": "28b9bf166cef66429d09148d5c6cc908"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/8146cbf1_2012_4178_aa12_06ddfb702361.webp",
    "revision": "7c8c2a3664e7b621245c4f2ada9ed042"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/83e1c0ed_fc26_49df_9364_6bc7729d14b6.webp",
    "revision": "a08aeb8efc68cd32da367de2e749b08c"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/856730a3_5355_4937_a2ae_43309d07af31.webp",
    "revision": "f91c1004c98823326cfa0913321d9d84"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/85a1dd0a_7a8b_4074_bf97_45bf0631db1a.webp",
    "revision": "6ee47e7acb952cbf8cae1fb8aebd9b65"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/883fb3cd_8ce1_482b_9e57_02947b44f038.webp",
    "revision": "db4b7ad41d45538d88a5879500faf2f7"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/88bb2680_ef7a_4cc2_afaa_ceb8c6e6fe27.webp",
    "revision": "3a25bd87fd680c4f3b346ba1c1472862"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/8c369704_303d_41fa_b6fa_f63bf8c5e96b.webp",
    "revision": "9437a1a6d26b13f2cf4dc3f87073cb72"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/8e43bab9_8e16_4925_94f9_c03eb7a8e72d.webp",
    "revision": "e106b16db96ca3fb80cc2fd8ba33a74f"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/910bb144_bf74_4eee_9e91_8fbcbaf302ac.webp",
    "revision": "4f2df7b5970176840d1e54d1e8e77b64"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/91c20414_ceda_4519_bcc2_ded7959fff38.webp",
    "revision": "338c1371f9f7644bab6123f146102842"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/93088689_2d3f_4616_a90a_23be68e300d1.webp",
    "revision": "0c900ad6196ee1364c64f0845bc9d776"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/933425f6_3f59_4de2_9d0d_39cbfb478d8e.webp",
    "revision": "b0f8fd668902ed61fd8cd18705adaef3"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/95d65f28_6c8f_4226_9697_a5a4e9edc801.webp",
    "revision": "424112c146a9a3ad07fae50be9b5058e"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/964e8232_3729_4053_bd48_bd8a77e1916b.webp",
    "revision": "771ba9ad9fb2d99d8576419e28b835bf"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/98cca56b_209b_44a7_9a41_a89629ef0242.webp",
    "revision": "603fe7653fd8697b016cdaa0d79a0c71"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/98cf6eac_a8b9_423d_afad_5fc46aefa481.webp",
    "revision": "d9d53d31c23d3f5eae57e052215cc3f4"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/9aef769f_4f22_4a7f_981a_aacac41fd0d6.webp",
    "revision": "44db0ad1abb06ea423560ce681c79228"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/9b5b4dcb_1687_4588_8fd3_dd91f8b60206.webp",
    "revision": "746359c0309505bb4e3eaf0da924098c"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/9baec2f1_84c7_4b70_aa3e_b8f6fe76b0c1.webp",
    "revision": "e4196ce47c3ed4b8aacada1e90eb5a2c"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/9be93722_b4ee_4059_b688_0ae9e2527083.webp",
    "revision": "3a8837e6b79a6ebc667d8fbc78829a71"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/9cfdf097_5fcd_469f_ab72_b979b3cb69ce.webp",
    "revision": "e6c7afcb0bb4fc2bf2d2d3898365897d"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/9df157f4_4547_4672_92b6_56f92e9e06e0.webp",
    "revision": "e5772ce5e5401f1a12be307d43c7eafa"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/a212b550_67bf_422e_a110_7bb742e84672.webp",
    "revision": "a7c12ca65c8c11ad3737337da15857e7"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/a50f6668_892d_4997_97fd_6ec7be5b04af.webp",
    "revision": "38174f6a53dd7ad55671ce07b8756ab2"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/a6417376_6bef_489e_94f1_cae522aea9e1.webp",
    "revision": "08bbc65df2e1898702c095c22ac646ad"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/a790296f_b016_4ba6_b40b_4420a682a1d9.webp",
    "revision": "d4c389789bbe950a5023f603560843e2"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/abfe6e2e_06b0_4beb_a6ff_1708f242c84d.webp",
    "revision": "03165f33b90432870555be8e103f2260"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/ac945acc_1ab3_4c14_8789_02a888245565.webp",
    "revision": "705b817fce4cbf2156252d44545fab6e"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/aebdd924_73cd_4187_be5e_ba29ccf19c49.webp",
    "revision": "220ca301fae941fde99681313a483815"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/b530def8_d159_4853_8434_c98212e985e6.webp",
    "revision": "3f5dba214fe24ae313f3491b7559f87c"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/ba335abd_29f3_4b10_8b7c_29dd2c777fbf.webp",
    "revision": "0565934ed7f664ad4ce6ef7966695ca5"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/c3d27433_8ec5_44a1_afa4_47a43f92e8d8.webp",
    "revision": "0d5910557a8999e6c50ab59b2559a758"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/c5cea11d_e3f0_4300_a3a6_d5159d5b00f0.webp",
    "revision": "0184fdcf5e595681aea9965afdf3d385"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/ca2ec00d_7adc_4134_82b5_50f70d6e262c.webp",
    "revision": "b0534c953832d67d6a10b4b1856a8c2a"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/ce010596_12fe_43cb_9386_3f09a4397ef1.webp",
    "revision": "f3de19dd68a5e1ebfd725c12b323d5a0"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/d0187095_61a5_4ae2_ab27_5ece7161158b.webp",
    "revision": "c7188ceea34d964af6731b46273a5543"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/d18ca54d_6d78_46c4_a7f6_d6bda804f736.webp",
    "revision": "6ed279f0b27fb441f91f2041c30d4c83"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/d4b35cb8_3845_4ddf_8132_9300f7286c08.webp",
    "revision": "66de2921df9200a5902a8ad59b8b3679"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/d5dfae4f_39f7_40a3_b80d_b045c0a39c48.webp",
    "revision": "b1db918306c54f19d0556923b1253f4f"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/d86c5d13_6e48_42d9_bb10_68cda235473b.webp",
    "revision": "2189d9fcd59fac3eba1bfc6b46244434"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/dc6b1834_4dd8_40c4_acf4_9cb13e9c4d0b.webp",
    "revision": "020e11f379555305db548c67fcb0ab2f"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/df4f7cad_bf38_4608_9062_2d47fb5ed92d.webp",
    "revision": "d9d53d31c23d3f5eae57e052215cc3f4"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/e0472596_c5c1_4360_af80_bcb9f22630ce.webp",
    "revision": "f3820bf6f2ab15c447ffc1efbd8a4d87"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/e0645258_25e5_4f3e_9bdb_96987101bed3.webp",
    "revision": "8e7fd82b5b13e3f2aa99b4eb3e90291b"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/e1e6eb05_f722_45a2_be6c_95104506670c.webp",
    "revision": "a79d374efc2a62bfee29db6df6d9aff9"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/e3225d04_0d16_4067_ac8c_f7fdcb607e88.webp",
    "revision": "1a627a8cfa5326007517d124de9a6b04"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/e3a65aa1_e53c_42dd_9a04_4b386819cab4.webp",
    "revision": "f0118bb1d718fdc6b182f2701b8ae3c6"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/e7f655b5_b2d3_4923_90ba_6d7ce678b381.webp",
    "revision": "38f1e8e5f4b6c16b0c7a50cb09dd642b"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/e943dc7c_44b6_4d95_bcb6_551104d10ed2.webp",
    "revision": "919f4f86d353ec9a4b1a09f700359728"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/edf5996d_f34f_476c_9d32_358e72bdf46a.webp",
    "revision": "ed101dd5cd8d88435aafd5681b807d91"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/eff62395_e989_4993_b5ab_1b1808220401.webp",
    "revision": "d79e5cf57b75e3e8f57fe74c7e6a9cb9"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/f3026b60_0634_49ef_9ccb_8fb68d0e09a5.webp",
    "revision": "d8a1e952fdf22820c831043a77a95573"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/f706f043_fc2f_4fca_9e9a_bcd588eaafb4.webp",
    "revision": "187ac927eee872d53a25a858846151f8"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/fc491eba_6273_4ae0_a6bd_aee54fcac631.webp",
    "revision": "656802e14b88b357c4ae79743313f204"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/fdb11408_6de8_46ea_b051_faac6fc020a7.webp",
    "revision": "df6c7f5277bd98436bf9c763e1f93134"
  },
  {
    "url": "/images/thumbs/w320/posters/festivals/ff5813ad_14b6_43bc_a415_14c8074dd377.webp",
    "revision": "a80ace3fa48cb2609ca3ca5ddac0275c"
  },
  {
    "url": "/images/thumbs/w320/posters/gocamping/gocamping_1601.webp",
    "revision": "00314bbf6f46db27c6deaa0b9694d4ce"
  },
  {
    "url": "/images/thumbs/w320/posters/gocamping/gocamping_1776.webp",
    "revision": "05732aa6a81d97e23fd19387acab2d63"
  },
  {
    "url": "/images/thumbs/w320/posters/gocamping/gocamping_2022.webp",
    "revision": "8986b7ece262044957e8f2ff188464f0"
  },
  {
    "url": "/images/thumbs/w320/posters/gocamping/gocamping_2217.webp",
    "revision": "53140175521cc7e9e0540e8b68ed8ac2"
  },
  {
    "url": "/images/thumbs/w320/posters/gocamping/gocamping_2422.webp",
    "revision": "0f6126b97325cdad44449e736998837d"
  },
  {
    "url": "/images/thumbs/w320/posters/gocamping/gocamping_2464.webp",
    "revision": "e0bb7f3bc83414d8af43938e82bdd5a4"
  },
  {
    "url": "/images/thumbs/w320/posters/gocamping/gocamping_2672.webp",
    "revision": "c56be7029ac2f8bcc75912b68e4b51d6"
  },
  {
    "url": "/images/thumbs/w320/posters/gocamping/gocamping_2703.webp",
    "revision": "208bea5fc7aa1d7f3f4883514b3f24f1"
  },
  {
    "url": "/images/thumbs/w320/posters/gocamping/gocamping_2999.webp",
    "revision": "747f646cd07776e4b1f5402a95d75a67"
  },
  {
    "url": "/images/thumbs/w320/posters/gocamping/gocamping_306.webp",
    "revision": "9179e886b53bffa0524d2fb6df901995"
  },
  {
    "url": "/images/thumbs/w320/posters/gocamping/gocamping_3139.webp",
    "revision": "a76dbd08d07dcbcf45708f8b5094d249"
  },
  {
    "url": "/images/thumbs/w320/posters/gocamping/gocamping_3389.webp",
    "revision": "6266ea6887588c5b85f85c3d9b7a9937"
  },
  {
    "url": "/images/thumbs/w320/posters/gocamping/gocamping_3394.webp",
    "revision": "81afcf08b39221382a887d472d7cb774"
  },
  {
    "url": "/images/thumbs/w320/posters/gocamping/gocamping_6808.webp",
    "revision": "f7525c32009b3f0aa205a9953b970633"
  },
  {
    "url": "/images/thumbs/w320/posters/gocamping/gocamping_6959.webp",
    "revision": "f4e3b731bc9cd8df8b37751cea294397"
  },
  {
    "url": "/images/thumbs/w320/posters/gocamping/gocamping_6975.webp",
    "revision": "13d3b31d112019d7ff24677c3ef21ed9"
  },
  {
    "url": "/images/thumbs/w320/posters/gocamping/gocamping_6979.webp",
    "revision": "b68de8fbd55af6257344276d0a57e361"
  },
  {
    "url": "/images/thumbs/w320/posters/gocamping/gocamping_7254.webp",
    "revision": "e774b5ead07037fdcd6312a342bbeaee"
  },
  {
    "url": "/images/thumbs/w320/posters/gocamping/gocamping_7767.webp",
    "revision": "d1d7cb14e4535d511369650e0d8238a5"
  },
  {
    "url": "/images/thumbs/w320/posters/gocamping/gocamping_8014.webp",
    "revision": "df6ca22f679b207bf4e9f136090274af"
  },
  {
    "url": "/images/thumbs/w320/posters/hotdeals/klook_deal_10023349.webp",
    "revision": "b28b873d4eb7603742f0b260f0c25916"
  },
  {
    "url": "/images/thumbs/w320/posters/hotdeals/klook_deal_10037742.webp",
    "revision": "2425cfda87bac1475f4eba11b40cda62"
  },
  {
    "url": "/images/thumbs/w320/posters/hotdeals/klook_deal_10061523.webp",
    "revision": "a430f65abd605cf3ea123e053c8ff57e"
  },
  {
    "url": "/images/thumbs/w320/posters/hotdeals/klook_deal_10124731.webp",
    "revision": "d45cd1cf42f2fed0e5d81d19108ff8ea"
  },
  {
    "url": "/images/thumbs/w320/posters/hotdeals/klook_deal_10177758.webp",
    "revision": "520574f9c343c8ed2defea56d9bd9511"
  },
  {
    "url": "/images/thumbs/w320/posters/hotdeals/klook_deal_10198660.webp",
    "revision": "a921ed7135a066d405c1d64b8d190be1"
  },
  {
    "url": "/images/thumbs/w320/posters/hotdeals/klook_deal_10244780.webp",
    "revision": "91fb07781a240c67f5eb7b74c4c6379c"
  },
  {
    "url": "/images/thumbs/w320/posters/hotdeals/klook_deal_10244879.webp",
    "revision": "fc462788bea3c00a9608a62e9929da3e"
  },
  {
    "url": "/images/thumbs/w320/posters/hotdeals/klook_deal_10260973.webp",
    "revision": "cfdc0560461d022ac87daee2cad18d46"
  },
  {
    "url": "/images/thumbs/w320/posters/hotdeals/klook_deal_10271992.webp",
    "revision": "9337458203925a1c845a598680ad815f"
  },
  {
    "url": "/images/thumbs/w320/posters/hotdeals/klook_deal_10284948.webp",
    "revision": "3a0632e39d8813e46d9a46f5d08ae1e1"
  },
  {
    "url": "/images/thumbs/w320/posters/hotdeals/klook_deal_10296537.webp",
    "revision": "ea8a77794e81d0f49e890a82ed5015d5"
  },
  {
    "url": "/images/thumbs/w320/posters/hotdeals/klook_deal_10298420.webp",
    "revision": "00762732d71dc66872d702f2440c29e0"
  },
  {
    "url": "/images/thumbs/w320/posters/hotdeals/klook_deal_10319674.webp",
    "revision": "2a18d401e3eeac6b43132c92bc7bf32e"
  },
  {
    "url": "/images/thumbs/w320/posters/hotdeals/klook_deal_10323843.webp",
    "revision": "3f01c040de58b949fd0524537e2707b0"
  },
  {
    "url": "/images/thumbs/w320/posters/hotdeals/klook_deal_10337162.webp",
    "revision": "44438ce73e87349834c1f6e127ab6f6d"
  },
  {
    "url": "/images/thumbs/w320/posters/hotdeals/klook_deal_10340695.webp",
    "revision": "902addc9074048d2d6e4c1224353943e"
  },
  {
    "url": "/images/thumbs/w320/posters/hotdeals/klook_deal_10343073.webp",
    "revision": "50a24a63d5dca928a7af1f82dae04261"
  },
  {
    "url": "/images/thumbs/w320/posters/hotdeals/klook_deal_10344982.webp",
    "revision": "ed63e16f0727e21347fa868e680cefdf"
  },
  {
    "url": "/images/thumbs/w320/posters/hotdeals/klook_deal_10346044.webp",
    "revision": "741772cd2b9ee55a99e146d736d4979b"
  },
  {
    "url": "/images/thumbs/w320/posters/kids/yes24_고양_2026_가족뮤지컬_신데렐라.webp",
    "revision": "3ba4714947ba408227f7494f8001bd0b"
  },
  {
    "url": "/images/thumbs/w320/posters/kids/yes24_고양_2026_가족뮤지컬_피노키오.webp",
    "revision": "635fdaee278c1b843b9b012d4aede6c1"
  },
  {
    "url": "/images/thumbs/w320/posters/kids/yes24_고양_2026_가족뮤지컬_피터팬.webp",
    "revision": "377d3af539d9702065f212085a01fa75"
  },
  {
    "url": "/images/thumbs/w320/posters/kids/yes24_광주_아트콘서트_오감한스푼.webp",
    "revision": "95cbeb5a6d051b9b91441fa1808c73ec"
  },
  {
    "url": "/images/thumbs/w320/posters/kids/yes24_김해_2026_도담도담누리_패키지.webp",
    "revision": "1b391123646ba0b231196209e5847e5e"
  },
  {
    "url": "/images/thumbs/w320/posters/kids/yes24_김해_뮤지컬_장수탕_선녀님.webp",
    "revision": "1f783b454c4b9bf0b842af1c4863b2da"
  },
  {
    "url": "/images/thumbs/w320/posters/kids/yes24_김해_어린이_연극_어디로_가야_하지.webp",
    "revision": "9aa88c0bfe167da82635edc7f6119df3"
  },
  {
    "url": "/images/thumbs/w320/posters/kids/yes24_부산_2026_라이브_가족뮤지컬_어린이_캣프렌즈.webp",
    "revision": "46ac3fde611de60840305e4f213a6976"
  },
  {
    "url": "/images/thumbs/w320/posters/kids/yes24_부산_2026_명작동화_뮤지컬_헨젤과_그레텔.webp",
    "revision": "290835c953c30151e4a2ff4fd4a0c508"
  },
  {
    "url": "/images/thumbs/w320/posters/kids/yes24_부천_2026_어린이_베스트셀러_뮤지컬_콧구멍을_후비면.webp",
    "revision": "1506f2799779218f3b1a18172bae4a40"
  },
  {
    "url": "/images/thumbs/w320/posters/kids/yes24_서울_양천_2026_라이브_가족뮤지컬_인어공주.webp",
    "revision": "666b87a2ca7a60adea14fe41f42d3221"
  },
  {
    "url": "/images/thumbs/w320/posters/kids/yes24_서울_양천_어린이_베스트셀러_뮤지컬_누가_내_머리에_똥쌌어.webp",
    "revision": "f46e0e9ce6e2453422f32f4aaebe3bf9"
  },
  {
    "url": "/images/thumbs/w320/posters/kids/yes24_서울_양천_어린이_베스트셀러_뮤지컬_사과가쿵.webp",
    "revision": "952542bb25d247ccd434b4e29d6d6ca8"
  },
  {
    "url": "/images/thumbs/w320/posters/kids/yes24_성남_2026_여름방학특집_가족뮤지컬_피터팬.webp",
    "revision": "f0d8f1301c1affd52e0184d4b67ad507"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26011402.webp",
    "revision": "1c66e3cedadd0c57eb41b83a3a4cda0b"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26011606.webp",
    "revision": "1c566dd9efb5ddc843080a5a961f72b5"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26012601.webp",
    "revision": "75d4901ae2d7a94d03eda412727b4959"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26020602.webp",
    "revision": "2f3ecec995fbef5de0d78b3c432f9c26"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26021906.webp",
    "revision": "ce4f4ce3e046568b009d5322ab44f6df"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26030306.webp",
    "revision": "6e20d3dcc1d47499a00dd80106a86c0c"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26030312.webp",
    "revision": "720c5cc3ded082c5b7df923819f908a9"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26031015.webp",
    "revision": "da247510637af2fcab5689a8dbab9f88"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26031206.webp",
    "revision": "408fc442e23b2c339ed96ef155d72e56"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26031709.webp",
    "revision": "5938d7622148422cedc77f6abee2c212"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26032304.webp",
    "revision": "341a8aa772635537d67ef76249907bb6"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26033003.webp",
    "revision": "bed2cdcb65e2cb5e12f73ee93be6597d"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26033004.webp",
    "revision": "8d27d7a75f4c75d7141d414e79804a28"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26040104.webp",
    "revision": "dc11e467180cc34c55f5a40c7c4b6ac1"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26040310.webp",
    "revision": "644a3161b3942b01479d34cde649f6ea"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26040606.webp",
    "revision": "5da21a51aeff59eadf79a5613e4abe2e"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26041410.webp",
    "revision": "6a3d9e81c082810c0439515e86037cb5"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26041504.webp",
    "revision": "a2b55cf9dcaa880d19da4d5e3dad6e58"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26042204.webp",
    "revision": "e81b761d60b8c870392665a27d157f72"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26042205.webp",
    "revision": "c6db5a16946e46ed5ef3b1d271aa49e0"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26042207.webp",
    "revision": "f61ae28d372367d5b15e57551f467ace"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26042803.webp",
    "revision": "557ed787062c0c8fdc9dc3292316279f"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26042903.webp",
    "revision": "6a5c109873efc445e9cb887bfd5c84cf"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26042904.webp",
    "revision": "a940b7a6aa8db1ac3b397ac55aa3490b"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26042905.webp",
    "revision": "2a560372c874705a5b357b1d548d21e9"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26043007.webp",
    "revision": "54e850cd4dde02d7f2412f69ffda42f9"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26051112.webp",
    "revision": "f4d93cc205d3f114bd04e2b5c7d2a6cb"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26051208.webp",
    "revision": "5bf74a43dbccac96edb536c491e41b1a"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26051916.webp",
    "revision": "02f727ad0331f4974223ebcc74de2af5"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26052102.webp",
    "revision": "14f1c3a543f6ff46f30d3d330903e20d"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26052702.webp",
    "revision": "76a70f55ae62cf65d3ab0f7c358e4664"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26060202.webp",
    "revision": "92960591fd7adb9bc371c0d0d093c546"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26060205.webp",
    "revision": "df6b1d60fdd98f8aed3dea57b25f62a9"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26060404.webp",
    "revision": "7a3acf72ad1181facad791b73f953adf"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26060803.webp",
    "revision": "7d2549316673d2c553947b3c86ce01ee"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26061902.webp",
    "revision": "cd4f29226cf78609581023ea78476076"
  },
  {
    "url": "/images/thumbs/w320/posters/kintex/kintex_26062208.webp",
    "revision": "250a40902fd406c917581e94772925a5"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie__웨일폴_고래에_먹힌_남자.webp",
    "revision": "578dafb581dc828ac89995cc0867889e"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_가능주의자.webp",
    "revision": "65a2f98378abd69f2e73b65ccd3f229d"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_군체.webp",
    "revision": "f6f7b556ab7a5b4cfb953de474d4ab48"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_그린랜드_2_마이그레이션.webp",
    "revision": "678584fbf56e0257b1c2a47387df12b2"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_그림자_아이.webp",
    "revision": "224dc74c95e7f5a9d9e1fb0beabd2954"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_극장판_도라에몽_신_진구의_해저비밀성.webp",
    "revision": "81722db74b43add80d729a8de66f85ec"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_극장판_암살교실_모두의_시간.webp",
    "revision": "9e61f3c5d53e0b54807405b749071881"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_길_위의_뭉치.webp",
    "revision": "401914fb02a1c5c1675c3608e74aebe9"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_눈동자.webp",
    "revision": "e8d1a8ab534d90eaa8298860e1494dda"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_다윗.webp",
    "revision": "fa6b012db7d68603549f44bd5ff0fc6c"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_도그_스타_마지막_희망.webp",
    "revision": "d37dc91339a80e560319f8ecbda0d479"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_동지도.webp",
    "revision": "e74f84532c0865b0127496083265f99e"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_드림_애니멀즈_더무비.webp",
    "revision": "005e18b9a6d17a6b1fef3b6f8658b9bd"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_디거.webp",
    "revision": "d03e5f76606af0e6dfbb864e892a6805"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_레디_오어_낫_죽음의_숨바꼭질.webp",
    "revision": "9942048eb118c069e3b38233cf6b7b45"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_레지던트_이블_0번째_밤.webp",
    "revision": "f120d304e34f06f9c9828ada9f7f6562"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_마티_슈프림.webp",
    "revision": "8e7135f82198ff08f5ce3f039696bdba"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_명탐정_코난_하이웨이의_타천사.webp",
    "revision": "1e5c5c9fcb7b8e2369cd8c9d91978270"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_모아나.webp",
    "revision": "2774c5b59cec62e839f3eca0d12f5daf"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_모자_쓴_고양이.webp",
    "revision": "b7773c4b5fc52feaf85c91eb4a6fcc26"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_무서운_영화.webp",
    "revision": "96cb14c31365ba16cf1c878542f04007"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_미니언즈__몬스터즈.webp",
    "revision": "19c9bc6aafc54e67a03ac32e39982cf6"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_미명.webp",
    "revision": "59b6489837fda606e96cfb5db44cfcce"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_백룸.webp",
    "revision": "b831e323fa8c2c36cdbbf68d7926e5ea"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_베러티.webp",
    "revision": "4d94105b8adbb3dd8d281c66ca63c29c"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_사랑의_네_가지_온도.webp",
    "revision": "5237ac8d087a5a2a07342406c6114b2f"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_사랑의_하츄핑_고래보석의_전설.webp",
    "revision": "f8ba9f95706827a4314f1f01780ee78b"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_섹스중독_쉬운_여자.webp",
    "revision": "4d009c1c18fc15abe48b35e50999f72e"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_스파이더맨_브랜드_뉴_데이.webp",
    "revision": "87603d18485b65e65504f910d3e5c37b"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_시크릿_에이전트.webp",
    "revision": "0d7d1295b5baa26d49fa4f9d4e43be5b"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_에픽_엘비스_프레슬리_콘서트.webp",
    "revision": "21743d8dca75f7e87edd550990e8c8d8"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_여름_너머.webp",
    "revision": "af2417e1e5855a17260fc7a3f863f9f1"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_오디세이.webp",
    "revision": "69091348656a883fc19d828fbcebdd70"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_오케이_마담2.webp",
    "revision": "4611cdf57e47613c4628bb59fea05932"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_오크_스트리트의_마지막_날.webp",
    "revision": "dfe882aa2a2983b7a23b8da9f7eb1fd8"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_와인드업_더_무비.webp",
    "revision": "05cd123975e9fdf50f5c150d8b3fb893"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_와일드_씽.webp",
    "revision": "53d25dd49302def531f09d2c4660f16f"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_우리_아빠_좀비.webp",
    "revision": "49f5365648134c88d3e8c2b875bdb904"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_인시디어스_그들이_넘어왔다.webp",
    "revision": "89a0713422a5ad87eae786e2d87b2a52"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_지느러미.webp",
    "revision": "bd848871a5acf01c5bbb6496c57032f6"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_키퍼.webp",
    "revision": "a119127bb471faee55a2b85d649f1bd6"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_토이_스토리_5.webp",
    "revision": "7258a29a13c0ad5dc4df37a73c79faf0"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_트로피_.webp",
    "revision": "731e1bd3f461bde71fadeca4e18fd2f1"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_파리의_사생활.webp",
    "revision": "a54beab4e60d6cbb462e15fa6126cbbe"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_퍼피_구조대_더_다이노_무비.webp",
    "revision": "6975e7710b18edbc99b50f65ed4cbafe"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_포가튼_아일랜드.webp",
    "revision": "d91e0048a4a3d66315d8ec1c0c545064"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_폴2_데드포인트.webp",
    "revision": "f626dcc2fc17bab2dfe75722f9db4b25"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_하나_코리아.webp",
    "revision": "c17562e3de9af80f145bebd8f49cafd4"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_하트_오브_비스트.webp",
    "revision": "103e68437885b1dfac8e8177444f2517"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_헥스_깨어난_마법.webp",
    "revision": "35bb280c7a8b8301f1f94aa0ffda2e23"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_호컴.webp",
    "revision": "af749c3370254196feb75882b869660b"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_호프.webp",
    "revision": "767a5cfeede3108123110b0c94596809"
  },
  {
    "url": "/images/thumbs/w320/posters/movies/movie_희망의_발견_알래스카에서.webp",
    "revision": "df85e2f2f36320e472d38422e00d3025"
  },
  {
    "url": "/images/thumbs/w320/posters/musical/yes24_김해_뮤지컬_아몬드.webp",
    "revision": "b23887c91a3c6db983acac8838b25e35"
  },
  {
    "url": "/images/thumbs/w320/posters/musical/yes24_뮤지컬_드라큘라_Dracula_The_Musical_YES24DAY.webp",
    "revision": "71541f3e3fae75f2ca6d5678f89dd66b"
  },
  {
    "url": "/images/thumbs/w320/posters/musical/yes24_뮤지컬_스트라빈스키.webp",
    "revision": "f49b2393c4b4dca19cedadff602eecc8"
  },
  {
    "url": "/images/thumbs/w320/posters/musical/yes24_뮤지컬_헬스키친_Musical_Hell_s_Kitchen_YES24DAY.webp",
    "revision": "9f6809f864158f797c8f6efe98c545d4"
  },
  {
    "url": "/images/thumbs/w320/posters/musical/yes24_부산_뮤지컬_Musical_Gala_Show_클라이막스.webp",
    "revision": "fcb92fc351199d615fda1cde5d8288ed"
  },
  {
    "url": "/images/thumbs/w320/posters/musical/yes24_쇼태권_SHOW_TAEKWON.webp",
    "revision": "c7ac24b1baa87e2d711485672fee6cf4"
  },
  {
    "url": "/images/thumbs/w320/posters/musical/yes24_이터니티_콘서트_앵콜.webp",
    "revision": "6cf3346f27ceea4ae3b2ddc44f8085db"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/1등들.webp",
    "revision": "508662d7b5857953e44fe9e44e72c106"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/8번_출구.webp",
    "revision": "c0254969ca83e35025f57480944dd147"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/Show_Me_The_Money_12.webp",
    "revision": "71233976bc0ab2f87a543c06a3556feb"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/골_때리는_그녀들.webp",
    "revision": "5115f34f1a65ac8dd800fd63105617af"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/귀시.webp",
    "revision": "694961dbdb37b4acdf092a6da9764353"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/낭만닥터_김사부_3.webp",
    "revision": "ec15f464c5457fda201db312cd56669d"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/놀면_뭐하니_.webp",
    "revision": "508662d7b5857953e44fe9e44e72c106"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/대학전쟁.webp",
    "revision": "80cd8666ecb1db8d7af1781724dee144"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/도망쳐.webp",
    "revision": "e9510cbf666023090df15b9efe9af278"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/레이디_두아.webp",
    "revision": "31678596cf6e1b04e77d88eadcf3bced"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/마녀_____Part2__The_Other_One.webp",
    "revision": "b6ee4ad7752d7a79f17ca12f603d3999"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/만약에_우리.webp",
    "revision": "27a5736bf7c33103d61fd8eb42f570de"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/망내인__얼굴_없는_살인자들.webp",
    "revision": "4db5fccbaa4cac4a980ff864abab347f"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/메이드_인_코리아.webp",
    "revision": "6f1d4ebbc54950f77f64718cced1e16e"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/모범택시.webp",
    "revision": "3005b1245d26a7f5282bdb78945ac2de"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/무명전설.webp",
    "revision": "19f7684780b1cf71f1212ee4cf074618"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/무빙.webp",
    "revision": "150d2ab4e007f6009d57b5f19abcac55"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/미혼남녀의_효율적_만남.webp",
    "revision": "72efb2096996cb474cfd8f0c2982784c"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/방과_후_전쟁활동.webp",
    "revision": "d7b22299c1bd8b1af121aadb7f376f34"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/백만_팔로워는_추리_중.webp",
    "revision": "dd23d1fecf742f15cb257f0f3bfe0cc0"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/보스.webp",
    "revision": "98e93afe53a2a1daee4b7e7d5d4384ae"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/붉은_진주.webp",
    "revision": "b02fda18639ca02b5262d1d5be008ae0"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/블러디_플라워.webp",
    "revision": "71190e2a7d1710cfd91bf8c0b799c291"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/사내연애.webp",
    "revision": "8471a92b09e0ff0d1489ce71802fe446"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/사랑하기_때문에.webp",
    "revision": "5a1743251936c80100f292b06a6274d3"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/새벽_2시의_신데렐라.webp",
    "revision": "ca10f1ffec7d990013f6bede3c9aa361"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/서브스턴스.webp",
    "revision": "26b14ad79680bacbd69e0b8cde004690"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/세이렌.webp",
    "revision": "96c892aebdd9254530d9bae45a113f08"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/소년시대.webp",
    "revision": "733b4a13edb0a163ce16890df14480a1"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/손해_보기_싫어서.webp",
    "revision": "8d64659c5b7a749ddacd14a1f49123da"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/스윙키즈.webp",
    "revision": "8a4299a9682abfa26041d85e0e42199f"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/시스터.webp",
    "revision": "a622c67a87f144e233ebf0a48b25c4e2"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/아너___그녀들의_법정.webp",
    "revision": "efc6fa2c80f2a51e8f3f7cca7a2f1677"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/야구여왕.webp",
    "revision": "1334b8e2283885ebc5edcabad2c2ea67"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/약한영웅_Class_1.webp",
    "revision": "5a380bb8390b9790ca3af08c5ec2ced1"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/약한영웅_Class_2.webp",
    "revision": "5a380bb8390b9790ca3af08c5ec2ced1"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/어느_날.webp",
    "revision": "f62d0ca96d872ef9e21f743cd2f943ca"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/어쩔수가없다.webp",
    "revision": "f9d67dc4578cc5d73abc8f78fbbb8d31"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/언더커버_미쓰홍.webp",
    "revision": "b708060dbc46f5e40472c89b9bab34b7"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/얼굴.webp",
    "revision": "6970d2ed2c1920cad69554f85d9fafd5"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/오은영_리포트___결혼_지옥.webp",
    "revision": "39da488470d1eb5443912a46da389621"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/우주를_줄게.webp",
    "revision": "c1c6e03b37ad0beb92f5ecde4f05bfb4"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/운명전쟁49.webp",
    "revision": "3310524f2e10ec0d1564361184064f7f"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/유_퀴즈_온_더_블럭.webp",
    "revision": "41d7b4aac1af79d62c3cb5e2b35f0510"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/은애하는_도적님아.webp",
    "revision": "3dfe6ee9a05b0588d8a8b3e5aaea2bb9"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/이_사랑_통역_되나요_.webp",
    "revision": "6c2d90f17940f08014658c0d8ea1c596"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/이재__곧_죽습니다.webp",
    "revision": "2e20a4ce4213176b808d3432fe729d69"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/조각도시.webp",
    "revision": "1f1dcb42a3df9994d890fb7f8ca98e1c"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/주토피아_2.webp",
    "revision": "3725f0f40b5aae4743c47bf9b4449112"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/찬란한_너의_계절에.webp",
    "revision": "0efc35fb74e72fec2a24fc97a78f95c1"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/천하제빵___베이크_유어_드림.webp",
    "revision": "aa9f662f30878096cb2e4792bcced961"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/첫_번째_남자.webp",
    "revision": "0c673295c76327b460e9a23b23d09cd3"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/친애하는_X.webp",
    "revision": "57ac17a9a36cad473b8eab16f2e946c8"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/카지노_시즌2.webp",
    "revision": "a87df1b9f91d7f441b37807401c24c32"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/쿵푸_팬더_2.webp",
    "revision": "562a86a40e83207b3585aee97aa21e86"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/쿵푸_팬더.webp",
    "revision": "562a86a40e83207b3585aee97aa21e86"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/쿵푸팬더3.webp",
    "revision": "562a86a40e83207b3585aee97aa21e86"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/특별수사__사형수의_편지.webp",
    "revision": "e29b604405346d97287eab536a35de66"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/파인__촌뜨기들.webp",
    "revision": "1ddbf1a383ae6c08fef37d30409ca2c2"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/퍼스트_라이드.webp",
    "revision": "aafadef30fcc05fcce2d12f17a127a1f"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/폭싹_속았수다.webp",
    "revision": "c93ec3a501d85773f9a56e99f0740859"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/프레데터__죽음의_땅.webp",
    "revision": "b9fb71215c93cc1ac09e94e690c2f7a3"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/프로젝트_Y.webp",
    "revision": "5e82c42e7977e6e666269fb81112ddfc"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/하얀_차를_탄_여자.webp",
    "revision": "b511635075a8b6934db0cade355d28c1"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/하우스메이드.webp",
    "revision": "9bdbdd421335d2a757c641d56498d886"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/하트맨.webp",
    "revision": "a83edf9048cf4fa800472f722ad67549"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/현역가왕3.webp",
    "revision": "b580e9ee7ae97eca3bf4fe67886d0b7c"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/환승연애4.webp",
    "revision": "0d97cbb3fe3def7e4a64b0dafcb7c9c3"
  },
  {
    "url": "/images/thumbs/w320/posters/ott/흑백요리사__요리_계급_전쟁_시즌2.webp",
    "revision": "d6d3e891c7fdc702bab1df344e3a9aab"
  },
  {
    "url": "/images/thumbs/w320/posters/play/yes24_김해_2026_자유_패키지_P_art.webp",
    "revision": "e1376d05f38099cfed4fc4a1666b8c1f"
  },
  {
    "url": "/images/thumbs/w320/posters/play/yes24_김해_뮤직드라마_불편한_편의점.webp",
    "revision": "756796908fb6aca7724bbb912714bb51"
  },
  {
    "url": "/images/thumbs/w320/posters/play/yes24_창원_국립극단_연극_그의_어머니.webp",
    "revision": "ff124df7d53060b0baee0349e6dfeb79"
  },
  {
    "url": "/images/thumbs/w320/posters/popups/popup_7806.webp",
    "revision": "4dcb686c49f95785293e9f00291bf051"
  },
  {
    "url": "/images/thumbs/w320/posters/popups/popup_7879.webp",
    "revision": "35146cb2eafa69b46145bae615fcd661"
  },
  {
    "url": "/images/thumbs/w320/posters/popups/popup_7880.webp",
    "revision": "c5583ca8db328ba17f3432cf802b9e30"
  },
  {
    "url": "/images/thumbs/w320/posters/popups/popup_7881.webp",
    "revision": "45a2e5532b234916633ff2ebd67bf8d3"
  },
  {
    "url": "/images/thumbs/w320/posters/popups/popup_7882.webp",
    "revision": "1d47e50a1ba4201438c3d24d3a4cb071"
  },
  {
    "url": "/images/thumbs/w320/posters/popups/popup_7883.webp",
    "revision": "8934c355f9c4ef850bee06a77590b4c5"
  },
  {
    "url": "/images/thumbs/w320/posters/popups/popup_7884.webp",
    "revision": "8934c355f9c4ef850bee06a77590b4c5"
  },
  {
    "url": "/images/thumbs/w320/posters/popups/popup_7885.webp",
    "revision": "c301daff6c29086773c57590bb348b16"
  },
  {
    "url": "/images/thumbs/w320/posters/popups/popup_7886.webp",
    "revision": "0b7d05cabd89c79abdfa9ea07285c8b2"
  },
  {
    "url": "/images/thumbs/w320/posters/popups/popup_7887.webp",
    "revision": "3a51e7dbff1ae9002fdbe57d09140a9b"
  },
  {
    "url": "/images/thumbs/w320/posters/popups/popup_7888.webp",
    "revision": "ed1de28421201f9cd058a1f9795380a3"
  },
  {
    "url": "/images/thumbs/w320/posters/popups/popup_7889.webp",
    "revision": "edfb5f86b84454b407a1d5a7f52e117e"
  },
  {
    "url": "/images/thumbs/w320/posters/setec/setec_2250.webp",
    "revision": "366d2024c27676099fc2b60759f686c6"
  },
  {
    "url": "/images/thumbs/w320/posters/setec/setec_2251.webp",
    "revision": "80793c991ffadfe0ff2bc01de92247a0"
  },
  {
    "url": "/images/thumbs/w320/posters/setec/setec_2265.webp",
    "revision": "ae2d5ca603266b82310d35dab32f8d07"
  },
  {
    "url": "/images/thumbs/w320/posters/setec/setec_2278.webp",
    "revision": "5fdc964ca392de59d8b0f7d2218e2a5b"
  },
  {
    "url": "/images/thumbs/w320/posters/setec/setec_2286.webp",
    "revision": "80793c991ffadfe0ff2bc01de92247a0"
  },
  {
    "url": "/images/thumbs/w320/posters/setec/setec_2287.webp",
    "revision": "b00aee8274eb98777ab578c07bbe8bc4"
  },
  {
    "url": "/images/thumbs/w320/posters/setec/setec_2288.webp",
    "revision": "80793c991ffadfe0ff2bc01de92247a0"
  },
  {
    "url": "/images/thumbs/w320/posters/setec/setec_2299.webp",
    "revision": "b2a6ccdb0040b529e77f5a8029f399fc"
  },
  {
    "url": "/images/thumbs/w320/posters/setec/setec_2300.webp",
    "revision": "80793c991ffadfe0ff2bc01de92247a0"
  },
  {
    "url": "/images/thumbs/w320/posters/setec/setec_2301.webp",
    "revision": "80793c991ffadfe0ff2bc01de92247a0"
  },
  {
    "url": "/images/thumbs/w320/posters/setec/setec_2303.webp",
    "revision": "80793c991ffadfe0ff2bc01de92247a0"
  },
  {
    "url": "/images/thumbs/w320/posters/setec/setec_2304.webp",
    "revision": "80793c991ffadfe0ff2bc01de92247a0"
  },
  {
    "url": "/images/thumbs/w320/posters/templestay/templestay_25648.webp",
    "revision": "c16d1accaf26b363a1123726da6c5b64"
  },
  {
    "url": "/images/thumbs/w320/posters/templestay/templestay_25812.webp",
    "revision": "6e390272058afc0bb3f7e747847bbc83"
  },
  {
    "url": "/images/thumbs/w320/posters/templestay/templestay_26582.webp",
    "revision": "5fdbcda0c4c2bab6b21bc07e8354c5f6"
  },
  {
    "url": "/images/thumbs/w320/posters/templestay/templestay_27600.webp",
    "revision": "cd8c96aabac3b51ce48f8e3a83ff19ab"
  },
  {
    "url": "/images/thumbs/w320/posters/templestay/templestay_28179.webp",
    "revision": "2ac18b9bcf80107e29ce29702e8fe42c"
  },
  {
    "url": "/images/thumbs/w320/posters/templestay/templestay_28197.webp",
    "revision": "675cdd735bb025a5d0ca6231b53c0cfb"
  },
  {
    "url": "/images/thumbs/w320/posters/templestay/templestay_28215.webp",
    "revision": "07e2d0256a97ff0030d216ab903861b8"
  },
  {
    "url": "/images/thumbs/w320/posters/templestay/templestay_28224.webp",
    "revision": "e67c96293875afb38d7f36d8bda6dbe2"
  },
  {
    "url": "/images/thumbs/w320/posters/templestay/templestay_28741.webp",
    "revision": "7e56210453b4e181fe9765dbd1bbca2a"
  },
  {
    "url": "/images/thumbs/w320/posters/templestay/templestay_28747.webp",
    "revision": "1a9aca694755f27e061abecd4370e459"
  },
  {
    "url": "/images/thumbs/w320/posters/templestay/templestay_28807.webp",
    "revision": "6045326c6ed1b2bd81bff9e2c0dd9493"
  },
  {
    "url": "/images/thumbs/w320/posters/templestay/templestay_28808.webp",
    "revision": "9b22207f28d90151cf0a566f7578a274"
  },
  {
    "url": "/images/ticket_icon.png",
    "revision": "f57a7e4b62c0e3a48fb70032ddb74b8b"
  },
  {
    "url": "/images/volleyball_poster.png",
    "revision": "674bd39c05c6a0c0413e82462278f3c9"
  },
  {
    "url": "/manifest.json",
    "revision": "08dc4263538f8d6f8e3fb8fbebddd945"
  },
  {
    "url": "/next.svg",
    "revision": "8e061864f388b47f33a1c3780831193e"
  },
  {
    "url": "/vercel.svg",
    "revision": "c0af2f507b369b085b35ef4bbe3bcf1e"
  },
  {
    "url": "/window.svg",
    "revision": "a2760511c65806022ad20adf74370ff3"
  },
  {
    "url": "/workbox-4754cb34.js",
    "revision": "98d58f6ba4bb37cd18d746933f6b0ed4"
  }
].concat(self.__precacheManifest || []);
workbox.precaching.precacheAndRoute(self.__precacheManifest, {});

workbox.precaching.cleanupOutdatedCaches();

workbox.routing.registerRoute(/\/version\.txt(?:\?.*)?$/i, new workbox.strategies.NetworkFirst({ "cacheName":"version-check","networkTimeoutSeconds":2, plugins: [new workbox.cacheableResponse.Plugin({ statuses: [ 0, 200 ] }), new workbox.expiration.Plugin({ maxEntries: 4, maxAgeSeconds: 60, purgeOnQuotaError: false })] }), 'GET');
workbox.routing.registerRoute(/\/data\/build-info\.json(?:\?.*)?$/i, new workbox.strategies.NetworkFirst({ "cacheName":"build-info","networkTimeoutSeconds":2, plugins: [new workbox.cacheableResponse.Plugin({ statuses: [ 0, 200 ] }), new workbox.expiration.Plugin({ maxEntries: 4, maxAgeSeconds: 60, purgeOnQuotaError: false })] }), 'GET');
workbox.routing.registerRoute(/\/data\/(?:performances|home-feed|map-items|map-venues|calendar-items|cinemas|venues|movies|ott)\.json(?:\?.*)?$/i, new workbox.strategies.StaleWhileRevalidate({ "cacheName":"runtime-data-payloads", plugins: [new workbox.cacheableResponse.Plugin({ statuses: [ 0, 200 ] }), new workbox.expiration.Plugin({ maxEntries: 32, maxAgeSeconds: 86400, purgeOnQuotaError: false })] }), 'GET');
workbox.routing.registerRoute(/\/data\/categories\/[^/]+\.json(?:\?.*)?$/i, new workbox.strategies.StaleWhileRevalidate({ "cacheName":"runtime-data-payloads", plugins: [new workbox.cacheableResponse.Plugin({ statuses: [ 0, 200 ] }), new workbox.expiration.Plugin({ maxEntries: 32, maxAgeSeconds: 86400, purgeOnQuotaError: false })] }), 'GET');
workbox.routing.registerRoute(/\/data\/(?:pages|category-pages)\/.+\.json(?:\?.*)?$/i, new workbox.strategies.StaleWhileRevalidate({ "cacheName":"runtime-paged-data", plugins: [new workbox.cacheableResponse.Plugin({ statuses: [ 0, 200 ] }), new workbox.expiration.Plugin({ maxEntries: 160, maxAgeSeconds: 86400, purgeOnQuotaError: false })] }), 'GET');
workbox.routing.registerRoute(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i, new workbox.strategies.CacheFirst({ "cacheName":"google-fonts", plugins: [new workbox.expiration.Plugin({ maxEntries: 4, maxAgeSeconds: 31536000, purgeOnQuotaError: false })] }), 'GET');
workbox.routing.registerRoute(/^https:\/\/use\.fontawesome\.com\/releases\/.*/i, new workbox.strategies.CacheFirst({ "cacheName":"font-awesome", plugins: [new workbox.expiration.Plugin({ maxEntries: 1, maxAgeSeconds: 31536000, purgeOnQuotaError: false })] }), 'GET');
workbox.routing.registerRoute(/\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i, new workbox.strategies.StaleWhileRevalidate({ "cacheName":"static-font-assets", plugins: [new workbox.expiration.Plugin({ maxEntries: 4, maxAgeSeconds: 604800, purgeOnQuotaError: false })] }), 'GET');
workbox.routing.registerRoute(/^https:\/\/wsrv\.nl\/.*/i, new workbox.strategies.CacheFirst({ "cacheName":"optimized-poster-images", plugins: [new workbox.cacheableResponse.Plugin({ statuses: [ 0, 200 ] }), new workbox.expiration.Plugin({ maxEntries: 1200, maxAgeSeconds: 3888000, purgeOnQuotaError: false })] }), 'GET');
workbox.routing.registerRoute(/^https?:\/\/(?:www\.)?(?:kopis\.or\.kr|culture\.go\.kr)\/.*/i, new workbox.strategies.CacheFirst({ "cacheName":"remote-poster-images", plugins: [new workbox.cacheableResponse.Plugin({ statuses: [ 0, 200 ] }), new workbox.expiration.Plugin({ maxEntries: 1200, maxAgeSeconds: 2592000, purgeOnQuotaError: false })] }), 'GET');
workbox.routing.registerRoute(/^https?:\/\/(?:ticketimage\.interpark\.com|image\.yes24\.com|tkfile\.yes24\.com|cdnticket\.melon\.co\.kr|file\.kinolights\.com|image\.toast\.com|ticketlink\.co\.kr)\/.*/i, new workbox.strategies.CacheFirst({ "cacheName":"remote-ticket-images", plugins: [new workbox.cacheableResponse.Plugin({ statuses: [ 0, 200 ] }), new workbox.expiration.Plugin({ maxEntries: 900, maxAgeSeconds: 2592000, purgeOnQuotaError: false })] }), 'GET');
workbox.routing.registerRoute(/^https?:\/\/(?:cdn\.visitkorea\.or\.kr|kfescdn\.visitkorea\.or\.kr|tong\.visitkorea\.or\.kr|api\.visitkorea\.or\.kr)\/.*/i, new workbox.strategies.CacheFirst({ "cacheName":"remote-tourism-images", plugins: [new workbox.cacheableResponse.Plugin({ statuses: [ 0, 200 ] }), new workbox.expiration.Plugin({ maxEntries: 900, maxAgeSeconds: 2592000, purgeOnQuotaError: false })] }), 'GET');
workbox.routing.registerRoute(/^https?:\/\/(?:[^/]+\.)?(?:mom-mom\.net|mom-mom\.co\.kr|nhncommerce\.com|firebasestorage\.googleapis\.com)\/.*/i, new workbox.strategies.CacheFirst({ "cacheName":"remote-family-images", plugins: [new workbox.cacheableResponse.Plugin({ statuses: [ 0, 200 ] }), new workbox.expiration.Plugin({ maxEntries: 900, maxAgeSeconds: 2592000, purgeOnQuotaError: false })] }), 'GET');
workbox.routing.registerRoute(/\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i, new workbox.strategies.StaleWhileRevalidate({ "cacheName":"static-image-assets", plugins: [new workbox.expiration.Plugin({ maxEntries: 500, maxAgeSeconds: 2592000, purgeOnQuotaError: false })] }), 'GET');
workbox.routing.registerRoute(/\.(?:js)$/i, new workbox.strategies.StaleWhileRevalidate({ "cacheName":"static-js-assets", plugins: [new workbox.expiration.Plugin({ maxEntries: 16, maxAgeSeconds: 86400, purgeOnQuotaError: false })] }), 'GET');
workbox.routing.registerRoute(/\.(?:css|less)$/i, new workbox.strategies.StaleWhileRevalidate({ "cacheName":"static-style-assets", plugins: [new workbox.expiration.Plugin({ maxEntries: 16, maxAgeSeconds: 86400, purgeOnQuotaError: false })] }), 'GET');
workbox.routing.registerRoute(/.*/i, new workbox.strategies.NetworkFirst({ "cacheName":"others","networkTimeoutSeconds":3, plugins: [new workbox.expiration.Plugin({ maxEntries: 16, maxAgeSeconds: 3600, purgeOnQuotaError: false })] }), 'GET');
