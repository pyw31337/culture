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
  "/culture/_next/precache.ReyVf3Ay6H26dQiqWULjd.e4a0919797d0c832f04be11775d72e03.js"
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
    "url": "/images/soccer_poster.png",
    "revision": "6c1d9e2cd563eb973b8c1291d33d58dd"
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
workbox.routing.registerRoute(/\/data\/(?:performances|cinemas|venues|movies|ott)\.json(?:\?.*)?$/i, new workbox.strategies.NetworkFirst({ "cacheName":"runtime-data-payloads","networkTimeoutSeconds":2, plugins: [new workbox.cacheableResponse.Plugin({ statuses: [ 0, 200 ] }), new workbox.expiration.Plugin({ maxEntries: 32, maxAgeSeconds: 86400, purgeOnQuotaError: false })] }), 'GET');
workbox.routing.registerRoute(/\/data\/categories\/[^/]+\.json(?:\?.*)?$/i, new workbox.strategies.NetworkFirst({ "cacheName":"runtime-data-payloads","networkTimeoutSeconds":2, plugins: [new workbox.cacheableResponse.Plugin({ statuses: [ 0, 200 ] }), new workbox.expiration.Plugin({ maxEntries: 32, maxAgeSeconds: 86400, purgeOnQuotaError: false })] }), 'GET');
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
