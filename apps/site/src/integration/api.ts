export function publicApiOrigin(value=import.meta.env.VITE_PUBLIC_API_ORIGIN):string {
 if(!value)return '';
 try{const url=new URL(value);if(url.username||url.password||url.search||url.hash||url.pathname!=='/')return '';if(url.protocol==='https:'||import.meta.env.DEV&&url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname))return url.origin;}catch{}return '';
}
export const publicStatusEndpoint=publicApiOrigin()+'/api/public/erlc-status';
