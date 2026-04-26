(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[345],{37145:(e,r,a)=>{"use strict";a.r(r),a.d(r,{default:()=>d});var t=a(95155),i=a(12115),s=a(98500),o=a.n(s),n=a(51943),l=a(66614);function d(){return(0,i.useEffect)(()=>{let e=window.location.pathname.match(/\/p\/([^/]+)\/?$/);if(!e)return;let r=decodeURIComponent(e[1]),a=setTimeout(()=>{window.location.replace(`/culture/#p=${encodeURIComponent(r)}`)},300);return()=>clearTimeout(a)},[]),(0,t.jsxs)("main",{className:"relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-gray-900 text-white",children:[(0,t.jsx)(n.default,{}),(0,t.jsxs)("div",{className:"relative z-10 text-center px-4",children:[(0,t.jsx)("h1",{className:"text-9xl font-black mb-4 opacity-20",children:"404"}),(0,t.jsx)("h2",{className:"text-3xl font-bold mb-6",children:"요청하신 페이지를 찾을 수 없습니다."}),(0,t.jsxs)("p",{className:"text-gray-400 mb-10 max-w-md mx-auto",children:["존재하지 않거나 아직 정적 페이지가 생성되지 않은 공연 정보일 수 있습니다.",(0,t.jsx)("br",{}),"홈으로 돌아가 최신 문화 정보를 확인해보세요."]}),(0,t.jsxs)(o(),{href:"/",className:"inline-flex items-center gap-2 px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-xl shadow-purple-900/20",children:[(0,t.jsx)(l.A,{size:20}),"Culture Flow 홈으로 이동"]})]}),(0,t.jsx)("div",{className:"bg-squares opacity-30 sm:opacity-50 pointer-events-none",children:[...Array(10)].map((e,r)=>(0,t.jsx)("div",{className:"bg-square"},r))})]})}},51943:(e,r,a)=>{"use strict";a.d(r,{default:()=>s});var t=a(95155),i=a(12115);function s(){let e=(0,i.useMemo)(()=>{let e="rgb(232, 121, 249)",r="rgb(96, 165, 250)",a="rgb(94, 234, 212)";return Array.from({length:25}).map((t,i)=>{let s=i+1,o=Math.floor(6*Math.random())+1;return{id:s,colors:1===o?[e,r,a]:2===o?[e,a,r]:3===o?[a,e,r]:4===o?[a,r,e]:5===o?[r,a,e]:[r,e,a],duration:45-.9*s,delay:-(s/25*45)}})},[]);return(0,t.jsxs)("div",{className:"rainbow-bg-wrapper",children:[(0,t.jsx)("div",{className:"rb-rays-container",children:e.map(e=>(0,t.jsx)("div",{className:"rb-ray",style:{"--rb-c1":e.colors[0],"--rb-c2":e.colors[1],"--rb-c3":e.colors[2],"--rb-dur":`${e.duration}s`,"--rb-del":`${e.delay}s`}},e.id))}),(0,t.jsx)("div",{className:"rb-fog-h"}),(0,t.jsx)("div",{className:"rb-fog-v"}),(0,t.jsx)("style",{dangerouslySetInnerHTML:{__html:`
                .rainbow-bg-wrapper {
                    position: fixed;
                    inset: 0;
                    z-index: 0;
                    overflow: hidden;
                    pointer-events: none;
                    background: white;
                }

                .dark .rainbow-bg-wrapper {
                    background: #0a0a0a;
                }

                .rb-rays-container {
                    position: absolute;
                    inset: 0;
                    mask-image: linear-gradient(to right, transparent 0%, transparent 50%, black 72%, black 100%);
                    -webkit-mask-image: linear-gradient(to right, transparent 0%, transparent 50%, black 72%, black 100%);
                }

                .rb-ray {
                    height: 100vh;
                    width: 0;
                    top: 0;
                    right: -25vw;
                    position: absolute;
                    transform: rotate(10deg);
                    transform-origin: top right;
                    box-shadow:
                        -130px 0 80px 40px var(--rb-bg),
                        -50px 0 50px 25px var(--rb-c1),
                        0 0 50px 25px var(--rb-c2),
                        50px 0 50px 25px var(--rb-c3),
                        130px 0 80px 40px var(--rb-bg);
                    animation: rb-slide var(--rb-dur) linear infinite;
                    animation-delay: var(--rb-del);
                }

                /* Light mode: white blending — exactly like the original */
                .rb-ray { --rb-bg: white; }
                .rb-fog-h { --rb-bg: white; }
                .rb-fog-v { --rb-bg: white; }

                /* Dark mode: dark blending, softer fog */
                .dark .rb-ray { --rb-bg: #0a0a0a; }
                .dark .rb-fog-h { --rb-bg: #0a0a0a; }
                .dark .rb-fog-v { --rb-bg: #0a0a0a; }

                @keyframes rb-slide {
                    from { right: -25vw; }
                    to { right: 125vw; }
                }

                .rb-fog-h {
                    box-shadow: 0 0 50vh 30vh var(--rb-bg);
                    width: 100vw;
                    height: 0;
                    bottom: 0;
                    left: 0;
                    position: absolute;
                    z-index: 1;
                }

                .rb-fog-v {
                    box-shadow: 0 0 25vw 15vw var(--rb-bg);
                    width: 0;
                    height: 100vh;
                    bottom: 0;
                    left: 0;
                    position: absolute;
                    z-index: 1;
                }
            `}})]})}},66614:(e,r,a)=>{"use strict";a.d(r,{A:()=>t});let t=(0,a(78340).A)("house",[["path",{d:"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",key:"5wwlr5"}],["path",{d:"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",key:"r6nss1"}]])},74944:(e,r,a)=>{Promise.resolve().then(a.bind(a,37145))},78340:(e,r,a)=>{"use strict";a.d(r,{A:()=>l});var t=a(12115);let i=e=>{let r=e.replace(/^([A-Z])|[\s-_]+(\w)/g,(e,r,a)=>a?a.toUpperCase():r.toLowerCase());return r.charAt(0).toUpperCase()+r.slice(1)},s=(...e)=>e.filter((e,r,a)=>!!e&&""!==e.trim()&&a.indexOf(e)===r).join(" ").trim();var o={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};let n=(0,t.forwardRef)(({color:e="currentColor",size:r=24,strokeWidth:a=2,absoluteStrokeWidth:i,className:n="",children:l,iconNode:d,...b},c)=>(0,t.createElement)("svg",{ref:c,...o,width:r,height:r,stroke:e,strokeWidth:i?24*Number(a)/Number(r):a,className:s("lucide",n),...!l&&!(e=>{for(let r in e)if(r.startsWith("aria-")||"role"===r||"title"===r)return!0})(b)&&{"aria-hidden":"true"},...b},[...d.map(([e,r])=>(0,t.createElement)(e,r)),...Array.isArray(l)?l:[l]])),l=(e,r)=>{let a=(0,t.forwardRef)(({className:a,...o},l)=>(0,t.createElement)(n,{ref:l,iconNode:r,className:s(`lucide-${i(e).replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase()}`,`lucide-${e}`,a),...o}));return a.displayName=i(e),a}}},e=>{e.O(0,[500,441,794,358],()=>e(e.s=74944)),_N_E=e.O()}]);