import*as f from'node:fs';
const I=process.env.MAKEFUN_INPUT_DIR??'/input',J=process.env.MAKEFUN_OUTPUT_DIR??'/output';
function run(P,A){
const n=P.length,S=new Int32Array(256),C=new Int32Array(64),M=new Int32Array(256),o=new Uint8Array(65536);
let p=0,q=0,l=0,g=0,c=0,s=0;
const F=e=>[o.subarray(0,l),e];
for(;;){
if(s==1e6)return F(10);
if(c<0||c>=n)return F(9);
const k=P[c],V=k>15&&k<35&&k!=31,B=V&&k!=23&&k!=27;
if(!(k<8||V||k>47&&k<53||k==64||k==65||k>79&&k<84))return F(5);
const m=k==1?1:k==2?4:k>47&&k<52?2:0;
if(c+m>=n)return F(9);
s++;
const x=c+1+m;
const u=k==7?3:k==5||k==6||k==65||B?2:k==3||k==4||k==23||k==27||k==49||k==50||k==64||k==80||k==81||k==83?1:0;
const v=k==6?3:k==4||k==5?2:k==1||k==2||k==23||k==27||k==64||k==82||B?1:0;
if(p<u)return F(2);
if(p-u+v>256)return F(3);
c=x;
if(B){const b=S[p-1],a=S[p-2];let r;
switch(k){
case 16:r=(a+b)|0;break;
case 17:r=(a-b)|0;break;
case 18:r=Math.imul(a,b);break;
case 19:if(!b)return F(4);r=a==-2147483648&&b==-1?a:(a/b)|0;break;
case 20:if(!b)return F(4);r=b==-1?0:(a%b)|0;break;
case 21:if(!b)return F(4);r=Math.floor((a>>>0)/(b>>>0))|0;break;
case 22:if(!b)return F(4);r=((a>>>0)%(b>>>0))|0;break;
case 24:r=a&b;break;
case 25:r=a|b;break;
case 26:r=a^b;break;
case 28:r=a<<(b&31);break;
case 29:r=a>>(b&31);break;
case 30:r=(a>>>(b&31))|0;break;
case 32:r=a==b?1:0;break;
case 33:r=a<b?1:0;break;
case 34:r=(a>>>0)<(b>>>0)?1:0;break;
}
p-=2;S[p++]=r;}
else switch(k){
case 0:return F(0);
case 1:S[p++]=(P[x-1]<<24)>>24;break;
case 2:S[p++]=P[x-4]|P[x-3]<<8|P[x-2]<<16|P[x-1]<<24;break;
case 3:p--;break;
case 4:S[p]=S[p-1];p++;break;
case 5:{const t=S[p-1];S[p-1]=S[p-2];S[p-2]=t;break;}
case 6:S[p]=S[p-2];p++;break;
case 7:{const a=S[p-3];S[p-3]=S[p-2];S[p-2]=S[p-1];S[p-1]=a;break;}
case 23:S[p-1]=(-S[p-1])|0;break;
case 27:S[p-1]=~S[p-1];break;
case 48:case 49:case 50:{
const r=((P[x-2]|P[x-1]<<8)<<16)>>16;let t=k==48;
if(k!=48){const w=S[--p];t=k==49?w==0:w!=0;}
if(t)c=x+r;break;}
case 51:if(q==64)return F(7);C[q++]=x;c=P[x-2]|P[x-1]<<8;break;
case 52:if(!q)return F(8);c=C[--q];break;
case 64:{const a=S[p-1];if(a<0||a>255)return F(6);S[p-1]=M[a];break;}
case 65:{const a=S[p-1],w=S[p-2];if(a<0||a>255)return F(6);p-=2;M[a]=w;break;}
case 80:{const z=String(S[p-1]);if(l+z.length>65536)return F(11);p--;for(let i=0;i<z.length;i++)o[l++]=z.charCodeAt(i);break;}
case 81:if(l+1>65536)return F(11);o[l++]=S[--p]&255;break;
case 82:S[p++]=g<A.length?A[g++]:-1;break;
case 83:return F(S[--p]&255);
}
}
}
for(const d of f.readdirSync(I).sort()){
const[u,e]=run(f.readFileSync(I+'/'+d+'/program.bin'),f.readFileSync(I+'/'+d+'/input.bin'));
f.mkdirSync(J+'/'+d,{recursive:true});
f.writeFileSync(J+'/'+d+'/stdout.bin',u);
f.writeFileSync(J+'/'+d+'/exit.txt',e+'\n');
}
