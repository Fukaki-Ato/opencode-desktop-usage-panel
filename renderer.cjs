function usagePanel(api) {
  const number = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
  const tokens = (value) => ({
    input: number(value?.input),
    output: number(value?.output),
    reasoning: number(value?.reasoning),
    read: number(value?.cache?.read),
    write: number(value?.cache?.write),
  })
  const total = (value) => value.input + value.output + value.reasoning + value.read + value.write
  const hit = (value) => value.input + value.read > 0 ? value.read / (value.input + value.read) : null
  const compact = (value) => new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
  const exact = (value) => new Intl.NumberFormat('zh-CN').format(value)
  const percent = (value) => value === null ? '--' : `${(value * 100).toFixed(1)}%`
  const currency = (value) => typeof value === 'number' && Number.isFinite(value) ? `$${value.toFixed(4)}` : '--'

  function metrics(info, messages) {
    const rows = messages.filter((item) => item.type === 'assistant' && item.tokens)
      .filter((item) => !info?.revert?.messageID || item.id < info.revert.messageID)
      .map((item) => ({ id: item.id, model: item.model?.id || 'unknown', tokens: tokens(item.tokens), cost: item.cost }))
      .sort((left, right) => left.id.localeCompare(right.id))
    const sum = rows.reduce((acc, row) => {
      for (const key of Object.keys(acc)) acc[key] += row.tokens[key]
      return acc
    }, tokens())
    const usage = info?.tokens ? tokens(info.tokens) : sum
    return { usage, total: total(usage), hit: hit(usage), cost: info?.cost, rows, authoritative: !!info?.tokens }
  }

  function node(tag, text, className) {
    const element = document.createElement(tag)
    if (text !== undefined) element.textContent = text
    if (className) element.className = className
    return element
  }

  function setup(ctx) {
    const panelKey = `${ctx.id}:main`
    const read = (session) => metrics(session.server.data.session.get(session.id), session.server.data.session.message.list(session.id) || [])

    ctx.add(api.Slot, {
      at: 'session.header',
      order: 11,
      render(input) {
        const button = node('button', '', 'oc-usage-summary')
        button.type = 'button'
        button.dataset.desktopUsage = 'summary'
        button.title = '查看当前会话的 Token 与缓存明细'
        button.addEventListener('click', () => ctx.layout.toggle(panelKey, input.session))
        api.createEffect(() => {
          const data = read(input.session)
          button.textContent = `缓存 ${percent(data.hit)} · ${compact(data.total)} Token`
          button.setAttribute('aria-expanded', String(ctx.layout.state(panelKey, input.session) === 'visible'))
        })
        return button
      },
    })

    ctx.add(api.Panel, {
      id: 'main',
      region: 'side',
      list(input) {
        return input.open.includes('main') ? [{ id: 'main', title: 'Token 用量', closable: true }] : []
      },
      render(input) {
        const root = node('section', undefined, 'oc-usage-panel')
        root.dataset.desktopUsage = 'panel'
        api.createEffect(() => {
          const session = input.session
          const data = read(session)
          const latest = data.rows.at(-1)
          const fragment = document.createDocumentFragment()
          fragment.append(node('h2', 'Token 用量'))
          fragment.append(node('p', '当前会话累计，不含子代理', 'oc-usage-muted'))
          const rate = node('div', undefined, 'oc-usage-rate')
          rate.append(node('strong', percent(data.hit)), node('span', '缓存读取占比'))
          fragment.append(rate)
          const meter = node('div', undefined, 'oc-usage-meter')
          meter.setAttribute('role', 'meter')
          meter.setAttribute('aria-label', '缓存读取占比')
          meter.setAttribute('aria-valuemin', '0')
          meter.setAttribute('aria-valuemax', '100')
          if (data.hit !== null) meter.setAttribute('aria-valuenow', String(data.hit * 100))
          const fill = node('div')
          fill.style.width = `${(data.hit || 0) * 100}%`
          meter.append(fill)
          fragment.append(meter)
          const grid = node('dl', undefined, 'oc-usage-grid')
          for (const [label, value] of [
            ['总 Token', exact(data.total)],
            ['会话费用', currency(data.cost)],
            ['未缓存输入', exact(data.usage.input)],
            ['缓存读取', exact(data.usage.read)],
            ['缓存写入', exact(data.usage.write)],
            ['可见输出', exact(data.usage.output)],
            ['推理 Token', exact(data.usage.reasoning)],
            ['最近一轮命中', latest ? percent(hit(latest.tokens)) : '--'],
          ]) {
            const cell = node('div')
            cell.append(node('dt', label), node('dd', value))
            grid.append(cell)
          }
          fragment.append(grid)
          if (!data.authoritative) fragment.append(node('p', '会话累计尚未同步，暂显示已加载消息之和。', 'oc-usage-muted'))
          fragment.append(node('h3', '最近调用'))
          fragment.append(node('p', '仅当前已加载消息，最多展示 12 条', 'oc-usage-muted'))
          if (!data.rows.length) fragment.append(node('p', '尚无带用量的响应。', 'oc-usage-muted'))
          for (const row of data.rows.slice(-12).reverse()) {
            const item = node('div', undefined, 'oc-usage-call')
            item.append(node('div', row.model, 'oc-usage-model'))
            item.append(node('div', `命中 ${percent(hit(row.tokens))} · ${compact(total(row.tokens))} Token · ${currency(row.cost)}`))
            item.append(node('small', `输入 ${exact(row.tokens.input)} / 读 ${exact(row.tokens.read)} / 写 ${exact(row.tokens.write)} / 输出 ${exact(row.tokens.output)} / 推理 ${exact(row.tokens.reasoning)}`, 'oc-usage-muted'))
            fragment.append(item)
          }
          fragment.append(node('p', '缓存读取占比 = 缓存读取 /（未缓存输入 + 缓存读取），不含缓存写入。输出与推理分别统计。费用使用 OpenCode 记录值，不一定等于服务商账单。', 'oc-usage-note'))
          root.replaceChildren(fragment)
        })
        return root
      },
    })

    ctx.add({ kind: 'registry', id: 'style' }, `
      .oc-usage-summary{border:0;background:transparent;color:var(--v2-text-text-base,var(--text-base));font:inherit;font-size:12px;padding:5px 8px;border-radius:6px;white-space:nowrap;cursor:pointer}
      .oc-usage-summary:hover{background:var(--v2-background-bg-layer-03,rgba(128,128,128,.12))}
      .oc-usage-summary:focus-visible{outline:2px solid #57b9a4;outline-offset:2px}
      .oc-usage-panel{padding:20px;overflow:auto;height:100%;box-sizing:border-box;color:var(--v2-text-text-base,var(--text-base));font:inherit;font-size:12px}
      .oc-usage-panel h2{font-size:18px;font-weight:600;margin:0 0 5px}.oc-usage-panel h3{font-size:13px;font-weight:600;margin:24px 0 5px}
      .oc-usage-muted{color:var(--v2-text-text-faint,var(--text-weak));font-size:11px;margin:0 0 12px;overflow-wrap:anywhere}
      .oc-usage-rate{display:flex;align-items:baseline;gap:10px;margin-top:24px}.oc-usage-rate strong{font-size:36px;line-height:1.2;font-weight:600;color:#57b9a4}.oc-usage-rate span{font-size:12px}
      .oc-usage-meter{height:6px;border-radius:4px;background:rgba(128,128,128,.18);overflow:hidden;margin:12px 0 22px}.oc-usage-meter>div{height:100%;background:#57b9a4}
      .oc-usage-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 12px;margin:0}.oc-usage-grid dt{font-size:11px;color:var(--v2-text-text-faint,var(--text-weak))}.oc-usage-grid dd{margin:4px 0 0;font-size:17px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
      .oc-usage-call{padding:10px 0;border-bottom:1px solid rgba(128,128,128,.18);line-height:1.8}.oc-usage-model{font-weight:500;overflow-wrap:anywhere}.oc-usage-call small{display:block;margin:2px 0}
      .oc-usage-note{font-size:11px;line-height:1.7;color:var(--v2-text-text-faint,var(--text-weak));margin-top:24px}
    `)
  }

  setup.metrics = metrics
  return setup
}

module.exports = usagePanel
