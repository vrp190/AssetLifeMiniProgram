// 分类与图标。
// iOS 端用 SF Symbols，小程序无法使用，这里改成 Emoji（跨平台一致、零资源体积）。

const CATEGORIES = [
  { name: '数码', icon: '💻' },
  { name: '家电', icon: '🧊' },
  { name: '家具', icon: '🛏️' },
  { name: '厨具', icon: '🍳' },
  { name: '服饰', icon: '👕' },
  { name: '运动', icon: '🏃' },
  { name: '乐器', icon: '🎸' },
  { name: '图书', icon: '📚' },
  { name: '玩具', icon: '🧩' },
  { name: '交通', icon: '🚲' },
  { name: '健康', icon: '❤️' },
  { name: '其他', icon: '📦' }
]

const DEFAULT_ICON = '📦'
const UNCATEGORIZED = '未分类'
const ICON_CHOICES = [
  '📦', '💻', '🖥️', '⌨️', '🖱️', '📱', '🎧', '📷', '🕹️', '⌚',
  '🧊', '🛏️', '🪑', '🛋️', '🍳', '☕', '🍲', '🧴', '👕', '👟',
  '🧢', '🎒', '🏃', '🚲', '🛴', '🏋️', '🎸', '🎹', '📚', '🧩',
  '❤️', '💊', '🪥', '🪞', '🕯️', '🌿', '🐱', '🐶', '✈️', '🧰'
]

function names() {
  return CATEGORIES.map(function (item) { return item.name })
}

function iconFor(category) {
  for (let i = 0; i < CATEGORIES.length; i++) {
    if (CATEGORIES[i].name === category) return CATEGORIES[i].icon
  }
  return DEFAULT_ICON
}

function displayCategory(category) {
  return String(category || '').trim() || UNCATEGORIZED
}

module.exports = {
  CATEGORIES,
  DEFAULT_ICON,
  UNCATEGORIZED,
  ICON_CHOICES,
  names,
  iconFor,
  displayCategory
}
