import { ocrSpace } from 'ocr-space-api-wrapper';
import { CheckerGenerateContext } from './types';
import { compareTwoStrings } from 'string-similarity';
import filetype from 'magic-bytes.js'
import { readFileSync } from 'fs';

import puppeteer, { Browser } from 'puppeteer';
import { RequestInterceptionManager } from 'puppeteer-intercept-and-modify-requests'

let recognize: (img: string) => Promise<string> = (img) => { throw Error("Not initialized") };
let browser: Browser | undefined;
async function initializeOCR() {
    if (browser) browser.close();
    browser = undefined
    browser = await puppeteer.launch({
        headless: false
    });

    const page = await browser.newPage();
    page.setViewport({
        width: 1000,
        height: 800
    })

    const client = await page.target().createCDPSession()
    const interceptManager = new RequestInterceptionManager(client as any);

    await interceptManager.intercept(
        {
            urlPattern: `https://pearocr.com/js/668.*.js`,
            resourceType: 'Script',
            modifyResponse({ body }) {
                setTimeout(() => {
                    interceptManager.disable()
                }, 100)
                return {
                    body: body?.replace(/\,(\S+)\.addImage\=/, ',window.antOcr=$1,$1.addImage='),
                }
            },
        }
    )

    await page.goto('https://pearocr.com/#/');

    page.evaluate(`
        const _refreshItemText = antOcr.refreshItemText

    const recognize = (img)=>{
        return Promise.race([new Promise((rs)=>{
            antOcr.deleteAll();
            antOcr.addImage(img);
            
            antOcr.refreshItemText = (e)=>{
                _refreshItemText(e);
                rs(antOcr.RecoDataList[0].text);
                // rs(antOcr.RecoDataList[0].detail.map(v=>v.text).join('\\n'));
            }
        }),new Promise((_,rj)=>setTimeout(rj,20000,'timeout'))])
    }

    window.recognize=recognize;`);

    recognize = (img) => {
        // @ts-ignore
        return page.evaluate(async (img) => await window.recognize(img), img) as any
    }
}


initializeOCR();

export const generate = async ({
    message,
    client,
    getMedia
}: CheckerGenerateContext) => {
    if (message.media?.className !== 'MessageMediaPhoto') return;
    const mediaBuf = (await getMedia()) as unknown as Buffer;
    console.log("[ OCR ] Recognizing..");

    for(let attempt=0;attempt<2;attempt++){
        try {
            const res = await recognize(`data:${filetype(mediaBuf)[0].mime?.replace('jpeg', 'jpg')};base64,${(mediaBuf.toString('base64'))}`);
            const ocrResult = res?.trim() || 'No Result';
            console.log('[ OCR ] Result:', ocrResult);

            if (ocrResult.length < 10) return 'No Result';
            return ocrResult;
        } catch (e) {
            console.warn("[ OCR ] Error", e);
            initializeOCR();
            await new Promise(rs => setTimeout(rs, 5000));
        }
    }
    console.error("[ OCR ] Failed to recognize");
    return 'No Result'
}

export const checkDuplicate = async (s1: string, s2: string) => {
    const d = compareTwoStrings(s1, s2);
    return {
        isDuplicated: d > 0.8 && !(s1 === 'No Result') && !(s2 === 'No Result'),
        confidence: (d - 0.8) / 0.2
    }
}