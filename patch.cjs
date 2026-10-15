const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const version = '2.0.29'
const marker = 'oc-desktop-usage-panel-v1'
const anchor = ';function _ue(e)'
const entry = 'out/renderer/assets/main-C3tqWr4m.js'
const resources = path.join(process.env.LOCALAPPDATA, 'Programs', '@opencode-aidesktop', 'resources')
const target = path.join(resources, 'app.asar')
const backup = path.join(process.env.LOCALAPPDATA, 'opencode-ui-patches', version, 'app.asar.before-usage')

function archive(buffer) {
  const size = buffer.readUInt32LE(12)
  const header = JSON.parse(buffer.subarray(16, 16 + size).toString('utf8'))
  const base = 8 + buffer.readUInt32LE(4)
  const find = (name) => name.split('/').reduce((node, key) => node.files[key], header)
  const read = (name) => {
    const node = find(name)
    return buffer.subarray(base + Number(node.offset), base + Number(node.offset) + node.size)
  }
  return { header, base, find, read }
}

function repack(buffer, name, replacement) {
  const input = archive(buffer)
  const files = []
  function visit(node) {
    for (const child of Object.values(node.files || {})) {
      if (child.files) visit(child)
      else if (child.offset !== undefined && !child.unpacked) files.push(child)
    }
  }
  visit(input.header)
  files.sort((a, b) => Number(a.offset) - Number(b.offset))
  const changed = input.find(name)
  const parts = []
  let offset = 0
  for (const file of files) {
    const content = file === changed ? replacement : buffer.subarray(input.base + Number(file.offset), input.base + Number(file.offset) + file.size)
    if (file === changed) {
      const blockSize = file.integrity?.blockSize || 4194304
      const hash = (data) => crypto.createHash('sha256').update(data).digest('hex')
      const blocks = []
      for (let i = 0; i < content.length; i += blockSize) blocks.push(hash(content.subarray(i, i + blockSize)))
      file.integrity = { algorithm: 'SHA256', hash: hash(content), blockSize, blocks }
    }
    file.offset = String(offset)
    file.size = content.length
    parts.push(content)
    offset += content.length
  }
  const json = Buffer.from(JSON.stringify(input.header))
  const padding = (4 - json.length % 4) % 4
  const header = Buffer.alloc(16 + json.length + padding)
  header.writeUInt32LE(4, 0)
  header.writeUInt32LE(8 + json.length + padding, 4)
  header.writeUInt32LE(4 + json.length + padding, 8)
  header.writeUInt32LE(json.length, 12)
  json.copy(header, 16)
  return Buffer.concat([header, ...parts])
}

function patched(buffer) {
  const input = archive(buffer)
  const metadata = JSON.parse(input.read('package.json'))
  if (metadata.version !== version) throw new Error(`Expected Desktop ${version}; found ${metadata.version}`)
  const original = input.read(entry).toString('utf8')
  if (original.includes(marker)) throw new Error('Usage panel patch is already installed')
  if (original.split(anchor).length !== 2 || !original.includes('gue=fI.compose(')) throw new Error('Renderer layout does not match this patch')
  const factory = fs.readFileSync(path.join(__dirname, 'renderer.cjs'), 'utf8')
  const insertion = `;gue.push({id:"${marker}",renderer:c9((()=>{const module={exports:{}};${factory}\nreturn module.exports({Slot:CI,Panel:vI,createEffect:T,onCleanup:A})})())})`
  return repack(buffer, entry, Buffer.from(original.replace(anchor, insertion + anchor)))
}

function main() {
  const mode = process.argv[2] || 'stage'
  const source = fs.readFileSync(target)
  if (mode === 'stage') {
    const result = patched(source)
    const directory = path.join(process.env.LOCALAPPDATA, 'Temp', 'opencode', 'desktop-usage-smoke')
    fs.mkdirSync(directory, { recursive: true })
    const output = path.join(directory, 'app.asar.staged')
    fs.writeFileSync(output, result)
    const verify = archive(fs.readFileSync(output))
    if (!verify.read(entry).includes(Buffer.from(marker))) throw new Error('Staged patch verification failed')
    console.log(`Staged Desktop ${version} usage panel: ${output}`)
    return
  }
  if (!['install', 'restore'].includes(mode)) throw new Error('Use stage, install, or restore')
  const { execFileSync } = require('node:child_process')
  const processes = execFileSync('powershell.exe', ['-NoProfile', '-Command', 'Get-Process OpenCode -ErrorAction SilentlyContinue | ForEach-Object { $_.Path }; exit 0'], { encoding: 'utf8' })
  if (processes.toLowerCase().includes(path.dirname(resources).toLowerCase())) throw new Error('Exit OpenCode Desktop before applying or restoring the patch')
  if (mode === 'restore') {
    if (!archive(source).read(entry).includes(Buffer.from(marker))) throw new Error('Current Desktop does not contain this patch; refusing to overwrite it')
    const original = fs.readFileSync(backup)
    if (JSON.parse(archive(original).read('package.json')).version !== version) throw new Error('Backup version mismatch')
    if (!source.equals(patched(original))) throw new Error('Desktop changed after this patch was installed; refusing to overwrite later changes')
    fs.copyFileSync(backup, target)
    console.log('Original Desktop package restored')
    return
  }
  const result = patched(source)
  if (fs.existsSync(backup)) {
    if (!source.equals(fs.readFileSync(backup))) throw new Error('Existing backup differs from current Desktop; refusing to overwrite it')
  } else {
    fs.mkdirSync(path.dirname(backup), { recursive: true })
    fs.writeFileSync(backup, source, { flag: 'wx' })
  }
  const temporary = target + '.usage-staged'
  fs.writeFileSync(temporary, result)
  fs.renameSync(temporary, target)
  console.log('Desktop usage panel installed; original package backed up')
}

if (require.main === module) {
  try { main() } catch (error) { console.error(error.message); process.exitCode = 1 }
}

module.exports = { archive, repack, patched }
