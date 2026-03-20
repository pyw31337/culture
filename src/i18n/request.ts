import {getRequestConfig} from 'next-intl/server';
 
export default getRequestConfig(async ({ locale }) => {
    const targetLocale = locale || 'ko';
    return {
        locale: targetLocale as string,
        messages: (await import(`../messages/${targetLocale}.json`)).default
    };
});
