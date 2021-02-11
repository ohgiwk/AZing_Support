import puppeteer from 'puppeteer'
import cheerio from 'cheerio'
import moment from 'moment'

export default class WebMailPage {
  private _browser?: puppeteer.Browser
  private _page?: puppeteer.Page

  get browser() {
    if (this._browser) {
      return this._browser
    } else {
      throw new Error()
    }
  }
  get page() {
    if (this._page) {
      return this._page
    } else {
      throw new Error()
    }
  }
  public async open(url: string, username: string, password: string) {
    // prettier-ignore
    this._browser = await puppeteer.launch({ headless: false, defaultViewport: null })
    this._page = await this.browser.newPage()

    // prettier-ignore
    const Authorization = `Basic ` + Buffer.from(`${username}:${password}`).toString("base64")
    await this.page.setExtraHTTPHeaders({ Authorization })

    await this.page.goto(url)
  }

  public async close() {
    await this.browser.close()
  }

  public async login(username: string, password: string) {
    await this.page.type('#rcmloginuser', username)
    await this.page.type('#rcmloginpwd', password)
    await this.page.click('#rcmloginsubmit')
    await this.page.waitForNavigation({ waitUntil: 'domcontentloaded' })
  }

  public async pageBack() {
    await this.page.click('#rcmbtn108')
    await this.page.waitForTimeout(1500)
  }

  /**
   * メール一覧の絞り込み
   */
  public async filterMailList(str: string) {
    await this.page.type('#quicksearchbox', str)
    await this.page.waitForTimeout(1000)
    const searchBox = await this.page.$('#quicksearchbox')
    if (searchBox) {
      await searchBox.press('Enter')
      await this.page.waitForTimeout(2000)
    }
  }

  public async getRookieMailList() {
    const $ = await this.getTable()

    // 最後の月曜日
    const lastMonday = moment().startOf('week').startOf('day')

    return $('tr')
      .toArray()
      .filter((el) => lastMonday.isBefore(new Date($(el).find('.date').text())))
  }

  public async goDetailPage(id: string) {
    await this.page.click(id)
    await this.page.keyboard.press('Enter')
    await this.page.waitForTimeout(1500)
  }
  /**
   * 詳細ページで本文を取得する
   */
  public async getMessage() {
    return (await this.page.$('#messagebody pre')) !== null
      ? await this.page.$eval('#messagebody pre', (e) => e.textContent)
      : await this.page.evaluate(
          // @ts-ignore
          () => document.querySelector('#messagebody').innerText
        )
  }

  public async getTable() {
    return cheerio.load(
      await this.page.$eval('#messagelist', (e) => e.outerHTML)
    )
  }
}
