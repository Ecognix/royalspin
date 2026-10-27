export const GAMES = [
  ['crash', 'Crash', '#7a1fa2,#ff4d6d'],
  ['color', 'Color Trading', '#e53935,#8e44ad'],
  ['dice', 'Dice', '#0f6bff,#12c2e9'],
  ['mines', 'Mines', '#0b8f5a,#9be15d'],
  ['limbo', 'Limbo', '#ff7a18,#ffd200'],
  ['keno', 'Keno', '#6a3df0,#c471ed'],
  ['flip', 'Coin Flip', '#444c5c,#9aa5b8'],
]

export const ICON = {
  crash: <><path d="M10 85 Q40 80 60 55 T95 12" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" /><circle cx="95" cy="12" r="6" fill="#fff" /></>,
  color: <><circle cx="32" cy="38" r="18" fill="#2e9e5b" stroke="#fff" strokeWidth="3" /><circle cx="68" cy="38" r="18" fill="#e53935" stroke="#fff" strokeWidth="3" /><circle cx="50" cy="62" r="18" fill="#8e44ad" stroke="#fff" strokeWidth="3" /></>,
  dice: <><rect x="22" y="18" width="56" height="56" rx="12" fill="#fff" /><g fill="#0f6bff"><circle cx="38" cy="34" r="5" /><circle cx="62" cy="34" r="5" /><circle cx="50" cy="46" r="5" /><circle cx="38" cy="58" r="5" /><circle cx="62" cy="58" r="5" /></g></>,
  mines: <><path d="M50 14 L78 36 L66 70 L34 70 L22 36Z" fill="#fff" opacity=".92" /><path d="M50 14 L50 70 M22 36 L78 36" stroke="#0b8f5a" strokeWidth="3" /></>,
  limbo: <><path d="M18 70 L50 20 L82 70 L50 58Z" fill="#fff" /><circle cx="50" cy="42" r="6" fill="#ff7a18" /></>,
  keno: <g fill="#fff"><circle cx="30" cy="28" r="7" /><circle cx="50" cy="28" r="7" opacity=".5" /><circle cx="70" cy="28" r="7" /><circle cx="30" cy="48" r="7" opacity=".5" /><circle cx="50" cy="48" r="7" /><circle cx="70" cy="48" r="7" opacity=".5" /><circle cx="30" cy="68" r="7" /><circle cx="50" cy="68" r="7" opacity=".5" /><circle cx="70" cy="68" r="7" /></g>,
  flip: <><circle cx="50" cy="42" r="27" fill="#f2c230" stroke="#fff3b0" strokeWidth="5" /><text x="50" y="52" textAnchor="middle" fontSize="28" fontWeight="800" fill="#6b4a00">H</text></>,
}
