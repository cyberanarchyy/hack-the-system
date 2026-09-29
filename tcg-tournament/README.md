# TCG Tournament 🃏

A phone-first tournament app for trading card games (Pokémon, Magic, Yu-Gi-Oh!, One Piece, Lorcana, etc.).
No account, no server, and it works offline. Install it on your home screen like a normal app.

## Features

- **Players**: add one at a time or paste a whole list. Rename, drop, or re-enter players.
- **Swiss pairings**: players are grouped by points, rematches are avoided, and the bye goes to the lowest-ranked player who hasn't had one yet.
- **Round timer**: big countdown, pause, ±1 and +5 minutes. It beeps and vibrates at 5 minutes left and at time, keeps the screen awake while running, and keeps counting if you close the app.
- **Results**: tap a match to enter 2-0, 2-1, 1-0, draws, and so on. Bo1, Bo3, and Bo5 are supported.
- **Standings**: 3 points for a win, 1 for a draw. Tiebreakers are OMW%, GW%, and OGW% with a 33% floor.
- **Top cut**: single elimination for Top 2/4/8/16/32, seeded so 1st and 2nd can only meet in the finals.
- **Season leaderboard**: combines every tournament into one ranking, with a top 3 podium. Sort by points, titles, win %, or events played, and filter by game. Tap a player to see each event they played: record, placing, top cut, and titles. Players are matched by name, and names from earlier events are suggested when you register so they stay consistent.
- **Share standings** through your phone's share sheet, and **export/import** a tournament as a `.json` backup.
- Automatic number of Swiss rounds (based on player count), or choose your own.

## Put it on your phone

The app is plain HTML/CSS/JS, so any static host works. The easiest is **GitHub Pages**:

1. On GitHub, go to **Settings → Pages**.
2. Under *Build and deployment*, choose **Deploy from a branch**, pick your branch and the `/ (root)` folder, then Save.
3. After a minute, open `https://<your-username>.github.io/hack-the-system/tcg-tournament/` on your phone.
4. Add it to your home screen:
   - **iPhone (Safari)**: Share → *Add to Home Screen*
   - **Android (Chrome)**: ⋮ menu → *Install app* / *Add to Home screen*

After the first visit, it works without internet.

### Run locally

```bash
cd tcg-tournament
python3 -m http.server 8000
# open http://localhost:8000 (or http://<your-computer-ip>:8000 from your phone on the same Wi-Fi)
```

## Notes

- Tournament data is stored **only on the device** (browser local storage). Use **Settings → Export** to back it up or move it to another phone, and don't clear browser data in the middle of an event.
- Phones pause web pages that are in the background. The timer still shows the correct time when you come back, but the alarm sound can only play while the app is open. Keep it on screen during rounds (it keeps the screen awake for you).
- Your phone must not be on silent for the beep. Vibration works on Android but not on iPhone (Safari doesn't support it).
