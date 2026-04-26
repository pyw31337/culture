(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[841],{24538:(e,r,t)=>{"use strict";t.d(r,{A:()=>a});let a=(0,t(78340).A)("map-pin",[["path",{d:"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",key:"1r0f0z"}],["circle",{cx:"12",cy:"10",r:"3",key:"ilqhr7"}]])},24821:(e,r,t)=>{Promise.resolve().then(t.bind(t,59603)),Promise.resolve().then(t.bind(t,98787)),Promise.resolve().then(t.bind(t,51943))},51943:(e,r,t)=>{"use strict";t.d(r,{default:()=>n});var a=t(95155),i=t(12115);function n(){let e=(0,i.useMemo)(()=>{let e="rgb(232, 121, 249)",r="rgb(96, 165, 250)",t="rgb(94, 234, 212)";return Array.from({length:25}).map((a,i)=>{let n=i+1,l=Math.floor(6*Math.random())+1;return{id:n,colors:1===l?[e,r,t]:2===l?[e,t,r]:3===l?[t,e,r]:4===l?[t,r,e]:5===l?[r,t,e]:[r,e,t],duration:45-.9*n,delay:-(n/25*45)}})},[]);return(0,a.jsxs)("div",{className:"rainbow-bg-wrapper",children:[(0,a.jsx)("div",{className:"rb-rays-container",children:e.map(e=>(0,a.jsx)("div",{className:"rb-ray",style:{"--rb-c1":e.colors[0],"--rb-c2":e.colors[1],"--rb-c3":e.colors[2],"--rb-dur":`${e.duration}s`,"--rb-del":`${e.delay}s`}},e.id))}),(0,a.jsx)("div",{className:"rb-fog-h"}),(0,a.jsx)("div",{className:"rb-fog-v"}),(0,a.jsx)("style",{dangerouslySetInnerHTML:{__html:`
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
            `}})]})}},53810:(e,r,t)=>{"use strict";t.d(r,{A:()=>a});let a=(0,t(78340).A)("share-2",[["circle",{cx:"18",cy:"5",r:"3",key:"gq8acd"}],["circle",{cx:"6",cy:"12",r:"3",key:"w7nqdw"}],["circle",{cx:"18",cy:"19",r:"3",key:"1xt0gg"}],["line",{x1:"8.59",x2:"15.42",y1:"13.51",y2:"17.49",key:"47mynk"}],["line",{x1:"15.41",x2:"8.59",y1:"6.51",y2:"10.49",key:"1n3mei"}]])},54332:(e,r,t)=>{"use strict";t.d(r,{A:()=>a});let a=(0,t(78340).A)("film",[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}],["path",{d:"M7 3v18",key:"bbkbws"}],["path",{d:"M3 7.5h4",key:"zfgn84"}],["path",{d:"M3 12h18",key:"1i2n21"}],["path",{d:"M3 16.5h4",key:"1230mu"}],["path",{d:"M17 3v18",key:"in4fa5"}],["path",{d:"M17 7.5h4",key:"myr1c1"}],["path",{d:"M17 16.5h4",key:"go4c1d"}]])},57420:(e,r,t)=>{"use strict";t.d(r,{A:()=>a});let a=(0,t(78340).A)("calendar",[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["path",{d:"M3 10h18",key:"8toen8"}]])},61341:(e,r,t)=>{"use strict";function a(e){let r=function(e){for(let r of[e.dateRaw,e.date]){if(!r||"string"!=typeof r)continue;let e=function(e){let r=e.trim();if(!r)return null;let t=r.replace(/\([^)]*\)/g," ").replace(/\[[^\]]*\]/g," ").trim(),a=t.match(/(\d{4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);if(a)return{year:Number(a[1]),month:Number(a[2]),day:Number(a[3])};let i=t.match(/(^|[^\d])(\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})(?!\d)/);if(i)return{year:2e3+Number(i[2]),month:Number(i[3]),day:Number(i[4])};let n=t.match(/^(\d{4})(\d{2})(\d{2})$/);return n?{year:Number(n[1]),month:Number(n[2]),day:Number(n[3])}:null}(r);if(!e)continue;let t=new Date(e.year,e.month-1,e.day);if(!Number.isNaN(t.getTime()))return t.setHours(0,0,0,0),t}return null}(e);if(!r){let r;return(r=[e.dateRaw,e.date].find(e=>"string"==typeof e&&e.trim().length>0)?.trim())?r.toUpperCase().includes("OPEN RUN")||r.includes("오픈런")?"오픈런":r.includes("상시")?"상시":r.includes("예약 확정")||r.includes("일정 조율")||r.includes("옵션에서 선택")?"예약형":null:null}let t=new Date;t.setHours(0,0,0,0);let a=Math.round((r.getTime()-t.getTime())/864e5);return 0===a?"D-Day":a>0?`D-${a}`:`D+${Math.abs(a)}`}t.d(r,{R:()=>a})},84980:(e,r,t)=>{"use strict";t.d(r,{A:()=>a});let a=(0,t(78340).A)("clock",[["path",{d:"M12 6v6l4 2",key:"mmk7yg"}],["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}]])},86901:(e,r,t)=>{"use strict";t.d(r,{A:()=>a});let a=(0,t(78340).A)("sparkles",[["path",{d:"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z",key:"1s2grr"}],["path",{d:"M20 2v4",key:"1rf3ol"}],["path",{d:"M22 4h-4",key:"gwowj6"}],["circle",{cx:"4",cy:"20",r:"2",key:"6kqj1y"}]])},94290:(e,r,t)=>{"use strict";t.d(r,{A:()=>a});let a=(0,t(78340).A)("star",[["path",{d:"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",key:"r04s7s"}]])},98787:(e,r,t)=>{"use strict";t.d(r,{default:()=>i});var a=t(12115);function i({id:e}){return(0,a.useEffect)(()=>{let r=setTimeout(()=>{window.location.replace(`/culture/#p=${e}`)},500);return()=>clearTimeout(r)},[e]),null}}},e=>{e.O(0,[538,467,750,603,441,794,358],()=>e(e.s=24821)),_N_E=e.O()}]);