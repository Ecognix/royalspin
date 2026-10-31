# Royal Spin (play-money casino demo, Next.js)

Next.js 14 App Router project. All money is dummy play coins.

## Run
```bash
npm install
npm run dev
```
- Player app: http://localhost:3000
- Admin console: http://localhost:3000/console (default login `admin` / `admin123`, change it under Security)

## Structure
```
app/
  layout.js, globals.css
  page.js                player app entry
  console/page.js        separate admin portal route
components/
  App.js                 auth, header + profile dropdown menu, game dashboard
  Games.js               Dice, Limbo, Mines, Keno, Coin Flip, live Crash, Color Trading
  Pages.js               Wallet (UPI QR + UTR), Vault, Wager, Bonus, Profile, Settings
  Admin.js               admin panel
  meta.js                game list and tile icons
lib/
  db.js                  data layer (localStorage now, Supabase later), place()/pay()
  fair.js                RNG, Crash schedule, Color Trading results and payouts
  tick.js                background settlement of Crash and Colour bets
```

The font is Inter via `next/font/google` (downloaded by Next at dev/build time, so the machine needs internet the first time).

## Games
Crash and Color Trading are shared-clock games: every player sees the same round and
result because they derive from a public seed (`lib/fair.js`) plus the time.
Color Trading: 30s periods, last 5s locked. Green/Red 1.96x, Violet 4.4x, number 8.8x,
Big (5-9) / Small (0-4) 1.96x. 0 and 5 count as red/green at 1.47x and also as violet.
Admin controls house edge, limits and on/off per game, equally for all players.

## Supabase setup
Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`
(see `.env.example`) and create the database tables using `supabase-schema.sql`.

## Deposit and referral rules
For an existing Supabase database, run `referrals_and_deposit_rules_migration.sql` in the
Supabase SQL Editor before deploying the referral signup flow. New databases should use
`supabase-schema.sql`. Each approved deposit credits the deposit amount plus ₹500 to the
wallet and requires wagering twice the deposit amount before withdrawal. No new deposit or
welcome bonus is added to the bonus balance. Referral links award the referring player 5%
of each referred player's approved deposit.
