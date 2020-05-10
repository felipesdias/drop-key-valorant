const puppeteer = require("puppeteer");
const selectors = require("./selectors.json");
const readline = require("readline");
const params = require("./env.json");

const readLineConsole = (async function* readLineConsole() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  for await (const line of rl) {
    yield line;
  }
})();

const sleep = (miliseconds) =>
  new Promise((resolve) => setTimeout(resolve, miliseconds));

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: params.chromePath,
  });

  const page = await browser.newPage();
  await page.goto("https://twitch.tv");

  await page.waitForSelector(selectors.btnOpenLogin);
  await page.click(selectors.btnOpenLogin);

  await page.waitForSelector(selectors.inputUsername);
  await page.waitForSelector(selectors.inputpassword);
  await page.waitForSelector(selectors.btnLogin);

  await page.type(selectors.inputUsername, params.username, { delay: 35 });
  await page.type(selectors.inputpassword, params.password, { delay: 35 });

  await page.click(selectors.btnLogin);

  console.log("aguarde 15seg...");

  await sleep(10000); // espera carregar captcha
  await page.mouse.click(400, 390); // iniciar teste
  await sleep(3000); // espera iniciar teste

  console.log("Acompanhe o arquivo captcha.png");

  while(true) {
    await page.screenshot({ path: "captcha.png" });
    process.stdout.write("Girar imagem (0 - girar; 1 - aceitar; 2 - sair): ");
    const input = (await readLineConsole.next()).value;
    switch(input) {
      case '0':
        await page.mouse.click(300, 340);
        await sleep(500);
        break;
      case '1':
        await page.mouse.click(400, 415);
        await sleep(4000);
        break;
      case '2':
        await sleep(500);
        break;
      default:
        console.log('');
    }

    if (input === '2')
      break;
  }

  process.stdout.write("Código de acesso: ");
  let accessCode = (await readLineConsole.next()).value.trim().split("");
  console.log("");

  const accessCodeSelectors = accessCode.map((_, idx) =>
    selectors.divAccessCodes.replace("|idx", String(idx + 1))
  );

  await Promise.all(
    accessCodeSelectors.map(
      async (select) => await page.waitForSelector(select)
    )
  );

  for (let i = 0; i < accessCode.length; i++) {
    await page.type(accessCodeSelectors[i], accessCode[i]);
    await sleep(50);
  }

  await sleep(1000);

  await page.goto(selectors.avaiableStreamsUrl);

  await page.waitForSelector(selectors.divStreams);

  let streamsUrls = [];

  for (let i = 0; i < 20; i++) {
    streamsUrls = await page.evaluate((selector) => {
      return [...document.querySelector(selector).children]
        .map((x) => {
          try {
            return x.querySelector("article").querySelector("a").href;
          } catch {
            return false;
          }
        })
        .filter((x) => x);
    }, selectors.divStreams);

    if (streamsUrls.length >= params.nStreams)
      break;

    await page.evaluate((selector) => {
      const div = document.querySelector(selector);
      div.scrollTo(0, div.scrollHeight);
    }, selectors.containerDiv);
    await sleep(2000);
  }

  await page.close();

  for (let i = 0; i < streamsUrls.length && i < params.nStreams; i++) {
    const pageStrem = await browser.newPage();
    await pageStrem.goto(streamsUrls[i]);

    while (true) {
      const initializeVideo = await pageStrem.evaluate((selector) => {
        return !!document.querySelector(selector);
      }, selectors.divControlVideo);

      if (initializeVideo) break;

      const byPassUnauthorized = await pageStrem.evaluate((selector) => {
        return !!document.querySelector(selector);
      }, selectors.btnStartWatch);

      if (byPassUnauthorized) await pageStrem.click(selectors.btnStartWatch);

      await sleep(1000);
    }
    
    while(await pageStrem.evaluate(selector => !!document.querySelector(selector), selectors.spinnerLoading));

    console.log('aberto:', streamsUrls[i]);
    await pageStrem.screenshot({
      path: `./images/${streamsUrls[i].split("/").reverse()[0]}.png`,
    });
  }
})();
