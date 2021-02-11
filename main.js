// @ts-check
const puppeteer = require('puppeteer')
const cheerio = require('cheerio')
const moment = require('moment')
const Asana = require('./asana')
const { AZING, ASANA, MAIL_LIST, SUPPORTERS } = require('./config.json')

async function getMails() {
  // prettier-ignore
  const browser = await puppeteer.launch({ headless: false, defaultViewport: null })
  const page = await browser.newPage()
  const { USERNAME, PASSWORD } = AZING.WEB_MAIL
  // prettier-ignore
  const Authorization = `Basic ` + Buffer.from(`${USERNAME}:${PASSWORD}`).toString("base64")
  await page.setExtraHTTPHeaders({ Authorization })
  await page.goto(AZING.WEB_MAIL.URL)

  {
    // ログイン
    await page.type('#rcmloginuser', AZING.ACCOUNT.USERNAME)
    await page.type('#rcmloginpwd', AZING.ACCOUNT.PASSWORD)
    await page.click('#rcmloginsubmit')
    await page.waitForNavigation({ waitUntil: 'domcontentloaded' })
  }
  {
    // 絞り込み
    await page.type('#quicksearchbox', 'training')
    await page.waitForTimeout(1000)
    await (await page.$('#quicksearchbox')).press('Enter')
    await page.waitForTimeout(2000)
  }

  const html = await page.$eval('#messagelist', (e) => e.outerHTML)
  const $ = cheerio.load(html)

  const lastMonday = moment().startOf('week').startOf('day')
  const rows = $('tr')
    .toArray()
    .filter((el) => lastMonday.isBefore(new Date($(el).find('.date').text())))

  const mails = []

  for (const row of rows) {
    const senderMail = $(row).find('.rcmContactAddress').attr('title')
    const rookie = MAIL_LIST.find((m) => m.email === senderMail)

    if (rookie) {
      console.log(`getMails - ${rookie.name}`)

      await page.click('#' + $(row).attr('id'))
      await page.keyboard.press('Enter')
      await page.waitForTimeout(1500)

      const body =
        (await page.$('#messagebody pre')) !== null
          ? await page.$eval('#messagebody pre', (e) => e.textContent)
          : await page.evaluate(
              // @ts-ignore
              () => document.querySelector('#messagebody').innerText
            )
      mails.push({ rookie: rookie.name, supporter: rookie.support, body })

      await page.click('#rcmbtn108')
      await page.waitForTimeout(1500)
    }
  }

  await browser.close()
  return mails
}

/**
 * 取得したメールからタスクを作成する
 * @param {{ rookie: string, supporter: string, body: string}[]} mails
 */
async function updateAsana(mails) {
  // 既存セクション取得
  const sections = await Asana.getSections()
  const nextFriday = moment().endOf('week').subtract(1, 'days')
  const formatted = nextFriday.format('YYYY/MM/DD')
  let nextSection = sections.find((s) => s.name.includes(formatted))

  if (!nextSection) {
    // セクション作成
    console.log(`createSection`)

    const count = sections.filter((s) => s.name.includes('メール送信')).length
    nextSection = await Asana.createSection(
      `メール送信${count + 1}回目 ${formatted}`
    )
  }
  // 既存タスク取得
  const tasks = await Asana.getTasksFromSection(nextSection.gid)
  const allTasks = tasks.concat(
    ...(await Promise.all(tasks.map((t) => Asana.getSubTasks(t.gid))))
  )

  // タスク作成
  for (const supporter of SUPPORTERS) {
    const myRookies = MAIL_LIST.filter((m) => m.support === supporter.name)

    const common = {
      assignee: supporter.gid,
      projects: [ASANA.PROJECT_ID],
      due_on: nextFriday.format('YYYY-MM-DD'),
    }

    if (myRookies.length > 1) {
      // 担当が２人以上の時はサブタスク作成
      const name = `${supporter.name}`
      let task = allTasks.find((t) => t.name === name)

      if (!task) {
        console.log(`createTask: ${supporter.name}`)
        task = await Asana.createTask({ name, ...common })
        await Asana.addTaskToSection(nextSection.gid, { task: task.gid })
      }

      for (const rookie of myRookies) {
        const mail = mails.find((m) => m.rookie === rookie.name)
        let name = `${rookie.name}`
        const subTask = allTasks.find((t) => t.name.includes(name))
        name += mail ? '★' : ''
        const data = { name, notes: mail?.body ?? '', assignee: supporter.gid }

        if (subTask) {
          console.log(`updateTask: ${supporter.name}-${rookie.name}`)
          await Asana.updateTask(subTask.gid, data)
        } else {
          console.log(`createSubTask: ${supporter.name}-${rookie.name}`)
          await Asana.createSubTask(task.gid, data)
        }
      }
    } else {
      // 担当が１人のみ
      for (const rookie of myRookies) {
        const mail = mails.find((m) => m.rookie === rookie.name)
        let name = `${supporter.name}(${rookie.name})`
        const task = allTasks.find((t) => t.name.includes(name))
        name += mail ? '★' : ''

        if (task) {
          console.log(`updateTask: ${supporter.name}-${rookie.name}`)
          await Asana.updateTask(task.gid, {
            name,
            notes: task.notes || mail?.body || '',
          })
        } else {
          console.log(`createTask: ${supporter.name}-${rookie.name}`)
          const data = { name, notes: mail?.body ?? '', ...common }
          const newTask = await Asana.createTask(data)
          await Asana.addTaskToSection(nextSection.gid, { task: newTask.gid })
        }
      }
    }
  }
}

async function main() {
  try {
    const mails = await getMails()
    await updateAsana(mails)
  } catch (e) {
    console.error(e)
  }
}
main()
