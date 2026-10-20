const cleanup:(()=>Promise<void>)[]=[];
export function onShutdown(fn:()=>Promise<void>){cleanup.push(fn);}
export async function closeRuntime(){for(const fn of cleanup.reverse())await fn();}
