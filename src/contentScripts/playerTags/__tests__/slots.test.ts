import { beforeEach, describe, expect, it } from 'vitest'
import { ANCHOR_CLASS, findNameSlots, ownText } from '../slots'

const DIPLO = `
<div class="diplo-form"><div class="players"><table>
  <thead><tr><th class="player-country"></th><th class="player-name">玩家</th></tr></thead>
  <tbody>
    <tr><td class="player-country"></td><td class="player-name">henryla</td><td>9</td></tr>
    <tr><td class="player-country"></td><td class="player-name">This_is_Nato</td><td>14</td></tr>
  </tbody>
</table></div></div>`

const SCORE = `
<div class="score-wrapper"><table>
  <thead><tr><th></th><th class="player-name" data-r-tooltip="玩家名稱。">玩家</th></tr></thead>
  <tbody>
    <tr><td></td><td class="player-name" data-r-tooltip="玩家名稱。">fu000009</td></tr>
    <tr><td></td><td class="player-name" data-r-tooltip="玩家名稱。">
      ok_computer
    </td></tr>
  </tbody>
</table></div>`

const LOBBY = `
<div class="player-slots">
  <div class="player-slot player-slot-header"><div class="player-header-players">玩家</div></div>
  <div class="player-slot">
    <div class="rank-indicator" data-r-tooltip="leeeee : 未參加排名"></div>
    <div class="player-name"><div class="select disabled"><div class="select-value"><div>leeeee</div></div></div></div>
  </div>
  <div class="player-slot">
    <div class="rank-indicator" data-r-tooltip="ok_computer : 未參加排名"></div>
    <input type="text" class="player-name" readonly value="ok_computer">
  </div>
  <div class="player-slot">
    <div class="rank-indicator"></div>
    <div class="player-name"><div class="select disabled"><div class="select-value"><div>開放</div></div></div></div>
  </div>
  <div class="player-slot">
    <div class="rank-indicator"></div>
    <div class="player-name"><div class="select disabled"><div class="select-value"><div>關閉</div></div></div></div>
  </div>
</div>`

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('ownText', () => {
  it('ignores element children (e.g. our anchor)', () => {
    document.body.innerHTML = `<table><tr><td class="x"> bob <span class="${ANCHOR_CLASS}">敵人</span></td></tr></table>`
    expect(ownText(document.querySelector('.x')!)).toBe('bob')
  })
})

describe('findNameSlots', () => {
  it('finds in-game diplomacy rows, skipping the header th', () => {
    document.body.innerHTML = DIPLO
    const slots = findNameSlots()
    expect(slots.map(s => s.name)).toEqual(['henryla', 'This_is_Nato'])
    expect(slots.every(s => s.mode === 'inline' && s.host.tagName === 'TD')).toBe(true)
  })

  it('finds score-screen rows and trims whitespace', () => {
    document.body.innerHTML = SCORE
    expect(findNameSlots().map(s => s.name)).toEqual(['fu000009', 'ok_computer'])
  })

  it('finds occupied lobby slots only (div + input variants)', () => {
    document.body.innerHTML = LOBBY
    const slots = findNameSlots()
    expect(slots.map(s => [s.name, s.mode])).toEqual([
      ['leeeee', 'inline'],
      ['ok_computer', 'after-input'],
    ])
    expect(slots[0].host.parentElement!.classList.contains('select-value')).toBe(true)
    expect(slots[1].host.tagName).toBe('INPUT')
  })

  it('ignores td.player-name outside the known screens', () => {
    document.body.innerHTML = `<table><tr><td class="player-name">random</td></tr></table>`
    expect(findNameSlots()).toEqual([])
  })

  it('still reads the name after our anchor was appended', () => {
    document.body.innerHTML = DIPLO
    const td = document.querySelector('tbody td.player-name')!
    const a = document.createElement('span')
    a.className = ANCHOR_CLASS
    a.textContent = '-敵人'
    td.appendChild(a)
    expect(findNameSlots()[0].name).toBe('henryla')
  })
})
