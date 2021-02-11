import moment from 'moment'

import Asana from './src/api/Asana.js'
import WebMailPage from './src/pages/WebMailPage'
import { AZING, ASANA, MAIL_LIST, SUPPORTERS } from './config.json'

type Mail = { rookie: string; supporter: string; body: string }

async function getMails(): Promise<Mail[]> {
  const mails: Mail[] = []

  const page = new WebMailPage()

  const { USERNAME, PASSWORD, URL } = AZING.WEB_MAIL
  await page.open(URL, USERNAME, PASSWORD)

  await page.login(AZING.ACCOUNT.USERNAME, AZING.ACCOUNT.PASSWORD)

  await page.filterMailList('training')

  const list = await page.getRookieMailList()
  const $ = await page.getTable()

  for (const row of list) {
    // メアドを取得
    const senderMail = $(row).find('.rcmContactAddress').attr('title')
    const rookie = MAIL_LIST.find((m) => m.email === senderMail)

    if (rookie) {
      console.log(`getMails - ${rookie.name}`)

      await page.goDetailPage(`#${$(row).attr('id')}`)

      const body = await page.getMessage()

      mails.push({ rookie: rookie.name, supporter: rookie.support, body })

      await page.pageBack()
    }
  }

  await page.close()

  return mails
}

/**
 * 取得したメールからタスクを作成する
 */
async function updateAsana(mails: Mail[]) {
  // 既存セクション取得
  const sections = await Asana.getSections()
  const nextFriday = moment().endOf('week').subtract(1, 'days')
  const formatted = nextFriday.format('YYYY/MM/DD')
  let _nextSection = sections.find((s) => s.name.includes(formatted))

  if (!_nextSection) {
    // セクション作成
    console.log(`createSection`)

    const count = sections.filter((s) => s.name.includes('メール送信')).length
    _nextSection = await Asana.createSection(
      `メール送信${count + 1}回目 ${formatted}`
    )
  }

  const nextSection = _nextSection!

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
