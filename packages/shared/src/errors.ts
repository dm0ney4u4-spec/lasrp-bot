export function publicError(error:unknown){
 if(!(error instanceof Error))return 'The action could not be completed. Please try again.';
 if(error.name.startsWith('Prisma')||/DATABASE_URL|postgres(?:ql)?:\/\/|password=|token=|server-key/i.test(error.message))return 'A database or configuration check failed. Management can review the server diagnostics.';
 return error.message.slice(0,1800);
}
