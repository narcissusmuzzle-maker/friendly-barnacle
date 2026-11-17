// Служба «будильник»: её запускает система в момент окончания таймера, даже если экран погашен и приложение закрыто.
//  - вибрирует — ВСЕГДА, без всяких проверок (раньше служба молча выходила, если «поколение» будильника не совпадало, и вибрация
//    могла пропасть; теперь отменяет лишние будильники страница, а служба только вибрирует);
//  - сама ничего не ставит: все будильники (на несколько ближайших границ вперёд) расставляет страница, см. core.alarmPlan;
//  - пишет строку в журнал (файл lg_s.txt), чтобы потом на экране журнала было видно: служба запускалась или нет, во сколько и принял ли
//    вибромотор команду. Журнал пишется ПОСЛЕ вибрации и любая его ошибка на вибрацию не влияет.
// Параметр: вид|граница в секундах (UTC)|сколько границ ещё впереди (-1 — без ограничения). Старый вид «вид|поколение|период[|n]» тоже годится.
// Служба живёт доли секунды, поэтому ничего тяжёлого здесь нет.
import * as sensor from '@zos/sensor'
import { readFileSync, writeFileSync } from '@zos/fs'

const LOG_FILE = 'lg_s.txt'
const LOG_MAX = 60

/** Команда вибромотору: основная сцена, а если не вышло — запасная. Возвращает 'ok' или 'E:причина'. */
function buzz() {
  let v = null
  try { v = new sensor.Vibrator() } catch (e) { return 'E:noV ' + String(e).slice(0, 20) }
  const mode = sensor.VIBRATOR_SCENE_STRONG_REMINDER !== undefined ? sensor.VIBRATOR_SCENE_STRONG_REMINDER : sensor.VIBRATOR_SCENE_DURATION_LONG
  try {
    v.start({ mode: mode })
    return 'ok'
  } catch (e) {
    try { v.setMode({ mode: mode }); v.start(); return 'ok2' } catch (e2) { return 'E:' + String(e2).slice(0, 24) }
  }
}

/** Дописать строку в журнал службы (последние LOG_MAX). Формат строки: «миллисекунды|текст». */
function logLine(ms, text) {
  try {
    let old = ''
    try { old = readFileSync({ path: LOG_FILE, options: { encoding: 'utf8' } }) } catch (e) { old = '' }
    const lines = typeof old === 'string' && old ? old.split('\n').filter((s) => s.indexOf('|') > 0) : []
    lines.push(Math.round(ms) + '|' + String(text).replace(/[\r\n|]+/g, ' '))
    const cut = lines.length > LOG_MAX ? lines.slice(lines.length - LOG_MAX) : lines
    writeFileSync({ path: LOG_FILE, data: cut.join('\n') + '\n', options: { encoding: 'utf8' } })
  } catch (e) { /* журнал не критичен */ }
}

AppService({
  onInit(param) {
    const now = Date.now()
    const res = buzz()
    try {
      const parts = String(param || '').split('|')
      const kind = parts[0] || '?'
      let b = +parts[1] || 0
      if (b < 1000000000) b = 0   // старый вид параметра: вместо границы там было «поколение»
      const late = b ? ' +' + Math.round(now / 1000 - b) + 's' : ''
      logLine(now, 'S ' + kind + late + ' ' + res)
    } catch (e) { /* журнал не критичен */ }
  },
  onDestroy() {}
})
