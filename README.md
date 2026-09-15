# Vendor Marketplace

A marketplace where customers book event vendors — photographers, DJs, caterers
and more — through preset packages with clear prices, reviews from real
bookings, and payment and messaging inside each booking.

## Run it on your computer

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) (the
   program that runs the app's database) and open it.
2. Install Node 22.22.2 or newer (the engine the app runs on) with the LTS
   installer from [nodejs.org](https://nodejs.org).
3. Open Terminal (the app where you type commands: press Cmd-Space, type
   "Terminal") and switch on the pnpm tool. Type your Mac password when asked;
   nothing shows while you type.
   ```
   sudo npm install --global corepack@latest
   ```
   ```
   sudo corepack enable
   ```
4. Get the code, then move into its folder. If your Mac offers to install
   developer tools, click Install and run the first command again.
   ```
   git clone https://github.com/hmalik-dev/vendor-marketplace.git
   ```
   ```
   cd vendor-marketplace
   ```
5. The `.env` file you were given (a settings file holding the app's keys) is
   the only other thing you need. Finder hides names starting with a dot, so
   if it is in your Downloads folder, move it with:
   ```
   mv ~/Downloads/.env .env
   ```
6. Start the app. The first run takes a few minutes:
   ```
   pnpm start
   ```
7. When the messages stop scrolling, open http://localhost:3000 in your browser.
8. To stop it, press Ctrl-C in Terminal or close the window. To start it again
   later: open Docker Desktop and Terminal, run `cd vendor-marketplace`, then
   `git pull` to get new code if you want it, then `pnpm start` — the same
   commands shown in steps 4 and 6, every time.

### If you see…

| Message                                                 | What to do                                                                    |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `command not found: pnpm` or `corepack`                 | Run both commands in step 3 again, then open a new Terminal window.           |
| `The app needs Node …`                                  | Install Node from [nodejs.org](https://nodejs.org), open a new Terminal.      |
| `Docker is not running`                                 | Open Docker Desktop, wait for the whale icon in the menu bar, then try again. |
| `The app will not start until these keys …`             | Ask the project owner for the `.env` file, then follow step 5.                |
| `port is already allocated` or `address already in use` | The app is already running in another Terminal window: close that one.        |

Developers: see [docs/development.md](docs/development.md).
